import { NextRequest, NextResponse } from "next/server";
import { downloadFile } from "@/lib/storage";
import { extractTrackedChangeIds } from "@/lib/docxTrackedChanges";
import { errorToResponse } from "@/lib/http-error";
import { loadActiveVersion, requireDocumentAccess } from "../../_helpers";

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

    const bytes = await downloadFile(version.storage_path);
    if (!bytes) return NextResponse.json({ detail: "Document bytes not available" }, { status: 404 });

    return NextResponse.json({ ids: await extractTrackedChangeIds(Buffer.from(bytes)) });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/single-documents/[documentId]/tracked-change-ids error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
