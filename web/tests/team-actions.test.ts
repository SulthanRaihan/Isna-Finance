import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  api: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/access", () => ({ readAccess: mocks.access }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/orders/data", () => ({
  choices: vi.fn(),
  orderCustomers: vi.fn(),
}));
vi.mock("@/lib/master/api", () => ({
  api: mocks.api,
  ApiError: class extends Error {},
}));
import { writeTeam } from "@/app/team-actions";
beforeEach(() => vi.resetAllMocks());
it.each(["anonymous", "forbidden", "unavailable"])(
  "denies team writes for %s",
  async (status) => {
    mocks.access.mockResolvedValue({ status });
    expect(await writeTeam("create", null, {}, "synthetic-key")).toHaveProperty(
      "error",
    );
    expect(mocks.api).not.toHaveBeenCalled();
  },
);
it("forwards the same retry key and does not auto-retry an uncertain request", async () => {
  mocks.access.mockResolvedValue({ status: "owner" });
  mocks.api.mockRejectedValue(new Error("Synthetic transport failure"));
  const payload = { cny_amount: "1.00" };
  expect(
    await writeTeam("create", null, payload, "synthetic-key"),
  ).toMatchObject({ safeToEdit: false });
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith(
    "/team-activities",
    "POST",
    payload,
    "synthetic-key",
  );
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
