import { NextRequest, NextResponse } from "next/server";
import { errorToResponse } from "@/lib/http-error";
import { loadActiveVersion, requireDocumentAccess, signedOrProxyUrl } from "../../_helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const access = await requireDocumentAccess(documentId);
    if ("error" in access) return access.error;

    const version = await loadActiveVersion(
      documentId,
      access.doc.current_version_id,
      req.nextUrl.searchParams.get("version_id"),
    );
    if (!version) return NextResponse.json({ detail: "No file available" }, { status: 404 });

    return NextResponse.json({
      url: await signedOrProxyUrl(access.doc, version),
      document_id: documentId,
      filename: access.doc.filename,
      version_id: version.id,
      has_pdf_rendition: !!version.pdf_storage_path,
    });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/single-documents/[documentId]/url error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
