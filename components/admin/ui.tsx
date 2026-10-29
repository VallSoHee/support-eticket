import Link from "next/link";
import type { ReactNode } from "react";

// Kumpulan elemen UI kecil yang dipakai semua halaman modul Admin, supaya gaya
// tabel/form/filter konsisten dengan halaman Admin/Petugas/Client yang sudah ada.
// Semua server-safe (tanpa hook); komponen yang butuh interaksi ada di file lain.

export const inputClass =
  "h-11 w-full rounded-2xl border border-line bg-field px-4 text-[14px] text-ink placeholder:text-[#9aa1b3] " +
  "outline-none transition focus:border-brand/60 focus:bg-white focus:ring-4 focus:ring-brand/10 " +
  "aria-[invalid=true]:border-brand";

export const primaryBtn =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white " +
  "shadow-[0_14px_30px_-10px_color-mix(in_srgb,var(--color-brand)_75%,transparent)] transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70";

export const ghostBtn =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-line bg-white px-5 text-[14px] font-semibold text-ink transition hover:border-brand hover:text-brand";

export const smallBtn =
  "rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-brand hover:text-brand";

export const smallDangerBtn =
  "rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-soft/60";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink">{title}</h2>
        {description && <p className="text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-white p-6 shadow-sm md:p-8 ${className}`}>{children}</div>;
}

export function TableShell({ children, minWidth = 640 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-white shadow-sm">
      <table className="w-full text-left text-[13px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, right = false }: { children?: ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}

export function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function Flash({ error, success }: { error?: string | null; success?: string | null }) {
  return (
    <>
      {error && (
        <div role="alert" className="rounded-2xl border border-brand/20 bg-brand-soft/70 px-4 py-3 text-[13px] font-medium text-brand-dark">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
          {success}
        </div>
      )}
    </>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[12px] text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-[12px] font-medium text-brand-dark">{error}</p>}
    </div>
  );
}

type InputProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  type?: "text" | "number" | "date" | "time";
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
};

export function InputField({ label, name, error, hint, type = "text", required = true, ...rest }: InputProps) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint}>
      <input id={name} name={name} type={type} required={required} aria-invalid={!!error} className={inputClass} {...rest} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  defaultValue,
  options,
  required = true,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint}>
      <select id={name} name={name} required={required} defaultValue={defaultValue} aria-invalid={!!error} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextareaField({
  label,
  name,
  error,
  hint,
  defaultValue,
  placeholder,
  rows = 5,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint}>
      <textarea
        id={name}
        name={name}
        required
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        aria-invalid={!!error}
        className={`${inputClass} h-auto resize-y py-3 leading-relaxed`}
      />
    </Field>
  );
}

/** Filter berbasis GET form: server-rendered, URL bisa di-bookmark, tanpa JS. */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
      {children}
      <div className="flex items-center gap-2">
        <button type="submit" className={primaryBtn}>
          Apply
        </button>
        <Link href={resetHref} className={ghostBtn}>
          Reset
        </Link>
      </div>
    </form>
  );
}

export function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-[150px] flex-1">
      <label htmlFor={`f-${name}`} className="mb-1.5 block text-[12px] font-semibold text-muted">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterInput({
  label,
  name,
  value,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  value?: string;
  type?: "text" | "date";
  placeholder?: string;
}) {
  return (
    <div className="min-w-[150px] flex-1">
      <label htmlFor={`f-${name}`} className="mb-1.5 block text-[12px] font-semibold text-muted">
        {label}
      </label>
      <input id={`f-${name}`} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} className={inputClass} />
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page" && k !== "error" && k !== "success") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex items-center justify-between text-[13px] text-muted">
      <span>
        {total} result{total === 1 ? "" : "s"} · page {Math.min(page, totalPages)} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={smallBtn}>
            Previous
          </Link>
        ) : (
          <span className={`${smallBtn} pointer-events-none opacity-40`}>Previous</span>
        )}
        {page < totalPages ? (
          <Link href={href(page + 1)} className={smallBtn}>
            Next
          </Link>
        ) : (
          <span className={`${smallBtn} pointer-events-none opacity-40`}>Next</span>
        )}
      </div>
    </div>
  );
}

/** Ambil integer page dari query string dengan aman. */
export function parsePage(v: string | undefined) {
  const n = Number.parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function dateFmt(d: Date, withTime = false) {
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
