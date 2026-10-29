
// Pengiriman email. Kalau SMTP_HOST diisi -> kirim sungguhan via SMTP (Nodemailer).
// Kalau tidak: development hanya mencetak isi email ke console, production gagal dengan jelas.
//
// Env: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_SECURE ("true" untuk port 465), MAIL_FROM.
import { BRAND } from "@/lib/brand";

type Mail = { to: string; subject: string; text: string; html: string };

async function deliver(mail: Mail, devLog: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mailer:stub] ${devLog}`);
      return;
    }
    // Di production jangan mencetak kode/link (itu kredensial sementara) -> gagalkan supaya user tahu.
    throw new Error("SMTP belum dikonfigurasi (SMTP_HOST kosong); email tidak terkirim.");
  }

  const { default: nodemailer } = await import("nodemailer");
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  // Alamat pengirim HARUS sama dengan akun SMTP-nya. Gmail & penyedia lain menimpa/menandai
  // pengirim yang berbeda, dan itu salah satu penyebab utama email masuk spam.
  const from = process.env.MAIL_FROM || (process.env.SMTP_USER ? `"${BRAND.name}" <${process.env.SMTP_USER}>` : undefined);
  const fromAddress = from?.match(/<([^>]+)>/)?.[1] ?? from;
  if (process.env.SMTP_USER && fromAddress && fromAddress.toLowerCase() !== process.env.SMTP_USER.toLowerCase()) {
    console.warn(`[mailer] MAIL_FROM (${fromAddress}) beda dengan SMTP_USER (${process.env.SMTP_USER}); email berisiko masuk spam.`);
  }

  await transport.sendMail({
    from,
    ...mail,
    // Tandai sebagai email otomatis (transaksional) agar auto-reply/out-of-office tidak membalas.
    headers: { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" },
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string }) {
  await deliver(
    {
      to: input.to,
      subject: "Reset your password",
      text: `Hi ${input.name},\n\nReset your password using this link (valid for 1 hour):\n${input.resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
      html: `<p>Hi ${esc(input.name)},</p><p>Reset your password using this link (valid for 1 hour):</p><p><a href="${esc(input.resetUrl)}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    },
    `Reset link untuk ${input.to}: ${input.resetUrl}`,
  );
}

const OTP_INTRO = {
  REGISTER: "Use this code to verify your email and finish creating your account.",
  EMAIL_CHANGE_OLD: "Use this code to confirm that you want to change the email address on your account.",
  EMAIL_CHANGE_NEW: "Use this code to confirm this address as the new email for your account.",
} as const;

export async function sendOtpEmail(input: { to: string; code: string; purpose: keyof typeof OTP_INTRO; name?: string }) {
  const hi = input.name ? `Hi ${input.name},` : "Hi,";
  const intro = OTP_INTRO[input.purpose];
  const brand = BRAND.name;

  await deliver(
    {
      to: input.to,
      // Subjek singkat, ada nama brand, tanpa tanda seru/huruf kapital semua (pemicu filter spam).
      subject: `${input.code} is your ${brand} verification code`,
      text: [
        hi,
        "",
        intro,
        "",
        `Your ${brand} verification code: ${input.code}`,
        "",
        "This code expires in 10 minutes.",
        `If you didn't request it, you can safely ignore this email. Never share this code with anyone, including ${brand} staff.`,
        "",
        `${brand} · ${BRAND.tagline}`,
      ].join("\n"),
      html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#1c2033">
<div style="display:none;max-height:0;overflow:hidden">Your verification code is ${input.code}. It expires in 10 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:20px;font-weight:700;padding-bottom:16px">${esc(brand)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${esc(hi)}<br><br>${intro}</td></tr>
<tr><td align="center" style="padding:24px 0"><span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;background:#f4f5f8;border-radius:12px;padding:14px 24px">${input.code}</span></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#6b7185">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email. Never share this code with anyone, including ${esc(brand)} staff.</td></tr>
</table>
<p style="font-size:12px;color:#9aa1b3;margin-top:16px">${esc(brand)} · ${esc(BRAND.tagline)}</p>
</td></tr></table></body></html>`,
    },
    `OTP ${input.purpose} untuk ${input.to}: ${input.code}`,
  );
}
