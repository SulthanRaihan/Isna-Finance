export type Entity = "customers" | "accounts" | "teams";
export type MasterRecord = {
  id: string;
  display_name?: string;
  note?: string | null;
  label?: string;
  bank_name?: string;
  country_code?: string;
  account_last4?: string | null;
  account_type?: string | null;
  name?: string;
  default_fee_rate?: string;
  is_active: boolean;
};
export type Assignment = {
  account_id: string;
  business_date: string;
  is_default: boolean;
};
export type ActionResult = {
  ok?: boolean;
  error?: string;
  conflicts?: Assignment[];
  fields?: Record<string, string>;
};
export function maskedAccount(record: MasterRecord) {
  return `${record.label}  ${record.bank_name}${record.account_last4 ? ` ••••${record.account_last4}` : ""}`;
}
