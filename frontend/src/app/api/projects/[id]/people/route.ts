import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/app/api/auth-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { errorToResponse } from "@/lib/http-error";
import { getUserById, getUsersByEmails } from "@/lib/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) return NextResponse.json({ detail: "Project not found" }, { status: 404 });
    const ownerUser = await getUserById(project.user_id);
    const emails = Array.isArray(project.shared_with) ? project.shared_with.map(String) : [];
    const memberUsers = await getUsersByEmails(emails);
    const owner = ownerUser
      ? { user_id: ownerUser.id, email: ownerUser.email, display_name: ownerUser.displayName }
      : { user_id: project.user_id, email: null, display_name: null };
    const members = memberUsers.map((user) => ({
      email: user.email,
      display_name: user.displayName,
    }));
    return NextResponse.json({ owner, members });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/projects/[id]/people error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
