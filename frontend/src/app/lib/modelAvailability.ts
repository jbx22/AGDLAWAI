import { MODELS, type ModelOption } from "../components/assistant/ModelToggle";
import type { ApiKeyState } from "@/app/lib/mikeApi";
import { getTierPolicy } from "@/lib/billing/plans";

export type ModelProvider = "claude" | "gemini" | "openai" | "deepseek";

export function getModelProvider(modelId: string): ModelProvider | null {
    const model = MODELS.find((m) => m.id === modelId);
    if (!model) return null;
    return modelGroupToProvider(model.group);
}

export function isModelAvailable(
    modelId: string,
    apiKeys: ApiKeyState,
    tier?: string | null,
): boolean {
    const provider = getModelProvider(modelId);
    if (!provider) return false;
    if (!isModelAllowedForTier(modelId, tier)) return false;
    return isProviderAvailable(provider, apiKeys);
}

export function isModelAllowedForTier(
    modelId: string,
    tier: string | null | undefined,
): boolean {
    const provider = getModelProvider(modelId);
    const policy = getTierPolicy(tier);
    if (provider === "deepseek") return policy.deepseek;
    if (provider === "openai") return policy.openai;
    return false;
}

export function isProviderAvailable(
    provider: ModelProvider,
    apiKeys: ApiKeyState,
): boolean {
    // DeepSeek is always available (platform-owned key)
    if (provider === "deepseek") return true;
    // For OpenAI, Claude, Gemini: user must have configured their own key
    return !!apiKeys[provider]?.configured;
}

export function providerLabel(provider: ModelProvider): string {
    if (provider === "deepseek") return "DeepSeek";
    if (provider === "claude") return "Anthropic (Claude)";
    if (provider === "openai") return "OpenAI";
    return "Google (Gemini)";
}

export function modelGroupToProvider(
    group: ModelOption["group"],
): ModelProvider {
    if (group === "DeepSeek") return "deepseek";
    if (group === "Anthropic") return "claude";
    if (group === "OpenAI") return "openai";
    return "gemini";
}
