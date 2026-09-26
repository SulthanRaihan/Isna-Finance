import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AtmCard, AtmForm } from "@/components/money-out-forms";
import { requireOwner } from "@/lib/auth/guard";
import { api } from "@/lib/master/api";
import { maskedAccount, type MasterRecord } from "@/lib/master/types";
import type { AtmActivity } from "@/lib/money-out";
export const dynamic = "force-dynamic";
export default async function AtmPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; account?: string; offset?: string }>;
}) {
  await requireOwner();
  const q = await searchParams;
  const offset = Math.max(0, parseInt(q.offset ?? "0", 10) || 0);
  let data:
    { items: AtmActivity[]; accounts: MasterRecord[]; day: string } | undefined;
  const filters = new URLSearchParams();
  if (q.date) filters.set("date", q.date);
  if (q.account) filters.set("account_id", q.account);
  try {
    const context = await api<{ business_date: string }>("/business-context");
    const accounts: MasterRecord[] = [];
    for (let start = 0; ; start += 100) {
      const p = await api<{ items: MasterRecord[] }>(
        `/accounts?limit=100&offset=${start}`,
      );
      accounts.push(...p.items);
      if (p.items.length < 100) break;
    }
    const page = await api<{ items: AtmActivity[] }>(
      `/atm-activities?${filters}&limit=20&offset=${offset}`,
    );
    data = { items: page.items, accounts, day: context.business_date };
  } catch {}
  const pageUrl = (n: number) =>
    `/atm?${new URLSearchParams({ ...(q.date ? { date: q.date } : {}), ...(q.account ? { account: q.account } : {}), offset: String(n) })}`;
  return (
    <AppShell activePath="/activity">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex gap-4 text-sm text-primary">
          <Link href="/activity">Aktivitas tim</Link>
          <Link href="/outflows">Money Out</Link>
        </div>
        <h1 className="text-3xl font-semibold">ATM / Card</h1>
        <p className="text-foreground-muted">
          Catat aktivitas, lalu konfirmasi pembayaran fee pada tanggal uang
          keluar.
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
                Tambah aktivitas ATM/card
              </summary>
              <div className="mt-4">
                <AtmForm day={data.day} accounts={data.accounts} />
              </div>
            </details>
            <form className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-3">
              <label>
                Tanggal aktivitas
                <input
                  type="date"
                  name="date"
                  defaultValue={q.date}
                  className="mt-2 min-h-12 w-full rounded-xl border px-3"
                />
              </label>
              <label>
                Rekening
                <select
                  name="account"
                  defaultValue={q.account ?? ""}
                  className="mt-2 min-h-12 w-full rounded-xl border px-3"
                >
                  <option value="">Semua</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {maskedAccount(a)}
                    </option>
                  ))}
                </select>
              </label>
              <button className="min-h-12 self-end rounded-xl border px-4">
                Terapkan filter
              </button>
            </form>
            {data.items.length === 0 && (
              <p>Belum ada aktivitas untuk filter ini.</p>
            )}
            {data.items.map((a) => (
              <AtmCard key={a.id} activity={a} accounts={data.accounts} />
            ))}
            <nav
              className="flex justify-between text-primary"
              aria-label="Halaman aktivitas"
            >
              {offset > 0 && (
                <Link href={pageUrl(Math.max(0, offset - 20))}>Sebelumnya</Link>
              )}
              {data.items.length === 20 && (
                <Link href={pageUrl(offset + 20)}>Berikutnya</Link>
              )}
            </nav>
          </>
        )}
      </div>
    </AppShell>
  );
}
