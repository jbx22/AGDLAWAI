import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentEdits } from "@/db/schema";
import { downloadFile, uploadFile } from "@/lib/storage";
import { resolveTrackedChange } from "@/lib/docxTrackedChanges";
import { errorToResponse } from "@/lib/http-error";
import { loadActiveVersion, requireDocumentAccess, signedOrProxyUrl } from "../../../_helpers";
import { and, eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string; editId: string }> },
) {
  try {
    const { documentId, editId } = await params;
    const mode = req.nextUrl.pathname.endsWith("/accept") ? "accept" : "reject";
    const access = await requireDocumentAccess(documentId);
    if ("error" in access) return access.error;

    const [edit] = await db
      .select()
      .from(documentEdits)
      .where(and(eq(documentEdits.id, editId), eq(documentEdits.document_id, documentId)))
      .limit(1);
    if (!edit) return NextResponse.json({ detail: "Edit not found" }, { status: 404 });

    const active = await loadActiveVersion(documentId, access.doc.current_version_id);
    if (!active) return NextResponse.json({ detail: "No file to edit" }, { status: 404 });

    if (edit.status === "pending") {
      const bytes = await downloadFile(active.storage_path);
      if (!bytes) return NextResponse.json({ detail: "Document bytes not available" }, { status: 404 });

      const wIds = [edit.del_w_id, edit.ins_w_id].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      );
      const resolved = await resolveTrackedChange(Buffer.from(bytes), wIds, mode);
      if (resolved.found) {
        await uploadFile(
          active.storage_path,
          resolved.bytes.buffer.slice(
            resolved.bytes.byteOffset,
            resolved.bytes.byteOffset + resolved.bytes.byteLength,
          ) as ArrayBuffer,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
      }

      await db
        .update(documentEdits)
        .set({
          status: mode === "accept" ? "accepted" : "rejected",
          resolved_at: new Date(),
        })
        .where(eq(documentEdits.id, editId));
    }

    const remaining = await db
      .select({ id: documentEdits.id })
      .from(documentEdits)
      .where(and(eq(documentEdits.document_id, documentId), eq(documentEdits.status, "pending")));

    return NextResponse.json({
      ok: true,
      version_id: active.id,
      download_url: await signedOrProxyUrl(access.doc, active),
      remaining_pending: remaining.length,
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/single-documents/[documentId]/edits/[editId] error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
