import { NextRequest, NextResponse } from "next/server";
import { errorToResponse } from "@/lib/http-error";
import {
  buildTabularMessages,
  buildTabularStore,
  createSseStream,
  extractTabularAnnotations,
  generateTabularTitle,
  missingModelApiKey,
  parseMessages,
  requireTabularReviewAccess,
  runLLMStream,
  TABULAR_TOOLS,
  createServerSupabase,
} from "../../_helpers";
import { db } from "@/db";
import { tabularReviewChatMessages, tabularReviewChats } from "@/db/schema";
import { getUserModelSettings } from "@/lib/userSettings";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { reviewId } = await params;
    const access = await requireTabularReviewAccess(reviewId);
    if ("error" in access) return access.error;

    const body = await req.json();
    const messages = parseMessages(body.messages);
    const lastUser = [...messages].reverse().find((message) => message.role === "user" && message.content?.trim());
    if (!lastUser?.content?.trim()) {
      return NextResponse.json({ detail: "messages must include a user message" }, { status: 400 });
    }

    const { tabular_model, title_model, api_keys } = await getUserModelSettings(access.userId);
    const missingKey = missingModelApiKey(tabular_model, api_keys);
    if (missingKey) return NextResponse.json({ code: "missing_api_key", ...missingKey }, { status: 422 });

    let chatId = typeof body.chat_id === "string" && body.chat_id ? body.chat_id : null;
    let chatTitle: string | null = null;
    if (chatId) {
      const [existing] = await db
        .select()
        .from(tabularReviewChats)
        .where(eq(tabularReviewChats.id, chatId))
        .limit(1);
      if (!existing || existing.review_id !== reviewId) chatId = null;
      else chatTitle = existing.title;
    }
    if (!chatId) {
      const [created] = await db
        .insert(tabularReviewChats)
        .values({ review_id: reviewId, user_id: access.userId })
        .returning({ id: tabularReviewChats.id, title: tabularReviewChats.title });
      chatId = created.id;
      chatTitle = created.title;
    }

    await db.insert(tabularReviewChatMessages).values({
      chat_id: chatId,
      role: "user",
      content: lastUser.content,
    });

    const tabularStore = await buildTabularStore(access.review);
    const apiMessages = buildTabularMessages(messages, tabularStore, access.review.title ?? "Untitled Review");

    return createSseStream(async (write) => {
      write(`data: ${JSON.stringify({ type: "chat_id", chatId })}\n\n`);
      try {
        const { fullText, events } = await runLLMStream({
          apiMessages,
          docStore: new Map(),
          docIndex: {},
          userId: access.userId,
          db: createServerSupabase(),
          write,
          extraTools: TABULAR_TOOLS,
          tabularStore,
          buildCitations: (text) => extractTabularAnnotations(text, tabularStore),
          model: tabular_model,
          apiKeys: api_keys,
        });
        const annotations = extractTabularAnnotations(fullText, tabularStore);
        await db.insert(tabularReviewChatMessages).values({
          chat_id: chatId,
          role: "assistant",
          content: events.length ? events : null,
          annotations: annotations.length ? annotations : null,
        });
        await db.update(tabularReviewChats).set({ updated_at: new Date() }).where(eq(tabularReviewChats.id, chatId));

        const isFirstExchange = messages.filter((message) => message.role === "user").length === 1;
        if (isFirstExchange && !chatTitle) {
          const title = await generateTabularTitle(title_model, lastUser.content ?? "", access.review.title, api_keys);
          if (title) {
            await db.update(tabularReviewChats).set({ title }).where(eq(tabularReviewChats.id, chatId));
            write(`data: ${JSON.stringify({ type: "chat_title", chatId, title })}\n\n`);
          }
        }
      } catch (error) {
        console.error("POST /api/tabular-review/[reviewId]/chat stream error:", error);
        write(`data: ${JSON.stringify({ type: "error", message: String(error) })}\n\n`);
        write("data: [DONE]\n\n");
      }
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/tabular-review/[reviewId]/chat error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
