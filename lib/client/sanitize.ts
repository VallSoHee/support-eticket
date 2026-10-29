import sanitizeHtml from "sanitize-html";

// Deskripsi tiket adalah HTML dari CKEditor. HTML dari browser TIDAK boleh dipercaya:
// disanitasi di server sebelum disimpan (createTicketAction) dan sekali lagi saat ditampilkan
// (components/RichText.tsx). Hanya dipakai di server (sanitize-html memakai Node).

/** Semua gambar/file tiket hanya boleh menunjuk ke endpoint unggahan kita sendiri. */
export const UPLOAD_URL_PREFIX = "/api/uploads/";

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "code", "a",
    "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre",
    "figure", "img", "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
    figure: ["class"],
    code: ["class"],
    ol: ["start"],
  },
  allowedClasses: {
    figure: ["image", "table"],
    code: ["language-*"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    // Tautan keluar dibuka di tab baru tanpa membocorkan window.opener.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:/i.test(href);
      return {
        tagName,
        attribs: { ...attribs, ...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}) },
      };
    },
  },
  // Gambar dari domain lain dibuang (mencegah pixel pelacak / hotlink); hanya unggahan kita.
  exclusiveFilter: (frame) => frame.tag === "img" && !(frame.attribs.src ?? "").startsWith(UPLOAD_URL_PREFIX),
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, options).trim();
}

/** Teks polos dari HTML — untuk validasi panjang minimal. */
export function richTextToPlain(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Baris lama (sebelum CKEditor) berisi teks polos; yang baru selalu diawali tag HTML. */
export const looksLikeHtml = (v: string) => /^\s*<[a-z][\s\S]*>/i.test(v);

/** ID unggahan yang dirujuk dalam HTML (gambar & tautan file). */
export function extractUploadIds(html: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(`${UPLOAD_URL_PREFIX.replace(/\//g, "\\/")}([A-Za-z0-9_-]+)`, "g");
  for (const m of html.matchAll(re)) ids.add(m[1]);
  return [...ids];
}
