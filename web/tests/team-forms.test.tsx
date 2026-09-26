import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const write = vi.hoisted(() => vi.fn());
vi.mock("@/app/team-actions", () => ({ writeTeam: write }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { ActivityCard, MovementForm } from "@/components/team-forms";
const activity = {
  id: "synthetic-id",
  team_id: "synthetic-team",
  business_date: "2020-01-01",
  actual_cny_handled: "1.00",
  fee_rate: "100.005000",
  calculated_fee_idr: "100.01",
  fee_status: "unpaid" as const,
  payment_date: null,
  updated_at: "2020-01-01T00:00:00Z",
};
beforeEach(() => vi.resetAllMocks());
it("paid activity hides financial editing and payment actions", () => {
  render(
    <ActivityCard
      activity={{ ...activity, fee_status: "paid", payment_date: "2020-01-03" }}
    />,
  );
  expect(screen.getByText(/Money Out pada 2020-01-03/)).toBeVisible();
  expect(screen.queryByText("Ubah aktivitas belum dibayar")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Konfirmasi fee dibayar" }),
  ).toBeNull();
});
it("uncertain movement retry preserves exact payload and key", async () => {
  write
    .mockResolvedValueOnce({ error: "Uncertain", safeToEdit: false })
    .mockResolvedValueOnce({ ok: true });
  render(<MovementForm teamId="synthetic-team" day="2020-01-01" />);
  fireEvent.change(screen.getByLabelText("Jumlah CNY"), {
    target: { value: "12.50" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
  await screen.findByRole("button", { name: "Coba permintaan yang sama" });
  expect(screen.getByLabelText("Jumlah CNY")).toBeDisabled();
  const initial = write.mock.calls[0];
  fireEvent.click(
    screen.getByRole("button", { name: "Coba permintaan yang sama" }),
  );
  await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  expect(write.mock.calls[1]).toEqual(initial);
});
