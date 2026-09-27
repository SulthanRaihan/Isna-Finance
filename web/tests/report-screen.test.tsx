import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/master/api", () => ({ api: request }));
vi.mock("@/lib/auth/guard", () => ({
  requireOwner: async () => ({ display_name: "Synthetic owner" }),
}));
vi.mock("@/app/auth-actions", () => ({ logout: vi.fn() }));
import { ReportScreen } from "@/components/report-screen";
it("unavailable backend never becomes a zero-money dashboard", async () => {
  request.mockRejectedValue(new Error("Unavailable"));
  render(await ReportScreen({ search: { date: "2020-01-02" } }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Ringkasan belum tersedia",
  );
  expect(screen.queryByText("Rp0")).toBeNull();
  expect(screen.queryByLabelText("Ringkasan keuangan")).toBeNull();
});
