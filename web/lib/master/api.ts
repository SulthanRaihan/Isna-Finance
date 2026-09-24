import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Assignment } from "./types";
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public fields: Record<string, unknown> = {},
  ) {
    super(code);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const base = process.env.API_BASE_URL;
  if (!base) throw new ApiError("API_UNAVAILABLE", 503);
  const url = new URL(base);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new ApiError("API_UNAVAILABLE", 503);
  const client = await createClient();
  if (!client) throw new ApiError("UNAUTHENTICATED", 401);
  // Token is transport only. The FastAPI endpoint independently verifies it.
  const { data } = await client.auth.getSession();
  if (!data.session) throw new ApiError("UNAUTHENTICATED", 401);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/api/v1${path}`, {
      method,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError("API_UNAVAILABLE", 503);
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError("API_UNAVAILABLE", 503);
  }
  if (!response.ok)
    throw new ApiError(
      result.error?.code ?? "API_UNAVAILABLE",
      response.status,
      result.error?.fields ?? {},
    );
  return result as T;
}
export function actionError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "ACCOUNT_ASSIGNED")
      return {
        error:
          "Rekening masih dipakai. Ubah pilihan pada tanggal berikut sebelum menonaktifkannya.",
        conflicts: error.fields.conflicting_assignments as Assignment[],
      };
    if (error.status === 422)
      return {
        error:
          "Periksa isian. Rekening yang dipilih harus aktif dan rekening default harus termasuk pilihan.",
        fields: error.fields as Record<string, string>,
      };
    if (error.code === "DUPLICATE")
      return { error: "Nama tersebut sudah digunakan. Gunakan nama lain." };
    if (error.status === 401 || error.status === 403)
      return { error: "Sesi tidak tersedia. Silakan masuk kembali." };
  }
  return {
    error: "Layanan data belum tersedia. Silakan coba lagi nanti.",
  };
}
