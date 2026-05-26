import { NextResponse } from "next/server";
import { ensureReviewAccess, filterAccessibleDocumentIds } from "@/app/api/access";
import { requireAuth } from "@/app/api/auth-helpers";
import { db } from "@/db";
import {
  documents,
  documentVersions,
  tabularCells,
  tabularReviews,
} from "@/db/schema";
import { completeText, providerForModel, streamChatWithTools, type UserApiKeys } from "@/lib/llm";
import {
  extractPdfText,
  runLLMStream,
  TABULAR_TOOLS,
  type ChatMessage,
  type TabularCellStore,
} from "@/lib/chatTools";
import { createServerSupabase } from "@/lib/supabase";
import { downloadFile } from "@/lib/storage";
import { extractDocxBodyText } from "@/lib/docxTrackedChanges";
import { and, asc, eq, inArray } from "drizzle-orm";

export type ColumnConfig = {
  index: number;
  name: string;
  prompt: string;
  format?: string;
  tags?: string[];
};

export type CellResult = {
  summary: string;
  flag: "green" | "grey" | "yellow" | "red";
  reasoning: string;
};

type ReviewRow = typeof tabularReviews.$inferSelect;

function providerLabel(provider: ReturnType<typeof providerForModel>): string {
  if (provider === "claude") return "Anthropic";
  if (provider === "openai") return "OpenAI";
  if (provider === "deepseek") return "DeepSeek";
  return "Gemini";
}

function providerEnvKey(provider: ReturnType<typeof providerForModel>): string {
  if (provider === "claude") return "ANTHROPIC_API_KEY";
  return `${provider.toUpperCase()}_API_KEY`;
}

export function missingModelApiKey(model: string, apiKeys: UserApiKeys) {
  const provider = providerForModel(model);
  if (apiKeys[provider]?.trim() || process.env[providerEnvKey(provider)]?.trim()) return null;
  return {
    provider,
    model,
    detail: `${providerLabel(provider)} API key is required to use ${model}. Add an API key or select a different tabular review model.`,
  };
}

export async function requireTabularReviewAccess(reviewId: string) {
  const { userId, userEmail } = await requireAuth();
  const [review] = await db.select().from(tabularReviews).where(eq(tabularReviews.id, reviewId)).limit(1);
  if (!review) {
    return { error: NextResponse.json({ detail: "Review not found" }, { status: 404 }) };
  }
  const access = await ensureReviewAccess(
    {
      user_id: review.user_id,
      project_id: review.project_id,
      shared_with: Array.isArray(review.shared_with) ? review.shared_with.map(String) : [],
    },
    userId,
    userEmail,
  );
  if (!access.ok) {
    return { error: NextResponse.json({ detail: "Review not found" }, { status: 404 }) };
  }
  return { userId, userEmail, review, access };
}

export function parseColumns(review: Pick<ReviewRow, "columns_config">): ColumnConfig[] {
  return Array.isArray(review.columns_config)
    ? (review.columns_config as ColumnConfig[])
        .map((column) => ({
          index: Number(column.index),
          name: String(column.name ?? `Column ${column.index}`),
          prompt: String(column.prompt ?? ""),
          format: typeof column.format === "string" ? column.format : undefined,
          tags: Array.isArray(column.tags) ? column.tags.map(String) : undefined,
        }))
        .filter((column) => Number.isFinite(column.index))
        .sort((a, b) => a.index - b.index)
    : [];
}

export function parseCellContent(raw: unknown): { summary: string; flag?: string; reasoning?: string } | null {
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null && "summary" in raw) {
    const value = raw as { summary?: unknown; flag?: unknown; reasoning?: unknown };
    return {
      summary: String(value.summary ?? ""),
      flag: typeof value.flag === "string" ? value.flag : undefined,
      reasoning: typeof value.reasoning === "string" ? value.reasoning : "",
    };
  }
  if (typeof raw === "string") {
    try {
      return parseCellContent(JSON.parse(raw));
    } catch {
      return raw.trim() ? { summary: raw.trim() } : null;
    }
  }
  return null;
}

