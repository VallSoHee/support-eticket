"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createTicketAction } from "@/lib/client/ticket-actions";
import { PLATFORM_LABEL, PRIORITIES, PRIORITY_LABEL, URGENCY_HINT } from "@/lib/admin/constants";
import type { Platform, Priority } from "@/generated/prisma/enums";
import type { MasterFormState } from "@/lib/admin/master-types";
import { Card, Field, InputField, inputClass } from "@/components/admin/ui";
import { FormAlert, SubmitButton } from "@/components/auth/fields";

// CKEditor butuh DOM -> hanya dirender di browser.
const RichTextEditor = dynamic(() => import("@/components/client/RichTextEditor").then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-2xl border border-line bg-field" aria-hidden />,
});

const initial: MasterFormState = {};

type AppOption = { id: string; nama: string; platforms: Platform[] };

export function TicketForm({ applications }: { applications: AppOption[] }) {
  const [state, formAction, pending] = useActionState(createTicketAction, initial);
  const [html, setHtml] = useState("");
  const [uploading, setUploading] = useState(false);
  // Pilihan urgency yang baru diganti user (null = belum diubah). Select-nya sendiri uncontrolled
  // (defaultValue) supaya tidak "lompat" saat React 19 me-reset form setelah action selesai.
  const [pickedPriority, setPickedPriority] = useState<Priority | null>(null);
  const currentPriority = pickedPriority ?? ((state.values?.priority as Priority | undefined) || "MEDIUM");
  const fe = state.fieldErrors ?? {};

  // Aplikasi dipilih dari master data. Platform mengikuti aplikasinya: satu platform -> terkunci,
  // lebih dari satu -> client memilih salah satu. (Server memvalidasi ulang di createTicketAction.)
  const [appId, setAppId] = useState(state.values?.applicationId ?? "");
  const [pickedPlatform, setPickedPlatform] = useState<string>(state.values?.platform ?? "");
  const app = applications.find((a) => a.id === appId);
  const platformOptions = app?.platforms ?? [];
  const locked = platformOptions.length === 1;
  const platform = locked ? platformOptions[0] : platformOptions.find((p) => p === pickedPlatform) ?? platformOptions[0] ?? "";

  return (
    <Card className="w-full">
      <p className="text-[12px] font-semibold uppercase tracking-widest text-brand">New ticket</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Submit a ticket</h2>
      <p className="mt-1 text-[14px] text-muted">Tell us what&apos;s wrong and our support team will pick it up.</p>

      <form action={formAction} className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {state.error && (
          <div className="lg:col-span-2">
            <FormAlert tone="error">{state.error}</FormAlert>
          </div>
        )}

        {/* Kiri: isian singkat */}
        <div className="space-y-5">
          <InputField
            label="Title"
            name="judul"
            placeholder="e.g. Cannot upload invoice in the billing page"
            defaultValue={state.values?.judul}
            error={fe.judul?.[0]}
          />
          <Field label="Application" htmlFor="applicationId" error={fe.applicationId?.[0]}>
            <select
              id="applicationId"
              name="applicationId"
              required
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              aria-invalid={!!fe.applicationId}
              className={inputClass}
            >
              <option value="" disabled>
                {applications.length === 0 ? "No applications available" : "Select an application"}
              </option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nama}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Platform"
            htmlFor="platform"
            error={fe.platform?.[0]}
            hint={locked ? "This application is only available on one platform, so it is set automatically." : undefined}
          >
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPickedPlatform(e.target.value)}
              disabled={!app || locked}
              required
              aria-invalid={!!fe.platform}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {!app && <option value="">Select an application first</option>}
              {platformOptions.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </select>
            {/* Select yang disabled tidak ikut terkirim, jadi nilainya dikirim lewat input hidden. */}
            <input type="hidden" name="platform" value={platform} />
          </Field>
          <Field label="Urgency level" htmlFor="priority" error={fe.priority?.[0]} hint={URGENCY_HINT[currentPriority]}>
            <select
              id="priority"
              name="priority"
              defaultValue={currentPriority}
              onChange={(e) => setPickedPriority(e.target.value as Priority)}
              aria-invalid={!!fe.priority}
              className={inputClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Kanan: deskripsi */}
        <Field label="Description" htmlFor="deskripsi" error={fe.deskripsi?.[0]}>
          <input type="hidden" name="deskripsi" value={html} />
          <RichTextEditor
            initialData={state.values?.deskripsi ?? ""}
            invalid={!!fe.deskripsi}
            onChange={setHtml}
            onBusyChange={setUploading}
          />
        </Field>

        <div className="flex items-center justify-between border-t border-line pt-5 lg:col-span-2">
          <Link href="/client/tickets" className="text-[14px] font-semibold text-ink transition hover:text-brand">
            Cancel
          </Link>
          <div className="flex items-center gap-4">
            {uploading && <span className="text-[12px] text-muted">Uploading files…</span>}
            <SubmitButton pending={pending || uploading} arrow={false}>
              Submit ticket
            </SubmitButton>
          </div>
        </div>
      </form>
    </Card>
  );
}
