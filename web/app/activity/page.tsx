import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  ActivityCard,
  ActivityForm,
  MovementForm,
} from "@/components/team-forms";
import { requireOwner } from "@/lib/auth/guard";
import { api } from "@/lib/master/api";
import type { MasterRecord } from "@/lib/master/types";
import type { TeamActivity, TeamLedger } from "@/lib/team-activity";
import { money } from "@/lib/orders/types";
export const dynamic = "force-dynamic";
export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; date?: string; offset?: string }>;
}) {
  await requireOwner();
  const search = await searchParams;
  let data:
    | {
        teams: MasterRecord[];
        day: string;
        team?: MasterRecord;
        ledger?: TeamLedger;
        activities: TeamActivity[];
      }
    | undefined;
  const offset = Math.max(0, parseInt(search.offset ?? "0", 10) || 0);
  try {
    const context = await api<{ business_date: string }>("/business-context");
    const teams: MasterRecord[] = [];
    for (let start = 0; ; start += 100) {
      const page = await api<{ items: MasterRecord[] }>(
        `/teams?limit=100&offset=${start}`,
      );
      teams.push(...page.items);
      if (page.items.length < 100) break;
    }
    const team = teams.find((t) => t.id === search.team);
    const day = search.date || context.business_date;
    if (team) {
      const q = new URLSearchParams({
        date: day,
        limit: "20",
        offset: String(offset),
      });
      const [ledger, activities] = await Promise.all([
        api<TeamLedger>(`/teams/${team.id}/ledger?${q}`),
        api<{ items: TeamActivity[] }>(
          `/team-activities?team_id=${team.id}&date=${encodeURIComponent(day)}`,
        ),
      ]);
      data = { teams, day, team, ledger, activities: activities.items };
    } else data = { teams, day, activities: [] };
  } catch {
    /* Preserve a visible failure instead of displaying false zero balances. */
  }
  return (
    <AppShell activePath="/activity">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-semibold">Aktivitas tim</h1>
        <p className="text-foreground-muted">
          Ledger RMB dan fee harian. Saldo ini adalah catatan operasional tim.
        </p>
        {!data ? (
          <p role="alert">
            Data belum tersedia. Periksa koneksi dan penerapan migrasi M4, lalu
            muat ulang.
          </p>
        ) : (
          <>
            <form className="grid gap-3 sm:grid-cols-3">
              <label>
                Tim
                <select
                  name="team"
                  defaultValue={data.team?.id ?? ""}
                  required
                  className="mt-2 h-12 w-full rounded-xl border px-3"
                >
                  <option value="">Pilih tim</option>
                  {data.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.is_active ? "" : " (nonaktif)"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tanggal aktivitas
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={data.day}
                  className="mt-2 h-12 w-full rounded-xl border px-3"
                />
              </label>
              <button className="min-h-12 self-end rounded-xl border px-4">
                Tampilkan
              </button>
            </form>
            <Link href="/teams" className="text-primary">
              Kelola tim dan default fee
            </Link>
            {data.team && data.ledger && (
              <>
                <section className="rounded-2xl border bg-surface p-5">
                  <h2 className="font-semibold">Saldo hingga {data.day}</h2>
                  <p className="my-3 text-3xl tabular-nums">
                    CNY {money(data.ledger.balance_cny)}
                  </p>
                  <p className="text-sm">
                    Hari ini: diterima {money(data.ledger.received_cny)} ·
                    distribusi {money(data.ledger.distributed_cny)} ·
                    penyesuaian {money(data.ledger.adjustment_cny)}
                  </p>
                </section>
                <div className="grid gap-5 md:grid-cols-2">
                  <section className="rounded-2xl border bg-surface p-5">
                    <h2 className="mb-4 font-semibold">
                      Tambah pergerakan RMB
                    </h2>
                    <MovementForm
                      key={`${data.team.id}:${data.day}`}
                      teamId={data.team.id}
                      day={data.day}
                    />
                  </section>
                  <section className="rounded-2xl border bg-surface p-5">
                    <h2 className="mb-4 font-semibold">Fee aktivitas harian</h2>
                    {data.activities.length ? (
                      <p>Aktivitas tanggal ini sudah tercatat di bawah.</p>
                    ) : (
                      <ActivityForm
                        key={`${data.team.id}:${data.day}`}
                        teamId={data.team.id}
                        day={data.day}
                        rate={data.team.default_fee_rate ?? "2.000000"}
                      />
                    )}
                  </section>
                </div>
                {data.activities.map((a) => (
                  <ActivityCard key={a.id} activity={a} />
                ))}
                <section className="space-y-3 rounded-2xl border bg-surface p-5">
                  <h2 className="font-semibold">
                    Pergerakan tanggal {data.day}
                  </h2>
                  {!data.ledger.movements.length && (
                    <p>Belum ada pergerakan pada halaman ini.</p>
                  )}
                  {data.ledger.movements.map((m) => (
                    <article key={m.id} className="border-b py-3">
                      <p>
                        {m.movement_type} · CNY {money(m.cny_amount)}
                      </p>
                      {m.note && <p>{m.note}</p>}
                      {m.order_id && (
                        <Link
                          className="text-primary"
                          href={`/orders/${m.order_id}`}
                        >
                          Lihat order terkait
                        </Link>
                      )}
                    </article>
                  ))}
                  <div className="flex gap-4">
                    {offset > 0 && (
                      <Link
                        href={`/activity?team=${data.team.id}&date=${data.day}&offset=${Math.max(0, offset - 20)}`}
                      >
                        Sebelumnya
                      </Link>
                    )}
                    {data.ledger.movements.length === 20 && (
                      <Link
                        href={`/activity?team=${data.team.id}&date=${data.day}&offset=${offset + 20}`}
                      >
                        Berikutnya
                      </Link>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
