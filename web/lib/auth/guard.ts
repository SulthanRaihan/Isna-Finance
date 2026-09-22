import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAccess } from "./access";

export async function requireOwner() {
  const access = await readAccess(await createClient());
  if (access.status === "owner") return access.owner;
  if (access.status === "anonymous") redirect("/login");
  redirect(`/access?reason=${access.status}`);
}
