import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/auth-helpers";
import { ensureDocAccess } from "@/app/api/access";
import { db } from "@/db";
import { documentVersions, documents } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  buildContentDisposition,
  deleteFile,
  downloadFile,
  getSignedUrl,
  normalizeDownloadFilename,
  uploadFile,
} from "@/lib/storage";
import { docxToPdf } from "@/lib/convert";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type DocumentRow = typeof documents.$inferSelect;
type VersionRow = typeof documentVersions.$inferSelect;

export async function requireDocumentAccess(documentId: string) {
  const { userId, userEmail } = await requireAuth();
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (!doc) {
    return { error: NextResponse.json({ detail: "Document not found" }, { status: 404 }) };
  }
  const access = await ensureDocAccess(doc, userId, userEmail);
  if (!access.ok) {
    return { error: NextResponse.json({ detail: "Document not found" }, { status: 404 }) };
  }
  return { userId, userEmail, doc };
}

export async function loadActiveVersion(
  documentId: string,
  currentVersionId: string | null,
  versionId?: string | null,
): Promise<VersionRow | null> {
  const targetVersionId = versionId || currentVersionId;
  if (!targetVersionId) return null;
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.id, targetVersionId), eq(documentVersions.document_id, documentId)))
    .limit(1);
  return version ?? null;
}

export function resolveDownloadFilename(
  originalFilename: string,
  displayName: string | null | undefined,
  versionNumber: number | null,
): string {
  const dot = originalFilename.lastIndexOf(".");
  const origExt = dot > 0 ? originalFilename.slice(dot) : "";
  if (displayName?.trim()) {
    const trimmed = normalizeDownloadFilename(displayName.trim());
    return /\.[a-z0-9]{1,6}$/i.test(trimmed) || !origExt ? trimmed : `${trimmed}${origExt}`;
  }
  if (!versionNumber || versionNumber < 1) return normalizeDownloadFilename(originalFilename);
  const stem = dot > 0 ? originalFilename.slice(0, dot) : originalFilename;
  const ext = dot > 0 ? originalFilename.slice(dot) : ".docx";
  return normalizeDownloadFilename(`${stem} [Edited V${versionNumber}]${ext}`);
}

export function contentTypeFor(filename: string, fileType?: string | null): string {
  const lower = `${filename}.${fileType ?? ""}`.toLowerCase();
  if (lower.includes(".pdf")) return "application/pdf";
  if (lower.includes(".docx")) return DOCX_CONTENT_TYPE;
  if (lower.includes(".doc")) return "application/msword";
  return "application/octet-stream";
}

export async function streamActiveDocument(
  doc: Pick<DocumentRow, "id" | "filename" | "file_type" | "current_version_id">,
  versionId: string | null,
  mode: "inline" | "attachment",
) {
  const active = await loadActiveVersion(doc.id, doc.current_version_id, versionId);
  if (!active) return NextResponse.json({ detail: "No file available" }, { status: 404 });

  const isOfficeDoc = doc.file_type === "docx" || doc.file_type === "doc";
  const storagePath = mode === "inline" && isOfficeDoc && active.pdf_storage_path
    ? active.pdf_storage_path
    : active.storage_path;
  const bytes = await downloadFile(storagePath);
  if (!bytes) return NextResponse.json({ detail: "Document bytes not available" }, { status: 404 });

  const filename = resolveDownloadFilename(doc.filename, active.display_name, active.version_number);
  const type = storagePath === active.pdf_storage_path ? "application/pdf" : contentTypeFor(filename, doc.file_type);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": buildContentDisposition(mode, filename),
    },
  });
}

export async function deleteDocumentAndFiles(documentId: string) {
  const versions = await db
    .select({
      storage_path: documentVersions.storage_path,
      pdf_storage_path: documentVersions.pdf_storage_path,
    })
    .from(documentVersions)
    .where(eq(documentVersions.document_id, documentId));

  await Promise.all(
    versions.flatMap((version) =>
      [version.storage_path, version.pdf_storage_path]
        .filter((path): path is string => typeof path === "string" && path.length > 0)
        .map((path) => deleteFile(path).catch(() => undefined)),
    ),
  );
  await db.delete(documents).where(eq(documents.id, documentId));
}

export async function signedOrProxyUrl(doc: DocumentRow, version: VersionRow) {
  const filename = resolveDownloadFilename(doc.filename, version.display_name, version.version_number);
  const signed = await getSignedUrl(version.storage_path, 3600, filename);
  return signed ?? `/api/single-documents/${doc.id}/docx${version.id ? `?version_id=${encodeURIComponent(version.id)}` : ""}`;
}

export async function nextVersionNumber(documentId: string) {
  const [latest] = await db
    .select({ version_number: documentVersions.version_number })
    .from(documentVersions)
    .where(eq(documentVersions.document_id, documentId))
    .orderBy(desc(documentVersions.version_number))
    .limit(1);
  return ((latest?.version_number ?? 1) || 1) + 1;
}

export function extension(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export async function renderPdfIfNeeded(
  userId: string,
  documentId: string,
  versionSlug: string,
  suffix: string,
  content: Buffer,
) {
  if (suffix === "pdf") return null;
  if (suffix !== "docx" && suffix !== "doc") return null;
  try {
    const pdf = await docxToPdf(content);
    const key = `converted-pdfs/${userId}/${documentId}/${versionSlug}.pdf`;
    await uploadFile(
      key,
      pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer,
      "application/pdf",
    );
    return key;
  } catch (error) {
    console.warn(`[versions/upload] PDF rendition skipped for ${documentId}:`, error);
    return null;
  }
}
