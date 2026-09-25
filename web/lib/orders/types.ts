import type { MasterRecord } from "@/lib/master/types";
export type Order = {
  id: string;
  customer_id: string;
  business_date: string;
  cny_amount: string;
  customer_rate: string;
  expected_idr: string;
  receiving_account_id: string;
  payment_status: "awaiting" | "received";
  fulfillment_status: "pending" | "sent";
  idr_received_at: string | null;
  cny_sent_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  ui_status: string;
  money_in_date: string | null;
  warnings: string[];
  customer?: { id: string; display_name: string; is_active?: boolean };
  account?: MasterRecord;
  audit?: Audit[];
};
export type Audit = {
  id: string;
  action: string;
  created_at: string;
  actor_user_id: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown>;
};
export type OrderResult = {
  order?: Order;
  error?: string;
  safeToEdit?: boolean;
};
export const statusLabels: Record<string, string> = {
  awaiting_payment: "Menunggu IDR",
  ready_to_send: "Siap kirim RMB",
  completed: "Selesai",
  sent_awaiting_payment: "RMB terkirim · IDR belum diterima",
};
// Integer arithmetic is a preview only; FastAPI recalculates persisted values.
export function previewIDR(amount: string, rate: string): string | null {
  if (
    !/^\d{1,16}(\.\d{1,2})?$/.test(amount) ||
    !/^\d{1,12}(\.\d{1,6})?$/.test(rate)
  )
    return null;
  const scaled = (value: string, places: number) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(places, "0"));
  };
  const cents =
    (scaled(amount, 2) * scaled(rate, 6) + BigInt(500000)) / BigInt(1000000);
  return `${cents / BigInt(100)}.${(cents % BigInt(100)).toString().padStart(2, "0")}`;
}
export function money(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (fraction && /[1-9]/.test(fraction) ? `,${fraction}` : "")
  );
}
