export type Extraction = {
  draft: {
    customer_text: string | null;
    matched_customer_id: string | null;
    cny_amount: string | null;
    customer_rate: string | null;
  };
  candidates: { id: string; display_name: string }[];
  confidence: { customer: number; cny_amount: number; customer_rate: number };
  warnings: string[];
  multiple_orders: boolean;
};
