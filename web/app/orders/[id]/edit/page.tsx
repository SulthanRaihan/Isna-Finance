import type { ComponentProps } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OrderEditor } from "@/components/order-editor";
import { requireOwner } from "@/lib/auth/guard";
import { api, actionError } from "@/lib/master/api";
import { choices } from "@/lib/orders/data";
import type { Order } from "@/lib/orders/types";
import type { MasterRecord } from "@/lib/master/types";
export const dynamic = "force-dynamic";
export default async function EditOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  let editorProps: ComponentProps<typeof OrderEditor> | undefined;
  let error = "";
  try {
    const order = await api<Order>(`/orders/${encodeURIComponent(id)}`);
    const [context, accounts, customers] = await Promise.all([
      api<{ timezone: string }>("/business-context"),
      choices(order.business_date),
      api<{ items: MasterRecord[] }>("/customers?active=true&limit=100"),
    ]);
    editorProps = {
      order,
      day: order.business_date,
      timezone: context.timezone,
      initialAccounts: accounts.accounts,
      defaultId: accounts.defaultId,
      initialCustomers: customers.items,
    };
  } catch (e) {
    error = actionError(e).error;
  }
  return (
    <AppShell activePath="/orders">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link className="text-primary" href={`/orders/${id}`}>
          Kembali ke order
        </Link>
        <h1 className="text-3xl font-semibold">Ubah order</h1>
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
