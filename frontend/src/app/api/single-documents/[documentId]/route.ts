import { NextRequest, NextResponse } from "next/server";
import { errorToResponse } from "@/lib/http-error";
import { deleteDocumentAndFiles, requireDocumentAccess } from "../_helpers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const access = await requireDocumentAccess(documentId);
    if ("error" in access) return access.error;

    await deleteDocumentAndFiles(documentId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("DELETE /api/single-documents/[documentId] error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
