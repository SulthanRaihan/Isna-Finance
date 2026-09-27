import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  ReportSummary,
  ReportAttention,
  ReportRows,
} from "@/components/reporting";
import type { DailyReport } from "@/lib/reporting";
const data: DailyReport = {
  date: "2020-01-02",
  timezone: "Asia/Jakarta",
  customer_count: 1,
  order_count: 2,
  total_cny: "2.00",
  money_in_idr: "200.00",
  money_out_idr: "19.25",
  profit_idr: "180.75",
  recorded_business_balance_idr: null,
  business_position: {
    status: "not_configured",
    amount_idr: null,
    opening: null,
  },
  orders: {
    awaiting_payment: 1,
    ready_to_send: 1,
    sent_awaiting_payment: 1,
    completed: 1,
  },
  pending_count: 2,
  category_breakdown: [],
  warnings: [
    {
      code: "sent_awaiting_payment",
      severity: "info",
      count: 1,
      section: "pending",
    },
    {
      code: "nonzero_team_balance",
      severity: "info",
      count: 1,
      section: "teams",
    },
  ],
  receiving_accounts: [],
  page: { section: "orders", limit: 20, offset: 0, total: 0, items: [] },
};
it("missing opening is visibly not configured, with distinct customer/order labels", () => {
  render(<ReportSummary data={data} />);
  expect(screen.getByText("Belum dikonfigurasi")).toBeVisible();
  expect(screen.getByText("Pelanggan unik")).toBeVisible();
  expect(screen.getByText("Jumlah order")).toBeVisible();
  expect(screen.getByText("Rp180,75")).toBeVisible();
});
it("shows signed exact positions without floating point conversion", () => {
  render(
    <ReportSummary
      data={{
        ...data,
        business_position: {
          status: "configured",
          amount_idr: "-999999999999999999.99",
          opening: {
            id: "synthetic",
            effective_date: "2020-01-02",
            opening_amount_idr: "-1.00",
          },
        },
      }}
    />,
  );
  expect(screen.getByText("Rp-999.999.999.999.999.999,99")).toBeVisible();
  expect(screen.getByText(/transaksi dari tanggal itu/)).toBeVisible();
});
it("pending explains current statuses and informational warnings", () => {
  render(<ReportAttention data={data} />);
  expect(screen.getByText(/bukan rekonstruksi status historis/)).toBeVisible();
  expect(screen.getAllByText(/bukan otomatis kesalahan/)).toHaveLength(2);
  expect(
    screen.getByRole("link", { name: /1 tim memiliki saldo/ }),
  ).toHaveAttribute("href", "/recaps?date=2020-01-02&section=teams&offset=0");
});
it("money in row shows recognition date separately from order date", () => {
  render(
    <ReportRows
      date={data.date}
      page={{
        section: "money_in",
        total: 1,
        limit: 20,
        offset: 0,
        items: [
          {
            id: "synthetic",
            business_date: "2019-12-30",
            customer_name: "Synthetic customer",
            cny_amount: "1",
            expected_idr: "100",
            payment_status: "received",
            fulfillment_status: "sent",
            money_in_date: "2020-01-02",
            account_label: "Test bank",
            account_last4: "1234",
          },
        ],
      }}
    />,
  );
  expect(
    screen.getByText(/Order 2019-12-30 · IDR diterima 2020-01-02/),
  ).toBeVisible();
});
