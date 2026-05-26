import { NextResponse } from "next/server";
import { errorToResponse } from "@/lib/http-error";
import {
  createSseStream,
  extractDocumentText,
  loadReviewDocuments,
  missingModelApiKey,
  parseColumns,
  queryTabularCell,
  requireTabularReviewAccess,
  setCellByKey,
} from "../../_helpers";
import { getUserModelSettings } from "@/lib/userSettings";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { reviewId } = await params;
    const access = await requireTabularReviewAccess(reviewId);
    if ("error" in access) return access.error;

    const columns = parseColumns(access.review);
    if (!columns.length) {
      return NextResponse.json({ detail: "No columns configured" }, { status: 400 });
    }

    const { tabular_model, api_keys } = await getUserModelSettings(access.userId);
    const missingKey = missingModelApiKey(tabular_model, api_keys);
    if (missingKey) return NextResponse.json({ code: "missing_api_key", ...missingKey }, { status: 422 });

    const { cells, docs } = await loadReviewDocuments(access.review, access.userId, access.userEmail);
    const done = new Set(
      cells
        .filter((cell) => cell.status === "done" && cell.content)
        .map((cell) => `${cell.document_id}:${cell.column_index}`),
    );

    return createSseStream(async (write) => {
      try {
        for (const doc of docs) {
          const text = await extractDocumentText(doc.id, doc.file_type);
          for (const column of columns) {
            if (done.has(`${doc.id}:${column.index}`)) continue;
            write(`data: ${JSON.stringify({ type: "cell_update", document_id: doc.id, column_index: column.index, content: null, status: "generating" })}\n\n`);
            await setCellByKey(reviewId, doc.id, column.index, { status: "generating", content: null });
            const result = await queryTabularCell(tabular_model, doc.filename, text, column, api_keys);
            if (!result) {
              await setCellByKey(reviewId, doc.id, column.index, { status: "error" });
              write(`data: ${JSON.stringify({ type: "cell_update", document_id: doc.id, column_index: column.index, content: null, status: "error" })}\n\n`);
              continue;
            }
            await setCellByKey(reviewId, doc.id, column.index, {
              content: JSON.stringify(result),
              status: "done",
            });
            write(`data: ${JSON.stringify({ type: "cell_update", document_id: doc.id, column_index: column.index, content: result, status: "done" })}\n\n`);
          }
        }
        write("data: [DONE]\n\n");
      } catch (error) {
        console.error("POST /api/tabular-review/[reviewId]/generate stream error:", error);
        write(`data: ${JSON.stringify({ type: "error", message: String(error) })}\n\n`);
        write("data: [DONE]\n\n");
      }
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/tabular-review/[reviewId]/generate error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
