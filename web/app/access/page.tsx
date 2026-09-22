import Link from "next/link";
import { logout } from "@/app/auth-actions";

export const dynamic = "force-dynamic";
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const denied = reason === "forbidden";
  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <section className="w-full max-w-md rounded-2xl border bg-surface p-8">
        <p className="mb-3 text-sm font-semibold text-primary">Isna Finance</p>
        <h1 className="text-2xl font-semibold">
          {denied ? "Akses belum diberikan" : "Akses belum dapat diverifikasi"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-foreground-muted">
          {denied
            ? "Ruang kerja ini hanya tersedia untuk akun owner Isna."
            : reason === "logout"
              ? "Keluar akun belum berhasil. Periksa koneksi lalu coba lagi."
              : "Layanan belum siap atau sedang tidak dapat dihubungi. Silakan coba lagi."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg p-2 text-sm font-semibold text-primary"
        >
          Coba lagi
        </Link>
        <form action={logout}>
          <button className="mt-3 min-h-11 w-full rounded-xl border px-4 text-sm font-medium">
            Keluar / kembali ke login
          </button>
        </form>
      </section>
    </main>
  );
}
