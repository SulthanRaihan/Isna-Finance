import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categories } from "@/lib/money-out";
import { money } from "@/lib/orders/types";
import {
  recapLink,
  sections,
  type DailyReport,
  type ReportPage,
} from "@/lib/reporting";

export function ReportSummary({ data }: { data: DailyReport }) {
  const position = data.business_position;
  return (
    <div className="space-y-5">
      <section
        aria-label="Ringkasan keuangan"
        className="rounded-[20px] bg-primary p-5 text-primary-foreground shadow-sm sm:p-6"
      >
        <p className="text-sm opacity-90">Profit harian · {data.date}</p>
        <p className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
          Rp{money(data.profit_idr)}
        </p>
        <p className="mt-2 text-xs opacity-90">
          Money In dikurangi Money Out yang tercatat.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/20 pt-4 min-[380px]:grid-cols-2">
          <Link href={recapLink(data.date, "money_in")} className="min-h-12">
            <span className="flex items-center gap-2 text-sm">
              <ArrowDownLeft size={16} aria-hidden="true" />
              Money In
            </span>
            <span className="mt-1 block break-words text-lg font-semibold tabular-nums">
              Rp{money(data.money_in_idr)}
            </span>
          </Link>
          <Link href={recapLink(data.date, "outflows")} className="min-h-12">
            <span className="flex items-center gap-2 text-sm">
              <ArrowUpRight size={16} aria-hidden="true" />
              Money Out
            </span>
            <span className="mt-1 block break-words text-lg font-semibold tabular-nums">
              Rp{money(data.money_out_idr)}
            </span>
          </Link>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Volume CNY", money(data.total_cny)],
          ["Pelanggan unik", data.customer_count],
          ["Jumlah order", data.order_count],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-surface p-4">
            <p className="text-xs text-foreground-muted">{label}</p>
            <p className="mt-2 break-words text-xl font-semibold tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-foreground-muted">
        Pelanggan, order, dan volume mengikuti tanggal order. Money In mengikuti
        tanggal IDR diterima ({data.timezone}); Money Out mengikuti tanggal uang
        keluar. Order selesai pada tanggal pilihan, menurut status terkini:{" "}
        {data.orders.completed}.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base">Posisi bisnis tercatat</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="break-words text-xl font-semibold tabular-nums">
            {position.status === "not_configured"
              ? "Belum dikonfigurasi"
              : `Rp${money(position.amount_idr)}`}
          </p>
          {position.status === "configured" ? (
            <p className="mt-2 text-xs text-foreground-muted">
              Saldo awal Rp{money(position.opening.opening_amount_idr)} pada
              awal {position.opening.effective_date}; transaksi dari tanggal itu
              hingga {data.date} ikut dihitung.
            </p>
          ) : (
            <p className="mt-2 text-sm text-foreground-muted">
              Belum ada saldo awal yang berlaku untuk tanggal ini.
            </p>
          )}
          <p className="mt-2 text-xs text-foreground-muted">
            Berdasarkan catatan aplikasi; bukan saldo rekening bank sebenarnya.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
export function ReportAttention({ data }: { data: DailyReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Perlu ditindaklanjuti</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground-muted">
          Order hingga {data.date}, termasuk tanggal sebelumnya, memakai status
          terkini. Ini bukan rekonstruksi status historis.
        </p>
        <Link
          href={recapLink(data.date, "pending")}
          className="block rounded-xl bg-surface-muted p-4"
        >
          <div className="flex justify-between gap-3">
            <span>Menunggu IDR</span>
            <strong>{data.orders.awaiting_payment}</strong>
          </div>
          <div className="mt-3 flex justify-between gap-3">
            <span>Siap kirim RMB</span>
            <strong>{data.orders.ready_to_send}</strong>
          </div>
          <p className="mt-3 text-xs text-primary">
            Lihat {data.pending_count} order belum selesai →
          </p>
        </Link>
        {data.warnings.map((w) => (
          <Link
            key={w.code}
            href={recapLink(data.date, w.section)}
            className="flex min-h-12 gap-3 rounded-xl border p-3 text-sm"
          >
            <Info
              size={18}
              className="mt-0.5 shrink-0 text-info"
              aria-hidden="true"
            />
            <span>
              {w.code === "sent_awaiting_payment"
                ? `${w.count} order sudah dikirim tetapi IDR belum diterima.`
                : `${w.count} tim memiliki saldo RMB tidak nol.`}
              <span className="mt-1 block text-xs text-foreground-muted">
                Informasi untuk perhatian/rekonsiliasi, bukan otomatis
                kesalahan.
              </span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
export function ReportBreakdown({ data }: { data: DailyReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Rincian Money Out</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {data.category_breakdown.map((r) => (
            <div
              key={r.category}
              className="flex flex-wrap justify-between gap-2 py-3 text-sm"
            >
              <dt>{categories[r.category]}</dt>
              <dd className="font-medium tabular-nums">
                Rp{money(r.amount_idr)}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-foreground-muted">
          Hanya posting aktif. Fee belum dibayar dan posting voided tidak
          dihitung.
        </p>
      </CardContent>
    </Card>
  );
}
export function ReportRows({ page, date }: { page: ReportPage; date: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-surface">
      <div className="border-b p-4">
        <h2 className="font-semibold">
          {sections[page.section]} · {page.total} catatan
        </h2>
        {page.section === "pending" && (
          <p className="mt-2 text-xs text-foreground-muted">
            Status terkini untuk tanggal order ≤ {date}.
          </p>
        )}
        {page.section === "teams" && (
          <p className="mt-2 text-xs text-foreground-muted">
            Saldo kumulatif hingga {date}, termasuk penyesuaian bertanda.
          </p>
        )}
      </div>
      {page.items.length === 0 ? (
        <p className="p-5 text-sm text-foreground-muted">
          Tidak ada catatan pada halaman ini.
        </p>
      ) : (
        <div className="divide-y">
          {page.section === "teams"
            ? page.items.map((t) => (
                <Link
                  key={t.id}
                  href={`/activity?${new URLSearchParams({ team: t.id, date })}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <span>
                    {t.name}
                    {!t.is_active && (
                      <span className="ml-2 text-xs text-foreground-muted">
                        Nonaktif
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">
                    CNY {money(t.balance_cny)}
                  </span>
                </Link>
              ))
            : page.section === "outflows"
              ? page.items.map((f) => (
                  <Link
                    key={f.id}
                    href={`/outflows/${f.id}`}
                    className="block space-y-2 p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">
                        {categories[f.category]}
                      </span>
                      <span className="tabular-nums">
                        Rp{money(f.amount_idr)}
                      </span>
                    </div>
                    <p className="break-words text-sm text-foreground-muted">
                      {f.description}
                      {f.replaces_id ? " · Posting pengganti" : ""}
                    </p>
                  </Link>
                ))
              : page.items.map((o) => (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    className="block space-y-2 p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{o.customer_name}</span>
                      <span className="text-sm tabular-nums">
                        CNY {money(o.cny_amount)}
                      </span>
                    </div>
                    <p className="text-sm tabular-nums">
                      {page.section === "money_in"
                        ? "IDR diterima"
                        : "IDR order"}
                      : Rp{money(o.expected_idr)}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      Order {o.business_date}
                      {page.section === "money_in"
                        ? ` · IDR diterima ${o.money_in_date}`
                        : ""}{" "}
                      · {o.account_label}
                      {o.account_last4 ? ` ••••${o.account_last4}` : ""}
                    </p>
                    <p className="text-xs">
                      {o.payment_status === "awaiting"
                        ? o.fulfillment_status === "sent"
                          ? "RMB terkirim · IDR belum diterima"
                          : "Menunggu IDR"
                        : o.fulfillment_status === "sent"
                          ? "Selesai"
                          : "Siap kirim RMB"}
                    </p>
                  </Link>
                ))}
        </div>
      )}
    </div>
  );
}
export function ReportSkeleton() {
  return (
    <div
      role="status"
      aria-label="Memuat ringkasan"
      className="space-y-5 p-6 motion-safe:animate-pulse"
    >
      <div className="h-10 w-1/2 rounded-xl bg-surface-muted" />
      <div className="h-48 rounded-[20px] bg-surface-muted" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-24 rounded-2xl bg-surface-muted" />
        ))}
      </div>
      <span className="sr-only">Memuat ringkasan…</span>
    </div>
  );
}
