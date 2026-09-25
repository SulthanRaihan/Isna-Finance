import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  client: vi.fn(),
  api: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/access", () => ({ readAccess: mocks.access }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/master/api", () => ({
  api: mocks.api,
  actionError: () => ({ error: "Unavailable" }),
}));
import { saveRecord, saveDaily } from "@/app/master-actions";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.client.mockResolvedValue({});
});
const actions = [
  () => saveRecord("customers", null, { display_name: "Synthetic" }),
  () => saveDaily("2026-09-25", [], null),
];
it.each(["anonymous", "forbidden", "unavailable"])(
  "denies both writes without redirect when access is %s",
  async (status) => {
    mocks.access.mockResolvedValue({ status });
    for (const action of actions) {
      expect(await action()).toEqual({ error: expect.any(String) });
    }
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  },
);
it("keeps client initialization failure recoverable and denies writes", async () => {
  mocks.client.mockRejectedValue(new Error("Synthetic outage"));
  for (const action of actions) expect(await action()).toHaveProperty("error");
  expect(mocks.api).not.toHaveBeenCalled();
});
it("allows an explicit retry only after owner verification succeeds", async () => {
  mocks.access
    .mockResolvedValueOnce({ status: "unavailable" })
    .mockResolvedValue({ status: "owner" });
  expect(await actions[0]()).toHaveProperty("error");
  expect(mocks.api).not.toHaveBeenCalled();
  expect(await actions[0]()).toEqual({ ok: true });
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith("/customers", "POST", {
    display_name: "Synthetic",
  });
  expect(await actions[1]()).toEqual({ ok: true });
  expect(mocks.api).toHaveBeenLastCalledWith(
    "/daily-accounts/2026-09-25",
    "PUT",
    { active_account_ids: [], default_account_id: null },
  );
});
