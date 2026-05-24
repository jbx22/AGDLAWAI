import type {
    LlmMessage,
    NormalizedToolCall,
    NormalizedToolResult,
    OpenAIToolSchema,
    StreamChatParams,
    StreamChatResult,
} from "./types";

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const MAX_OUTPUT_TOKENS = 16384;

type ChatCompletionMessage =
    | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
    | { role: "tool"; tool_call_id: string; content: string };

type ChatToolCall = {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
};

type ToolCallDelta = {
    index?: number;
    id?: string;
    type?: "function";
    function?: {
        name?: string;
        arguments?: string;
    };
};

type ChatStreamEvent = {
    choices?: {
        delta?: {
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: ToolCallDelta[];
        };
    }[];
};

type ChatCompletionResponse = {
    choices?: {
        message?: {
            content?: string | null;
            reasoning_content?: string | null;
        };
    }[];
};

function apiKey(override?: string | null): string {
    const key = override?.trim() || process.env.DEEPSEEK_API_KEY?.trim() || "";
    if (!key) {
        throw new Error(
            "DeepSeek API key is not configured. Set DEEPSEEK_API_KEY or add a user DeepSeek key.",
        );
    }
    return key;
}

function toMessages(systemPrompt: string, messages: LlmMessage[]): ChatCompletionMessage[] {
    const out: ChatCompletionMessage[] = [];
    if (systemPrompt.trim()) out.push({ role: "system", content: systemPrompt });
    for (const message of messages) {
        out.push({ role: message.role, content: message.content });
    }
    return out;
}

function extractSseJson(buffer: string): { events: unknown[]; rest: string } {
    const events: unknown[] = [];
    const chunks = buffer.split(/\n\n/);
    const rest = chunks.pop() ?? "";

    for (const chunk of chunks) {
        const dataLines = chunk
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());

        for (const data of dataLines) {
            if (!data || data === "[DONE]") continue;
            try {
                events.push(JSON.parse(data));
            } catch {
                // Leave malformed partial events buffered for the next read.
            }
        }
    }

    return { events, rest };
}

function parseToolCall(call: ChatToolCall): NormalizedToolCall {
    let input: Record<string, unknown> = {};
    try {
        const parsed = JSON.parse(call.function.arguments || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            input = parsed as Record<string, unknown>;
        }
    } catch {
        input = {};
    }

    return {
        id: call.id,
        name: call.function.name,
        input,
    };
}

function createToolAccumulator() {
    const calls: ChatToolCall[] = [];
    const started = new Set<number>();

    return {
        add(delta: ToolCallDelta, onStart?: (call: NormalizedToolCall) => void) {
            const index = delta.index ?? calls.length;
            calls[index] ??= {
                id: delta.id ?? `tool_call_${index}`,
                type: "function",
                function: { name: "", arguments: "" },
            };

            const current = calls[index];
            if (delta.id) current.id = delta.id;
            if (delta.type === "function") current.type = "function";
            if (delta.function?.name) current.function.name += delta.function.name;
            if (delta.function?.arguments) {
                current.function.arguments += delta.function.arguments;
            }

            if (!started.has(index) && current.function.name) {
                started.add(index);
                onStart?.(parseToolCall(current));
            }
        },
        list() {
            return calls.filter((call) => call.id && call.function.name);
        },
    };
}

async function createChatCompletion(params: {
    model: string;
    messages: ChatCompletionMessage[];
    tools?: OpenAIToolSchema[];
    stream?: boolean;
    maxTokens?: number;
    enableThinking?: boolean;
    apiKey: string;
}): Promise<Response> {
    const response = await fetch(DEEPSEEK_CHAT_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            tools: params.tools?.length ? params.tools : undefined,
            stream: params.stream,
            max_tokens: params.maxTokens ?? MAX_OUTPUT_TOKENS,
            thinking: params.enableThinking ? { type: "enabled" } : undefined,
            reasoning_effort: params.enableThinking ? "medium" : undefined,
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        const err = new Error(
            `DeepSeek request failed (${response.status}): ${text || response.statusText}`,
        );
        (err as { status?: number }).status = response.status;
        throw err;
    }

    return response;
}

export async function streamDeepSeek(
    params: StreamChatParams,
): Promise<StreamChatResult> {
    const {
        model,
        systemPrompt,
        tools = [],
        callbacks = {},
        runTools,
        apiKeys,
        enableThinking,
    } = params;
    const maxIter = params.maxIterations ?? 10;
    const key = apiKey(apiKeys?.deepseek);
    const messages = toMessages(systemPrompt, params.messages);
    let fullText = "";
    const hasTools = tools.length > 0;

    for (let iter = 0; iter < maxIter; iter++) {
        const response = await createChatCompletion({
            model,
            messages,
            tools,
            stream: true,
            enableThinking: !!enableThinking,
            apiKey: key,
        });
        if (!response.body) throw new Error("DeepSeek response had no body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const accumulator = createToolAccumulator();
        let buffer = "";
        let pendingText = "";
        let sawReasoning = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const extracted = extractSseJson(buffer);
            buffer = extracted.rest;

            for (const event of extracted.events as ChatStreamEvent[]) {
                const delta = event.choices?.[0]?.delta;
                if (!delta) continue;

                if (typeof delta.reasoning_content === "string") {
                    sawReasoning = true;
                    callbacks.onReasoningDelta?.(delta.reasoning_content);
                }

                if (typeof delta.content === "string") {
                    if (hasTools) {
                        pendingText += delta.content;
                    } else {
                        fullText += delta.content;
                        callbacks.onContentDelta?.(delta.content);
                    }
                }

                for (const toolDelta of delta.tool_calls ?? []) {
                    accumulator.add(toolDelta, callbacks.onToolCallStart);
                }
            }
        }

        if (sawReasoning) callbacks.onReasoningBlockEnd?.();

        const toolCalls = accumulator.list();
        if (!toolCalls.length || !runTools) {
            if (pendingText) {
                fullText += pendingText;
                callbacks.onContentDelta?.(pendingText);
            }
            break;
        }

        messages.push({
            role: "assistant",
            content: pendingText || null,
            tool_calls: toolCalls,
        });
        const results = await runTools(toolCalls.map(parseToolCall));
        for (const result of results) {
            messages.push({
                role: "tool",
                tool_call_id: result.tool_use_id,
                content: result.content,
            });
        }
    }

    return { fullText };
}

export async function completeDeepSeekText(params: {
    model: string;
    systemPrompt?: string;
    user: string;
    maxTokens?: number;
    apiKeys?: { deepseek?: string | null };
}): Promise<string> {
    const response = await createChatCompletion({
        model: params.model,
        messages: toMessages(params.systemPrompt ?? "", [
            { role: "user", content: params.user },
        ]),
        maxTokens: params.maxTokens ?? 512,
        apiKey: apiKey(params.apiKeys?.deepseek),
    });
    const json = (await response.json()) as ChatCompletionResponse;
    return json.choices?.[0]?.message?.content ?? "";
}

export type { NormalizedToolResult };
