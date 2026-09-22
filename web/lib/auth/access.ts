import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

export type Owner = { id: string; display_name: string; role: "owner" };
export type Access =
  | { status: "owner"; owner: Owner }
  | { status: "anonymous" | "forbidden" | "unavailable" };

export async function readAccess(
  client: SupabaseClient<Database> | null,
): Promise<Access> {
  if (!client) return { status: "unavailable" };
  try {
    const { data, error } = await client.auth.getUser();
    if (error) {
      const anonymous =
        error.name === "AuthSessionMissingError" ||
        error.status === 401 ||
        error.status === 403;
      return { status: anonymous ? "anonymous" : "unavailable" };
    }
    if (!data.user) return { status: "anonymous" };
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id,display_name,role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) return { status: "unavailable" };
    if (!profile || profile.id !== data.user.id || profile.role !== "owner")
      return { status: "forbidden" };
    return {
      status: "owner",
      owner: {
        id: profile.id,
        display_name: profile.display_name,
        role: "owner",
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}
