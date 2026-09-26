"use client";
import { CurrentPosting } from "@/components/current-posting";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { writeMoney } from "@/app/money-out-actions";
import {
  categories,
  type AtmActivity,
  type Category,
  type MoneyOperation,
  type Outflow,
} from "@/lib/money-out";
import { maskedAccount, type MasterRecord } from "@/lib/master/types";
import { money, previewIDR } from "@/lib/orders/types";
const input = "mt-2 min-h-12 w-full rounded-xl border bg-surface px-3";
function ConfirmedForm({
  operation,
  id = null,
  children,
  payload,
}: {
  operation: MoneyOperation;
  id?: string | null;
  children: ReactNode;
  payload: (data: FormData) => Record<string, unknown>;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const request = useRef<{
    key: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const router = useRouter();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || done) return;
        if (!request.current)
          request.current = {
            key: crypto.randomUUID(),
            payload: payload(new FormData(e.currentTarget)),
          };
        start(async () => {
          let result;
          try {
            result = await writeMoney(
              operation,
              id,
              request.current!.payload,
              request.current!.key,
            );
          } catch {
            result = {
              error: "Hasil belum pasti. Coba permintaan yang sama.",
              safeToEdit: false,
            };
          }
          if (result.ok) {
            setDone(true);
            setError("");
            if (result.id && ["create", "correct"].includes(operation))
              router.push(`/outflows/${result.id}`);
            router.refresh();
          } else {
            setError(result.error ?? "");
            setUncertain(uncertain || !result.safeToEdit);
            if (result.safeToEdit && !uncertain) request.current = null;
          }
        });
      }}
    >
      <fieldset disabled={pending || done || uncertain} className="space-y-4">
        {children}
        <label className="flex gap-2 text-sm">
          <input type="checkbox" required />
          Saya sudah memeriksa isian dan mengonfirmasi pencatatan ini.
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button
        disabled={pending || done}
        className="min-h-12 rounded-xl bg-primary px-5 text-primary-foreground disabled:opacity-50"
      >
        {done
          ? "Tersimpan"
          : pending
            ? "Menyimpan…"
            : uncertain
              ? "Coba permintaan yang sama"
              : operation === "void"
                ? "Konfirmasi void"
                : operation === "correct"
                  ? "Simpan koreksi"
                  : operation === "atm_pay"
                    ? "Konfirmasi fee dibayar"
                    : "Simpan"}
      </button>
      {done && (
        <p role="status">
          Tersimpan. Periksa daftar dan riwayat yang diperbarui.
        </p>
      )}
    </form>
  );
}
export function AtmForm({
  day,
  accounts,
  activity,
}: {
  day: string;
  accounts: MasterRecord[];
  activity?: AtmActivity;
}) {
  const [cny, setCny] = useState(activity?.actual_cny_handled ?? ""),
    [rate, setRate] = useState(activity?.fee_rate ?? "");
  return (
    <ConfirmedForm
      operation={activity ? "atm_edit" : "atm_create"}
      id={activity?.id}
      payload={(d) => ({
        business_date: String(d.get("day")),
        account_id: String(d.get("account")) || null,
        actual_cny_handled: String(d.get("cny")),
        fee_rate: String(d.get("rate")),
        note: String(d.get("note")) || null,
        ...(activity ? { updated_at: activity.updated_at } : {}),
      })}
    >
      <label className="block">
        Tanggal aktivitas
        <input
          className={input}
          name="day"
          type="date"
          required
          defaultValue={day}
        />
      </label>
      <label className="block">
        Rekening/kartu (opsional)
        <select
          className={input}
          name="account"
          defaultValue={activity?.account_id ?? ""}
        >
          <option value="">Tanpa rekening</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {maskedAccount(a)}
              {a.is_active ? "" : " (nonaktif)"}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        CNY yang ditangani
        <input
          className={input}
          name="cny"
          required
          inputMode="decimal"
          value={cny}
          onChange={(e) => setCny(e.target.value)}
        />
      </label>
      <label className="block">
        Fee IDR per CNY
        <input
          className={input}
          name="rate"
          required
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </label>
      <p>
        Pratinjau fee:{" "}
        {previewIDR(cny, rate) === null
          ? "—"
          : `Rp${money(previewIDR(cny, rate)!)}`}{" "}
        — dihitung ulang oleh server.
      </p>
      <p className="text-sm text-foreground-muted">
        Menyimpan aktivitas belum mencatat Money Out. Catat pembayaran setelah
        fee benar-benar dibayar.
      </p>
      <label className="block">
        Catatan
        <textarea
          className={input}
          name="note"
          maxLength={2000}
          defaultValue={activity?.note ?? ""}
        />
      </label>
    </ConfirmedForm>
  );
}
export function AtmCard({
  activity,
  accounts,
}: {
  activity: AtmActivity;
  accounts: MasterRecord[];
}) {
  return (
    <article className="space-y-4 rounded-2xl border bg-surface p-5">
      <h2 className="font-semibold">Aktivitas {activity.business_date}</h2>
      <p>
        {activity.actual_cny_handled} CNY · fee asli Rp
        {money(activity.calculated_fee_idr)}
      </p>
      <p>
        {activity.fee_status === "paid"
          ? `Sudah dibayar · tanggal asli ${activity.payment_date}`
          : "Belum dibayar"}
      </p>
      {activity.note && (
        <p className="whitespace-pre-wrap text-sm">{activity.note}</p>
      )}
      {activity.fee_status === "paid" ? (
        <>
          <p className="text-sm text-foreground-muted">
            Aktivitas terkunci. Angka di atas adalah riwayat asli; koreksi
            dicatat pada posting pengganti.
          </p>
          <CurrentPosting outflow={activity.current_outflow} />
        </>
      ) : (
        <>
          <details>
            <summary className="cursor-pointer text-primary">
              Ubah aktivitas
            </summary>
            <AtmForm
              key={activity.updated_at}
              day={activity.business_date}
              accounts={accounts}
              activity={activity}
            />
          </details>
          <details>
            <summary className="cursor-pointer text-primary">
              Catat pembayaran fee
            </summary>
            <p className="my-3 text-sm">
              Isi tanggal uang fee benar-benar keluar. Pembayaran ini
              menghasilkan satu Money Out.
            </p>
            <ConfirmedForm
              operation="atm_pay"
              id={activity.id}
              payload={(d) => ({
                payment_date: String(d.get("payment_date")),
                updated_at: activity.updated_at,
              })}
            >
              <label className="block">
                Tanggal pembayaran sebenarnya
                <input
                  className={input}
                  name="payment_date"
                  type="date"
                  required
                />
              </label>
            </ConfirmedForm>
          </details>
        </>
      )}
    </article>
  );
}
export function OutflowForm({
  day,
  outflow,
}: {
  day: string;
  outflow?: Outflow;
}) {
  const [category, setCategory] = useState<Category>(
      outflow?.category ?? "rmb_purchase",
    ),
    [cny, setCny] = useState(outflow?.cny_amount ?? ""),
    [rate, setRate] = useState(outflow?.rate_or_fee ?? "");
  const formula = ["rmb_purchase", "team_fee", "atm_card_fee"].includes(
    category,
  );
  return (
    <ConfirmedForm
      operation={outflow ? "correct" : "create"}
      id={outflow?.id}
      payload={(d) => ({
        business_date: String(d.get("day")),
        description: String(d.get("description")),
        ...(outflow
          ? { updated_at: outflow.updated_at, reason: String(d.get("reason")) }
          : { category }),
        ...(formula
          ? {
              cny_amount: String(d.get("cny")),
              rate_or_fee: String(d.get("rate")),
            }
          : { amount_idr: String(d.get("idr")) }),
      })}
    >
      {outflow ? (
        <>
          <p>
            Koreksi {categories[category]}. Posting lama akan di-void dan
            posting pengganti dibuat bersama. Ini tidak mencatat refund.
          </p>
          <label className="block">
            Alasan koreksi
            <textarea
              className={input}
              name="reason"
              required
              maxLength={2000}
            />
          </label>
        </>
      ) : (
        <label className="block">
          Kategori
          <select
            className={input}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {(["rmb_purchase", "exchange_fee", "other"] as const).map((k) => (
              <option key={k} value={k}>
                {categories[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        Tanggal uang sebenarnya keluar
        <input
          className={input}
          type="date"
          name="day"
          defaultValue={day}
          required
        />
      </label>
      <label className="block">
        Keterangan
        <textarea
          className={input}
          name="description"
          required
          maxLength={2000}
          defaultValue={outflow?.description ?? ""}
        />
      </label>
      {formula ? (
        <>
          <label className="block">
            Jumlah CNY
            <input
              className={input}
              name="cny"
              inputMode="decimal"
              required
              value={cny}
              onChange={(e) => setCny(e.target.value)}
            />
          </label>
          <label className="block">
            {category === "rmb_purchase"
              ? "Kurs beli IDR per CNY"
              : "Fee IDR per CNY"}
            <input
              className={input}
              name="rate"
              inputMode="decimal"
              required
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
          <p>
            Pratinjau:{" "}
            {previewIDR(cny, rate) === null
              ? "—"
              : `Rp${money(previewIDR(cny, rate)!)}`}{" "}
            — dihitung ulang oleh server.
          </p>
        </>
      ) : (
        <label className="block">
          Jumlah IDR aktual
          <input
            className={input}
            name="idr"
            inputMode="decimal"
            required
            defaultValue={outflow?.amount_idr ?? ""}
          />
        </label>
      )}
    </ConfirmedForm>
  );
}
export function VoidForm({ outflow }: { outflow: Outflow }) {
  return (
    <ConfirmedForm
      operation="void"
      id={outflow.id}
      payload={(d) => ({
        reason: String(d.get("reason")),
        updated_at: outflow.updated_at,
      })}
    >
      <p>
        Void membatalkan validitas pencatatan dan mengeluarkannya dari Money
        Out. Riwayat tetap disimpan. Ini bukan refund uang nyata.
      </p>
      <label className="block">
        Alasan void
        <textarea className={input} name="reason" required maxLength={2000} />
      </label>
    </ConfirmedForm>
  );
}
