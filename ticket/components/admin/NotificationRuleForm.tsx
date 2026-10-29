"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createAnnouncementAction,
  saveEventRuleAction,
  updateAnnouncementAction,
} from "@/lib/admin/notification-actions";
import type { MasterFormState } from "@/lib/admin/master-types";
import {
  ANNOUNCE_AUDIENCE_OPTIONS,
  ANNOUNCE_TARGET_OPTIONS,
  AUDIENCE_LABEL,
  PLACEHOLDERS,
  TARGETS,
  TARGET_LABEL,
  TITLE_MAX,
  MESSAGE_MAX,
  parseAudience,
  renderTemplate,
  type Audience,
  type EventDef,
  type NotifyVars,
  type Target,
} from "@/lib/notify/events";
import { Card, Field, InputField, inputClass, ghostBtn } from "@/components/admin/ui";
import { FormAlert, SubmitButton } from "@/components/auth/fields";

const initial: MasterFormState = {};

type RuleValues = { title: string; message: string; audience: Audience[]; target: Target; customPath: string | null };

type Props =
  | { kind: "event"; def: EventDef; rule: RuleValues & { enabled: boolean } }
  | { kind: "announcement"; mode: "create" | "edit"; rule?: RuleValues & { id: string; name: string } };

// Contoh isi untuk pratinjau — bukan data sungguhan.
const SAMPLE: NotifyVars = {
  ticket: "Cannot log in to the dashboard",
  client: "Rina Putri",
  actor: "Dimas",
  app: "Valify Web",
  priority: "High",
  preview: "Hi, I tried resetting my password but the email never arrived…",
};

