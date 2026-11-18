/**
 * ═══════════════════════════════════════════════════════════════
 * Project Repository — SQLite CRUD + relationship aggregation
 * ═══════════════════════════════════════════════════════════════
 * The project is the central entity (PRD §4): this repository is also the one
 * place that gathers what is actually linked to a project (sales invoices,
 * quotations, orders, payments, costs) so the UI never queries tables directly.
 *
 * The reference (PRJ-YYYY-NNN) is allocated atomically on creation and is never
 * reassigned; cancellation is soft so history and the reference are preserved.
 */

import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import { appendAuditEntry } from "@/lib/repositories/AuditLogRepository";
import { allocateProjectReference } from "@/lib/repositories/DocumentSequenceRepository";
import { dateKeyFromParts, localPartsFromIsoDate } from "@/lib/domain/references";
import {
  buildProjectFinancialSummary,
  resolveFinancialStatus,
  type Project,
  type ProjectDraft,
  type ProjectExecutionStatus,
  type ProjectFinancialStatus,
  type ProjectFinancialSummary,
} from "@/lib/domain/projects";

function rowToProject(row: any): Project {
  return {
    id: String(row.id),
    reference: String(row.reference),
    customerId: row.customer_id ?? null,
    title: String(row.title ?? ""),
    description: row.description ?? undefined,
    requestNotes: row.request_notes ?? undefined,
    executionStatus: (row.execution_status as ProjectExecutionStatus) ?? "new",
    financialStatus: (row.financial_status as ProjectFinancialStatus) ?? "not_invoiced",
    deliveryDate: row.delivery_date ?? undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    cancelledAt: row.cancelled_at ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
  };
}

function newProjectId(nowIso: string): string {
  return `prj-${nowIso.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Read ───────────────────────────────────────────────────────────────────

/** Active projects, newest first. */
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDb();
  const res = await db.query(
    "SELECT * FROM projects WHERE cancelled_at IS NULL ORDER BY created_at DESC"
  );
  return (res.values ?? []).map(rowToProject);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM projects WHERE id = ? LIMIT 1", [id]);
  const row = res.values?.[0];
  return row ? rowToProject(row) : undefined;
}

export async function findProjectByReference(reference: string): Promise<Project | undefined> {
  const db = await getDb();
  const res = await db.query(
    "SELECT * FROM projects WHERE reference = ? AND cancelled_at IS NULL LIMIT 1",
    [reference.trim()]
  );
  const row = res.values?.[0];
  return row ? rowToProject(row) : undefined;
}

/** Projects that belong to one customer (contextual navigation, §3.2). */
export async function getProjectsByCustomer(customerId: string): Promise<Project[]> {
  const db = await getDb();
  const res = await db.query(
    "SELECT * FROM projects WHERE customer_id = ? AND cancelled_at IS NULL ORDER BY created_at DESC",
    [customerId]
  );
  return (res.values ?? []).map(rowToProject);
}

// ── Write ──────────────────────────────────────────────────────────────────

export interface CreateProjectResult {
  project: Project;
}

/**
 * Creates a project and allocates its permanent reference.
 * The reference is allocated from the persistent sequence table (never from a
 * count of visible rows), so two rapid creations can never share a number.
 */
export async function createProject(draft: ProjectDraft, nowIso = new Date().toISOString()): Promise<Project> {
  const db = await getDb();
  const id = newProjectId(nowIso);

  const anchor = localPartsFromIsoDate(nowIso.slice(0, 10)) ?? localPartsFromIsoDate("2026-01-01")!;
  const allocated = await allocateProjectReference(anchor.year, nowIso);

  const project: Project = {
    id,
    reference: allocated.reference,
    customerId: draft.customerId,
    title: draft.title.trim(),
    description: draft.description,
    requestNotes: draft.requestNotes,
    executionStatus: draft.executionStatus ?? "new",
    financialStatus: "not_invoiced", // always derived from records (§4.4)
    deliveryDate: draft.deliveryDate,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await db.run(
    `INSERT INTO projects
       (id, reference, customer_id, title, description, request_notes,
        execution_status, financial_status, delivery_date, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      project.id,
      project.reference,
      project.customerId,
      project.title,
      project.description ?? null,
      project.requestNotes ?? null,
      project.executionStatus,
      project.financialStatus,
      project.deliveryDate ?? null,
      project.createdAt,
      project.updatedAt,
    ]
  );

  await appendAuditEntry({
    entityType: "project",
    entityId: project.id,
    action: "create",
    details: { reference: project.reference, customerId: project.customerId, title: project.title },
    nowIso,
  });

  notifyDataChanged();
  return project;
}

