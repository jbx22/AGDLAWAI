import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { uploadFile, storageKey } from "@/lib/storage";
import { convertedPdfKey, docxToPdf } from "@/lib/convert";

const ALLOWED_TYPES = new Set(["pdf", "docx", "doc"]);
const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

type UploadedDocument = typeof documents.$inferSelect & {
  storage_path: string;
  pdf_storage_path: string | null;
};

export async function uploadDocumentForUser(
  req: NextRequest,
  userId: string,
  projectId: string | null,
): Promise<NextResponse> {
  const form = await req.formData();
  const maybeFile = form.get("file");
  if (!(maybeFile instanceof File)) {
    return NextResponse.json({ detail: "file is required" }, { status: 400 });
  }
  if (maybeFile.size > MAX_UPLOAD_SIZE_BYTES) {
    return NextResponse.json(
      { detail: "File is too large. Maximum upload size is 100 MB." },
      { status: 413 },
    );
  }

  const filename = sanitizeFilename(maybeFile.name);
  const suffix = getExtension(filename);
  if (!ALLOWED_TYPES.has(suffix)) {
    return NextResponse.json(
      { detail: `Unsupported file type: ${suffix || "unknown"}. Allowed: pdf, docx, doc` },
      { status: 400 },
    );
  }

  const content = Buffer.from(await maybeFile.arrayBuffer());
  const [doc] = await db
    .insert(documents)
    .values({
      project_id: projectId,
      user_id: userId,
      filename,
      file_type: suffix,
      size_bytes: content.byteLength,
      status: "processing",
    })
    .returning();

  try {
    const rawBuffer = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength,
    ) as ArrayBuffer;
    const key = storageKey(userId, doc.id, filename);
    await uploadFile(key, rawBuffer, contentTypeFor(suffix, maybeFile.type));

    const tree = await extractStructureTree(rawBuffer, suffix);
    const pageCount = suffix === "pdf" ? await countPdfPages(rawBuffer) : null;

    let pdfStoragePath: string | null = null;
    if (suffix === "pdf") {
      pdfStoragePath = key;
    } else {
      try {
        const pdfBuffer = await docxToPdf(content);
        const pdfKey = convertedPdfKey(userId, doc.id);
        const pdfArrayBuffer = pdfBuffer.buffer.slice(
          pdfBuffer.byteOffset,
          pdfBuffer.byteOffset + pdfBuffer.byteLength,
        ) as ArrayBuffer;
        await uploadFile(pdfKey, pdfArrayBuffer, "application/pdf");
        pdfStoragePath = pdfKey;
      } catch (err) {
        console.warn(`[upload] PDF rendition skipped for ${filename}:`, err);
      }
    }

    const [versionRow] = await db
      .insert(documentVersions)
      .values({
        document_id: doc.id,
        storage_path: key,
        pdf_storage_path: pdfStoragePath,
        source: "upload",
        version_number: 1,
        display_name: filename,
      })
      .returning({ id: documentVersions.id });

    const [updated] = await db
      .update(documents)
      .set({
        current_version_id: versionRow.id,
        size_bytes: content.byteLength,
        page_count: pageCount,
        structure_tree: tree ?? null,
        status: "ready",
        updated_at: new Date(),
      })
      .where(eq(documents.id, doc.id))
      .returning();

    return NextResponse.json(
      {
        ...updated,
        storage_path: key,
        pdf_storage_path: pdfStoragePath,
      } satisfies UploadedDocument,
      { status: 201 },
    );
  } catch (err) {
    await db
      .update(documents)
      .set({ status: "error", updated_at: new Date() })
      .where(eq(documents.id, doc.id));
    console.error("Document upload failed:", err);
    return NextResponse.json(
      { detail: "Document processing failed. Please try a smaller PDF, DOCX, or DOC file." },
      { status: 500 },
    );
  }
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim() || "document";
  return trimmed.replace(/[\x00-\x1F\x7F]/g, "_").replace(/[\\/]/g, "_");
}

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

function contentTypeFor(suffix: string, browserType: string): string {
  if (browserType) return browserType;
  if (suffix === "pdf") return "application/pdf";
  if (suffix === "doc") return "application/msword";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

async function countPdfPages(buf: ArrayBuffer): Promise<number | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
    const pdf = await (
      pdfjsLib as unknown as {
        getDocument: (opts: unknown) => { promise: Promise<{ numPages: number }> };
      }
    ).getDocument({ data: new Uint8Array(buf) }).promise;
    return pdf.numPages;
  } catch {
    return null;
  }
}

async function extractStructureTree(
  content: ArrayBuffer,
  fileType: string,
): Promise<unknown[] | null> {
  try {
    if (fileType === "pdf") {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
      const pdf = await (
        pdfjsLib as unknown as {
          getDocument: (opts: unknown) => {
            promise: Promise<{
              numPages: number;
              getOutline: () => Promise<{ title?: string }[] | null>;
            }>;
          };
        }
      ).getDocument({ data: new Uint8Array(content) }).promise;
      if (pdf.numPages <= 5) return null;
      const outline = await pdf.getOutline();
      if (outline?.length) {
        return outline.map((item, i) => ({
          id: `h1-${i}`,
          title: item.title ?? `Item ${i + 1}`,
          level: 1,
          page_number: null,
          children: [],
        }));
      }
      return Array.from({ length: pdf.numPages }, (_, i) => ({
        id: `page-${i + 1}`,
        title: `Page ${i + 1}`,
        level: 1,
        page_number: i + 1,
        children: [],
      }));
    }

    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(content),
    });
    const nodes = result.value
      .split("\n")
      .filter((line) => line.trim())
      .slice(0, 30)
      .map((line, i) => ({
        id: `h1-${i}`,
        title: line.slice(0, 100),
        level: 1,
        page_number: null,
        children: [],
      }));
    return nodes.length ? nodes : null;
  } catch {
    return null;
  }
}
