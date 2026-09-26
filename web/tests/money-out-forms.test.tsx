import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const write = vi.hoisted(() => vi.fn());
vi.mock("@/app/money-out-actions", () => ({ writeMoney: write }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
import { AtmCard, OutflowForm, VoidForm } from "@/components/money-out-forms";
import type { Outflow } from "@/lib/money-out";
const outflow: Outflow = {
  id: "synthetic-id",
  business_date: "2020-01-03",
  category: "exchange_fee",
  description: "Synthetic fee",
  amount_idr: "100.01",
  cny_amount: null,
  rate_or_fee: null,
  source_type: null,
  source_id: null,
  status: "posted",
  replaces_id: null,
  void_reason: null,
  voided_at: null,
  created_at: "2020-01-03T00:00:00Z",
  updated_at: "2020-01-03T00:00:00Z",
};
beforeEach(() => vi.resetAllMocks());
it("exchange fees submit actual IDR without a rate", async () => {
  write.mockResolvedValue({ ok: true });
  render(<OutflowForm day="2020-01-01" />);
  fireEvent.change(screen.getByLabelText("Kategori"), {
    target: { value: "exchange_fee" },
  });
  expect(screen.queryByLabelText("Jumlah CNY")).toBeNull();
  fireEvent.change(screen.getByLabelText("Jumlah IDR aktual"), {
    target: { value: "19.25" },
  });
  fireEvent.change(screen.getByLabelText("Keterangan"), {
    target: { value: "Synthetic" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  expect(write.mock.calls[0][2]).toEqual({
    category: "exchange_fee",
    business_date: "2020-01-01",
    description: "Synthetic",
    amount_idr: "19.25",
  });
});
it("uncertain correction freezes the exact request and idempotency key", async () => {
  write
    .mockResolvedValueOnce({ error: "Uncertain", safeToEdit: false })
    .mockResolvedValueOnce({ ok: true });
  render(<OutflowForm day={outflow.business_date} outflow={outflow} />);
  fireEvent.change(screen.getByLabelText("Alasan koreksi"), {
    target: { value: "Synthetic correction" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Simpan koreksi" }));
  await screen.findByRole("button", { name: "Coba permintaan yang sama" });
  expect(screen.getByLabelText("Jumlah IDR aktual")).toBeDisabled();
  const first = write.mock.calls[0];
  fireEvent.click(
    screen.getByRole("button", { name: "Coba permintaan yang sama" }),
  );
  await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  expect(write.mock.calls[1]).toEqual(first);
  expect(first[2].updated_at).toBe(outflow.updated_at);
});
it("paid ATM shows current voided posting and no second payment", () => {
  render(
    <AtmCard
      accounts={[]}
      activity={{
        id: "synthetic-atm",
        account_id: null,
        business_date: "2020-01-01",
        actual_cny_handled: "5600",
        fee_rate: "1.7",
        calculated_fee_idr: "9520",
        fee_status: "paid",
        payment_date: "2020-01-03",
        updated_at: outflow.updated_at,
        note: null,
        current_outflow: { ...outflow, status: "voided" },
      }}
    />,
  );
  expect(screen.getByText(/Voided · tidak dihitung/)).toBeVisible();
  expect(screen.queryByText("Catat pembayaran fee")).toBeNull();
  expect(screen.queryByText("Ubah aktivitas")).toBeNull();
});
it("void explains accounting invalidation and requires a reason", () => {
  render(<VoidForm outflow={outflow} />);
  expect(screen.getByLabelText("Alasan void")).toBeRequired();
  expect(screen.getByText(/bukan refund/)).toBeVisible();
});
