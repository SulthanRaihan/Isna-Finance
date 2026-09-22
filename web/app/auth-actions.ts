"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAccess } from "@/lib/auth/access";
import type { LoginState } from "@/lib/auth/state";

export async function login(
  _previous: LoginState,
  form: FormData,
): Promise<LoginState> {
  const rawEmail = form.get("email");
  const password = form.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    !password ||
    password.length > 4096
  ) {
    return { error: "Masukkan email dan kata sandi yang valid.", email };
  }
  const client = await createClient();
  if (!client)
    return { error: "Login belum tersedia. Silakan coba lagi nanti.", email };
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        error:
          "Login tidak berhasil. Periksa email dan kata sandi, lalu coba lagi.",
        email,
      };
    const access = await readAccess(client);
    if (access.status !== "owner") {
      await client.auth.signOut({ scope: "local" });
      return {
        error:
          access.status === "forbidden"
            ? "Akun ini belum memiliki akses ke ruang kerja Isna."
            : "Akses belum dapat diverifikasi. Silakan coba lagi nanti.",
        email,
      };
    }
  } catch {
    return {
      error: "Layanan login belum dapat dihubungi. Silakan coba lagi.",
      email,
    };
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const client = await createClient();
  if (client) {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) redirect("/access?reason=logout");
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
