import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  access: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
  })),
}));
vi.mock("@/lib/auth/access", () => ({ readAccess: mocks.access }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { login, logout } from "@/app/auth-actions";
function form(
  email = "owner@example.test",
  password = "synthetic-only-password",
) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.access.mockResolvedValue({
    status: "owner",
    owner: { id: "synthetic" },
  });
});
describe("auth actions", () => {
  it("validates fields before contacting Supabase", async () => {
    expect((await login({}, form("invalid", ""))).error).toBeTruthy();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("keeps password whitespace unchanged and redirects only a verified owner", async () => {
    await expect(
      login({}, form(" owner@example.test ", " password ")),
    ).rejects.toThrow("redirect:/");
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "owner@example.test",
      password: " password ",
    });
  });
  it("returns generic errors without provider details or password", async () => {
    mocks.signIn.mockResolvedValue({
      error: { message: "private-provider-detail" },
    });
    const result = await login({}, form());
    expect(result.error).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(
      /private-provider-detail|synthetic-only-password/,
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("clears the local session for a non-owner", async () => {
    mocks.access.mockResolvedValue({ status: "forbidden" });
    expect((await login({}, form())).error).toMatch(/belum memiliki akses/);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("logs out the current session", async () => {
    await expect(logout()).rejects.toThrow("redirect:/login");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("does not claim successful logout when the provider fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "offline" } });
    await expect(logout()).rejects.toThrow("redirect:/access?reason=logout");
  });
});
