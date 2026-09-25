"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { writeOrder } from "@/app/order-actions";
import type { Order } from "@/lib/orders/types";
export function OrderTransitions({
  order,
  timezone,
}: {
  order: Order;
  timezone: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {order.payment_status === "awaiting" && (
        <Transition
          id={order.id}
          operation="receive-payment"
          timezone={timezone}
        />
      )}{" "}
      {order.fulfillment_status === "pending" && (
        <Transition id={order.id} operation="mark-sent" timezone={timezone} />
      )}
    </div>
  );
}
function Transition({
  id,
  operation,
  timezone,
}: {
  id: string;
  operation: "receive-payment" | "mark-sent";
  timezone: string;
}) {
  const router = useRouter(),
    [stamp, setStamp] = useState(""),
    [offset, setOffset] = useState(timezone === "Asia/Jakarta" ? "+07:00" : ""),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    [uncertain, setUncertain] = useState(false),
    [done, setDone] = useState(false);
  const request = useRef<{
    key: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const receiving = operation === "receive-payment";
  return (
    <form
      className="space-y-4 rounded-2xl border bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (!request.current)
            request.current = {
              key: crypto.randomUUID(),
              payload: {
                [receiving ? "received_at" : "sent_at"]:
                  `${stamp.length === 16 ? stamp + ":00" : stamp}${offset}`,
              },
            };
          const result = await writeOrder(
            operation,
            id,
            request.current.payload,
            request.current.key,
          );
          if (result.order) {
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
      <h2 className="font-semibold">
        {receiving ? "Konfirmasi IDR diterima" : "Konfirmasi RMB dikirim"}
      </h2>
      <p className="text-sm text-foreground-muted">
        Catat waktu kejadian sebenarnya. Tanggal pelaporan mengikuti {timezone}.
      </p>
      <label className="block text-sm">
        Tanggal dan jam kejadian
        <input
          className="mt-2 h-12 w-full rounded-xl border px-3"
          required
          type="datetime-local"
          step="1"
          value={stamp}
          disabled={pending || uncertain || done}
          onChange={(e) => setStamp(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Zona waktu kejadian (UTC; WIB +07:00)
        <input
          className="mt-2 h-12 w-full rounded-xl border px-3"
          required
          pattern="[+-](0[0-9]|1[0-4]):[0-5][0-9]"
          placeholder="+07:00"
          value={offset}
          disabled={pending || uncertain || done}
          onChange={(e) => setOffset(e.target.value)}
        />
      </label>
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          required
          disabled={pending || uncertain || done}
        />
        Saya memastikan {receiving ? "IDR sudah diterima" : "RMB sudah dikirim"}{" "}
        pada waktu tersebut.
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        className="min-h-12 w-full rounded-xl bg-primary px-4 text-primary-foreground disabled:opacity-50"
        disabled={pending || done}
      >
        {done
          ? "Tercatat"
          : pending
            ? "Menyimpan…"
            : uncertain
              ? "Coba permintaan yang sama"
              : receiving
                ? "Tandai IDR diterima"
                : "Tandai RMB dikirim"}
      </button>
    </form>
  );
}
