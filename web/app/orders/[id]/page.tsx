import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OrderTransitions } from "@/components/order-transitions";
import { requireOwner } from "@/lib/auth/guard";
import { api, actionError } from "@/lib/master/api";
import { maskedAccount } from "@/lib/master/types";
import { money, statusLabels, type Order } from "@/lib/orders/types";
export const dynamic = "force-dynamic";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  let data: { order: Order; timezone: string } | undefined;
  let error = "";
  try {
    const [order, context] = await Promise.all([
      api<Order>(`/orders/${encodeURIComponent(id)}`),
      api<{ timezone: string }>("/business-context"),
    ]);
    data = { order, timezone: context.timezone };
  } catch (e) {
    error = actionError(e).error;
  }
  return (
    <AppShell activePath="/orders">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link className="text-sm text-primary" href="/orders">
          Kembali ke orders
        </Link>
        {data ? (
          <OrderContent id={id} {...data} />
        ) : (
          <p role="alert">{error}</p>
        )}
      </div>
    </AppShell>
  );
}

function OrderContent({
  id,
  order,
  timezone,
}: {
  id: string;
  order: Order;
  timezone: string;
}) {
  const time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("id-ID", {
          timeZone: timezone,
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "Belum dikonfirmasi";
  return (
    <>
      <section className="space-y-4 rounded-2xl border bg-surface p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            {order.customer?.display_name}
          </h1>
          <span className="rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
            {statusLabels[order.ui_status]}
          </span>
        </div>
        <p className="text-sm text-foreground-muted">
          Tanggal order {order.business_date}
        </p>
        <p className="text-3xl font-semibold tabular-nums">
          Rp{money(order.expected_idr)}
        </p>
        <p>
          CNY {money(order.cny_amount)} × {money(order.customer_rate)}
        </p>
        <p className="text-sm">
          {order.account ? maskedAccount(order.account) : ""}
        </p>
        {order.note && (
          <p className="whitespace-pre-wrap text-sm">{order.note}</p>
        )}
        <dl className="grid gap-3 border-t pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-foreground-muted">
              IDR diterima · {timezone}
            </dt>
            <dd>{time(order.idr_received_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-foreground-muted">
              RMB dikirim · {timezone}
            </dt>
            <dd>{time(order.cny_sent_at)}</dd>
          </div>
        </dl>
        <p className="text-sm">
          Tanggal pengakuan Money In: {order.money_in_date ?? "Belum diakui"}
        </p>
        <Link
          className="inline-block min-h-11 text-primary underline"
          href={`/orders/${id}/edit`}
        >
          Ubah{" "}
          {order.payment_status === "received" ||
          order.fulfillment_status === "sent"
            ? "catatan"
            : "order"}
        </Link>
      </section>
      {order.warnings.map((w) => (
        <p key={w} role="alert" className="rounded-xl bg-warning/10 p-4">
          {w}
        </p>
      ))}
      <OrderTransitions order={order} timezone={timezone} />
      <section className="rounded-2xl border bg-surface p-6">
        <h2 className="text-xl font-semibold">Riwayat perubahan</h2>
        <ul className="mt-4 space-y-4">
          {order.audit?.map((event) => (
            <li key={event.id} className="border-b pb-3">
              <p className="text-sm font-medium">
                {{
                  create: "Order dibuat",
                  edit: "Order diubah",
                  receive: "IDR diterima",
                  send: "RMB dikirim",
                }[event.action] ?? event.action}{" "}
                · {time(event.created_at)}
              </p>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-primary">
                  Lihat perubahan
                </summary>
                <p className="mt-2 text-xs text-foreground-muted">
                  Pelaku: {event.actor_user_id}
                </p>
                <dl className="mt-2 space-y-2">
                  {Object.entries(event.after_json)
                    .filter(
                      ([key, value]) =>
                        ![
                          "updated_at",
                          "created_at",
                          "created_by",
                          "id",
                        ].includes(key) &&
                        JSON.stringify(event.before_json?.[key]) !==
                          JSON.stringify(value),
                    )
                    .map(([key, value]) => (
                      <div key={key} className="break-words">
                        <dt className="font-medium">
                          {{
                            customer_id: "Pelanggan (ID)",
                            business_date: "Tanggal order",
                            cny_amount: "Jumlah CNY",
                            customer_rate: "Rate",
                            expected_idr: "IDR",
                            receiving_account_id: "Rekening (ID)",
                            payment_status: "Status pembayaran",
                            fulfillment_status: "Status pengiriman",
                            idr_received_at: "Waktu IDR diterima",
                            cny_sent_at: "Waktu RMB dikirim",
                            note: "Catatan",
                          }[key] ?? key}
                        </dt>
                        <dd>
                          {String(event.before_json?.[key] ?? "—")} →{" "}
                          {String(value ?? "—")}
                        </dd>
                      </div>
                    ))}
                </dl>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
