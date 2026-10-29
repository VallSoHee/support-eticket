"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Autoformat,
  AutoLink,
  BlockQuote,
  Bold,
  ClassicEditor,
  Code,
  CodeBlock,
  Essentials,
  FileDialogButtonView,
  FileRepository,
  Heading,
  Image,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  List,
  Paragraph,
  PasteFromOffice,
  Plugin,
  Strikethrough,
  Table,
  TableToolbar,
  Underline,
  type EditorConfig,
  type FileLoader,
  type UploadAdapter,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";
import { UPLOAD_ACCEPT } from "@/lib/client/upload-types";

// Editor deskripsi tiket. Dimuat lewat next/dynamic (ssr: false) dari TicketForm karena
// CKEditor butuh DOM. Isi editor (HTML) dikirim ke atas lewat onChange; server yang menyanitasinya.
//
// Unggahan:
//  - Foto: tombol "Insert image", drag & drop, atau paste -> tampil inline di deskripsi.
//  - File lain (PDF, Office, ZIP, dll): tombol klip -> disisipkan sebagai tautan unduh.
// Keduanya diunggah ke /api/uploads dan yang disimpan di HTML hanyalah URL-nya.

type UploadResult = { url: string; name: string; isImage: boolean };
type Progress = (loaded: number, total: number) => void;
type Runner = (file: File, onProgress?: Progress, signal?: AbortSignal) => Promise<UploadResult>;

// XHR (bukan fetch) supaya progres unggahan bisa ditampilkan di editor.
function uploadFile(file: File, onProgress?: Progress, signal?: AbortSignal): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      const body = xhr.response as (Partial<UploadResult> & { error?: string }) | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.url) resolve(body as UploadResult);
      else reject(new Error(body?.error ?? "Upload failed."));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort());

    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

class TicketUploadAdapter implements UploadAdapter {
  private loader: FileLoader;
  private run: Runner;
  private controller = new AbortController();

  constructor(loader: FileLoader, run: Runner) {
    this.loader = loader;
    this.run = run;
  }

  async upload() {
    const file = await this.loader.file;
    if (!file) throw new Error("No file to upload.");
    const res = await this.run(
      file,
      (loaded, total) => {
        this.loader.uploadTotal = total;
        this.loader.uploaded = loaded;
      },
      this.controller.signal,
    );
    return { default: res.url };
  }

  abort() {
    this.controller.abort();
  }
}

const PAPERCLIP_ICON =
  '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 6.5 7.6 12.4a1.7 1.7 0 0 0 2.4 2.4l6-6a3.4 3.4 0 0 0-4.8-4.8l-6.2 6.2a5.1 5.1 0 0 0 7.2 7.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Plugin dibuat lewat closure supaya bisa memakai callback (hitung unggahan berjalan, tampilkan error)
// milik instance komponen ini.
function createUploadPlugins(run: Runner, onError: (message: string) => void) {
  class UploadAdapterPlugin extends Plugin {
    static get pluginName() {
      return "TicketUploadAdapter" as const;
    }
    static get requires() {
      return [FileRepository] as const;
    }
    init() {
      this.editor.plugins.get(FileRepository).createUploadAdapter = (loader) => new TicketUploadAdapter(loader, run);
    }
  }

  class FileAttachPlugin extends Plugin {
    static get pluginName() {
      return "TicketFileAttach" as const;
    }
    init() {
      const editor = this.editor;

      const attach = async (file: File) => {
        try {
          const res = await run(file);
          editor.model.change((writer) => {
            // Tautan unduh dengan nama file sebagai teks; lalu putus atribut link supaya ketikan berikutnya polos.
            editor.model.insertContent(writer.createText(res.name, { linkHref: res.url }));
            writer.removeSelectionAttribute("linkHref");
            editor.model.insertContent(writer.createText(" "));
          });
        } catch (e) {
          onError(e instanceof Error ? e.message : "Upload failed.");
        }
      };

      editor.ui.componentFactory.add("attachFile", (locale) => {
        const view = new FileDialogButtonView(locale);
        // FileDialogButtonView sendiri adalah ButtonView (tidak ada lagi properti .buttonView).
        view.set({
          acceptedType: UPLOAD_ACCEPT,
          allowMultipleFiles: true,
          label: "Attach file",
          icon: PAPERCLIP_ICON,
          tooltip: true,
        });
        view.on("done", (_evt, files: Iterable<File>) => {
          for (const f of Array.from(files)) void attach(f);
        });
        return view;
      });
    }
  }

  return [UploadAdapterPlugin, FileAttachPlugin];
}

/** Bagian editor yang dipakai pemanggil (mis. chat) untuk mengosongkan / memfokuskan isi. */
export type EditorHandle = { getData: () => string; setData: (data: string) => void; focus: () => void };

