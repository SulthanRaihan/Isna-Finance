import type { ComponentProps } from "react";
import { AppShell } from "@/components/app-shell";
import { OrderEditor } from "@/components/order-editor";
import { requireOwner } from "@/lib/auth/guard";
import { api, actionError } from "@/lib/master/api";
import { choices, orderCustomers } from "@/lib/orders/data";
export const dynamic = "force-dynamic";
export default async function NewOrder() {
  await requireOwner();
  let editorProps: ComponentProps<typeof OrderEditor> | undefined;
  let error = "";
  try {
    const context = await api<{ business_date: string; timezone: string }>(
      "/business-context",
    );
    const [accounts, customers] = await Promise.all([
      choices(context.business_date),
      orderCustomers(),
    ]);
    editorProps = {
      day: context.business_date,
      timezone: context.timezone,
      initialAccounts: accounts.accounts,
      defaultId: accounts.defaultId,
      initialCustomers: customers.items,
    };
  } catch (e) {
    error = actionError(e).error;
  }
  return (
    <AppShell activePath="/orders/new">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-sm text-foreground-muted">
            Catat transaksi pelanggan
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Quick Order</h1>
        </div>
        {editorProps ? (
          <OrderEditor {...editorProps} />
        ) : (
          <p role="alert" className="rounded-xl border bg-surface p-5">
            {error} Muat ulang halaman untuk mencoba lagi.
          </p>
        )}
      </div>
    </AppShell>
  );
}
