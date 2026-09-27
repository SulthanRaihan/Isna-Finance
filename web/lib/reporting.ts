import type { Outflow } from "./money-out";
export const sections = {
  orders: "Order tanggal pilihan",
  money_in: "Money In",
  outflows: "Money Out",
  pending: "Perlu ditindaklanjuti",
  teams: "Saldo tim",
};
export type ReportSection = keyof typeof sections;
export type ReportOrder = {
  id: string;
  business_date: string;
  customer_name: string;
  cny_amount: string;
  expected_idr: string;
  payment_status: "awaiting" | "received";
  fulfillment_status: "pending" | "sent";
  money_in_date: string | null;
  account_label: string;
  account_last4: string | null;
};
export type ReportTeam = {
  id: string;
  name: string;
  is_active: boolean;
  balance_cny: string;
};
export type ReportPage = { limit: number; offset: number; total: number } & (
  | { section: "orders" | "money_in" | "pending"; items: ReportOrder[] }
  | { section: "outflows"; items: Outflow[] }
  | { section: "teams"; items: ReportTeam[] }
);
export type DailyReport = {
  date: string;
  timezone: string;
  customer_count: number;
  order_count: number;
  total_cny: string;
  money_in_idr: string;
  money_out_idr: string;
  profit_idr: string;
  recorded_business_balance_idr: string | null;
  business_position:
    | { status: "not_configured"; amount_idr: null; opening: null }
    | {
        status: "configured";
        amount_idr: string;
        opening: {
          id: string;
          effective_date: string;
          opening_amount_idr: string;
        };
      };
  orders: {
    awaiting_payment: number;
    ready_to_send: number;
    sent_awaiting_payment: number;
    completed: number;
  };
  pending_count: number;
  category_breakdown: { category: Outflow["category"]; amount_idr: string }[];
  warnings: {
    code: "sent_awaiting_payment" | "nonzero_team_balance";
    severity: "info";
    count: number;
    section: ReportSection;
  }[];
  receiving_accounts: {
    id: string;
    label: string;
    bank_name: string;
    account_last4: string | null;
    is_default: boolean;
    is_active: boolean;
  }[];
  page: ReportPage;
};
export function recapLink(
  date: string,
  section: ReportSection = "orders",
  offset = 0,
) {
  return `/recaps?${new URLSearchParams({ date, section, offset: String(offset) })}`;
}
