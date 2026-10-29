import { authorizeApi } from "@/lib/auth/guards";
import { listNotifications } from "@/lib/notify/queries";

export const runtime = "nodejs";

// GET /api/notifications?limit=20 -> { items, unread } milik user yang login (semua role).
export async function GET(req: Request) {
  const guard = await authorizeApi();
  if (!guard.ok) return guard.response;

  const limit = Number.parseInt(new URL(req.url).searchParams.get("limit") ?? "20", 10);
  const page = await listNotifications(guard.user.id, Number.isFinite(limit) ? limit : 20);
  return Response.json(page, { headers: { "Cache-Control": "no-store" } });
}
