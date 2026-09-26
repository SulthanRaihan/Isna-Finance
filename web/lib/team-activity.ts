import type { Outflow } from "./money-out";
export type TeamActivity = {
  current_outflow?: Outflow | null;
  id: string;
  team_id: string;
  business_date: string;
  actual_cny_handled: string;
  fee_rate: string;
  calculated_fee_idr: string;
  fee_status: "unpaid" | "paid";
  payment_date: string | null;
  updated_at: string;
};
export type TeamMovement = {
  id: string;
  team_id: string;
  business_date: string;
  movement_type: string;
  cny_amount: string;
  order_id: string | null;
  note: string | null;
};
export type TeamLedger = {
  balance_cny: string;
  received_cny: string;
  distributed_cny: string;
  adjustment_cny: string;
  movements: TeamMovement[];
};
