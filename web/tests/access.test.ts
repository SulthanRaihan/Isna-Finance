import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
vi.mock("server-only", () => ({}));
import { readAccess } from "@/lib/auth/access";

const owner = {
  id: "synthetic-owner",
  display_name: "Synthetic Owner",
  role: "owner",
};
function mockClient(
  profile: unknown = owner,
  authError: unknown = null,
  profileError: unknown = null,
) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: profile, error: profileError });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const from = vi
    .fn()
    .mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: owner.id, user_metadata: { role: "owner" } } },
        error: authError,
      }),
    },
    from,
  };
  return { client: client as unknown as SupabaseClient<Database>, from, eq };
}

describe("owner access", () => {
  it("allows only a matching verified owner", async () => {
    const { client, eq } = mockClient();
    expect(await readAccess(client)).toEqual({ status: "owner", owner });
    expect(eq).toHaveBeenCalledWith("id", owner.id);
  });
  it.each([
    null,
    { ...owner, role: "operator" },
    { ...owner, role: "developer" },
    { ...owner, id: "another-user" },
  ])(
    "denies missing or non-owner profiles despite owner metadata",
    async (profile) => {
      expect(await readAccess(mockClient(profile).client)).toEqual({
        status: "forbidden",
      });
    },
  );
  it("denies unverified sessions before reading profiles", async () => {
    const { client, from } = mockClient(owner, { status: 401 });
    expect(await readAccess(client)).toEqual({ status: "anonymous" });
    expect(from).not.toHaveBeenCalled();
  });
  it("fails closed on configuration and provider errors", async () => {
    expect(await readAccess(null)).toEqual({ status: "unavailable" });
    expect(await readAccess(mockClient(owner, { status: 503 }).client)).toEqual(
      { status: "unavailable" },
    );
    expect(
      await readAccess(
        mockClient(owner, null, { code: "missing_table" }).client,
      ),
    ).toEqual({ status: "unavailable" });
  });
});