export function RichTextEditor({
  initialData = "",
  invalid = false,
  onChange,
  onBusyChange,
  variant = "full",
  placeholder,
  onReady,
  onEnter,
}: {
  initialData?: string;
  invalid?: boolean;
  onChange: (html: string) => void;
  /** true selama ada unggahan yang belum selesai (form jangan disubmit dulu). Harus referensi stabil (mis. setState). */
  onBusyChange: (busy: boolean) => void;
  /** "compact" = versi ringkas untuk chat: toolbar kecil, area ketik pendek yang bisa scroll. */
  variant?: "full" | "compact";
  placeholder?: string;
  onReady?: (editor: EditorHandle) => void;
  /** Dipanggil saat Enter ditekan di paragraf biasa (bukan Shift+Enter, bukan di dalam list/tabel/kutipan). */
  onEnter?: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const compact = variant === "compact";
  const onEnterRef = useRef(onEnter);
  useEffect(() => {
    onEnterRef.current = onEnter;
  }, [onEnter]);

  const config = useMemo<EditorConfig>(() => {
    let inFlight = 0;
    const run: Runner = (file, onProgress, signal) => {
      setNotice(null);
      inFlight += 1;
      onBusyChange(true);
      return uploadFile(file, onProgress, signal)
        .catch((e: unknown) => {
          setNotice(e instanceof Error ? e.message : "Upload failed.");
          throw e;
        })
        .finally(() => {
          inFlight -= 1;
          if (inFlight === 0) onBusyChange(false);
        });
    };

    return {
      licenseKey: "GPL",
      placeholder:
        placeholder ?? "Describe what happened, the steps to reproduce it, and what you expected. Paste or drop screenshots here.",
      plugins: [
        Essentials,
        Paragraph,
        ...(compact ? [] : [Heading]),
        Bold,
        Italic,
        Underline,
        Strikethrough,
        Code,
        Link,
        AutoLink,
        List,
        BlockQuote,
        ...(compact ? [] : [CodeBlock, Table, TableToolbar]),
        Image,
        ImageToolbar,
        ImageTextAlternative,
        ImageUpload,
        PasteFromOffice,
        Autoformat,
      ],
      extraPlugins: createUploadPlugins(run, setNotice),
      toolbar: {
        items: compact
          ? ["bold", "italic", "underline", "strikethrough", "|", "link", "bulletedList", "numberedList", "code", "|", "uploadImage", "attachFile"]
          : [
          "heading",
          "|",
          "bold",
          "italic",
          "underline",
          "strikethrough",
          "|",
          "link",
          "bulletedList",
          "numberedList",
          "blockQuote",
          "code",
          "codeBlock",
          "insertTable",
          "|",
          "uploadImage",
          "attachFile",
          "|",
          "undo",
          "redo",
        ],
        shouldNotGroupWhenFull: !compact,
      },
      ...(compact
        ? {}
        : {
            heading: {
              options: [
                { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
                { model: "heading2", view: "h2", title: "Heading", class: "ck-heading_heading2" },
                { model: "heading3", view: "h3", title: "Subheading", class: "ck-heading_heading3" },
              ],
            },
            codeBlock: { languages: [{ language: "plaintext", label: "Plain text" }] },
            table: { contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"] },
          }),
      image: { toolbar: ["imageTextAlternative"] },
      link: { defaultProtocol: "https://" },
    };
  }, [onBusyChange, compact, placeholder]);

  return (
    <div className={`rich-editor ${compact ? "rich-editor-compact" : ""} ${invalid ? "rich-editor-invalid" : ""}`}>
      <CKEditor
        editor={ClassicEditor}
        config={config}
        data={initialData}
        onReady={(editor) => {
          if (onEnter) {
            // Enter = kirim (seperti chat biasa), tapi hanya di paragraf polos: di dalam list / kutipan
            // Enter tetap membuat baris baru, dan Shift+Enter selalu baris baru.
            const doc = editor.editing.view.document as unknown as {
              on: (
                name: string,
                cb: (evt: { stop: () => void }, data: { isSoft?: boolean; preventDefault: () => void }) => void,
                opts?: { priority: string },
              ) => void;
            };
            doc.on(
              "enter",
              (evt, data) => {
                if (data.isSoft) return;
                const block = editor.model.document.selection.getFirstPosition()?.parent as unknown as
                  | { name?: string; parent?: { name?: string } | null; hasAttribute?: (k: string) => boolean }
                  | undefined;
                if (!block || block.name !== "paragraph" || block.parent?.name !== "$root") return;
                if (block.hasAttribute?.("listItemId") || block.hasAttribute?.("listItem")) return;
                evt.stop();
                data.preventDefault();
                onEnterRef.current?.();
              },
              { priority: "high" },
            );
          }
          onReady?.(editor);
        }}
        onChange={(_event, editor) => onChange(editor.getData())}
      />
      {!compact && (
        <p className="mt-2 text-[12px] text-muted">
          Images, PDF, Office files, TXT, CSV, LOG and ZIP are supported (max 10 MB each).
        </p>
      )}
      {notice && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-brand-dark">
          {notice}
        </p>
      )}
    </div>
  );
}