/** Updates the editable fields. The reference is never touched (§5.3.3). */
export async function updateProject(
  id: string,
  changes: Partial<ProjectDraft>,
  nowIso = new Date().toISOString()
): Promise<void> {
  const db = await getDb();
  const current = await getProjectById(id);
  if (!current) throw new Error("المشروع غير موجود");

  const next = {
    customerId: changes.customerId ?? current.customerId,
    title: changes.title?.trim() ?? current.title,
    description: changes.description ?? current.description ?? null,
    requestNotes: changes.requestNotes ?? current.requestNotes ?? null,
    executionStatus: changes.executionStatus ?? current.executionStatus,
    deliveryDate: changes.deliveryDate ?? current.deliveryDate ?? null,
  };

  await db.run(
    `UPDATE projects SET
       customer_id = ?, title = ?, description = ?, request_notes = ?,
       execution_status = ?, delivery_date = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.customerId,
      next.title,
      next.description,
      next.requestNotes,
      next.executionStatus,
      next.deliveryDate,
      nowIso,
      id,
    ]
  );

  await appendAuditEntry({
    entityType: "project",
    entityId: id,
    action: "update",
    details: { executionStatus: next.executionStatus },
    nowIso,
  });
  notifyDataChanged();
}

/**
 * Persists the derived financial status while keeping an explicit user closure.
 * Called after any change to linked documents so the stored value never drifts
 * from the records (§10.2).
 */
export async function refreshProjectFinancialStatus(
  id: string,
  nowIso = new Date().toISOString()
): Promise<ProjectFinancialStatus> {
  const db = await getDb();
  const project = await getProjectById(id);
  if (!project) throw new Error("المشروع غير موجود");

  const summary = await getProjectFinancialSummary(id);
  const resolved = resolveFinancialStatus(project.financialStatus, summary.suggestedFinancialStatus);

  if (resolved !== project.financialStatus) {
    await db.run("UPDATE projects SET financial_status = ?, updated_at = ? WHERE id = ?", [
      resolved,
      nowIso,
      id,
    ]);
  }
  return resolved;
}

/** Explicit financial closure after review (§4.4, §12 step 12). */
export async function closeProjectFinancially(
  id: string,
  reason: string | null,
  nowIso = new Date().toISOString()
): Promise<{ ok: boolean; message?: string }> {
  const summary = await getProjectFinancialSummary(id);
  if (summary.customerOutstanding > 0.009 || summary.supplierOutstanding > 0.009) {
    // Refusing here enforces §12 step 12 in the business logic, not the UI.
    return {
      ok: false,
      message:
        `لا يمكن إغلاق المشروع مالياً وهناك أرصدة قائمة: ` +
        `المتبقي على العميل ${summary.customerOutstanding} والمستحق للموردين ${summary.supplierOutstanding}.`,
    };
  }
  const db = await getDb();
  await db.run("UPDATE projects SET financial_status = 'financially_closed', updated_at = ? WHERE id = ?", [
    nowIso,
    id,
  ]);
  await appendAuditEntry({
    entityType: "project",
    entityId: id,
    action: "update",
    reason: reason ?? "إغلاق مالي بعد المراجعة",
    details: { financial_status: "financially_closed" },
    nowIso,
  });
  notifyDataChanged();
  return { ok: true };
}

/** Soft cancellation: the project, its reference and its history survive. */
export async function cancelProject(id: string, reason: string | null, nowIso = new Date().toISOString()): Promise<void> {
  const db = await getDb();
  await db.run(
    "UPDATE projects SET cancelled_at = ?, cancellation_reason = ?, execution_status = 'cancelled', updated_at = ? WHERE id = ? AND cancelled_at IS NULL",
    [nowIso, reason, nowIso, id]
  );
  await appendAuditEntry({ entityType: "project", entityId: id, action: "cancel", reason, nowIso });
  notifyDataChanged();
}

export async function restoreCancelledProject(id: string, nowIso = new Date().toISOString()): Promise<void> {
  const db = await getDb();
  await db.run(
    "UPDATE projects SET cancelled_at = NULL, cancellation_reason = NULL, execution_status = 'new', updated_at = ? WHERE id = ?",
    [nowIso, id]
  );
  await appendAuditEntry({ entityType: "project", entityId: id, action: "restore", nowIso });
  notifyDataChanged();
}

// ── Relationships ──────────────────────────────────────────────────────────

export interface LinkedDocumentSummary {
  id: string;
  reference: string;
  label: string;
  date: string;
  total: number;
  status?: string;
  /** معرّف ومرجع فاتورة المبيعات الناتجة إن كان العرض قد حُوّل مسبقاً */
  convertedSalesId?: string;
  convertedSalesReference?: string;
}

export interface ProjectRelations {
  salesInvoices: LinkedDocumentSummary[];
  purchaseInvoices: LinkedDocumentSummary[];
  quotations: LinkedDocumentSummary[];
  orders: LinkedDocumentSummary[];
  paymentCount: number;
  collectedAmount: number;
  invoicedAmount: number;
}

/**
 * Everything actually linked to one project, read from the owning tables.
 * Nothing is synthesised: an empty list means nothing is linked yet.
 * Queries are individually guarded to prevent transient database locks or missing
 * optional tables from breaking the project workspace load.
 */
export async function getProjectRelations(projectId: string): Promise<ProjectRelations> {
  const db = await getDb();

  const salesInvoices: LinkedDocumentSummary[] = [];
  const purchaseInvoices: LinkedDocumentSummary[] = [];
  const customProformas: LinkedDocumentSummary[] = [];

  try {
    const invoicesRes = await db.query(
      `SELECT id, reference, serial, type, date, total_amount
         FROM custom_invoices
        WHERE project_id = ? AND cancelled_at IS NULL
        ORDER BY date DESC, created_at DESC`,
      [projectId]
    );
    for (const row of invoicesRes.values ?? []) {
      const type = String(row.type ?? "");
      const item: LinkedDocumentSummary = {
        id: String(row.id),
        reference: String(row.reference ?? row.serial ?? ""),
        label:
          type === "purchase"
            ? "فاتورة مشتريات"
            : type === "proforma"
            ? "فاتورة مبدئية"
            : "فاتورة مبيعات",
        date: String(row.date ?? ""),
        total: Number(row.total_amount) || 0,
      };
      if (type === "sales") {
        salesInvoices.push(item);
      } else if (type === "purchase") {
        purchaseInvoices.push(item);
      } else if (type === "proforma") {
        customProformas.push(item);
      }
    }
  } catch (err) {
    console.warn("[ProjectRepository] invoices query warning:", err);
  }

  let quotations: LinkedDocumentSummary[] = [...customProformas];
  try {
    const quotationsRes = await db.query(
      `SELECT id, serial, date, total_amount, status
         FROM proforma_invoices
        WHERE project_id = ?
        ORDER BY date DESC, created_at DESC`,
      [projectId]
    );

    const findConvertedSales = (quoteId: string) =>
      salesInvoices.find(
        (s) => s.id === `sales-from-${quoteId}` || s.id.startsWith(`sales-from-${quoteId}-r`)
      );

    const legacyQuotes: LinkedDocumentSummary[] = (quotationsRes.values ?? []).map((row: any) => ({
      id: String(row.id),
      reference: String(row.serial ?? ""),
      label: "عرض سعر",
      date: String(row.date ?? ""),
      total: Number(row.total_amount) || 0,
      status: row.status ?? undefined,
    }));

    quotations = [...customProformas, ...legacyQuotes].map((quote) => {
      const match = findConvertedSales(quote.id);
      return match
        ? { ...quote, convertedSalesId: match.id, convertedSalesReference: match.reference }
        : quote;
    });
  } catch (err) {
    console.warn("[ProjectRepository] quotations query warning:", err);
  }

  const orders: LinkedDocumentSummary[] = [];
  try {
    const ordersRes = await db.query(
      `SELECT id, order_number, created_at, total_cost, status
         FROM orders
        WHERE project_id = ?
        ORDER BY created_at DESC`,
      [projectId]
    );
    for (const row of ordersRes.values ?? []) {
      orders.push({
        id: String(row.id),
        reference: String(row.order_number ?? ""),
        label: "أمر شغل",
        date: String(row.created_at ?? "").slice(0, 10),
        total: Number(row.total_cost) || 0,
        status: row.status ?? undefined,
      });
    }
  } catch (err) {
    console.warn("[ProjectRepository] orders query warning:", err);
  }

  // Payments are allocated to invoices, so the project's collections are the
  // sum of allocations on its own invoices — never a global total (§9.1).
  let collectedAmount = 0;
  let paymentCount = 0;
  if (salesInvoices.length > 0) {
    try {
      const invoiceIds = salesInvoices.map((inv) => inv.id);
      const placeholders = invoiceIds.map(() => "?").join(",");
      const allocationsRes = await db.query(
        `SELECT a.payment_id AS payment_id, SUM(a.amount) AS allocated
           FROM customer_payment_allocations a
           JOIN customer_payments p ON p.id = a.payment_id
          WHERE a.invoice_id IN (${placeholders}) AND p.cancelled_at IS NULL
          GROUP BY a.payment_id`,
        invoiceIds
      );
      for (const row of allocationsRes.values ?? []) {
        paymentCount += 1;
        collectedAmount += Number(row.allocated) || 0;
      }
    } catch (err) {
      console.warn("[ProjectRepository] allocations query warning:", err);
    }
  }

  const invoicedAmount = salesInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return { salesInvoices, purchaseInvoices, quotations, orders, paymentCount, collectedAmount, invoicedAmount };
}

/** Direct costs recorded against a project (purchases + direct expenses). */
export async function getProjectCostTotals(projectId: string): Promise<{
  directCosts: number;
  paidToSuppliers: number;
  costRecordCount: number;
}> {
  const db = await getDb();
  let directCosts = 0;
  let costRecordCount = 0;

  try {
    const purchases = await db.query(
      `SELECT COUNT(*) AS c, COALESCE(SUM(total_amount), 0) AS total
         FROM custom_invoices
        WHERE project_id = ? AND type = 'purchase' AND cancelled_at IS NULL`,
      [projectId]
    );
    const row = purchases.values?.[0];
    directCosts += Number(row?.total) || 0;
    costRecordCount += Number(row?.c) || 0;
  } catch (err) {
    console.warn("[ProjectRepository] purchase totals failed:", err);
  }

  try {
    const expenses = await db.query(
      `SELECT COUNT(*) AS c, COALESCE(SUM(amount), 0) AS total
         FROM expenses
        WHERE project_id = ? AND cancelled_at IS NULL`,
      [projectId]
    );
    const row = expenses.values?.[0];
    directCosts += Number(row?.total) || 0;
    costRecordCount += Number(row?.c) || 0;
  } catch (err) {
    console.warn("[ProjectRepository] expense totals failed:", err);
  }

  // Payments actually made to suppliers/beneficiaries for this project.
  let paidToSuppliers = 0;
  try {
    const payments = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM supplier_payments
        WHERE project_id = ? AND cancelled_at IS NULL`,
      [projectId]
    );
    paidToSuppliers += Number(payments.values?.[0]?.total) || 0;
  } catch (err) {
    console.warn("[ProjectRepository] supplier payment totals failed:", err);
  }

  return { directCosts, paidToSuppliers, costRecordCount };
}

