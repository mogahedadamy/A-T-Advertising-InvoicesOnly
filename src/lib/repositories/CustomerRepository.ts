/**
 * ═══════════════════════════════════════════════════════════════
 * Customer Repository — SQLite CRUD
 * ═══════════════════════════════════════════════════════════════
 */

import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import type { CustomerRecord, CustomerType } from "@/lib/customersStore";

function rowToCustomer(row: any): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone || "",
    type: (row.type as CustomerType) || "individual",
    address: row.address || "",
    notes: row.notes || undefined,
    totalOrders: row.total_orders || 0,
    totalSpent: row.total_spent || 0,
    balance: row.balance || 0,
    createdAt: row.created_at,
  };
}

export async function getAllCustomers(): Promise<CustomerRecord[]> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM customers ORDER BY name ASC");
  return (res.values || []).map(rowToCustomer);
}

export async function upsertCustomer(customer: CustomerRecord): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO customers
      (id, name, phone, type, address, notes,
       total_orders, total_spent, balance, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name         = excluded.name,
       phone        = excluded.phone,
       type         = excluded.type,
       address      = excluded.address,
       notes        = excluded.notes,
       total_orders = excluded.total_orders,
       total_spent  = excluded.total_spent,
       balance      = excluded.balance`,
    [
      customer.id,
      customer.name,
      customer.phone || null,
      customer.type,
      customer.address || null,
      customer.notes || null,
      customer.totalOrders,
      customer.totalSpent,
      customer.balance,
      customer.createdAt,
    ]
  );
  notifyDataChanged();
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM customers WHERE id = ?", [id]);
  notifyDataChanged();
}

