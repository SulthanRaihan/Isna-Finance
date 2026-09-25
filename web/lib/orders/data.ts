import "server-only";
import type { Order } from "./types";
import { api } from "@/lib/master/api";
import type { Assignment, MasterRecord } from "@/lib/master/types";
export async function choices(day: string) {
  const assignments = (
    await api<{ assignments: Assignment[] }>(
      `/daily-accounts?date=${encodeURIComponent(day)}`,
    )
  ).assignments;
  const accounts: MasterRecord[] = [];
  for (let offset = 0; ; offset += 100) {
    const { items } = await api<{ items: MasterRecord[] }>(
      `/accounts?active=true&limit=100&offset=${offset}`,
    );
    accounts.push(
      ...items.filter((a) => assignments.some((d) => d.account_id === a.id)),
    );
    if (items.length < 100) break;
  }
  return {
    accounts,
    defaultId:
      assignments.find(
        (d) => d.is_default && accounts.some((a) => a.id === d.account_id),
      )?.account_id ?? "",
  };
}

export async function allOrderAccounts() {
  const result: MasterRecord[] = [];
  for (let offset = 0; ; offset += 100) {
    const { items } = await api<{ items: MasterRecord[] }>(
      `/accounts?limit=100&offset=${offset}`,
    );
    result.push(...items);
    if (items.length < 100) return result;
  }
}

export async function orderCustomers(q = "") {
  const [customers, recent] = await Promise.all([
    api<{ items: MasterRecord[] }>(
      `/customers?q=${encodeURIComponent(q)}&active=true&limit=100`,
    ),
    api<{ items: Order[] }>("/orders?limit=100"),
  ]);
  const ranked = new Map<string, MasterRecord>();
  for (const row of recent.items) {
    const customer = row.customer;
    if (
      customer?.is_active &&
      (!q || customers.items.some((c) => c.id === customer.id))
    )
      ranked.set(customer.id, { ...customer, is_active: true });
  }
  for (const customer of customers.items)
    if (!ranked.has(customer.id)) ranked.set(customer.id, customer);
  return { items: [...ranked.values()] };
}