export function NotificationRuleForm(props: Props) {
  const isEvent = props.kind === "event";
  const rule = props.rule;

  const action = isEvent
    ? saveEventRuleAction.bind(null, props.def.key)
    : props.mode === "create"
      ? createAnnouncementAction
      : updateAnnouncementAction.bind(null, props.rule!.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const fe = state.fieldErrors ?? {};

  const [title, setTitle] = useState(rule?.title ?? "");
  const [message, setMessage] = useState(rule?.message ?? "");
  const [target, setTarget] = useState<Target>(rule?.target ?? "DASHBOARD");

  const audienceOptions = isEvent ? props.def.audienceOptions : ANNOUNCE_AUDIENCE_OPTIONS;
  // Setelah error validasi, pilihan terakhir dikembalikan server (form React 19 di-reset setelah submit).
  const checked = state.values?.audience !== undefined ? parseAudience(state.values.audience) : (rule?.audience ?? []);
  const targetOptions: readonly Target[] = isEvent ? TARGETS : ANNOUNCE_TARGET_OPTIONS;

  const preview = isEvent ? renderTemplate(title, SAMPLE) : title.trim();
  const previewBody = isEvent ? renderTemplate(message, SAMPLE) : message.trim();

  return (
    <Card className="mx-auto max-w-2xl">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">
        {isEvent ? "Automatic notification" : props.mode === "create" ? "New announcement" : "Edit announcement"}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
        {isEvent ? props.def.label : props.mode === "create" ? "Create an announcement" : props.rule?.name}
      </h2>
      <p className="mt-1 text-[13px] text-muted">
        {isEvent
          ? props.def.when
          : "A message you send on demand — e.g. planned maintenance or an urgent notice. Save it as a template, then press “Send now” whenever you need it."}
      </p>

      <form action={formAction} className="mt-6 space-y-6">
        {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

        {isEvent && (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-field px-4 py-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={state.values ? state.values.enabled === "on" : props.rule.enabled}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span>
              <span className="block text-[14px] font-semibold text-ink">Send this notification</span>
              <span className="block text-[12px] text-muted">Turn off to stop it completely without losing your settings.</span>
            </span>
          </label>
        )}

        {!isEvent && (
          <InputField
            label="Template name"
            name="name"
            placeholder="e.g. Maintenance tonight"
            defaultValue={state.values?.name ?? props.rule?.name}
            error={fe.name?.[0]}
            hint="Only you see this — it labels the template in the list."
          />
        )}

        <Field label="Title" htmlFor="title" error={fe.title?.[0]}>
          <input
            id="title"
            name="title"
            required
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!fe.title}
            placeholder={isEvent ? "e.g. New ticket: {ticket}" : "e.g. Scheduled maintenance tonight"}
            className={inputClass}
          />
        </Field>

        <Field
          label="Message"
          htmlFor="message"
          error={fe.message?.[0]}
          hint={isEvent ? undefined : `Up to ${MESSAGE_MAX} characters.`}
        >
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            maxLength={MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-invalid={!!fe.message}
            placeholder={isEvent ? "e.g. {client} submitted a ticket for {app}." : "e.g. The system will be down from 22:00 to 23:00 WIB."}
            className={`${inputClass} h-auto resize-y py-3 leading-relaxed`}
          />
        </Field>

        {isEvent && (
          <div className="-mt-3 rounded-2xl bg-field px-4 py-3 text-[12px] text-muted">
            <p className="font-semibold text-ink">Placeholders you can use in the title and message</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {PLACEHOLDERS.map((p) => (
                <li key={p.key}>
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink">{`{${p.key}}`}</code> {p.hint}
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 block text-[13px] font-semibold text-ink">{isEvent ? "Who receives it" : "Send to"}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {audienceOptions.map((a) => (
              <label key={a} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line px-4 py-3 text-[13px] font-medium text-ink transition hover:border-brand/50 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40">
                <input type="checkbox" name="audience" value={a} defaultChecked={checked.includes(a)} className="h-4 w-4 accent-[var(--color-brand)]" />
                {AUDIENCE_LABEL[a]}
              </label>
            ))}
          </div>
          {fe.audience?.[0] && <p className="mt-1.5 text-[12px] font-medium text-brand-dark">{fe.audience[0]}</p>}
          {isEvent && <p className="mt-1.5 text-[12px] text-muted">The person who triggers the action never gets a notification for it, except when they are the only intended recipient.</p>}
        </fieldset>

        <SelectFieldControlled
          value={target}
          onChange={(v) => setTarget(v as Target)}
          error={fe.target?.[0]}
          options={targetOptions.map((t) => ({ value: t, label: TARGET_LABEL[t] }))}
        />

        {target === "CUSTOM" && (
          <InputField
            label="Custom path"
            name="customPath"
            placeholder={isEvent ? "/client/tickets/{ticketId}" : "/client/tickets"}
            defaultValue={state.values?.customPath ?? rule?.customPath ?? ""}
            error={fe.customPath?.[0]}
            hint={`A page inside this app, starting with “/”. Everyone who gets this notification is sent to the same path${isEvent ? "; {ticketId} is replaced with the ticket's id" : ""}.`}
          />
        )}
        {target === "TICKET" && (
          <p className="-mt-3 text-[12px] text-muted">Each person opens their own view of the ticket: clients go to My tickets, agents to their workspace, admins to Tickets.</p>
        )}

        {/* Pratinjau */}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">Preview</p>
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-brand-soft/30 px-4 py-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
                <path d="M10 19a2 2 0 0 0 4 0" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink">{preview || "Title"}</span>
              <span className="mt-0.5 line-clamp-2 block break-words text-[12px] leading-snug text-muted">{previewBody || "Message"}</span>
              <span className="mt-1 block text-[11px] text-muted">just now</span>
            </span>
          </div>
          {isEvent && <p className="mt-1.5 text-[12px] text-muted">Placeholders are shown with sample data.</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link href="/admin/notifications" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Cancel
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {!isEvent && (
              <button
                type="submit"
                name="intent"
                value="send"
                disabled={pending}
                onClick={(e) => {
                  if (!confirm("Save and send this notification now to the selected audience? This can't be undone.")) e.preventDefault();
                }}
                className={`${ghostBtn} h-12 disabled:opacity-60`}
              >
                Save &amp; send now
              </button>
            )}
            <SubmitButton pending={pending} arrow={false}>
              {isEvent ? "Save settings" : props.mode === "create" ? "Save" : "Update"}
            </SubmitButton>
          </div>
        </div>
      </form>
    </Card>
  );
}

// <select> terkontrol: perlu tahu pilihan saat ini untuk menampilkan/menyembunyikan kolom "Custom path".
function SelectFieldControlled({
  value,
  onChange,
  error,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label="When clicked, open" htmlFor="target" error={error}>
      <select id="target" name="target" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
