import Link from "next/link";
import { Users, Landmark, ContactRound, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireOwner } from "@/lib/auth/guard";
export const dynamic = "force-dynamic";
export default async function MorePage() {
  await requireOwner();
  return (
    <AppShell activePath="/more">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-foreground-muted">Persiapan operasional</p>
          <h1 className="mt-1 text-3xl font-semibold">Data operasional</h1>
          <p className="mt-3 text-foreground-muted">
            Kelola data yang akan digunakan saat mencatat order.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              href: "/customers",
              title: "Pelanggan",
              text: "Nama dan catatan pelanggan berulang.",
              icon: ContactRound,
            },
            {
              href: "/accounts",
              title: "Rekening",
              text: "Label bank dan identitas yang disamarkan.",
              icon: Landmark,
            },
            {
              href: "/teams",
              title: "Tim",
              text: "Nama tim dan tarif default per CNY.",
              icon: Users,
            },
            {
              href: "/daily-accounts",
              title: "Rekening harian",
              text: "Pilih rekening aktif dan default untuk suatu tanggal.",
              icon: CalendarDays,
            },
          ].map(({ href, title, text, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border bg-surface p-6 transition hover:border-primary"
            >
              <Icon
                size={24}
                className="mb-4 text-primary"
                aria-hidden="true"
              />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">
                {text}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
