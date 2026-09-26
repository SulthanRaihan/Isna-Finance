export const categories = {
  rmb_purchase: "Pembelian RMB",
  team_fee: "Fee tim",
  atm_card_fee: "Fee ATM/card",
  exchange_fee: "Fee penukaran",
  other: "Pengeluaran lain",
};
export type Category = keyof typeof categories;
export type Outflow = {
  id: string;
  business_date: string;
  category: Category;
  description: string;
  amount_idr: string;
  cny_amount: string | null;
  rate_or_fee: string | null;
  source_type: string | null;
  source_id: string | null;
  status: "posted" | "voided";
  replaces_id: string | null;
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};
export type AtmActivity = {
  id: string;
  account_id: string | null;
  business_date: string;
  actual_cny_handled: string;
  fee_rate: string;
  calculated_fee_idr: string;
  fee_status: "unpaid" | "paid";
  payment_date: string | null;
  note: string | null;
  updated_at: string;
  current_outflow: Outflow | null;
};
export type OutflowDetail = {
  outflow: Outflow;
  chain: Outflow[];
  audit: {
    id: string;
    entity_id: string;
    action: string;
    created_at: string;
    before_json: Record<string, unknown> | null;
    after_json: Record<string, unknown> | null;
  }[];
};
export type MoneyOperation =
  "atm_create" | "atm_edit" | "atm_pay" | "create" | "void" | "correct";
