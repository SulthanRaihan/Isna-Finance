import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  readAccess: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/auth/access", () => ({ readAccess: mocks.readAccess }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireOwner } from "@/lib/auth/guard";
beforeEach(() => vi.clearAllMocks());
describe("protected page guard", () => {
  it.each([
    ["anonymous", "/login"],
    ["forbidden", "/access?reason=forbidden"],
    ["unavailable", "/access?reason=unavailable"],
  ])("redirects %s without protected data", async (status, destination) => {
    mocks.readAccess.mockResolvedValue({ status });
    await expect(requireOwner()).rejects.toThrow(`redirect:${destination}`);
  });
  it("returns the verified owner", async () => {
    const owner = {
      id: "synthetic",
      display_name: "Synthetic Owner",
      role: "owner",
    };
    mocks.readAccess.mockResolvedValue({ status: "owner", owner });
    expect(await requireOwner()).toEqual(owner);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
