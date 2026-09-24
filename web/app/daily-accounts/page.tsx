import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DailyAccountEditor } from "@/components/daily-account-editor";
import { requireOwner } from "@/lib/auth/guard";
import { api, actionError } from "@/lib/master/api";
import type { Assignment, MasterRecord } from "@/lib/master/types";
export const dynamic = "force-dynamic";
export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireOwner();
  const search = await searchParams;
  const accounts: MasterRecord[] = [];
  let day = "",
    timezone = "",
    assignments: Assignment[] = [],
    error = "";
  try {
    const context = await api<{ business_date: string; timezone: string }>(
      "/business-context",
    );
    timezone = context.timezone;
    day = search.date ?? context.business_date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid date");
    assignments = (
      await api<{ assignments: Assignment[] }>(`/daily-accounts?date=${day}`)
    ).assignments;
    for (let offset = 0; ; offset += 100) {
      const { items } = await api<{ items: MasterRecord[] }>(
        `/accounts?limit=100&offset=${offset}`,
      );
      accounts.push(...items);
      if (items.length < 100) break;
    }
  } catch (e) {
    error = actionError(e).error;
  }
  return (
    <AppShell activePath="/more">
      <div className="max-w-2xl space-y-6">
        <Link href="/accounts" className="text-sm text-primary">
          Kembali ke rekening
        </Link>
        <h1 className="text-3xl font-semibold">Rekening harian</h1>
        <p className="text-sm text-foreground-muted">
          Tanggal bisnis - {timezone || "belum tersedia"}
        </p>
        <form className="flex gap-3">
          <input
            aria-label="Tanggal bisnis"
            type="date"
            name="date"
            defaultValue={day}
            required
            className="h-12 min-w-0 flex-1 rounded-xl border bg-surface px-3"
          />
          <button className="rounded-xl border bg-surface px-4">Lihat</button>
        </form>
        {error ? (
          <p role="alert" className="rounded-xl bg-danger/5 p-4 text-danger">
            {error}
          </p>
        ) : (
          <DailyAccountEditor
            key={day + JSON.stringify(assignments)}
            day={day}
            accounts={accounts}
            assignments={assignments}
          />
        )}
      </div>
    </AppShell>
  );
}
