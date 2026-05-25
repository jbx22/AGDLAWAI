import { NextRequest, NextResponse } from "next/server";
import { errorToResponse } from "@/lib/http-error";
import { requireDocumentAccess, streamActiveDocument } from "../../_helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const access = await requireDocumentAccess(documentId);
    if ("error" in access) return access.error;

    return await streamActiveDocument(
      access.doc,
      req.nextUrl.searchParams.get("version_id"),
      "attachment",
    );
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/single-documents/[documentId]/docx error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
