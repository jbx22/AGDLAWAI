import { NextResponse } from "next/server";
import { ensureDocAccess } from "@/app/api/access";
import { requireAuth } from "@/app/api/auth-helpers";
import { db } from "@/db";
import { documentVersions, documents } from "@/db/schema";
import { errorToResponse } from "@/lib/http-error";
import {
  buildContentDisposition,
  downloadFile,
} from "@/lib/storage";
import { verifyDownload } from "@/lib/downloadTokens";
import { eq } from "drizzle-orm";

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { userId, userEmail } = await requireAuth();
    const { token } = await params;
    const info = verifyDownload(token);
    if (!info) {
      return NextResponse.json({ detail: "Invalid link" }, { status: 404 });
    }

    const [version] = await db
      .select({
        id: documentVersions.id,
        document_id: documentVersions.document_id,
      })
      .from(documentVersions)
      .where(eq(documentVersions.storage_path, info.path))
      .limit(1);

    if (!version) {
      return NextResponse.json({ detail: "File not found" }, { status: 404 });
    }

    const [doc] = await db
      .select({
        id: documents.id,
        user_id: documents.user_id,
        project_id: documents.project_id,
      })
      .from(documents)
      .where(eq(documents.id, version.document_id))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ detail: "File not found" }, { status: 404 });
    }

    const access = await ensureDocAccess(doc, userId, userEmail);
    if (!access.ok) {
      return NextResponse.json({ detail: "File not found" }, { status: 404 });
    }

    const raw = await downloadFile(info.path);
    if (!raw) {
      return NextResponse.json({ detail: "File not found" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(raw), {
      headers: {
        "Content-Type": contentTypeFor(info.filename),
        "Content-Disposition": buildContentDisposition(
          "attachment",
          info.filename,
        ),
      },
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /download/[token] error:", err);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 },
    );
  }
}
