import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OutflowForm } from "@/components/money-out-forms";
import { requireOwner } from "@/lib/auth/guard";
import { api } from "@/lib/master/api";
import { categories, type Outflow } from "@/lib/money-out";
import { money } from "@/lib/orders/types";
export const dynamic = "force-dynamic";
export default async function OutflowsPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    category?: string;
    status?: string;
    offset?: string;
  }>;
}) {
  await requireOwner();
  const search = await searchParams;
  const offset = Math.max(0, parseInt(search.offset ?? "0", 10) || 0);
  const q = new URLSearchParams({ status: search.status || "posted" });
  if (search.date) q.set("date", search.date);
  if (search.category) q.set("category", search.category);
  let data: { items: Outflow[]; day: string } | undefined;
  try {
    const [page, context] = await Promise.all([
      api<{ items: Outflow[] }>(`/outflows?${q}&limit=20&offset=${offset}`),
      api<{ business_date: string }>("/business-context"),
    ]);
    data = { items: page.items, day: context.business_date };
  } catch {}
  return (
    <AppShell activePath="/activity">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex gap-4 text-sm text-primary">
          <Link href="/activity">Aktivitas tim</Link>
          <Link href="/atm">ATM / Card</Link>
        </div>
        <h1 className="text-3xl font-semibold">Money Out</h1>
        <p className="text-foreground-muted">
          Hanya posting aktif yang dihitung. Fee tim dan ATM berasal dari
          konfirmasi pembayaran aktivitas.
        </p>
        {!data ? (
          <p role="alert">
            Data belum tersedia. Periksa layanan dan migrasi M5, lalu muat
            ulang.
          </p>
        ) : (
          <>
            <details className="rounded-2xl border bg-surface p-5">
              <summary className="cursor-pointer font-semibold text-primary">
                Catat pengeluaran manual
              </summary>
              <div className="mt-4">
                <OutflowForm day={data.day} />
              </div>
            </details>
            <form className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
              <label>
                Tanggal uang keluar
                <input
                  type="date"
                  name="date"
                  defaultValue={search.date}
                  className="mt-2 min-h-12 w-full rounded-xl border px-3"
                />
              </label>
              <label>
                Kategori
                <select
                  name="category"
                  defaultValue={search.category ?? ""}
                  className="mt-2 min-h-12 w-full rounded-xl border px-3"
                >
                  <option value="">Semua</option>
                  {Object.entries(categories).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={search.status || "posted"}
                  className="mt-2 min-h-12 w-full rounded-xl border px-3"
                >
                  <option value="posted">Aktif</option>
                  <option value="voided">Voided</option>
                  <option value="all">Semua riwayat</option>
                </select>
              </label>
              <button className="min-h-12 self-end rounded-xl border px-4">
                Terapkan filter
              </button>
            </form>
            {data.items.length === 0 && (
              <p>Tidak ada pengeluaran untuk filter ini.</p>
            )}
            {data.items.map((f) => (
              <Link
                key={f.id}
                href={`/outflows/${f.id}`}
                className="block space-y-2 rounded-2xl border bg-surface p-5"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">
                    {categories[f.category]}
                  </span>
                  <span>Rp{money(f.amount_idr)}</span>
                </div>
                <p className="break-words">{f.description}</p>
                <p className="text-sm text-foreground-muted">
                  {f.business_date} ·{" "}
                  {f.status === "posted" ? "Aktif" : "Voided · dikecualikan"}
                  {f.replaces_id ? " · Pengganti koreksi" : ""}
                </p>
              </Link>
            ))}
            <nav
              className="flex justify-between text-primary"
              aria-label="Halaman Money Out"
            >
              {offset > 0 && (
                <Link
                  href={`/outflows?${q}&offset=${Math.max(0, offset - 20)}`}
                >
                  Sebelumnya
                </Link>
              )}
              {data.items.length === 20 && (
                <Link href={`/outflows?${q}&offset=${offset + 20}`}>
                  Berikutnya
                </Link>
              )}
            </nav>
          </>
        )}
      </div>
    </AppShell>
  );
}
