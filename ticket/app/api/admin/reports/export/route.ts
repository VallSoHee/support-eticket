import { authorizeApi } from "@/lib/auth/guards";
import { getReportRows, rowsToCsv } from "@/lib/admin/report";
import { writeAudit } from "@/lib/admin/audit";

// FR-7.4 — export CSV. proxy.ts sudah membatasi /api/admin ke ADMIN; authorizeApi
// adalah lapisan otoritatif yang membaca ulang user dari database (NFR-4).
export async function GET(request: Request) {
  const guard = await authorizeApi("ADMIN");
  if (!guard.ok) return guard.response;

  const sp = new URL(request.url).searchParams;
  const get = (k: string) => sp.get(k) || undefined;
  const filters = {
    from: get("from"),
    to: get("to"),
    categoryId: get("categoryId"),
    level: get("level"),
    priority: get("priority"),
    status: get("status"),
  };

  const { rows, truncated } = await getReportRows(filters);
  const csv = rowsToCsv(rows);

  await writeAudit({
    actorId: guard.user.id,
    action: "REPORT_EXPORT",
    entityType: "Report",
    entityId: "tickets-csv",
    description: `Exported ${rows.length} ticket(s) to CSV${truncated ? " (truncated)" : ""}. Filters: ${JSON.stringify(filters)}.`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tickets-report-${stamp}.csv"`,
      "Cache-Control": "no-store",
      ...(truncated ? { "X-Report-Truncated": "true" } : {}),
    },
  });
}
