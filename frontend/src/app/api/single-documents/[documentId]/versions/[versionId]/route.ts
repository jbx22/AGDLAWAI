import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentVersions } from "@/db/schema";
import { errorToResponse } from "@/lib/http-error";
import { requireDocumentAccess } from "../../../_helpers";
import { and, eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string; versionId: string }> },
) {
  try {
    const { documentId, versionId } = await params;
    const access = await requireDocumentAccess(documentId);
    if ("error" in access) return access.error;

    const body = (await req.json().catch(() => null)) as { display_name?: unknown } | null;
    const raw = body?.display_name;
    const displayName = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 200) : null;

    const [version] = await db
      .update(documentVersions)
      .set({ display_name: displayName })
      .where(and(eq(documentVersions.id, versionId), eq(documentVersions.document_id, documentId)))
      .returning({
        id: documentVersions.id,
        version_number: documentVersions.version_number,
        source: documentVersions.source,
        created_at: documentVersions.created_at,
        display_name: documentVersions.display_name,
      });

    if (!version) return NextResponse.json({ detail: "Version not found" }, { status: 404 });
    return NextResponse.json(version);
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("PATCH /api/single-documents/[documentId]/versions/[versionId] error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
