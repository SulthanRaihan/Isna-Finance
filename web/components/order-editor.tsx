"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  addOrderCustomer,
  loadOrderChoices,
  searchOrderCustomers,
  writeOrder,
} from "@/app/order-actions";
import { maskedAccount, type MasterRecord } from "@/lib/master/types";
import { money, previewIDR, type Order } from "@/lib/orders/types";
const input = "mt-2 h-12 w-full rounded-xl border bg-surface px-3";
const button =
  "min-h-12 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50";
export function OrderEditor({
  day,
  timezone,
  initialAccounts,
  defaultId,
  initialCustomers,
  order,
}: {
  day: string;
  timezone: string;
  initialAccounts: MasterRecord[];
  defaultId: string;
  initialCustomers: MasterRecord[];
  order?: Order;
}) {
  const [date, setDate] = useState(day),
    [accounts, setAccounts] = useState(initialAccounts),
    [account, setAccount] = useState(order?.receiving_account_id ?? defaultId);
  const [selectedDefault, setSelectedDefault] = useState(defaultId);
  const [customers, setCustomers] = useState(initialCustomers),
    [customer, setCustomer] = useState(order?.customer_id ?? ""),
    [query, setQuery] = useState("");
  const [amount, setAmount] = useState(order?.cny_amount ?? ""),
    [rate, setRate] = useState(order?.customer_rate ?? ""),
    [note, setNote] = useState(order?.note ?? "");
  const [error, setError] = useState(""),
    [saved, setSaved] = useState<Order | null>(null),
    [pending, start] = useTransition();
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{
    key: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const locked =
    !!order &&
    (order.payment_status === "received" ||
      order.fulfillment_status === "sent");
  const preview = previewIDR(amount, rate);
  async function changeDay(value: string) {
    setDate(value);
    setAccount("");
    setAccounts([]);
    setError("");
    const result = await loadOrderChoices(value);
    setAccounts(result.accounts);
    setAccount(result.defaultId);
    setSelectedDefault(result.defaultId);
    if ("error" in result) setError(result.error);
  }
  function submit() {
    start(async () => {
      setError("");
      const payload = locked
        ? { note: note || null }
        : {
            customer_id: customer,
            business_date: date,
            cny_amount: amount,
            customer_rate: rate,
            receiving_account_id: account,
            note: note || null,
          };
      if (!attempt.current)
        attempt.current = { key: crypto.randomUUID(), payload };
      const result = await writeOrder(
        order ? "edit" : "create",
        order?.id ?? null,
        attempt.current.payload,
        attempt.current.key,
      );
      if (result.order) {
        setSaved(result.order);
        setUncertain(false);
      } else {
        setError(result.error ?? "Gagal menyimpan.");
        setUncertain(uncertain || !result.safeToEdit);
        if (result.safeToEdit && !uncertain) attempt.current = null;
      }
    });
  }
  if (saved)
    return (
      <section className="space-y-5 rounded-2xl border bg-surface p-6">
        <h2 className="text-2xl font-semibold">
          {order ? "Perubahan tersimpan" : "Order tersimpan"}
        </h2>
        <p>Rp{money(saved.expected_idr)}</p>
        <p className="text-sm">
          Buka detail untuk mencatat IDR diterima atau RMB dikirim.
        </p>
        <Link className={button + " inline-block"} href={`/orders/${saved.id}`}>
          Lihat order
        </Link>
        {!order && (
          <button
            className="ml-3 min-h-12 rounded-xl border px-4"
            onClick={() => {
              setSaved(null);
              setCustomer("");
              setAmount("");
              setRate("");
              setNote("");
              attempt.current = null;
            }}
          >
            Tambah order lain
          </button>
        )}
      </section>
    );
  return (
    <form
      className="space-y-5 rounded-2xl border bg-surface p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {locked && (
        <p className="rounded-xl bg-surface-muted p-4 text-sm">
          Pembayaran atau pengiriman sudah dikonfirmasi. Hanya catatan yang
          dapat diubah.
        </p>
      )}
      <fieldset disabled={pending || uncertain || locked} className="space-y-5">
        <label className="block text-sm font-medium">
          Tanggal order · {timezone}
          <input
            className={input}
            type="date"
            required
            value={date}
            onChange={(e) => start(() => changeDay(e.target.value))}
          />
        </label>
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Cari pelanggan
            <input
              className={input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={120}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="min-h-11 rounded-xl border px-4"
              onClick={() =>
                start(async () => {
                  const result = await searchOrderCustomers(query);
                  setCustomers(result.items);
                  if ("error" in result) setError(result.error);
                })
              }
            >
              Cari
            </button>
            <button
              type="button"
              disabled={!query.trim()}
              className="min-h-11 rounded-xl border px-4 disabled:opacity-50"
              onClick={() =>
                start(async () => {
                  const result = await addOrderCustomer(query);
                  if (result.customer) {
                    setCustomers((c) => [
                      result.customer!,
                      ...c.filter((x) => x.id !== result.customer!.id),
                    ]);
                    setCustomer(result.customer.id);
                    setError("");
                  } else setError(result.error ?? "");
                })
              }
            >
              Tambah pelanggan “{query || "nama"}”
            </button>
          </div>
          <label className="block text-sm font-medium">
            Pelanggan
            <select
              className={input}
              required
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">Pilih pelanggan</option>
              {order?.customer &&
                !customers.some((c) => c.id === order.customer_id) && (
                  <option value={order.customer_id}>
                    {order.customer.display_name}
                  </option>
                )}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Jumlah CNY
            <input
              className={input}
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              maxLength={19}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Rate pelanggan
            <input
              className={input}
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,6})?"
              maxLength={19}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
        </div>
        <div className="rounded-2xl bg-primary/5 p-5">
          <p className="text-sm">Perkiraan IDR</p>
          <output className="mt-2 block text-3xl font-semibold tabular-nums">
            {preview === null ? "—" : `Rp${money(preview)}`}
          </output>
          <p className="mt-2 text-xs text-foreground-muted">
            Dihitung ulang saat disimpan. Gunakan titik untuk pecahan.
          </p>
        </div>
        <label className="block text-sm font-medium">
          Rekening penerima
          <select
            className={input}
            required
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Pilih rekening</option>
            {order?.account &&
              account === order.receiving_account_id &&
              !accounts.some((a) => a.id === account) && (
                <option value={order.receiving_account_id} disabled>
                  {maskedAccount(order.account)} · Pilihan sebelumnya
                </option>
              )}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {maskedAccount(a)}
                {a.id === selectedDefault ? " · Default" : ""}
              </option>
            ))}
          </select>
        </label>
        {!accounts.length && !locked && (
          <p className="text-sm">
            Belum ada rekening aktif untuk tanggal ini.{" "}
            <Link
              className="text-primary underline"
              href={`/daily-accounts?date=${date}`}
            >
              Atur rekening harian
            </Link>{" "}
            lalu muat ulang formulir.
          </p>
        )}
      </fieldset>
      <label className="block text-sm font-medium">
        Catatan (opsional)
        <textarea
          className={input + " min-h-24 py-3"}
          maxLength={2000}
          disabled={pending || uncertain}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {order && !uncertain && (
        <label className="flex gap-3 text-sm">
          <input type="checkbox" required />
          Saya sudah memeriksa perubahan ini. Perubahan akan dicatat dalam
          audit.
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger/5 p-4 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {uncertain && (
        <p className="text-sm">
          Isian dikunci untuk mencoba permintaan yang sama. Jangan tutup halaman
          sampai hasilnya dipastikan.
        </p>
      )}
      <button
        className={button + " w-full"}
        disabled={
          pending ||
          (!locked && !uncertain && (!customer || !account || preview === null))
        }
      >
        {pending
          ? "Menyimpan…"
          : uncertain
            ? "Coba permintaan yang sama"
            : order
              ? "Simpan perubahan"
              : "Simpan order"}
      </button>
    </form>
  );
}
