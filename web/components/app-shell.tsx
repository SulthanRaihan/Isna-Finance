import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  CirclePlus,
  House,
  ListOrdered,
  MoreHorizontal,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavigationItem = { label: string; icon: LucideIcon; available: boolean };
const navigation: NavigationItem[] = [
  { label: "Home", icon: House, available: true },
  { label: "Orders", icon: ListOrdered, available: false },
  { label: "Quick Order", icon: CirclePlus, available: false },
  { label: "Activity", icon: Activity, available: false },
  { label: "More", icon: MoreHorizontal, available: false },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={cn(mobile ? "grid grid-cols-5 gap-1" : "space-y-2")}
    >
      {navigation.map(({ label, icon: Icon, available }) => {
        const classes = cn(
          "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium",
          mobile
            ? "flex-col justify-center gap-1 px-1 py-2 text-[11px]"
            : "w-full",
          available
            ? "bg-surface-muted text-primary"
            : "cursor-not-allowed text-foreground-muted",
        );
        return available ? (
          <Link key={label} href="/" aria-current="page" className={classes}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </Link>
        ) : (
          <button
            key={label}
            type="button"
            disabled
            aria-label={`${label} (coming soon)`}
            className={classes}
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-4"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-surface p-6 md:flex">
        <Link
          href="/"
          className="mb-10 flex min-h-11 items-center gap-3 text-lg font-semibold"
        >
          <Wallet aria-hidden="true" className="text-primary" size={24} />
          Isna Finance
        </Link>
        <Navigation />
        <p className="mt-auto text-xs leading-5 text-foreground-muted">
          A little less admin.
          <br />A little more clarity.
        </p>
      </aside>
      <div className="md:pl-60">
        <header className="flex min-h-20 items-center justify-between border-b bg-surface px-4 sm:px-8">
          <span className="text-base font-semibold md:hidden">
            Isna Finance
          </span>
          <span className="hidden text-sm text-foreground-muted md:block">
            Your workspace
          </span>
          <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground-muted">
            Preview
          </span>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-8 md:pb-12"
        >
          {children}
        </main>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-surface px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <Navigation mobile />
      </div>
    </>
  );
}
