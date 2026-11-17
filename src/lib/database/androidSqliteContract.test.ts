/**
 * Contract test mirroring Android SQLCipher (@capacitor-community/sqlite) rules:
 * 1. `execute()` throws if given a PRAGMA that returns rows (e.g. journal_mode=WAL, wal_checkpoint).
 * 2. `run(sql, values, true)` throws "Already in transaction" while `beginTransaction()` is active.
 *
 * Also verifies persistence across cold restarts (onboarding profile + multiple custom invoices
 * sharing default meta.serial="001" while holding distinct INV-DDMMYYYY-NNN references).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";

const state = vi.hoisted(() => ({
  dir: "",
  fixture: null as FixtureDatabase | null,
  prefs: new Map<string, string>(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, Plugins: {}, getPlatform: () => "android" },
  registerPlugin: () => ({}),
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: state.prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      state.prefs.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      state.prefs.delete(key);
    },
  },
}));

vi.mock("@capacitor-community/sqlite", () => {
  class MockSQLiteConnection {
    async checkConnectionsConsistency() {
      return { result: false };
    }
    async isConnection() {
      return { result: Boolean(state.fixture) };
    }
    async retrieveConnection() {
      if (!state.fixture) throw new Error("No connection");
      return this.wrap(state.fixture);
    }
    async createConnection() {
      if (!state.fixture) {
        state.fixture = FixtureDatabase.open({ dir: state.dir });
      }
      return this.wrap(state.fixture);
    }
    async closeConnection() {
      closeAllFixtures();
      state.fixture = null;
    }
    private wrap(fixture: FixtureDatabase) {
      return {
        open: async () => {},
        query: (stmt: string, values?: unknown[]) => fixture.query(stmt, values),
        run: (stmt: string, values?: unknown[], transaction = true) =>
          fixture.run(stmt, values, transaction),
        execute: (stmts: string, transaction = false) => fixture.execute(stmts, transaction),
        executeSet: (set: { statement: string; values?: unknown[] }[], transaction = true) =>
          fixture.executeSet(set, transaction),
        beginTransaction: () => fixture.beginTransaction(),
        commitTransaction: () => fixture.commitTransaction(),
        rollbackTransaction: () => fixture.rollbackTransaction(),
      };
    }
  }
  return {
    CapacitorSQLite: {},
    SQLiteConnection: MockSQLiteConnection,
  };
});

vi.mock("@/lib/backup/notify", () => ({ notifyDataChanged: () => {} }));

import { closeDb, getDb } from "@/lib/database";
import { initSQLiteStorage } from "@/lib/sqliteStorage";
import { saveUserProfile, getStoredUserName, isUserOnboarded } from "@/lib/userProfileStore";
import { createSupplier, getAllSuppliers } from "@/lib/repositories/SupplierRepository";
import {
  createProject,
  getAllProjects,
  getProjectRelations,
  getProjectById,
} from "@/lib/repositories/ProjectRepository";
import { optimizeStorage } from "@/lib/repositories/MaintenanceRepository";
import {
  convertProformaToSalesInvoice,
  saveCustomInvoice,
  getCustomInvoicesSnapshot,
  resetCustomInvoicesStoreForTests,
} from "@/lib/billing/store";

afterEach(async () => {
  await closeDb();
  closeAllFixtures();
  state.prefs.clear();
  state.fixture = null;
  resetCustomInvoicesStoreForTests();
});

describe("Android SQLCipher plugin contract through real getDb()", () => {
  it("initializes DB, creates suppliers and projects, and runs maintenance without Execute or transaction errors", async () => {
    state.dir = mkdtempSync(join(tmpdir(), "ta-android-contract-"));
    state.fixture = FixtureDatabase.open({ dir: state.dir });

    const db = await getDb();
    expect(db).toBeTruthy();

    await db.run(
      "INSERT INTO customers(id, name, phone, created_at) VALUES(?,?,?,?)",
      ["cust-1", "عميل أندرويد", "0912345678", "2026-11-11T10:00:00.000Z"]
    );

    const supplier = await createSupplier(
      { name: "شركة النور للدعاية", phone: "0911111111" },
      "2026-11-11T10:01:00.000Z"
    );
    expect(supplier.name).toBe("شركة النور للدعاية");
    expect(await getAllSuppliers()).toHaveLength(1);

    const project = await createProject(
      { customerId: "cust-1", title: "حملة إطلاق الهوية" },
      "2026-11-11T10:02:00.000Z"
    );
    expect(project.reference).toMatch(/^PRJ-2026-\d{3}$/);
    expect(await getAllProjects()).toHaveLength(1);

    const maintenance = await optimizeStorage();
    expect(maintenance.ok).toBe(true);
  });

  it("persists onboarding profile and multiple invoices with default serial '001' across cold restarts", async () => {
    state.dir = mkdtempSync(join(tmpdir(), "ta-persist-reopen-"));
    state.fixture = FixtureDatabase.open({ dir: state.dir });

    await initSQLiteStorage();
    await saveUserProfile("طارق عثمان");

    expect(isUserOnboarded()).toBe(true);
    expect(getStoredUserName()).toBe("طارق عثمان");

    const inv1 = await saveCustomInvoice({
      id: "custom-inv-test-1",
      meta: { serial: "001", type: "sales", date: "2026-11-11", partyName: "العميل الأول", language: "ar" },
      items: [{ id: "i1", description: "تصميم شعار", qty: 1, unitPrice: 1000, total: 1000 }],
      totalAmount: 1000,
      createdAt: "2026-11-11T10:00:00.000Z",
      updatedAt: "2026-11-11T10:00:00.000Z",
    });
    const inv2 = await saveCustomInvoice({
      id: "custom-inv-test-2",
      meta: { serial: "001", type: "sales", date: "2026-11-11", partyName: "العميل الثاني", language: "ar" },
      items: [{ id: "i2", description: "حملة رقمية", qty: 1, unitPrice: 2000, total: 2000 }],
      totalAmount: 2000,
      createdAt: "2026-11-11T10:05:00.000Z",
      updatedAt: "2026-11-11T10:05:00.000Z",
    });

    expect(inv1.reference).toBe("26-0001");
    expect(inv2.reference).toBe("26-0002");

    // Simulate closing the app completely and relaunching against the same SQLite file on disk
    await closeDb();
    state.fixture = FixtureDatabase.open({ dir: state.dir });
    resetCustomInvoicesStoreForTests();

    await initSQLiteStorage();

    expect(isUserOnboarded()).toBe(true);
    expect(getStoredUserName()).toBe("طارق عثمان");
    const restoredInvoices = getCustomInvoicesSnapshot();
    expect(restoredInvoices).toHaveLength(2);
    expect(restoredInvoices.map((i) => i.reference).sort()).toEqual([
      "26-0001",
      "26-0002",
    ]);
  });

  it("links sales, purchase, and proforma invoices to a project and exposes them inside getProjectRelations", async () => {
    state.dir = mkdtempSync(join(tmpdir(), "ta-project-link-"));
    state.fixture = FixtureDatabase.open({ dir: state.dir });
    resetCustomInvoicesStoreForTests();

    await initSQLiteStorage();
    const project = await createProject({
      customerId: null,
      title: "حملة شاملة",
    });

    const salesInv = await saveCustomInvoice({
      id: "prj-link-sales",
      projectId: project.id,
      meta: { serial: "001", type: "sales", date: "2026-11-11", partyName: "شركة أ", language: "ar" },
      items: [{ id: "li-1", description: "تصميم هوية", qty: 1, unitPrice: 5000, total: 5000 }],
      totalAmount: 5000,
      createdAt: "2026-11-11T10:00:00.000Z",
      updatedAt: "2026-11-11T10:00:00.000Z",
    });
    const purchaseInv = await saveCustomInvoice({
      id: "prj-link-purchase",
      projectId: project.id,
      meta: { serial: "001", type: "purchase", date: "2026-11-11", partyName: "مورد ب", language: "ar" },
      items: [{ id: "li-2", description: "تنفيذ ميداني", qty: 1, unitPrice: 1200, total: 1200 }],
      totalAmount: 1200,
      createdAt: "2026-11-11T10:01:00.000Z",
      updatedAt: "2026-11-11T10:01:00.000Z",
    });
    await saveCustomInvoice({
      id: "prj-link-proforma",
      projectId: project.id,
      meta: { serial: "001", type: "proforma", date: "2026-11-11", partyName: "شركة أ", language: "ar" },
      items: [{ id: "li-3", description: "عرض أولي", qty: 1, unitPrice: 3000, total: 3000 }],
      totalAmount: 3000,
      createdAt: "2026-11-11T10:02:00.000Z",
      updatedAt: "2026-11-11T10:02:00.000Z",
    });

    const relations = await getProjectRelations(project.id);
    expect(relations.salesInvoices.map((s) => s.reference)).toEqual([salesInv.reference]);
    expect(relations.purchaseInvoices.map((p) => p.reference)).toEqual([purchaseInv.reference]);
    expect(relations.quotations).toHaveLength(1);
    expect(relations.quotations[0].label).toBe("فاتورة مبدئية");

    const updatedProject = await getProjectById(project.id);
    expect(updatedProject?.financialStatus).toBe("unpaid");
  });

  it("deduplicates concurrent double-taps on saveCustomInvoice (proforma) and updates the single row on edit", async () => {
    state.dir = mkdtempSync(join(tmpdir(), "ta-proforma-idempotent-"));
    state.fixture = FixtureDatabase.open({ dir: state.dir });
    resetCustomInvoicesStoreForTests();

    await initSQLiteStorage();
    const project = await createProject({
      customerId: null,
      title: "مشروع اختبار الفاتورة المبدئية",
    });

    const proformaDraft = {
      id: "stable-proforma-draft-1",
      projectId: project.id,
      meta: {
        serial: "001",
        type: "proforma" as const,
        date: "2026-11-11",
        partyName: "عميل المبدئية",
        language: "ar" as const,
      },
      items: [{ id: "p-1", description: "تصميم لوحة", qty: 1, unitPrice: 1500, total: 1500 }],
      totalAmount: 1500,
      createdAt: "2026-11-11T12:00:00.000Z",
      updatedAt: "2026-11-11T12:00:00.000Z",
    };

    // Simulate rapid double-tap firing two concurrent saves with the same draft identity
    const [firstSave, secondSave] = await Promise.all([
      saveCustomInvoice(proformaDraft),
      saveCustomInvoice(proformaDraft),
    ]);

    expect(firstSave.id).toBe("stable-proforma-draft-1");
    expect(secondSave.id).toBe("stable-proforma-draft-1");
    expect(secondSave.reference).toBe(firstSave.reference);
    expect(getCustomInvoicesSnapshot()).toHaveLength(1);

    let relations = await getProjectRelations(project.id);
    expect(relations.quotations).toHaveLength(1);

    // Editing and saving again must update the existing record rather than inserting a duplicate
    const editedSave = await saveCustomInvoice({
      ...proformaDraft,
      items: [{ id: "p-1", description: "تصميم لوحة معدل", qty: 2, unitPrice: 1500, total: 3000 }],
      totalAmount: 3000,
      reference: firstSave.reference,
    });

    expect(editedSave.id).toBe("stable-proforma-draft-1");
    expect(editedSave.reference).toBe(firstSave.reference);
    expect(editedSave.totalAmount).toBe(3000);
    expect(getCustomInvoicesSnapshot()).toHaveLength(1);

    relations = await getProjectRelations(project.id);
    expect(relations.quotations).toHaveLength(1);
    expect(relations.quotations[0].total).toBe(3000);
  });

  it("converts a project-linked proforma quote directly into a sales invoice without duplicates", async () => {
    state.dir = mkdtempSync(join(tmpdir(), "ta-proforma-convert-sales-"));
    state.fixture = FixtureDatabase.open({ dir: state.dir });
    resetCustomInvoicesStoreForTests();

    await initSQLiteStorage();
    const project = await createProject({
      customerId: null,
      title: "حملة إطلاق هوية بصرية",
    });

    const proforma = await saveCustomInvoice({
      id: "proforma-quote-to-convert-1",
      projectId: project.id,
      meta: {
        serial: "001",
        type: "proforma",
        date: "2026-11-11",
        partyName: "شركة النيل للإعلام",
        language: "ar",
      },
      items: [
        { id: "q-item-1", description: "تصميم هوية متكاملة", qty: 1, unitPrice: 4500, total: 4500 },
        { id: "q-item-2", description: "إعلان رقمي", qty: 2, unitPrice: 1250, total: 2500 },
      ],
      totalAmount: 7000,
      createdAt: "2026-11-11T13:00:00.000Z",
      updatedAt: "2026-11-11T13:00:00.000Z",
    });

    const firstConvert = await convertProformaToSalesInvoice(proforma);
    expect(firstConvert.alreadyConverted).toBe(false);
    expect(firstConvert.salesInvoice.id).toBe(`sales-from-${proforma.id}`);
    expect(firstConvert.salesInvoice.meta.type).toBe("sales");
    expect(firstConvert.salesInvoice.projectId).toBe(project.id);
    expect(firstConvert.salesInvoice.totalAmount).toBe(7000);
    expect(firstConvert.salesInvoice.reference).toMatch(/^26-\d{4}$/);

    // Original proforma stays preserved alongside the new sales invoice in project relations
    const relations = await getProjectRelations(project.id);
    expect(relations.quotations).toHaveLength(1);
    expect(relations.quotations[0].convertedSalesId).toBe(firstConvert.salesInvoice.id);
    expect(relations.quotations[0].convertedSalesReference).toBe(firstConvert.salesInvoice.reference);
    expect(relations.salesInvoices).toHaveLength(1);
    expect(relations.salesInvoices[0].id).toBe(firstConvert.salesInvoice.id);
    expect(relations.salesInvoices[0].reference).toBe(firstConvert.salesInvoice.reference);

    // Repeating or double-tapping conversion must return the existing sales invoice without duplicates
    const secondConvert = await convertProformaToSalesInvoice(proforma);
    expect(secondConvert.alreadyConverted).toBe(true);
    expect(secondConvert.salesInvoice.id).toBe(firstConvert.salesInvoice.id);
    expect(getCustomInvoicesSnapshot().filter((inv) => inv.meta.type === "sales")).toHaveLength(1);
    expect(getCustomInvoicesSnapshot().filter((inv) => inv.meta.type === "proforma")).toHaveLength(1);
  });
});
