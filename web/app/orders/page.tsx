import Link from "next/link";
import { allOrderAccounts } from "@/lib/orders/data";
import { maskedAccount, type MasterRecord } from "@/lib/master/types";
import { AppShell } from "@/components/app-shell";
import { requireOwner } from "@/lib/auth/guard";
import { api, actionError } from "@/lib/master/api";
import { money, statusLabels, type Order } from "@/lib/orders/types";
export const dynamic = "force-dynamic";
type Search = {
  q?: string;
  date_from?: string;
  date_to?: string;
  payment_status?: string;
  fulfillment_status?: string;
  offset?: string;
  customer_id?: string;
  receiving_account_id?: string;
};
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireOwner();
  const search = await searchParams;
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "date_from",
    "date_to",
    "payment_status",
    "fulfillment_status",
    "customer_id",
    "receiving_account_id",
  ] as const)
    if (search[key]) params.set(key, search[key]);
  const offset = Math.max(0, Number.parseInt(search.offset ?? "0", 10) || 0);
  params.set("limit", "20");
  params.set("offset", String(offset));
  let accounts: MasterRecord[] = [];
  let items: Order[] = [],
    error = "";
  try {
    const [list, available] = await Promise.all([
      api<{ items: Order[] }>(`/orders?${params}`),
      allOrderAccounts(),
    ]);
    items = list.items;
    accounts = available;
  } catch (e) {
    error = actionError(e).error;
  }
  const page = (next: number) => {
    const p = new URLSearchParams(params);
    p.set("offset", String(next));
    return `/orders?${p}`;
  };
  const field = "h-12 w-full rounded-xl border bg-surface px-3";
  return (
    <AppShell activePath="/orders">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold">Orders</h1>
          <Link
            className="rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground"
            href="/orders/new"
          >
            + Order baru
          </Link>
        </div>
        <form className="grid gap-3 rounded-2xl border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            Cari nama pelanggan
            <input className={field} name="q" defaultValue={search.q} />
          </label>
          <label className="text-sm">
            Dari tanggal
            <input
              className={field}
              type="date"
              name="date_from"
              defaultValue={search.date_from}
            />
          </label>
          <label className="text-sm">
            Sampai tanggal
            <input
              className={field}
              type="date"
              name="date_to"
              defaultValue={search.date_to}
            />
          </label>
          <label className="text-sm">
            Pembayaran
            <select
              className={field}
              name="payment_status"
              defaultValue={search.payment_status ?? ""}
            >
              <option value="">Semua</option>
              <option value="awaiting">Menunggu IDR</option>
              <option value="received">IDR diterima</option>
            </select>
          </label>
          <label className="text-sm">
            Pengiriman
            <select
              className={field}
              name="fulfillment_status"
              defaultValue={search.fulfillment_status ?? ""}
            >
              <option value="">Semua</option>
              <option value="pending">Belum dikirim</option>
              <option value="sent">RMB terkirim</option>
            </select>
          </label>
          <label className="text-sm">
            Rekening penerima
            <select
              className={field}
              name="receiving_account_id"
              defaultValue={search.receiving_account_id ?? ""}
            >
              <option value="">Semua rekening</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {maskedAccount(a)}
                  {!a.is_active ? " · Nonaktif" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="self-end rounded-xl border px-4 py-3">
            Terapkan filter
          </button>
        </form>
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-surface p-8">
            <h2 className="font-semibold">Belum ada order yang cocok</h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Ubah filter atau catat order pertama.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((order) => (
              <li key={order.id}>
                <Link
                  className="flex flex-wrap justify-between gap-4 rounded-2xl border bg-surface p-5 hover:border-primary"
                  href={`/orders/${order.id}`}
                >
                  <div>
                    <h2 className="font-semibold">
                      {order.customer?.display_name}
                    </h2>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {order.business_date} · CNY {money(order.cny_amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      Rp{money(order.expected_idr)}
                    </p>
                    <p className="mt-1 text-sm text-primary">
                      {statusLabels[order.ui_status]}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between">
          {offset > 0 && (
            <Link href={page(Math.max(0, offset - 20))}>Sebelumnya</Link>
          )}
          {items.length === 20 && (
            <Link href={page(offset + 20)}>Berikutnya</Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