/** The complete financial picture of a project, derived from records only. */
export async function getProjectFinancialSummary(
  projectId: string,
  existingRelations?: ProjectRelations
): Promise<ProjectFinancialSummary> {
  const project = await getProjectById(projectId).catch(() => undefined);
  const relations =
    existingRelations ??
    (await getProjectRelations(projectId).catch(() => ({
      salesInvoices: [],
      purchaseInvoices: [],
      quotations: [],
      orders: [],
      paymentCount: 0,
      collectedAmount: 0,
      invoicedAmount: 0,
    })));
  const costs = await getProjectCostTotals(projectId).catch(() => ({
    directCosts: 0,
    paidToSuppliers: 0,
    costRecordCount: 0,
  }));

  return buildProjectFinancialSummary({
    invoicedAmount: relations.invoicedAmount,
    collectedAmount: relations.collectedAmount,
    directCosts: costs.directCosts,
    paidToSuppliers: costs.paidToSuppliers,
    invoiceCount: relations.salesInvoices.length,
    quotationCount: relations.quotations.length,
    orderCount: relations.orders.length,
    paymentCount: relations.paymentCount,
    costRecordCount: costs.costRecordCount,
    closedByUser: project?.financialStatus === "financially_closed",
  });
}

export interface ProjectFinancialRow extends Project {
  summary: ProjectFinancialSummary;
}

