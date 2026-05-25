import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/auth-helpers";
import { ensureDocAccess } from "@/app/api/access";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { downloadFile } from "@/lib/storage";
import { errorToResponse } from "@/lib/http-error";
import { loadActiveVersion } from "../_helpers";

export async function POST(req: NextRequest) {
  try {
    const { userId, userEmail } = await requireAuth();
    const body = (await req.json().catch(() => null)) as { document_ids?: unknown } | null;
    const documentIds = Array.isArray(body?.document_ids)
      ? body.document_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    if (documentIds.length === 0) {
      return NextResponse.json({ detail: "document_ids is required" }, { status: 400 });
    }

    const rows = await db.select().from(documents).where(inArray(documents.id, documentIds));
    const access = await Promise.all(
      rows.map(async (doc) => ({
        doc,
        access: await ensureDocAccess(doc, userId, userEmail),
      })),
    );
    const allowed = access.filter((item) => item.access.ok).map((item) => item.doc);
    if (allowed.length === 0) {
      return NextResponse.json({ detail: "No documents found" }, { status: 404 });
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    await Promise.all(
      allowed.map(async (doc) => {
        const version = await loadActiveVersion(doc.id, doc.current_version_id);
        if (!version) return;
        const bytes = await downloadFile(version.storage_path);
        if (bytes) zip.file(doc.filename, Buffer.from(bytes));
      }),
    );

    const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="documents.zip"',
      },
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/single-documents/download-zip error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
