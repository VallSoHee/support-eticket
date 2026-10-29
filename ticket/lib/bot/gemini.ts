import { cleanBotText } from "@/lib/bot/text";

// Penyedia LLM: Google Gemini API (free tier lewat Google AI Studio). Memakai fetch langsung ke REST,
// jadi tanpa dependensi tambahan. Mengganti ke penyedia lain = tulis file serupa dan ubah index.ts.
//
//   GEMINI_API_KEY  wajib untuk mengaktifkan LLM (tanpa ini bot jalan hanya dengan FAQ)
//   GEMINI_MODEL    opsional, default "gemini-flash-lite-latest" (alias model Flash-Lite terbaru)

export type LlmTurn = { role: "user" | "model"; text: string };
export type LlmResult = { answer: string; needsAgent: boolean };

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 15_000;

export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY?.trim());

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/** Gabungkan giliran berurutan dengan peran sama (Gemini lebih stabil dengan user/model bergantian). */
function mergeTurns(turns: LlmTurn[]): LlmTurn[] {
  const out: LlmTurn[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.text += `\n${t.text}`;
    else out.push({ ...t });
  }
  return out;
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export async function askGemini(opts: { system: string; turns: LlmTurn[] }): Promise<LlmResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new LlmError("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-flash-lite-latest";

  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    // Kunci lewat header (bukan query string) supaya tidak ikut tercatat di log URL.
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: mergeTurns(opts.turns).map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      generationConfig: {
        temperature: 0.3,
        // Longgar: model "thinking" ikut memakai jatah token ini sebelum menulis jawaban.
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { answer: { type: "STRING" }, needs_agent: { type: "BOOLEAN" } },
          required: ["answer", "needs_agent"],
        },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) {
    // 429 = kuota free tier habis (per menit / per hari). Pemanggil jatuh ke jawaban cadangan.
    throw new LlmError(`Gemini HTTP ${res.status}`, res.status);
  }

  const data = (await res.json()) as GeminiResponse;
  if (data.promptFeedback?.blockReason) throw new LlmError(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);

  const raw = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!raw) throw new LlmError("Gemini returned an empty answer");

  try {
    const parsed = JSON.parse(raw) as { answer?: unknown; needs_agent?: unknown };
    const answer = typeof parsed.answer === "string" ? cleanBotText(parsed.answer) : "";
    if (!answer) throw new LlmError("Gemini JSON had no answer");
    return { answer, needsAgent: parsed.needs_agent === true };
  } catch (e) {
    if (e instanceof LlmError) throw e;
    // Bukan JSON valid: anggap seluruh teks sebagai jawaban.
    return { answer: cleanBotText(raw), needsAgent: false };
  }
}
