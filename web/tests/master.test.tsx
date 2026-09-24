import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ saveRecord: vi.fn(), saveDaily: vi.fn() }));
vi.mock("@/app/master-actions", () => mocks);
import { ActiveToggle, MasterEditor } from "@/components/master-editor";
import { DailyAccountEditor } from "@/components/daily-account-editor";
const account = {
  id: "synthetic-a",
  label: "Synthetic account",
  bank_name: "Demo",
  account_last4: "1234",
  is_active: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveDaily.mockResolvedValue({ ok: true });
});
it("returns conflict links without silently changing default", async () => {
  mocks.saveRecord.mockResolvedValue({
    error: "Resolve assignments",
    conflicts: [
      { account_id: account.id, business_date: "2026-09-23", is_default: true },
    ],
  });
  render(<ActiveToggle entity="accounts" record={account} />);
  fireEvent.click(screen.getByRole("button", { name: "Nonaktifkan" }));
  expect(await screen.findByRole("link")).toHaveAttribute(
    "href",
    "/daily-accounts?date=2026-09-23",
  );
  expect(mocks.saveDaily).not.toHaveBeenCalled();
});
it("requires explicit default resolution after unselecting it", () => {
  render(
    <DailyAccountEditor
      day="2026-09-23"
      accounts={[account]}
      assignments={[
        {
          account_id: account.id,
          business_date: "2026-09-23",
          is_default: true,
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox"));
  expect(
    screen.getByRole("button", { name: "Simpan pilihan harian" }),
  ).toBeDisabled();
  expect(screen.getByRole("combobox")).toHaveValue(account.id);
});
it("can explicitly clear a date without choosing another default", async () => {
  render(
    <DailyAccountEditor
      day="2026-09-23"
      accounts={[account]}
      assignments={[]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Simpan pilihan harian" }),
  );
  await waitFor(() =>
    expect(mocks.saveDaily).toHaveBeenCalledWith("2026-09-23", [], null),
  );
});
it("preserves form values on API failure and does not report success", async () => {
  mocks.saveRecord.mockResolvedValue({ error: "Unavailable" });
  render(<MasterEditor entity="customers" />);
  fireEvent.change(screen.getByRole("textbox", { name: "Nama pelanggan" }), {
    target: { value: "Synthetic Customer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Simpan" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
  expect(screen.getByRole("textbox", { name: "Nama pelanggan" })).toHaveValue(
    "Synthetic Customer",
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
