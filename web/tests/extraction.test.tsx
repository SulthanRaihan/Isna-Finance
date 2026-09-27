import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({
  beginExtractionUpload: vi.fn(),
  extractScreenshot: vi.fn(),
  cancelExtractionUpload: vi.fn(),
}));
vi.mock("@/app/extraction-actions", () => actions);
import { ScreenshotExtractor } from "@/components/screenshot-extractor";
const draft = {
  draft: {
    customer_text: "Synthetic",
    matched_customer_id: null,
    cny_amount: "100.25",
    customer_rate: "2300.005",
  },
  confidence: { customer: 0.8, cny_amount: 0.9, customer_rate: 0.7 },
  warnings: ["SELECT_CUSTOMER"],
  candidates: [],
  multiple_orders: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  actions.beginExtractionUpload.mockResolvedValue({
    ticket: {
      job_id: "synthetic-job",
      upload_url: "https://synthetic.test/upload",
    },
  });
  actions.extractScreenshot.mockResolvedValue({ result: draft });
  actions.cancelExtractionUpload.mockResolvedValue(undefined);
});
function upload(type = "image/png") {
  fireEvent.change(screen.getByLabelText("Pilih screenshot"), {
    target: { files: [new File(["synthetic"], "test.png", { type })] },
  });
}
it("requires explicit apply and cleans up after extraction", async () => {
  const apply = vi.fn();
  render(<ScreenshotExtractor onApply={apply} />);
  upload();
  await screen.findByText("Draft belum tersimpan — periksa setiap isian");
  await waitFor(() =>
    expect(actions.cancelExtractionUpload).toHaveBeenCalledWith(
      "synthetic-job",
    ),
  );
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Terapkan draft ke form" }),
  );
  expect(apply).toHaveBeenCalledWith(draft);
});
it("multiple orders cannot be applied", async () => {
  actions.extractScreenshot.mockResolvedValue({
    result: { ...draft, multiple_orders: true },
  });
  const apply = vi.fn();
  render(<ScreenshotExtractor onApply={apply} />);
  upload();
  await screen.findByText(/Screenshot tampak berisi beberapa order/);
  expect(
    screen.queryByRole("button", { name: "Terapkan draft ke form" }),
  ).not.toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});
it("rejects unsupported file before requesting a ticket", () => {
  render(<ScreenshotExtractor onApply={vi.fn()} />);
  upload("image/webp");
  expect(screen.getByRole("alert")).toHaveTextContent("PNG/JPEG");
  expect(actions.beginExtractionUpload).not.toHaveBeenCalled();
});
it("provider failure leaves a manual fallback and requests cleanup", async () => {
  actions.extractScreenshot.mockResolvedValue({
    error: "Gunakan isian manual",
  });
  render(<ScreenshotExtractor onApply={vi.fn()} />);
  upload();
  await screen.findByText("Gunakan isian manual");
  await waitFor(() =>
    expect(actions.cancelExtractionUpload).toHaveBeenCalled(),
  );
});