export async function loadActiveVersion(documentId: string) {
  const [doc] = await db
    .select({
      current_version_id: documents.current_version_id,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc?.current_version_id) return null;
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, doc.current_version_id))
    .limit(1);
  return version ?? null;
}

export async function extractDocumentText(documentId: string, fileType: string | null) {
  const active = await loadActiveVersion(documentId);
  if (!active) return "";
  const bytes = await downloadFile(active.storage_path);
  if (!bytes) return "";
  if (fileType === "pdf") return extractPdfText(bytes);
  const buffer = Buffer.from(bytes);
  const text = await extractDocxBodyText(buffer).catch(() => "");
  if (text.trim()) return text;
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function formatPromptSuffix(format?: string, tags?: string[]): string {
  switch (format) {
    case "bulleted_list":
      return ' The "summary" field must be a markdown bulleted list only.';
    case "number":
      return ' The "summary" field must be a single number only.';
    case "percentage":
      return ' The "summary" field must be a single percentage value only.';
    case "monetary_amount":
      return ' The "summary" field must be the monetary value only, including currency.';
    case "currency":
      return ' The "summary" field must contain only currency code(s), wrapped like [[SAR]].';
    case "yes_no":
      return ' The "summary" field must be [[Yes]] or [[No]] only.';
    case "date":
      return ' The "summary" field must be the date only.';
    case "tag":
      return tags?.length
        ? ` The "summary" field must contain exactly one tag from: ${tags.map((tag) => `[[${tag}]]`).join(", ")}.`
        : "";
    default:
      return "";
  }
}

function normalizeCellResult(raw: string): CellResult | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { summary?: unknown; value?: unknown; flag?: unknown; reasoning?: unknown };
    const flag = ["green", "grey", "yellow", "red"].includes(String(parsed.flag))
      ? (String(parsed.flag) as CellResult["flag"])
      : "grey";
    return {
      summary: String(parsed.summary ?? parsed.value ?? "").trim() || "Not Found",
      flag,
      reasoning: String(parsed.reasoning ?? ""),
    };
  } catch {
    return cleaned ? { summary: cleaned.slice(0, 800), flag: "grey", reasoning: "" } : null;
  }
}

export async function queryTabularCell(
  model: string,
  filename: string,
  documentText: string,
  column: ColumnConfig,
  apiKeys: UserApiKeys,
): Promise<CellResult | null> {
  const suffix = formatPromptSuffix(column.format, column.tags);
  const raw = await completeText({
    model,
    systemPrompt:
      "You are an Arabic-first legal document analyst for JBL BIZ LAW. Return only valid JSON with keys summary, flag, and reasoning. Write summary and reasoning in Arabic unless quoting source text verbatim. Use flag values green, grey, yellow, or red.",
    user: `Document: ${filename}\n\n${documentText.slice(0, 120_000)}\n\nInstruction: ${column.prompt}${suffix} If not found, state "Not Found".`,
    maxTokens: 2048,
    apiKeys,
  });
  return normalizeCellResult(raw);
}

export async function setCellByKey(
  reviewId: string,
  documentId: string,
  columnIndex: number,
  values: Partial<typeof tabularCells.$inferInsert>,
) {
  const rows = await db
    .select({ id: tabularCells.id })
    .from(tabularCells)
    .where(
      and(
        eq(tabularCells.review_id, reviewId),
        eq(tabularCells.document_id, documentId),
        eq(tabularCells.column_index, columnIndex),
      ),
    );
  const existing = rows.find(Boolean);
  if (existing) {
    await db.update(tabularCells).set(values).where(eq(tabularCells.id, existing.id));
  } else {
    await db.insert(tabularCells).values({
      review_id: reviewId,
      document_id: documentId,
      column_index: columnIndex,
      ...values,
    });
  }
}