/**
 * Summaries for EVERY project in a handful of grouped queries.
 *
 * Why this exists: building a report by calling getProjectFinancialSummary per
 * project costs ~8 queries per project (N+1). With 500 projects that is 4,000
 * round trips inside the WebView. Here the aggregates are computed with fixed
 * GROUP BY queries and the (pure) summary function is applied in memory, so the
 * report cost stops growing with the number of queries (§15 performance).
 */
export async function getAllProjectSummaries(): Promise<ProjectFinancialRow[]> {
  const db = await getDb();
  const projects = await getAllProjects();
  if (projects.length === 0) return [];

  const empty = <T,>(): Record<string, T> => ({});

  // Revenue + purchase totals per project.
  const invoiceAgg = await db.query(
    `SELECT project_id,
            SUM(CASE WHEN type = 'sales' THEN total_amount ELSE 0 END) AS sales_total,
            SUM(CASE WHEN type = 'sales' THEN 1 ELSE 0 END) AS sales_count,
            SUM(CASE WHEN type = 'purchase' THEN total_amount ELSE 0 END) AS purchase_total,
            SUM(CASE WHEN type = 'purchase' THEN 1 ELSE 0 END) AS purchase_count,
            SUM(CASE WHEN type = 'proforma' THEN 1 ELSE 0 END) AS proforma_count
       FROM custom_invoices
      WHERE cancelled_at IS NULL AND project_id IS NOT NULL
      GROUP BY project_id`
  );
  const revenue: Record<string, number> = empty();
  const salesCount: Record<string, number> = empty();
  const purchaseTotal: Record<string, number> = empty();
  const purchaseCount: Record<string, number> = empty();
  const quotationCount: Record<string, number> = empty();
  for (const row of invoiceAgg.values ?? []) {
    const key = String(row.project_id);
    revenue[key] = Number(row.sales_total) || 0;
    salesCount[key] = Number(row.sales_count) || 0;
    purchaseTotal[key] = Number(row.purchase_total) || 0;
    purchaseCount[key] = Number(row.purchase_count) || 0;
    quotationCount[key] = Number(row.proforma_count) || 0;
  }

  // Collections per project, through the allocations of the project's invoices.
  const collectedAgg = await db.query(
    `SELECT i.project_id AS project_id, COUNT(DISTINCT a.payment_id) AS payments, COALESCE(SUM(a.amount), 0) AS collected
       FROM customer_payment_allocations a
       JOIN customer_payments p ON p.id = a.payment_id
       JOIN custom_invoices i ON i.id = a.invoice_id
      WHERE p.cancelled_at IS NULL AND i.project_id IS NOT NULL
      GROUP BY i.project_id`
  );
  const collected: Record<string, number> = empty();
  const paymentCount: Record<string, number> = empty();
  for (const row of collectedAgg.values ?? []) {
    const key = String(row.project_id);
    collected[key] = Number(row.collected) || 0;
    paymentCount[key] = Number(row.payments) || 0;
  }

  // Direct expenses and supplier payments per project.
  const expenseAgg = await db.query(
    `SELECT project_id, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS c
       FROM expenses
      WHERE kind = 'direct' AND cancelled_at IS NULL AND project_id IS NOT NULL
      GROUP BY project_id`
  );
  const directExpenseTotal: Record<string, number> = empty();
  const directExpenseCount: Record<string, number> = empty();
  for (const row of expenseAgg.values ?? []) {
    const key = String(row.project_id);
    directExpenseTotal[key] = Number(row.total) || 0;
    directExpenseCount[key] = Number(row.c) || 0;
  }

  const supplierPayAgg = await db.query(
    `SELECT project_id, COALESCE(SUM(amount), 0) AS total
       FROM supplier_payments
      WHERE cancelled_at IS NULL AND project_id IS NOT NULL
      GROUP BY project_id`
  );
  const supplierPaid: Record<string, number> = empty();
  for (const row of supplierPayAgg.values ?? []) {
    supplierPaid[String(row.project_id)] = Number(row.total) || 0;
  }

  const quotationAgg = await db.query(
    "SELECT project_id, COUNT(*) AS c FROM proforma_invoices WHERE project_id IS NOT NULL GROUP BY project_id"
  );
  for (const row of quotationAgg.values ?? []) {
    const key = String(row.project_id);
    quotationCount[key] = (quotationCount[key] ?? 0) + (Number(row.c) || 0);
  }

  const orderAgg = await db.query(
    "SELECT project_id, COUNT(*) AS c FROM orders WHERE project_id IS NOT NULL GROUP BY project_id"
  );
  const orderCount: Record<string, number> = empty();
  for (const row of orderAgg.values ?? []) {
    orderCount[String(row.project_id)] = Number(row.c) || 0;
  }

  return projects.map((project) => ({
    ...project,
    summary: buildProjectFinancialSummary({
      invoicedAmount: revenue[project.id] ?? 0,
      collectedAmount: collected[project.id] ?? 0,
      directCosts: (purchaseTotal[project.id] ?? 0) + (directExpenseTotal[project.id] ?? 0),
      paidToSuppliers: supplierPaid[project.id] ?? 0,
      invoiceCount: salesCount[project.id] ?? 0,
      quotationCount: quotationCount[project.id] ?? 0,
      orderCount: orderCount[project.id] ?? 0,
      paymentCount: paymentCount[project.id] ?? 0,
      costRecordCount: (purchaseCount[project.id] ?? 0) + (directExpenseCount[project.id] ?? 0),
      closedByUser: project.financialStatus === "financially_closed",
    }),
  }));
}

/** Links or unlinks a document to a project (used by the document forms). */
export async function linkDocumentToProject(
  entity: "invoice" | "quotation" | "order",
  documentId: string,
  projectId: string | null,
  nowIso = new Date().toISOString()
): Promise<void> {
  const db = await getDb();
  const table = entity === "invoice" ? "custom_invoices" : entity === "quotation" ? "proforma_invoices" : "orders";
  await db.run(`UPDATE ${table} SET project_id = ? WHERE id = ?`, [projectId, documentId]);
  if (entity === "invoice" && projectId) {
    await refreshProjectFinancialStatus(projectId, nowIso);
  }
  notifyDataChanged();
}
