"use server";
import { requireOwner } from "@/lib/auth/guard";
import { api } from "@/lib/master/api";
import type { Extraction } from "@/lib/extraction";

export async function beginExtractionUpload(
  mime_type: string,
  size_bytes: number,
) {
  await requireOwner();
  try {
    return {
      ticket: await api<{ job_id: string; upload_url: string }>(
        "/ai/uploads",
        "POST",
        { mime_type, size_bytes },
      ),
    };
  } catch {
    return {
      error:
        "Ekstraksi belum tersedia atau batas permintaan tercapai. Quick Order manual tetap bisa digunakan.",
    };
  }
}
export async function extractScreenshot(job_id: string) {
  await requireOwner();
  try {
    return {
      result: await api<Extraction>(
        "/ai/extract-order",
        "POST",
        { job_id },
        undefined,
        75000,
      ),
    };
  } catch {
    return {
      error:
        "Ekstraksi belum berhasil. Gunakan isian manual atau coba dengan screenshot baru. Pembersihan gambar tetap dijalankan.",
    };
  }
}
export async function cancelExtractionUpload(job_id: string) {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(job_id)) return;
  try {
    await api(`/ai/uploads/${job_id}`, "DELETE");
  } catch {
    /* Independent sweeper handles orphan cleanup. */
  }
}
