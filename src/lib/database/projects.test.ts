/**
 * تكامل وحدة المشاريع مع SQLite حقيقي:
 * تخصيص المرجع، الحالات المنفصلة، الربط الحقيقي بالمستندات، تجميع المبالغ،
 * الإلغاء الناعم مع التدقيق، وحاجز الإغلاق المالي.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const state = vi.hoisted(() => ({ db: null as any }));

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
import {
  cancelProject,
  closeProjectFinancially,
  createProject,
  findProjectByReference,
  getAllProjects,
  getProjectById,
  getProjectCostTotals,
  getProjectFinancialSummary,
  getProjectRelations,
  linkDocumentToProject,
  refreshProjectFinancialStatus,
  updateProject,
} from "@/lib/repositories/ProjectRepository";
import { listAuditEntries } from "@/lib/repositories/AuditLogRepository";

const NOW = "2026-11-11T09:00:00.000Z";

let dir = "";
let db: FixtureDatabase;

beforeEach(async () => {
  closeAllFixtures();
  dir = mkdtempSync(join(tmpdir(), "ta-projects-"));
  db = FixtureDatabase.open({ dir });
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);
  state.db = db;
});

function addCustomer(id: string, name: string) {
  db.db
    .prepare(
      "INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)"
    )
    .run(id, name, "0912", "company", NOW);
}

function addSalesInvoice(id: string, reference: string, total: number, projectId: string | null) {
  db.db
    .prepare(
      `INSERT INTO custom_invoices
        (id, serial, type, date, party_name, language, total_amount, created_at, updated_at, reference, project_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(id, "001", "sales", "2026-11-11", "عميل", "ar", total, NOW, NOW, reference, projectId);
}

function addPurchaseInvoice(id: string, total: number, projectId: string) {
  db.db
    .prepare(
      `INSERT INTO custom_invoices
        (id, serial, type, date, party_name, language, total_amount, created_at, updated_at, reference, project_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(id, "001", "purchase", "2026-11-11", "مورد", "ar", total, NOW, NOW, "PINV-11112026-001", projectId);
}

function addCustomerPayment(paymentId: string, invoiceId: string, customerId: string, amount: number) {
  db.db
    .prepare(
      `INSERT INTO customer_payments (id, customer_id, amount, paid_at, method, created_at)
       VALUES (?,?,?,?,?,?)`
    )
    .run(paymentId, customerId, amount, "2026-11-11", "cash", NOW);
  db.db
    .prepare(
      `INSERT INTO customer_payment_allocations (id, payment_id, invoice_id, amount, created_at)
       VALUES (?,?,?,?,?)`
    )
    .run(`alloc-${paymentId}`, paymentId, invoiceId, amount, NOW);
}

function addQuotation(id: string, projectId: string, total: number) {
  db.db
    .prepare(
      `INSERT INTO proforma_invoices
        (id, serial, date, customer_name, total_amount, total_in_words, status, created_at, updated_at, project_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(id, "0009", "2026-11-10", "عميل", total, "", "draft", NOW, NOW, projectId);
}

describe("Project creation and reference (PRD §2.2, §5.3.2)", () => {
  it("allocates PRJ-YYYY-NNN atomically and persists the project", async () => {
    addCustomer("cust-1", "شركة النيل");
    const first = await createProject({ customerId: "cust-1", title: "حملة أولى" });
    const second = await createProject({ customerId: "cust-1", title: "حملة ثانية" });

    expect(first.reference).toBe("PRJ-2026-001");
    expect(second.reference).toBe("PRJ-2026-002");
    expect(db.count("projects")).toBe(2);

    const stored = await getProjectById(first.id);
    expect(stored?.title).toBe("حملة أولى");
    expect(stored?.executionStatus).toBe("new");
    // financial status starts from derived emptiness, never "paid"
    expect(stored?.financialStatus).toBe("not_invoiced");
  });

  it("numbers each year separately", async () => {
    addCustomer("cust-1", "شركة");
    const a = await createProject({ customerId: "cust-1", title: "2026" }, "2026-12-31T10:00:00.000Z");
    const b = await createProject({ customerId: "cust-1", title: "2027" }, "2027-01-01T10:00:00.000Z");
    expect(a.reference).toBe("PRJ-2026-001");
    expect(b.reference).toBe("PRJ-2027-001");
  });

  it("finds a project by its reference and updates it without touching the reference", async () => {
    addCustomer("cust-1", "شركة");
    const created = await createProject({ customerId: "cust-1", title: "قبل" });
    await updateProject(created.id, { title: "بعد", executionStatus: "in_progress" });

    const updated = await getProjectById(created.id);
    expect(updated?.title).toBe("بعد");
    expect(updated?.executionStatus).toBe("in_progress");
    expect(updated?.reference).toBe("PRJ-2026-001");
    expect((await findProjectByReference("PRJ-2026-001"))?.id).toBe(created.id);
  });

  it("keeps execution and financial status independent", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    // Operationally finished while nothing has been invoiced or paid.
    await updateProject(project.id, { executionStatus: "completed" });
    const reloaded = await getProjectById(project.id);
    expect(reloaded?.executionStatus).toBe("completed");
    expect(reloaded?.financialStatus).toBe("not_invoiced");
  });
});

describe("Linking documents to a project (PRD §4.2)", () => {
  it("aggregates only the documents actually linked", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    const other = await createProject({ customerId: "cust-1", title: "مشروع آخر" });

    addSalesInvoice("inv-1", "INV-11112026-001", 250000, project.id);
    addSalesInvoice("inv-other", "INV-11112026-002", 999999, other.id); // must be ignored
    addQuotation("q-1", project.id, 250000);

    const relations = await getProjectRelations(project.id);
    expect(relations.salesInvoices.length).toBe(1);
    expect(relations.invoicedAmount).toBe(250000);
    expect(relations.quotations.length).toBe(1);
    expect(relations.collectedAmount).toBe(0);
    expect(relations.paymentCount).toBe(0);
  });

  it("counts collections only through allocations on the project's own invoices", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 250000, project.id);
    addCustomerPayment("pay-1", "inv-1", "cust-1", 100000);

    const relations = await getProjectRelations(project.id);
    expect(relations.collectedAmount).toBe(100000);
    expect(relations.paymentCount).toBe(1);

    const summary = await getProjectFinancialSummary(project.id);
    expect(summary.customerOutstanding).toBe(150000);
    expect(summary.suggestedFinancialStatus).toBe("partially_paid");
  });

  it("treats purchase invoices as costs and ignores them as revenue", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 250000, project.id);
    addPurchaseInvoice("pinv-1", 120000, project.id);

    const relations = await getProjectRelations(project.id);
    expect(relations.salesInvoices.length).toBe(1);
    expect(relations.invoicedAmount).toBe(250000); // the purchase is NOT revenue

    const costs = await getProjectCostTotals(project.id);
    expect(costs.directCosts).toBe(120000);
    expect(costs.costRecordCount).toBe(1);

    const summary = await getProjectFinancialSummary(project.id);
    expect(summary.margin).toBe(130000);
  });

  it("links and unlinks an existing document", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 50000, null);

    expect((await getProjectRelations(project.id)).salesInvoices.length).toBe(0);
    await linkDocumentToProject("invoice", "inv-1", project.id);
    expect((await getProjectRelations(project.id)).invoicedAmount).toBe(50000);

    await linkDocumentToProject("invoice", "inv-1", null);
    expect((await getProjectRelations(project.id)).invoicedAmount).toBe(0);
  });

  it("refreshes the stored financial status from the records", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 100000, project.id);

    const status = await refreshProjectFinancialStatus(project.id);
    expect(status).toBe("unpaid");
    expect((await getProjectById(project.id))?.financialStatus).toBe("unpaid");
  });
});

describe("Financial closure guard (PRD §4.4, §12)", () => {
  it("refuses to close a project while balances remain", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 250000, project.id);
    addCustomerPayment("pay-1", "inv-1", "cust-1", 100000);

    const refused = await closeProjectFinancially(project.id, "مراجعة");
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain("أرصدة قائمة");
    expect((await getProjectById(project.id))?.financialStatus).not.toBe("financially_closed");
  });

  it("closes a fully settled project and keeps it closed", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 100000, project.id);
    addCustomerPayment("pay-1", "inv-1", "cust-1", 100000);

    const closed = await closeProjectFinancially(project.id, "تمت التسوية");
    expect(closed.ok).toBe(true);
    expect((await getProjectById(project.id))?.financialStatus).toBe("financially_closed");

    await refreshProjectFinancialStatus(project.id);
    expect((await getProjectById(project.id))?.financialStatus).toBe("financially_closed");

    const summary = await getProjectFinancialSummary(project.id);
    expect(summary.suggestedFinancialStatus).toBe("financially_closed");
  });
});

describe("Cancellation keeps history (PRD §12.7, §12.13)", () => {
  it("hides a cancelled project but preserves it and records an audit entry", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    await cancelProject(project.id, "ألغى العميل الطلب");

    expect(await getAllProjects()).toEqual([]);

    const row = db.db.prepare("SELECT reference, cancelled_at, execution_status FROM projects WHERE id = ?").get(project.id) as any;
    expect(row.reference).toBe("PRJ-2026-001");
    expect(row.cancelled_at).toBeTruthy();
    expect(row.execution_status).toBe("cancelled");

    const audit = await listAuditEntries("project", project.id);
    expect(audit.map((entry) => entry.action)).toContain("cancel");
    expect(audit.some((entry) => entry.reason === "ألغى العميل الطلب")).toBe(true);
  });

  it("never reuses a cancelled project's reference", async () => {
    addCustomer("cust-1", "شركة");
    const cancelled = await createProject({ customerId: "cust-1", title: "ملغى" });
    await cancelProject(cancelled.id, null);
    const next = await createProject({ customerId: "cust-1", title: "جديد" });
    expect(next.reference).toBe("PRJ-2026-002");
    expect(next.reference).not.toBe(cancelled.reference);
  });
});

describe("Completeness is reported, never hidden (PRD §9.6)", () => {
  it("marks a project with revenue but no costs as incomplete", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 250000, project.id);

    const summary = await getProjectFinancialSummary(project.id);
    expect(summary.isComplete).toBe(false);
    expect(summary.completenessNotes.length).toBeGreaterThan(0);
    expect(summary.completenessNotes.join(" ")).toContain("غير مكتمل");
  });

  it("marks a fully recorded project as complete", async () => {
    addCustomer("cust-1", "شركة");
    const project = await createProject({ customerId: "cust-1", title: "حملة" });
    addSalesInvoice("inv-1", "INV-11112026-001", 250000, project.id);
    addCustomerPayment("pay-1", "inv-1", "cust-1", 250000);
    addPurchaseInvoice("pinv-1", 120000, project.id);
    // A supplier payment covering the purchase makes the cost side settled.
    db.db
      .prepare(
        `INSERT INTO supplier_payments (id, supplier_id, project_id, amount, paid_at, method, created_at)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run("sp-1", "sup-1", project.id, 120000, "2026-11-11", "cash", NOW);

    const summary = await getProjectFinancialSummary(project.id);
    expect(summary.isComplete).toBe(true);
    expect(summary.customerOutstanding).toBe(0);
    expect(summary.supplierOutstanding).toBe(0);
    expect(summary.margin).toBe(130000);
  });
});
