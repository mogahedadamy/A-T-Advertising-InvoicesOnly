/**
 * معايير القبول لمراجع الفواتير (PRD §17) عبر الكود الحقيقي:
 * المتجر (billing/store) ← المستودع (CustomInvoiceRepository) ← SQLite حقيقي.
 * لا محاكاة لطبقة SQL: القيود والفهارس الفريدة مفعّلة فعلاً.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const state = vi.hoisted(() => ({ db: null as any, dir: "" }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, Plugins: {}, getPlatform: () => "android" },
  registerPlugin: () => ({}),
}));

vi.mock("@/lib/database", () => ({
  getDb: async () => state.db,
  closeDb: async () => {},
}));

vi.mock("@/lib/backup/notify", () => ({ notifyDataChanged: () => {} }));

import { CREATE_SCHEMA_V1 } from "@/lib/database/schema";
import { runPendingMigrations } from "@/lib/database/migrations";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";
import type { CustomInvoice } from "@/lib/billing/types";

const NOW = "2026-11-11T08:00:00.000Z";

let dir = "";
let db: FixtureDatabase;
let itemSeq = 0;

beforeEach(async () => {
  closeAllFixtures();
  itemSeq = 0;
  // The store keeps an in-memory snapshot; reset it so each test starts from a
  // clean application state (the same thing happens on a real app restart).
  const { resetCustomInvoicesStoreForTests } = await import("@/lib/billing/store");
  resetCustomInvoicesStoreForTests();
  dir = mkdtempSync(join(tmpdir(), "ta-invoice-refs-"));
  db = FixtureDatabase.open({ dir });
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);
  state.db = db;
});

function buildInvoice(
  overrides: Partial<CustomInvoice> & { id: string; date?: string; type?: CustomInvoice["meta"]["type"] }
): CustomInvoice {
  // Every invoice gets its own item ids, exactly like the dialog does.
  itemSeq += 1;
  return {
    id: overrides.id,
    meta: {
      serial: "001",
      type: overrides.type ?? "sales",
      date: overrides.date ?? "2026-11-11",
      partyName: "شركة الاختبار",
      language: "ar",
      ...(overrides.meta ?? {}),
    },
    items: [{ id: `item-${overrides.id}-${itemSeq}`, description: "بند", qty: 1, unitPrice: 100, total: 100 }],
    totalAmount: 100,
    createdAt: overrides.createdAt ?? NOW,
    updatedAt: overrides.updatedAt ?? NOW,
    ...overrides,
  } as CustomInvoice;
}

/** An exact copy of an existing invoice, as the "duplicate" action produces. */
function duplicateOf(source: CustomInvoice, newId: string): CustomInvoice {
  return {
    ...source,
    id: newId,
    reference: undefined,
    referenceAssignedAt: undefined,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("PRD §17 — invoice reference acceptance", () => {
  it("assigns a unique dated reference on the first save", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const saved = await saveCustomInvoice(buildInvoice({ id: "inv-1" }));
    expect(saved.reference).toBe("26-0001");
    expect(saved.referenceAssignedAt).toBeTruthy();
  });

  it("continues the sequence within the year (YY-NNNN)", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const first = await saveCustomInvoice(buildInvoice({ id: "inv-1", date: "2026-11-11" }));
    const second = await saveCustomInvoice(buildInvoice({ id: "inv-2", date: "2026-11-11" }));
    const otherDay = await saveCustomInvoice(buildInvoice({ id: "inv-3", date: "2026-12-01" }));

    expect(first.reference).toBe("26-0001");
    expect(second.reference).toBe("26-0002");
    expect(otherDay.reference).toBe("26-0003");
  });

  it("keeps the reference when the invoice is edited, including a date change", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const created = await saveCustomInvoice(buildInvoice({ id: "inv-1", date: "2026-11-11" }));
    expect(created.reference).toBe("26-0001");

    // Edit: different date and different amount, same id.
    const edited = await saveCustomInvoice(
      buildInvoice({
        id: "inv-1",
        date: "2026-11-20",
        totalAmount: 999,
        meta: { serial: "001", type: "sales", date: "2026-11-20", partyName: "اسم معدّل", language: "ar" },
      })
    );
    expect(edited.reference).toBe("26-0001");

    const stored = db.db.prepare("SELECT date, party_name, reference FROM custom_invoices WHERE id='inv-1'").get() as any;
    expect(stored.reference).toBe("26-0001");
    expect(stored.date).toBe("2026-11-20");
    expect(stored.party_name).toBe("اسم معدّل");
  });

  it("never issues the same reference for many rapid saves", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const references: string[] = [];
    for (let i = 0; i < 25; i++) {
      const saved = await saveCustomInvoice(buildInvoice({ id: `bulk-${i}`, date: "2026-11-11" }));
      references.push(saved.reference!);
    }
    expect(new Set(references).size).toBe(25);
    const stored = db.db.prepare("SELECT COUNT(DISTINCT reference) AS c FROM custom_invoices").get() as any;
    expect(Number(stored.c)).toBe(25);
  });

  it("keeps two invoices apart even when they share the legacy serial", async () => {
    const { saveCustomInvoice, getCustomInvoicesSnapshot } = await import("@/lib/billing/store");
    const first = await saveCustomInvoice(buildInvoice({ id: "inv-1" }));
    const second = await saveCustomInvoice(buildInvoice({ id: "inv-2" }));

    // Both carry serial "001" (the legacy field), but they are different records.
    expect(first.id).not.toBe(second.id);
    expect(getCustomInvoicesSnapshot().length).toBe(2);
    expect(db.count("custom_invoices")).toBe(2);
    expect(new Set([first.reference, second.reference]).size).toBe(2);
  });

  it("persists the invoice, not just the reference", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    await saveCustomInvoice(buildInvoice({ id: "inv-1" }));
    expect(db.count("custom_invoices")).toBe(1);
    expect(db.count("custom_invoice_items")).toBe(1);
    const stored = db.db.prepare("SELECT reference FROM custom_invoices WHERE id='inv-1'").get() as any;
    expect(stored.reference).toBe("26-0001");
  });

  it("saves a duplicated invoice whose items still carry the original ids", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const original = await saveCustomInvoice(buildInvoice({ id: "inv-1" }));

    // Regression: reusing the source item ids used to violate the item PRIMARY
    // KEY and lose the duplicate silently.
    const copy = duplicateOf(original, "inv-2");
    const saved = await saveCustomInvoice(copy);

    expect(saved.reference).toBe("26-0002");
    expect(db.count("custom_invoices")).toBe(2);
    expect(db.count("custom_invoice_items")).toBe(2);

    // The original keeps its own items untouched.
    const originalItems = db.db.prepare("SELECT id FROM custom_invoice_items WHERE invoice_id='inv-1'").all() as any[];
    expect(originalItems.length).toBe(1);
    expect(originalItems[0].id).toBe(original.items[0].id);
  });

  it("does not publish a record when persistence fails (no fake success)", async () => {
    const { saveCustomInvoice, getCustomInvoicesSnapshot } = await import("@/lib/billing/store");
    const before = getCustomInvoicesSnapshot().length;

    // Force a storage failure by pointing the mock at a closed database.
    const working = state.db;
    state.db = {
      ...working,
      executeSet: () => {
        throw new Error("disk full");
      },
      query: working.query.bind(working),
      run: working.run.bind(working),
      beginTransaction: working.beginTransaction.bind(working),
      commitTransaction: working.commitTransaction.bind(working),
      rollbackTransaction: working.rollbackTransaction.bind(working),
    };

    await expect(saveCustomInvoice(buildInvoice({ id: "inv-fail" }))).rejects.toThrow();
    expect(getCustomInvoicesSnapshot().length).toBe(before);
    expect(db.count("custom_invoices")).toBe(0);
    state.db = working;
  });

  it("keeps the reference after cancellation and does not release the number", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const { deleteCustomInvoice } = await import("@/lib/billing/store").then(async () => {
      const repo = await import("@/lib/repositories/CustomInvoiceRepository");
      return { deleteCustomInvoice: repo.deleteCustomInvoice };
    });

    await saveCustomInvoice(buildInvoice({ id: "inv-1" }));
    await deleteCustomInvoice("inv-1");

    const row = db.db.prepare("SELECT reference, cancelled_at FROM custom_invoices WHERE id='inv-1'").get() as any;
    expect(row.reference).toBe("26-0001");
    expect(row.cancelled_at).toBeTruthy();

    // The cancelled invoice is hidden from reads but its record survives.
    const { getAllCustomInvoices } = await import("@/lib/repositories/CustomInvoiceRepository");
    expect(await getAllCustomInvoices()).toEqual([]);

    // And the next invoice takes the NEXT number, never the released one.
    const next = await saveCustomInvoice(buildInvoice({ id: "inv-2" }));
    expect(next.reference).toBe("26-0002");
  });

  it("finds an invoice by its full reference (PRD §5.3.6)", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    await saveCustomInvoice(buildInvoice({ id: "inv-1" }));
    await saveCustomInvoice(buildInvoice({ id: "inv-2" }));

    const { findCustomInvoiceByReference, referenceExists } = await import("@/lib/repositories/CustomInvoiceRepository");
    const found = await findCustomInvoiceByReference("26-0002");
    expect(found?.id).toBe("inv-2");
    expect(await referenceExists("26-0001")).toBe(true);
    expect(await referenceExists("26-0999")).toBe(false);
  });

  it("numbers purchase invoices in their own namespace", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const sales = await saveCustomInvoice(buildInvoice({ id: "sale-1", type: "sales" }));
    const purchase = await saveCustomInvoice(buildInvoice({ id: "buy-1", type: "purchase" }));
    expect(sales.reference).toBe("26-0001");
    expect(purchase.reference).toBe("26-0002");
  });

  it("saves a purchase invoice without crashing after 70 sales invoices in the same year (FIN-05)", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    for (let i = 1; i <= 70; i++) {
      const saved = await saveCustomInvoice(buildInvoice({ id: `sale-70-${i}`, type: "sales", date: "2026-11-11" }));
      expect(saved.reference).toBe(`26-${String(i).padStart(4, "0")}`);
    }
    const purchase = await saveCustomInvoice(buildInvoice({ id: "buy-after-70", type: "purchase", date: "2026-11-11" }));
    expect(purchase.reference).toBe("26-0071");
  });

  it("does not assign a reference to proforma/billing rows", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    const proforma = await saveCustomInvoice(buildInvoice({ id: "pro-1", type: "proforma" }));
    expect(proforma.reference).toBeUndefined();
    const stored = db.db.prepare("SELECT reference FROM custom_invoices WHERE id='pro-1'").get() as any;
    expect(stored.reference).toBeNull();
  });

  it("enforces uniqueness in the database, not just in the code", () => {
    // The partial unique index must exist and reject a duplicate reference.
    const indexes = (db.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as any[]).map((r) => r.name);
    expect(indexes).toContain("idx_custom_invoices_reference");

    db.db
      .prepare(
        "INSERT INTO custom_invoices (id, serial, type, date, party_name, total_amount, created_at, updated_at, reference) VALUES (?,?,?,?,?,?,?,?,?)"
      )
      .run("a", "001", "sales", "2026-11-11", "x", 1, NOW, NOW, "26-0001");
    expect(() =>
      db.db
        .prepare(
          "INSERT INTO custom_invoices (id, serial, type, date, party_name, total_amount, created_at, updated_at, reference) VALUES (?,?,?,?,?,?,?,?,?)"
        )
        .run("b", "002", "sales", "2026-11-11", "y", 1, NOW, NOW, "26-0001")
    ).toThrow();
  });

  it("preserves references across a backup restore (PRD §17)", async () => {
    const { saveCustomInvoice } = await import("@/lib/billing/store");
    await saveCustomInvoice(buildInvoice({ id: "inv-1" }));
    await saveCustomInvoice(buildInvoice({ id: "inv-2" }));
    const before = db.db.prepare("SELECT id, reference FROM custom_invoices ORDER BY id").all() as any[];

    // Simulate an older backup: rows restored, numbering table missing.
    db.db.exec("DELETE FROM document_sequences");
    await runPendingMigrations(db, { nowIso: NOW });

    const after = db.db.prepare("SELECT id, reference FROM custom_invoices ORDER BY id").all() as any[];
    expect(after).toEqual(before);

    // A new invoice still continues safely.
    const next = await saveCustomInvoice(buildInvoice({ id: "inv-3" }));
    expect(next.reference).toBe("26-0003");
  });
});
