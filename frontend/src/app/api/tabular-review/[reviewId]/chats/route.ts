import { NextResponse } from "next/server";
import { requireAuth } from "@/app/api/auth-helpers";
import { db } from "@/db";
import { tabularReviewChats, tabularReviews } from "@/db/schema";
import { errorToResponse } from "@/lib/http-error";
import { desc, eq } from "drizzle-orm";

async function canAccessReview(reviewId: string, userId: string, userEmail: string) {
  const [review] = await db
    .select({
      id: tabularReviews.id,
      user_id: tabularReviews.user_id,
      shared_with: tabularReviews.shared_with,
    })
    .from(tabularReviews)
    .where(eq(tabularReviews.id, reviewId))
    .limit(1);
  if (!review) return false;
  if (review.user_id === userId) return true;
  const shared = Array.isArray(review.shared_with) ? review.shared_with.map(String) : [];
  return shared.includes(userEmail);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { userId, userEmail } = await requireAuth();
    const { reviewId } = await params;
    if (!(await canAccessReview(reviewId, userId, userEmail))) {
      return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    }

    const chats = await db
      .select()
      .from(tabularReviewChats)
      .where(eq(tabularReviewChats.review_id, reviewId))
      .orderBy(desc(tabularReviewChats.updated_at));
    return NextResponse.json(chats);
  } catch (err) {
    const response = errorToResponse(err);
    if (response) return response;
    console.error("GET /api/tabular-review/[reviewId]/chats error:", err);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
