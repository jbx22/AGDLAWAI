import { NextRequest, NextResponse } from "next/server";
import { errorToResponse } from "@/lib/http-error";
import {
  extractDocumentText,
  missingModelApiKey,
  parseColumns,
  queryTabularCell,
  requireTabularReviewAccess,
  setCellByKey,
} from "../../_helpers";
import { db } from "@/db";
import { documents } from "@/db/schema";
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
    const documentId = typeof body.document_id === "string" ? body.document_id : "";
    const columnIndex = Number(body.column_index);
    if (!documentId || !Number.isFinite(columnIndex)) {
      return NextResponse.json({ detail: "document_id and column_index are required" }, { status: 400 });
    }

    const column = parseColumns(access.review).find((item) => item.index === columnIndex);
    if (!column) return NextResponse.json({ detail: "Column not found" }, { status: 400 });

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const { tabular_model, api_keys } = await getUserModelSettings(access.userId);
    const missingKey = missingModelApiKey(tabular_model, api_keys);
    if (missingKey) return NextResponse.json({ code: "missing_api_key", ...missingKey }, { status: 422 });

    await setCellByKey(reviewId, documentId, columnIndex, { status: "generating", content: null });
    const text = await extractDocumentText(documentId, doc.file_type);
    const result = await queryTabularCell(tabular_model, doc.filename, text, column, api_keys);
    if (!result) {
      await setCellByKey(reviewId, documentId, columnIndex, { status: "error" });
      return NextResponse.json({ detail: "Generation failed" }, { status: 500 });
    }
    await setCellByKey(reviewId, documentId, columnIndex, {
      content: JSON.stringify(result),
      status: "done",
    });
    return NextResponse.json(result);
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/tabular-review/[reviewId]/regenerate-cell error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
