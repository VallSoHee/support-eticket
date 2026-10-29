import type { TicketStatus } from "@/generated/prisma/enums";
import { STAGES, stageOf } from "@/lib/client/stages";

// Jalur progres 4 tahap. Tahap yang sudah lewat terisi, tahap sekarang berlingkar,
// sisanya kosong. Saat tiket selesai seluruh jalur berubah hijau.
export function TicketTrack({ status }: { status: TicketStatus }) {
  const current = stageOf(status);
  const finished = current === STAGES.length - 1;

  return (
    <ol className="grid grid-cols-4" aria-label="Ticket progress">
      {STAGES.map((stage, i) => {
        const reached = i <= current;
        const isCurrent = i === current;

        const node = finished
          ? "border-emerald-500 bg-emerald-500"
          : isCurrent
            ? "border-brand bg-white ring-4 ring-brand/15"
            : reached
              ? "border-brand bg-brand"
              : "border-line bg-white";
        const rail = finished ? "bg-emerald-500" : "bg-brand";

        return (
          <li
            key={stage.label}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex flex-col items-center gap-2.5 text-center"
          >
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute right-1/2 top-[7px] h-[2px] w-full ${i <= current ? rail : "bg-line"}`}
              />
            )}
            <span className={`relative z-10 h-4 w-4 rounded-full border-2 ${node}`} />
            <span className={`text-[12px] leading-tight sm:text-[13px] ${reached ? "font-semibold text-ink" : "text-muted"}`}>
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
