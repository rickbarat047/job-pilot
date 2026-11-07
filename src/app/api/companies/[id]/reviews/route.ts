import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { all, get, run, nowIso, newId } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
    const offset = (page - 1) * limit;

    const reviews = await all<{
      id: string;
      user_id: string;
      rating: number;
      title: string | null;
      comment: string | null;
      pros: string | null;
      cons: string | null;
      would_recommend: number;
      created_at: string;
      user_name: string | null;
    }>(
      `SELECT r.id, r.user_id, r.rating, r.title, r.comment, r.pros, r.cons, r.would_recommend, r.created_at,
              u.name as user_name
       FROM company_reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.company_id = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );

    const totalRow = await get<{ c: number }>("SELECT COUNT(*) as c FROM company_reviews WHERE company_id = ?", [
      id,
    ]);
    const total = Number(totalRow?.c ?? 0);

    const ratingRow = await get<{
      avg: number | null;
      count: number;
    }>(
      `SELECT AVG(r.rating) as avg, COUNT(*) as count FROM company_reviews r WHERE r.company_id = ?`,
      [id]
    );

    return NextResponse.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        pros: r.pros,
        cons: r.cons,
        wouldRecommend: Boolean(r.would_recommend),
        createdAt: r.created_at,
      })),
      total,
      page,
      limit,
      averageRating: ratingRow?.avg ? Math.round(ratingRow.avg * 10) / 10 : null,
      reviewCount: ratingRow?.count ?? 0,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch reviews." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const rating = Number(body.rating);
    const title = typeof body.title === "string" ? body.title.trim() : null;
    const comment = typeof body.comment === "string" ? body.comment.trim() : null;
    const pros = typeof body.pros === "string" ? body.pros.trim() : null;
    const cons = typeof body.cons === "string" ? body.cons.trim() : null;
    const wouldRecommend = body.wouldRecommended === true ? 1 : 0;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    }

    const now = nowIso();
    const id_ = newId("rev");

    const existing = await get<{ id: string }>("SELECT id FROM company_reviews WHERE company_id = ? AND user_id = ?", [
      id,
      user.id,
    ]);

    if (existing) {
      await run(
        `UPDATE company_reviews SET rating = ?, title = ?, comment = ?, pros = ?, cons = ?, would_recommend = ?, updated_at = ?
         WHERE id = ?`,
        [rating, title, comment, pros, cons, wouldRecommend, now, existing.id]
      );
      return NextResponse.json({ ok: true, message: "Review updated.", id: existing.id });
    }

    await run(
      `INSERT INTO company_reviews (id, company_id, user_id, rating, title, comment, pros, cons, would_recommend, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id_, id, user.id, rating, title, comment, pros, cons, wouldRecommend, now, now]
    );

    return NextResponse.json({ ok: true, message: "Review submitted.", id: id_ });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit review." }, { status: 400 });
  }
}