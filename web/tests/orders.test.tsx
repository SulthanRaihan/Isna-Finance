import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  writeOrder: vi.fn(),
  loadOrderChoices: vi.fn(),
  searchOrderCustomers: vi.fn(),
  addOrderCustomer: vi.fn(),
}));
vi.mock("@/app/order-actions", () => mocks);
import { OrderEditor } from "@/components/order-editor";
import { money, previewIDR, type Order } from "@/lib/orders/types";
const account = {
  id: "30000000-0000-4000-8000-000000000001",
  label: "Synthetic A",
  bank_name: "Demo",
  account_last4: "1234",
  is_active: true,
};
const customer = {
  id: "20000000-0000-4000-8000-000000000001",
  display_name: "Synthetic Customer",
  is_active: true,
};
const props = {
  day: "2026-09-25",
  timezone: "Asia/Jakarta",
  initialAccounts: [account],
  defaultId: account.id,
  initialCustomers: [customer],
};
const order: Order = {
  id: "10000000-0000-4000-8000-000000000001",
  customer_id: customer.id,
  business_date: props.day,
  cny_amount: "1.00",
  customer_rate: "100.005000",
  expected_idr: "100.01",
  receiving_account_id: account.id,
  payment_status: "awaiting",
  fulfillment_status: "pending",
  idr_received_at: null,
  cny_sent_at: null,
  note: null,
  created_at: "",
  updated_at: "",
  ui_status: "awaiting_payment",
  money_in_date: null,
  warnings: [],
};
beforeEach(() => vi.resetAllMocks());
it.each([
  ["1", "100.005", "100.01"],
  ["0.01", "0.5", "0.01"],
  ["9999999999999999.99", "1", "9999999999999999.99"],
])("previews %s times %s without floating point", (amount, rate, expected) => {
  expect(previewIDR(amount, rate)).toBe(expected);
});
it("formats large values without numeric conversion", () =>
  expect(money("9999999999999999.99")).toBe("9.999.999.999.999.999,99"));
it.each(["payment", "fulfillment"])(
  "locks material fields after %s confirmation",
  (state) => {
    render(
      <OrderEditor
        {...props}
        order={{
          ...order,
          payment_status: state === "payment" ? "received" : "awaiting",
          fulfillment_status: state === "fulfillment" ? "sent" : "pending",
        }}
      />,
    );
    expect(screen.getByLabelText("Jumlah CNY")).toBeDisabled();
    expect(screen.getByLabelText("Rate pelanggan")).toBeDisabled();
    expect(screen.getByLabelText("Rekening penerima")).toBeDisabled();
    expect(screen.getByLabelText("Pelanggan")).toBeDisabled();
    expect(screen.getByLabelText("Catatan (opsional)")).toBeEnabled();
  },
);
it("keeps the exact payload and idempotency key after an uncertain result", async () => {
  mocks.writeOrder
    .mockResolvedValueOnce({ error: "Uncertain", safeToEdit: false })
    .mockResolvedValueOnce({ order });
  render(<OrderEditor {...props} />);
  fireEvent.change(screen.getByLabelText("Pelanggan"), {
    target: { value: customer.id },
  });
  fireEvent.change(screen.getByLabelText("Jumlah CNY"), {
    target: { value: "1.00" },
  });
  fireEvent.change(screen.getByLabelText("Rate pelanggan"), {
    target: { value: "100.005" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Simpan order" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Uncertain");
  expect(screen.getByLabelText("Jumlah CNY")).toBeDisabled();
  const original = mocks.writeOrder.mock.calls[0];
  fireEvent.click(
    await screen.findByRole("button", { name: "Coba permintaan yang sama" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Order tersimpan" }),
  ).toBeVisible();
  expect(mocks.writeOrder.mock.calls[1]).toEqual(original);
});
it("keeps editable inputs after a definite validation rejection", async () => {
  mocks.writeOrder.mockResolvedValue({ error: "Invalid", safeToEdit: true });
  render(<OrderEditor {...props} order={order} />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid");
  await waitFor(() =>
    expect(screen.getByLabelText("Jumlah CNY")).toBeEnabled(),
  );
  expect(screen.getByLabelText("Jumlah CNY")).toHaveValue("1.00");
});
it("reloads date-specific choices without creating assignments", async () => {
  mocks.loadOrderChoices.mockResolvedValue({ accounts: [], defaultId: "" });
  render(<OrderEditor {...props} />);
  fireEvent.change(screen.getByLabelText(/Tanggal order/), {
    target: { value: "2026-09-26" },
  });
  await waitFor(() =>
    expect(mocks.loadOrderChoices).toHaveBeenCalledWith("2026-09-26"),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Rekening penerima")).toHaveValue(""),
  );
  expect(mocks.writeOrder).not.toHaveBeenCalled();
  expect(
    await screen.findByRole("button", { name: "Simpan order" }),
  ).toBeDisabled();
});
