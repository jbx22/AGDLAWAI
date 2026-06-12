import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/app/api/auth-helpers";
import { db } from "@/db";
import { tabularReviews } from "@/db/schema";
import { errorToResponse } from "@/lib/http-error";
import { getUserById, getUsersByEmails } from "@/lib/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  try {
    await requireAuth();
    const { reviewId } = await params;
    const [review] = await db.select().from(tabularReviews).where(eq(tabularReviews.id, reviewId)).limit(1);
    if (!review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const ownerUser = await getUserById(review.user_id);
    const emails = Array.isArray(review.shared_with) ? review.shared_with.map(String) : [];
    const memberUsers = await getUsersByEmails(emails);
    const owner = ownerUser
      ? { user_id: ownerUser.id, email: ownerUser.email, display_name: ownerUser.displayName }
      : { user_id: review.user_id, email: null, display_name: null };
    const members = memberUsers.map((user) => ({
      email: user.email,
      display_name: user.displayName,
    }));
    return NextResponse.json({ owner, members });
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/tabular-review/[reviewId]/people error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