export async function loadReviewDocuments(review: ReviewRow, userId: string, userEmail: string) {
  const cells = await db.select().from(tabularCells).where(eq(tabularCells.review_id, review.id));
  const cellDocIds = [...new Set(cells.map((cell) => cell.document_id))];
  const reviewDocIds = Array.isArray(review.document_ids) ? review.document_ids.map(String) : [];
  const docIds = [...new Set([...cellDocIds, ...reviewDocIds])];
  const allowedIds = new Set(await filterAccessibleDocumentIds(docIds, userId, userEmail));
  if (!allowedIds.size) return { cells, docs: [] as (typeof documents.$inferSelect)[] };
  const docs = await db
    .select()
    .from(documents)
    .where(inArray(documents.id, [...allowedIds]))
    .orderBy(asc(documents.created_at));
  return { cells, docs };
}

export function createSseStream(handler: (write: (line: string) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (line: string) => controller.enqueue(encoder.encode(line));
      try {
        await handler(write);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      role: String(item.role ?? "user"),
      content: typeof item.content === "string" ? item.content : "",
    }));
}

export async function buildTabularStore(review: ReviewRow): Promise<TabularCellStore> {
  const columns = parseColumns(review).map((column) => ({ index: column.index, name: column.name }));
  const cells = await db.select().from(tabularCells).where(eq(tabularCells.review_id, review.id));
  const docIds = [...new Set(cells.map((cell) => cell.document_id))];
  const docs = docIds.length
    ? await db
        .select({ id: documents.id, filename: documents.filename })
        .from(documents)
        .where(inArray(documents.id, docIds))
        .orderBy(asc(documents.created_at))
    : [];
  return {
    columns,
    documents: docs,
    cells: new Map(cells.map((cell) => [`${cell.column_index}:${cell.document_id}`, parseCellContent(cell.content)])),
  };
}

export function buildTabularMessages(messages: ChatMessage[], tabularStore: TabularCellStore, reviewTitle: string): unknown[] {
  const docList = tabularStore.documents.map((doc, index) => `- ROW:${index} "${doc.filename}"`).join("\n");
  const colList = tabularStore.columns.map((column, index) => `- COL:${index} "${column.name}"`).join("\n");
  const systemContent = `You are JBL BIZ LAW, an Arabic-first AI legal assistant. Answer in Arabic by default. You are helping with the tabular review "${reviewTitle}".

Use read_table_cells before answering questions about extracted cells.

DOCUMENTS:
${docList || "- none"}

COLUMNS:
${colList || "- none"}

When citing cell content, place [1], [2], etc. inline, then append a <CITATIONS> JSON block with ref, col_index, row_index, and quote. Omit citations if none are needed.`;
  return [{ role: "system", content: systemContent }, ...messages.map((message) => ({ role: message.role, content: message.content ?? "" }))];
}

type TabularCitation = { ref: number; col_index: number; row_index: number; quote: string };
const TABULAR_CITATIONS_BLOCK_RE = /<CITATIONS>\s*([\s\S]*?)\s*<\/CITATIONS>/;

export function extractTabularAnnotations(fullText: string, tabularStore: TabularCellStore) {
  const match = fullText.match(TABULAR_CITATIONS_BLOCK_RE);
  if (!match) return [];
  try {
    const citations = JSON.parse(match[1]) as TabularCitation[];
    return citations.map((citation) => ({
      type: "tabular_citation" as const,
      ref: citation.ref,
      col_index: citation.col_index,
      row_index: citation.row_index,
      col_name: tabularStore.columns[citation.col_index]?.name ?? `Col ${citation.col_index}`,
      doc_name: tabularStore.documents[citation.row_index]?.filename ?? `Row ${citation.row_index}`,
      quote: citation.quote,
    }));
  } catch {
    return [];
  }
}

export async function generateTabularTitle(model: string, firstMessage: string, reviewTitle: string | null, apiKeys: UserApiKeys) {
  const raw = await completeText({
    model,
    user: `Generate a short Arabic title, 3 to 6 words, for a tabular review chat.\nReview: ${reviewTitle ?? ""}\nMessage: ${firstMessage.slice(0, 500)}\nReturn only the title.`,
    maxTokens: 64,
    apiKeys,
  }).catch(() => "");
  return raw.trim().replace(/^["']|["']$/g, "") || null;
}

export { createServerSupabase, runLLMStream, streamChatWithTools, TABULAR_TOOLS };
