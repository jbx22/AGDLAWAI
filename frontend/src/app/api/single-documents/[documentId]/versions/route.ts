import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { documentVersions, documents } from "@/db/schema";
import { uploadFile, versionStorageKey } from "@/lib/storage";
import { errorToResponse } from "@/lib/http-error";
import {
  contentTypeFor,
  extension,
  nextVersionNumber,
  renderPdfIfNeeded,
  requireDocumentAccess,
} from "../../_helpers";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const access = await requireDocumentAccess(documentId);
    if ("error" in access) return access.error;

    const versions = await db
      .select({
        id: documentVersions.id,
        version_number: documentVersions.version_number,
        source: documentVersions.source,
        created_at: documentVersions.created_at,
        display_name: documentVersions.display_name,
      })
      .from(documentVersions)
      .where(eq(documentVersions.document_id, documentId))
      .orderBy(documentVersions.created_at);

    return NextResponse.json({
      current_version_id: access.doc.current_version_id,
      versions,
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/single-documents/[documentId]/versions error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const access = await requireDocumentAccess(documentId);
    if ("error" in access) return access.error;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ detail: "file is required" }, { status: 400 });
    }

    const suffix = extension(file.name);
    if (access.doc.file_type && suffix && access.doc.file_type !== suffix) {
      return NextResponse.json(
        { detail: `Uploaded file type (${suffix}) does not match document type (${access.doc.file_type}).` },
        { status: 400 },
      );
    }

    const content = Buffer.from(await file.arrayBuffer());
    const versionSlug = crypto.randomUUID().replace(/-/g, "");
    const key = versionStorageKey(access.userId, documentId, versionSlug, file.name);
    await uploadFile(
      key,
      content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer,
      contentTypeFor(file.name, suffix),
    );
    const pdfStoragePath = await renderPdfIfNeeded(access.userId, documentId, versionSlug, suffix, content);
    const versionNumber = await nextVersionNumber(documentId);
    const displayNameValue = form.get("display_name");
    const displayName = typeof displayNameValue === "string" && displayNameValue.trim()
      ? displayNameValue.trim().slice(0, 200)
      : file.name;

    const [version] = await db
      .insert(documentVersions)
      .values({
        document_id: documentId,
        storage_path: key,
        pdf_storage_path: suffix === "pdf" ? key : pdfStoragePath,
        source: "user_upload",
        version_number: versionNumber,
        display_name: displayName,
      })
      .returning({
        id: documentVersions.id,
        version_number: documentVersions.version_number,
        source: documentVersions.source,
        created_at: documentVersions.created_at,
        display_name: documentVersions.display_name,
      });

    const update: Partial<typeof documents.$inferInsert> = {
      current_version_id: version.id,
      updated_at: new Date(),
    };
    if (typeof displayNameValue === "string" && displayNameValue.trim()) {
      const normalized = displayNameValue.trim().slice(0, 200);
      update.filename = /\.[a-z0-9]{1,6}$/i.test(normalized)
        ? normalized
        : `${normalized}.${suffix || access.doc.file_type || "docx"}`;
    }
    await db.update(documents).set(update).where(eq(documents.id, documentId));

    return NextResponse.json(version, { status: 201 });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("POST /api/single-documents/[documentId]/versions error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
