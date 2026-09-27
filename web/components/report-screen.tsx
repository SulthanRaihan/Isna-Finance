import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  ReportAttention,
  ReportBreakdown,
  ReportRows,
  ReportSummary,
} from "@/components/reporting";
import { api } from "@/lib/master/api";
import { requireOwner } from "@/lib/auth/guard";
import {
  recapLink,
  sections,
  type DailyReport,
  type ReportSection,
} from "@/lib/reporting";
export type ReportSearch = { date?: string; section?: string; offset?: string };
export async function ReportScreen({
  search,
  recap = false,
}: {
  search: ReportSearch;
  recap?: boolean;
}) {
  const owner = await requireOwner();
  let data: DailyReport | undefined;
  let day = search.date ?? "";
  const section: ReportSection = Object.hasOwn(sections, search.section ?? "")
    ? (search.section as ReportSection)
    : "orders";
  const offset = Math.max(0, parseInt(search.offset ?? "0", 10) || 0);
  try {
    if (!day)
      day = (await api<{ business_date: string }>("/business-context"))
        .business_date;
    const q = new URLSearchParams({
      date: day,
      section,
      limit: "20",
      offset: String(offset),
    });
    data = await api<DailyReport>(
      recap
        ? `/recaps/daily?${q}`
        : `/dashboard/daily?date=${encodeURIComponent(day)}`,
    );
  } catch {
    /* Never substitute zeros for unavailable financial data. */
  }
  return (
    <AppShell activePath={recap ? "/recaps" : "/"}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">
              {recap
                ? "Catatan operasional harian"
                : `Selamat datang, ${owner.display_name}`}
            </p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
              {recap ? "Rekap harian" : "Ringkasan harian"}
            </h1>
          </div>
          <Link
            href={
              recap ? `/?${new URLSearchParams({ date: day })}` : "/orders/new"
            }
            className="inline-flex min-h-12 items-center rounded-xl border bg-surface px-4 text-sm font-medium"
          >
            {recap ? "Kembali ke Home" : "+ Quick Order"}
          </Link>
        </header>
        <form
          action={recap ? "/recaps" : "/"}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-sm">
            Tanggal bisnis
            <input
              className="mt-2 block min-h-12 rounded-xl border bg-surface px-3"
              name="date"
              type="date"
              defaultValue={day}
              required
            />
          </label>
          {recap && <input type="hidden" name="section" value={section} />}
          <button className="min-h-12 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">
            Tampilkan
          </button>
        </form>
        {!data ? (
          <div role="alert" className="rounded-2xl border bg-surface p-5">
            <h2 className="font-semibold">Ringkasan belum tersedia</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Periksa tanggal dan koneksi layanan laporan. Nilai belum dapat
              dihitung; data tidak dianggap nol.
            </p>
            <Link
              href={
                recap
                  ? recapLink(day, section, offset)
                  : `/?${new URLSearchParams({ date: day })}`
              }
              className="mt-3 inline-block min-h-11 py-3 text-primary"
            >
              Muat ulang ringkasan
            </Link>
          </div>
        ) : (
          <>
            {!recap && (
              <section className="rounded-2xl border bg-surface p-4">
                <h2 className="text-sm font-semibold">
                  Rekening penerima · {data.date}
                </h2>
                {data.receiving_accounts.length ? (
                  data.receiving_accounts.map((a) => (
                    <p key={a.id} className="mt-2 text-sm">
                      {a.label} · {a.bank_name}
                      {a.account_last4 ? ` ••••${a.account_last4}` : ""}
                      {a.is_default ? " · Default" : ""}
                      {!a.is_active ? " · Nonaktif" : ""}
                    </p>
                  ))
                ) : (
                  <p className="mt-2 text-sm text-foreground-muted">
                    Belum ada rekening yang dipilih untuk tanggal ini.
                  </p>
                )}
                <Link
                  href={`/daily-accounts?date=${encodeURIComponent(data.date)}`}
                  className="mt-2 inline-block min-h-11 py-3 text-sm text-primary"
                >
                  Lihat rekening harian →
                </Link>
              </section>
            )}
            <ReportSummary data={data} />
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <ReportAttention data={data} />
              <ReportBreakdown data={data} />
            </div>
            {recap ? (
              <nav aria-label="Bagian rekap" className="flex flex-wrap gap-2">
                {Object.entries(sections).map(([key, label]) => (
                  <Link
                    key={key}
                    href={recapLink(data.date, key as ReportSection)}
                    aria-current={section === key ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-xl border px-4 text-sm ${section === key ? "bg-primary text-primary-foreground" : "bg-surface"}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Order tanggal pilihan</h2>
                <Link
                  href={recapLink(data.date)}
                  className="min-h-11 py-3 text-sm text-primary"
                >
                  Buka rekap lengkap →
                </Link>
              </div>
            )}
            <ReportRows page={data.page} date={data.date} />
            {recap && (
              <nav
                aria-label="Halaman rekap"
                className="flex flex-wrap justify-between gap-4 text-sm"
              >
                <span>
                  {data.page.total} catatan · ringkasan mencakup semua halaman
                </span>
                <div className="flex gap-4">
                  {offset > 0 && (
                    <Link
                      className="min-h-11 py-3 text-primary"
                      href={recapLink(
                        data.date,
                        section,
                        Math.max(0, offset - data.page.limit),
                      )}
                    >
                      Sebelumnya
                    </Link>
                  )}
                  {offset + data.page.limit < data.page.total && (
                    <Link
                      className="min-h-11 py-3 text-primary"
                      href={recapLink(
                        data.date,
                        section,
                        offset + data.page.limit,
                      )}
                    >
                      Berikutnya
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
