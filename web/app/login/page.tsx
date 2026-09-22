import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { readAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { publicSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const access = await readAccess(await createClient());
  if (access.status === "owner") redirect("/");
  if (access.status === "forbidden") redirect("/access?reason=forbidden");
  return (
    <main className="flex min-h-dvh items-center justify-center p-5 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border bg-surface shadow-[0_12px_60px_-32px_#18243b40] lg:grid-cols-2">
        <section
          className="hidden flex-col justify-between border-r bg-surface p-10 lg:flex"
          aria-label="Isna Finance"
        >
          <span className="text-sm font-semibold tracking-wide text-primary">
            RUANG KERJA ISNA
          </span>
          <Image
            src="/brand/isna-finance-logo.png"
            alt="Isna Finance — Simple Finance, Brighter Days"
            width={1254}
            height={1254}
            priority
            className="my-3 w-full"
          />
          <div>
            <p className="text-2xl font-semibold tracking-tight">
              Hari lebih ringan.
              <br />
              Catatan lebih rapi.
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground-muted">
              Satu tempat untuk mendampingi aktivitas keuangan sehari-hari.
            </p>
          </div>
        </section>
        <section className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12">
          <div className="mb-6 flex justify-center lg:hidden">
            <Image
              src="/brand/isna-finance-logo.png"
              alt="Isna Finance"
              width={1254}
              height={1254}
              priority
              className="w-44"
            />
          </div>
          <p className="mb-2 text-sm font-medium text-primary">
            Selamat datang kembali
          </p>
          <h1 className="text-[28px] font-semibold tracking-tight">
            Halo, Isna.
          </h1>
          <p className="mt-3 mb-8 text-sm leading-6 text-foreground-muted">
            Masuk untuk membuka ruang kerjamu.
          </p>
          <LoginForm disabled={!publicSupabaseConfig()} />
          <div className="mt-8 flex items-center justify-center gap-2 border-t pt-6 text-xs text-foreground-muted">
            <ShieldCheck size={16} aria-hidden="true" />
            Akses pribadi, khusus Isna.
          </div>
        </section>
      </div>
    </main>
  );
}
