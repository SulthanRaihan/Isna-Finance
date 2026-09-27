"use client";
import { useState } from "react";
import {
  beginExtractionUpload,
  cancelExtractionUpload,
  extractScreenshot,
} from "@/app/extraction-actions";
import type { Extraction } from "@/lib/extraction";

export function ScreenshotExtractor({
  onApply,
}: {
  onApply: (result: Extraction) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<Extraction | null>(null);
  async function run(file: File) {
    setResult(null);
    setError("");
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size < 1 ||
      file.size > 5000000
    ) {
      setError("Gunakan satu PNG/JPEG maksimal 5 MB dan 20 megapiksel.");
      return;
    }
    setBusy(true);
    let job: string | undefined;
    try {
      const response = await beginExtractionUpload(file.type, file.size);
      if (!response.ticket) throw new Error(response.error);
      job = response.ticket.job_id;
      const uploaded = await fetch(response.ticket.upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
          "x-upsert": "false",
          "cache-control": "max-age=0",
        },
        signal: AbortSignal.timeout(60000),
      });
      if (!uploaded.ok) throw new Error("Upload gagal. Silakan coba kembali.");
      const extracted = await extractScreenshot(job);
      if (!extracted.result) throw new Error(extracted.error);
      setResult(extracted.result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ekstraksi gagal. Gunakan Quick Order manual.",
      );
    } finally {
      if (job) {
        try {
          await cancelExtractionUpload(job);
        } catch {
          /* The independent cleanup worker handles disconnected clients. */
        }
      }
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border bg-surface p-5">
      <h2 className="font-semibold">Bantu isi dari screenshot</h2>
      <p className="text-sm text-foreground-muted">
        Opsional. Satu order, satu PNG/JPEG, maksimal 5 MB dan 20 megapiksel.
        Gambar dikirim ke OpenAI untuk ekstraksi; salinan sementara aplikasi
        dihapus setelah proses, dengan pembersihan cadangan maksimal satu jam.
      </p>
      <label className="block text-sm">
        Pilih screenshot
        <input
          aria-label="Pilih screenshot"
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          className="mt-2 block w-full"
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length === 1) void run(files[0]);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p role="status">Memproses screenshot… Order belum disimpan.</p>}
      {error && <p role="alert">{error}</p>}
      {result &&
        (result.multiple_orders ? (
          <p role="alert">
            Screenshot tampak berisi beberapa order. Unggah screenshot satu
            order; tidak ada order yang dipilih otomatis.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="font-medium">
              Draft belum tersimpan — periksa setiap isian
            </p>
            <p>
              Pelanggan: {result.draft.customer_text ?? "Perlu diisi"} ·
              keyakinan {Math.round(result.confidence.customer * 100)}%
            </p>
            <p>
              CNY: {result.draft.cny_amount ?? "Perlu diisi"} · keyakinan{" "}
              {Math.round(result.confidence.cny_amount * 100)}%
            </p>
            <p>
              Rate: {result.draft.customer_rate ?? "Perlu diisi"} · keyakinan{" "}
              {Math.round(result.confidence.customer_rate * 100)}%
            </p>
            {!result.draft.matched_customer_id && (
              <p>
                Pilih pelanggan secara manual; nama belum cocok secara unik.
              </p>
            )}
            <p className="text-sm">
              Keyakinan AI bukan jaminan benar. Terapkan untuk mengedit isian di
              bawah, lalu simpan secara manual. Isian pelanggan, CNY, dan rate
              sebelumnya akan diganti.
            </p>
            <button
              type="button"
              disabled={busy}
              className="min-h-12 rounded-xl border px-4"
              onClick={() => {
                onApply(result);
                setResult(null);
              }}
            >
              Terapkan draft ke form
            </button>
          </div>
        ))}
    </section>
  );
}
