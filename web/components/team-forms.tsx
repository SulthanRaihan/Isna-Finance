"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { writeTeam } from "@/app/team-actions";
import type { TeamActivity } from "@/lib/team-activity";
import { money, previewIDR } from "@/lib/orders/types";
const input = "mt-2 h-12 w-full rounded-xl border bg-surface px-3";
function TeamForm({
  operation,
  id = null,
  children,
  payload,
}: {
  operation: "movement" | "create" | "edit" | "pay";
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
        const data = new FormData(e.currentTarget);
        if (!request.current)
          request.current = {
            key: crypto.randomUUID(),
            payload: payload(data),
          };
        start(async () => {
          let result;
          try {
            result = await writeTeam(
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
          Saya sudah memeriksa data dan memastikan kejadian ini benar.
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button
        disabled={pending || done}
        className="min-h-12 rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50"
      >
        {done
          ? "Tersimpan"
          : pending
            ? "Menyimpan…"
            : uncertain
              ? "Coba permintaan yang sama"
              : operation === "pay"
                ? "Konfirmasi fee dibayar"
                : "Simpan"}
      </button>
      {done && <p role="status">Tersimpan. Data diperbarui di halaman ini.</p>}
      {done && operation === "movement" && (
        <button
          type="button"
          className="min-h-12 rounded-xl border px-4"
          onClick={(e) => {
            e.currentTarget.form?.reset();
            request.current = null;
            setDone(false);
            setError("");
            setUncertain(false);
          }}
        >
          Tambah pergerakan berikutnya
        </button>
      )}
    </form>
  );
}
export function MovementForm({ teamId, day }: { teamId: string; day: string }) {
  return (
    <TeamForm
      operation="movement"
      payload={(d) => ({
        team_id: teamId,
        business_date: String(d.get("day")),
        movement_type: String(d.get("kind")),
        cny_amount: String(d.get("amount")),
        order_id: String(d.get("order")) || null,
        note: String(d.get("note")) || null,
      })}
    >
      <label className="block">
        Tanggal pergerakan
        <input
          name="day"
          type="date"
          required
          defaultValue={day}
          className={input}
        />
      </label>
      <label className="block">
        Jenis
        <select name="kind" className={input}>
          <option value="received">RMB diterima</option>
          <option value="distributed">RMB didistribusikan</option>
          <option value="adjustment">Penyesuaian bertanda + / −</option>
        </select>
      </label>
      <label className="block">
        Jumlah CNY
        <input name="amount" required inputMode="decimal" className={input} />
      </label>
      <p className="text-sm text-foreground-muted">
        Diterima/distribusi memakai angka positif. Penyesuaian memakai angka
        bertanda. Pergerakan tidak menghitung fee atau mengubah status order.
      </p>
      <label className="block">
        ID order (opsional)
        <input name="order" className={input} />
      </label>
      <label className="block">
        Catatan
        <input name="note" maxLength={2000} className={input} />
      </label>
    </TeamForm>
  );
}
export function ActivityForm({
  teamId,
  day,
  rate,
  activity,
}: {
  teamId: string;
  day: string;
  rate: string;
  activity?: TeamActivity;
}) {
  const [amount, setAmount] = useState(activity?.actual_cny_handled ?? "");
  const [feeRate, setFeeRate] = useState(activity?.fee_rate ?? rate);
  const preview = previewIDR(amount, feeRate);
  return (
    <TeamForm
      operation={activity ? "edit" : "create"}
      id={activity?.id}
      payload={(d) => ({
        team_id: teamId,
        business_date: String(d.get("day")),
        actual_cny_handled: String(d.get("amount")),
        fee_rate: String(d.get("rate")),
        ...(activity ? { updated_at: activity.updated_at } : {}),
      })}
    >
      <label className="block">
        Tanggal aktivitas
        <input
          name="day"
          type="date"
          required
          defaultValue={activity?.business_date ?? day}
          className={input}
        />
      </label>
      <label className="block">
        CNY benar-benar ditangani
        <input
          name="amount"
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={input}
        />
      </label>
      <label className="block">
        Fee IDR per CNY
        <input
          name="rate"
          required
          inputMode="decimal"
          value={feeRate}
          onChange={(e) => setFeeRate(e.target.value)}
          className={input}
        />
      </label>
      <p className="text-sm text-foreground-muted">
        Perkiraan fee: {preview === null ? "—" : `Rp${money(preview)}`}. Fee
        dihitung ulang saat disimpan. Aktivitas tetap belum dibayar dan belum
        masuk Money Out.
      </p>
    </TeamForm>
  );
}
export function ActivityCard({ activity }: { activity: TeamActivity }) {
  return (
    <article className="space-y-4 rounded-2xl border bg-surface p-5">
      <h3 className="font-semibold">
        Aktivitas {activity.business_date} ·{" "}
        {activity.fee_status === "paid" ? "Fee dibayar" : "Fee belum dibayar"}
      </h3>
      <p>
        CNY {money(activity.actual_cny_handled)} × {money(activity.fee_rate)} =
        Rp{money(activity.calculated_fee_idr)}
      </p>
      {activity.fee_status === "paid" ? (
        <p>Money Out pada {activity.payment_date}. Nilai finansial terkunci.</p>
      ) : (
        <>
          <details>
            <summary className="cursor-pointer text-primary">
              Ubah aktivitas belum dibayar
            </summary>
            <ActivityForm
              key={activity.updated_at}
              activity={activity}
              teamId={activity.team_id}
              day={activity.business_date}
              rate={activity.fee_rate}
            />
          </details>
          <details>
            <summary className="cursor-pointer text-primary">
              Catat pembayaran fee
            </summary>
            <p className="my-3 text-sm">
              Konfirmasi hanya setelah fee benar-benar dibayar. Tanggal ini
              menjadi tanggal Money Out.
            </p>
            <TeamForm
              operation="pay"
              id={activity.id}
              payload={(d) => ({
                payment_date: String(d.get("payment_date")),
                updated_at: activity.updated_at,
              })}
            >
              <label className="block">
                Tanggal pembayaran sebenarnya
                <input
                  name="payment_date"
                  type="date"
                  required
                  className={input}
                />
              </label>
            </TeamForm>
          </details>
        </>
      )}
    </article>
  );
}
