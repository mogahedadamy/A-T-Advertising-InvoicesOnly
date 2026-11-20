/**
 * ═══════════════════════════════════════════════════════════════
 * Professional Account Statement Document Engine (Enterprise A4)
 * ═══════════════════════════════════════════════════════════════
 * Authoritative, beautifully rendered Arabic RTL customer financial
 * statement engineered to enterprise ERP standards (SAP / Oracle / ERPNext).
 * Formatted specifically for standard A4 (210mm x 297mm) filling the entire page
 * with balanced whitespace, generous cell heights, and clear information hierarchy.
 */

import type { CustomerStatement } from "@/lib/repositories/ReportsRepository";
import type { CustomerRecord } from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { triggerPrintWithElement, shareInvoiceViaWhatsApp } from "@/lib/pdfExport";
import { TA_LOGO_GREEN_BASE64, TA_SIGNATURE_TARIG_BASE64, TA_QR_CODE_BASE64 } from "@/assets/invoiceImagesBase64";
import { escapeHtml } from "@/lib/security/htmlEscape";
import { toast } from "sonner";

const MIN_LEDGER_TABLE_ROWS = 12;

export function buildStatementDomElement(
  statement: CustomerStatement,
  customer: CustomerRecord,
  currency = statement.currency || "SDG"
): HTMLElement {
  const container = document.createElement("div");
  // Remove "invoice-paper" to prevent triggering A5 landscape heuristics in pdfExport.ts
  container.className = "statement-print-root standard-invoice-sheet statement-print-document font-sans text-right";
  container.dir = "rtl";
  container.style.cssText = `
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    padding: 10mm 12mm 10mm 12mm;
    background: #ffffff;
    color: #0f172a;
    box-sizing: border-box;
    position: relative;
    font-family: 'Tajawal', 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  `;

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, " / ");
  const currencyLabel =
    currency === "USD"
      ? "دولار أمريكي (USD)"
      : currency === "SAR"
      ? "ريال سعودي (SAR)"
      : currency === "EGP"
      ? "جنيه مصري (EGP)"
      : "جنيه سوداني (SDG)";
  const currencySymbol = currency === "USD" ? "$" : currency;

  // فئة العميل المعتمدة (شركة / مؤسسة / زبون / أفراد)
  const customerTypeLabel =
    customer.type === "company"
      ? "شركة"
      : customer.type === "institution" || customer.type === "agency" || customer.type === "internal"
      ? "مؤسسة"
      : customer.type === "client"
      ? "زبون"
      : "أفراد";

  const safeCurrencyLabel = escapeHtml(currencyLabel);
  const safeCurrencySymbol = escapeHtml(currencySymbol);
  const safeCustomerId = escapeHtml(customer.id);
  const safeCustomerName = escapeHtml(statement.customerName);
  const safeCustomerTypeLabel = escapeHtml(customerTypeLabel);
  const safeCustomerPhone = customer.phone ? escapeHtml(customer.phone) : "";
  const safeCustomerAddress = customer.address ? escapeHtml(customer.address) : "";
  const safeTodayStr = escapeHtml(todayStr);

  // بناء صفوف القيود المحاسبية
  const rowsHtml = statement.lines.map((line, idx) => {
    const bg = idx % 2 === 0 ? "#ffffff" : "#fbfdfc";
    const balanceColor = line.runningBalance > 0 ? "#b91c1c" : line.runningBalance < 0 ? "#047857" : "#0f172a";
    const safeDate = escapeHtml(line.date);
    const safeLabel = escapeHtml(line.label);
    const safeNotes = line.notes ? escapeHtml(line.notes) : "";
    const safeReference = line.reference ? escapeHtml(line.reference) : "—";

    return `
      <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0; height: 32px;">
        <td style="padding: 6px 8px; font-size: 11px; font-weight: 700; color: #475569; text-align: center; border-left: 1px solid #e2e8f0;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-size: 11px; font-weight: 700; font-family: monospace; direction: ltr; text-align: center; border-left: 1px solid #e2e8f0;">${safeDate}</td>
        <td style="padding: 6px 12px; font-size: 11px; font-weight: 800; color: #0f172a; border-left: 1px solid #e2e8f0;">
          ${safeLabel}
          ${safeNotes ? `<span style="font-size: 10px; font-weight: normal; color: #64748b; margin-right: 6px;">(${safeNotes})</span>` : ""}
        </td>
        <td style="padding: 6px 8px; font-size: 11px; font-family: monospace; font-weight: 700; color: #0D4A39; text-align: center; border-left: 1px solid #e2e8f0;" dir="ltr">${safeReference}</td>
        <td style="padding: 6px 8px; font-size: 11px; font-family: monospace; font-weight: 800; color: #b91c1c; text-align: left; border-left: 1px solid #e2e8f0;" dir="ltr">
          ${line.debit > 0 ? escapeHtml(formatNumber(line.debit)) : "—"}
        </td>
        <td style="padding: 6px 8px; font-size: 11px; font-family: monospace; font-weight: 800; color: #047857; text-align: left; border-left: 1px solid #e2e8f0;" dir="ltr">
          ${line.credit > 0 ? escapeHtml(formatNumber(line.credit)) : "—"}
        </td>
        <td style="padding: 6px 8px; font-size: 11px; font-family: monospace; font-weight: 900; color: ${balanceColor}; text-align: left;" dir="ltr">
          ${escapeHtml(formatNumber(line.runningBalance))}
        </td>
      </tr>
    `;
  }).join("");

  // تعبئة الصفوف الفارغة للحفاظ على التناسق الهيكلي لصفحة A4 الكاملة (مثل نموذج الفاتورة)
  const emptyRowsCount = Math.max(0, MIN_LEDGER_TABLE_ROWS - statement.lines.length);
  let emptyRowsHtml = "";
  for (let i = 0; i < emptyRowsCount; i++) {
    const isFirstEmpty = i === 0 && statement.lines.length === 0;
    emptyRowsHtml += `
      <tr style="background: #ffffff; border-bottom: 1px solid #f1f5f9; height: 32px;">
        <td style="padding: 6px 8px; text-align: center; color: #cbd5e1; font-size: 10px; border-left: 1px solid #f1f5f9;">${isFirstEmpty ? "—" : "•"}</td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 12px; border-left: 1px solid #f1f5f9; color: #94a3b8; font-size: 10.5px;">${isFirstEmpty ? "لا توجد قيود مالية إضافية مسجلة لهذه الفترة" : ""}</td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 8px;"></td>
      </tr>
    `;
  }

  const netBal = statement.netBalance ?? statement.outstanding;
  const netBalanceText = netBal > 0
    ? `<span style="color: #b91c1c; font-weight: 900;">${escapeHtml(formatNumber(netBal))} ${safeCurrencySymbol} (مديونية مستحقة على العميل)</span>`
    : netBal < 0
    ? `<span style="color: #047857; font-weight: 900;">${escapeHtml(formatNumber(Math.abs(netBal)))} ${safeCurrencySymbol} (رصيد دائن / دفعة مقدمة لصالح العميل)</span>`
    : `<span style="color: #059669; font-weight: 900;">0.00 (الحساب متزن بالكامل ومسدد)</span>`;

  container.innerHTML = `
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 1. الترويسة المؤسسية الرسمية (شعار T.A + شارة العنوان + شريط التواصل) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div style="position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 76px; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; z-index: 10;">
        <img src="${TA_LOGO_GREEN_BASE64}" alt="T.A Advertising Solution" style="height: 72px; width: auto; object-fit: contain;" />
      </div>

      <!-- شارة عنوان كشف الحساب في المنتصف تماماً مطابقة لهيكل الفاتورة الرسمية -->
      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 10;">
        <div style="background-color: #C1D0CD; border-radius: 18px; min-width: 230px; height: 52px; padding: 0 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 1px solid #1e293b;">
          <div style="font-size: 22px; font-weight: 900; color: #000000; line-height: 1.1; font-style: italic;">
            كشف حساب مالي
          </div>
          <div style="font-size: 9.5px; font-weight: 800; color: #1e293b; letter-spacing: 0.8px; margin-top: 2px;">
            STATEMENT OF ACCOUNT
          </div>
        </div>
      </div>

      <div style="width: 100px; shrink: 0;"></div>
    </div>

    <!-- شريط التواصل الرسمي المعتمد -->
    <div style="margin: 4px 0 10px 0; height: 34px; padding: 0 18px; background-color: #C1D0CD; border: 1px solid #1e293b; border-radius: 8px; font-size: 11.5px; font-weight: bold; color: #000000; display: flex; align-items: center; justify-content: space-between;" dir="ltr">
      <span style="font-weight: 900; letter-spacing: 0.3px;">+249 12371 1444  -  +249 91296 8886</span>
      <span style="font-weight: 900; letter-spacing: -0.2px;">t.a.advertising@gmail.com</span>
      <span style="font-weight: 900;" dir="rtl">السودان، الخرطوم - بورتسودان</span>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 2. بطاقتا البيانات: بيانات العميل + تفاصيل الكشف -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; margin-bottom: 10px;">
      <!-- بطاقة العميل (اليمين) -->
      <div style="border: 1px solid #1e293b; border-radius: 10px; padding: 8px 14px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 5px;">
          <span style="color: #475569; font-weight: 800; font-size: 9.5px; text-transform: uppercase;">بيانات العميل / CLIENT DETAILS</span>
          <span style="font-family: monospace; font-size: 10px; font-weight: 700; color: #0D4A39;" dir="ltr">${safeCustomerId}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 900; font-size: 14px; color: #0f172a;">${safeCustomerName}</span>
            <span style="font-size: 10px; font-weight: 800; background: #0D4A39; color: #ffffff; padding: 2px 8px; border-radius: 6px;">
              ${safeCustomerTypeLabel}
            </span>
          </div>
          ${safeCustomerPhone ? `<div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #334155;" dir="ltr">هاتف: ${safeCustomerPhone}</div>` : ""}
        </div>
        <div style="font-size: 10.5px; color: #64748b;">
          ${safeCustomerAddress ? `العنوان: ${safeCustomerAddress}` : "الخرطوم - السودان"}
        </div>
      </div>

      <!-- بطاقة تفاصيل الكشف (اليسار) -->
      <div style="border: 1px solid #1e293b; border-radius: 10px; padding: 8px 14px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 5px;">
          <span style="color: #475569; font-weight: 800; font-size: 9.5px; text-transform: uppercase;">تفاصيل الكشف / STATEMENT METRICS</span>
          <span style="font-family: monospace; font-size: 10px; font-weight: 800; color: #0f172a;" dir="ltr">${safeTodayStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="color: #475569; font-weight: 700; font-size: 11px;">العملة المحاسبية:</span>
          <span style="font-weight: 900; font-size: 12px; color: #0D4A39;">${safeCurrencyLabel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #475569; font-weight: 700; font-size: 11px;">إجمالي القيود المسجلة:</span>
          <span style="font-family: monospace; font-weight: 900; font-size: 12px; color: #0f172a;">${statement.lines.length} حركة محاسبية</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 3. لوحة المؤشرات المالية التنفيذية المركزة (KPI Financial Summary Bar) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 8px; margin-bottom: 10px;">
      <!-- إجمالي المطالبات (مدين +) -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 12px; text-align: center;">
        <div style="font-size: 10px; font-weight: 800; color: #64748b;">إجمالي المطالبات والفواتير (مدين +)</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: #b91c1c; margin-top: 2px;" dir="ltr">
          ${escapeHtml(formatNumber(statement.totalInvoiced))} <span style="font-size: 11px; font-weight: 700;">${safeCurrencySymbol}</span>
        </div>
      </div>

      <!-- إجمالي المسدد (دائن -) -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 7px 12px; text-align: center;">
        <div style="font-size: 10px; font-weight: 800; color: #047857;">إجمالي التحصيلات والمدفوعات (دائن -)</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: #047857; margin-top: 2px;" dir="ltr">
          ${escapeHtml(formatNumber(statement.totalCollected))} <span style="font-size: 11px; font-weight: 700;">${safeCurrencySymbol}</span>
        </div>
      </div>

      <!-- الرصيد الصافي المتبقي -->
      <div style="background: ${netBal > 0 ? "#fef2f2" : netBal < 0 ? "#ecfdf5" : "#f8fafc"}; border: 1.5px solid ${netBal > 0 ? "#ef4444" : netBal < 0 ? "#10b981" : "#cbd5e1"}; border-radius: 8px; padding: 7px 12px; text-align: center;">
        <div style="font-size: 10px; font-weight: 800; color: ${netBal > 0 ? "#b91c1c" : netBal < 0 ? "#047857" : "#334155"};">
          ${netBal > 0 ? "صافي الرصيد المستحق على العميل" : netBal < 0 ? "صافي الرصيد الدائن للعميل (مقدم)" : "صافي الرصيد (الحساب متزن)"}
        </div>
        <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: ${netBal > 0 ? "#b91c1c" : netBal < 0 ? "#047857" : "#0f172a"}; margin-top: 2px;" dir="ltr">
          ${escapeHtml(formatNumber(Math.abs(netBal)))} <span style="font-size: 11px; font-weight: 700;">${safeCurrencySymbol}</span>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 4. جدول كشف الحساب المحاسبي التفصيلي (Enterprise Ledger Table) -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div style="flex: 1; min-height: 480px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; margin-bottom: 10px; background: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; height: 100%;">
        <thead>
          <tr style="background: #0D4A39; color: #ffffff; height: 38px;">
            <th style="padding: 6px 8px; width: 36px; text-align: center; font-size: 11px; font-weight: 900; border-left: 1px solid #1e293b;">#</th>
            <th style="padding: 6px 8px; width: 95px; text-align: center; font-size: 11px; font-weight: 900; border-left: 1px solid #1e293b;">التاريخ</th>
            <th style="padding: 6px 12px; text-align: right; font-size: 11.5px; font-weight: 900; border-left: 1px solid #1e293b;">البيان وتفاصيل المعاملة المالية</th>
            <th style="padding: 6px 8px; width: 95px; text-align: center; font-size: 11px; font-weight: 900; border-left: 1px solid #1e293b;">المرجع</th>
            <th style="padding: 6px 8px; width: 95px; text-align: left; font-size: 11px; font-weight: 900; border-left: 1px solid #1e293b;" dir="ltr">مدين (+)</th>
            <th style="padding: 6px 8px; width: 95px; text-align: left; font-size: 11px; font-weight: 900; border-left: 1px solid #1e293b;" dir="ltr">دائن (-)</th>
            <th style="padding: 6px 8px; width: 105px; text-align: left; font-size: 11px; font-weight: 900;" dir="ltr">الرصيد التراكمي</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          ${emptyRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #F1F5F4; border-top: 2px solid #0D4A39; height: 38px; font-weight: 900; font-size: 11.5px;">
            <td colspan="4" style="padding: 6px 12px; text-align: right; color: #0D4A39; border-left: 1px solid #cbd5e1;">الإجماليات الكلية للفترة (${safeCurrencySymbol}):</td>
            <td style="padding: 6px 8px; color: #b91c1c; text-align: left; font-family: monospace; border-left: 1px solid #cbd5e1;" dir="ltr">${escapeHtml(formatNumber(statement.totalInvoiced))}</td>
            <td style="padding: 6px 8px; color: #047857; text-align: left; font-family: monospace; border-left: 1px solid #cbd5e1;" dir="ltr">${escapeHtml(formatNumber(statement.totalCollected))}</td>
            <td style="padding: 6px 8px; color: #0f172a; text-align: left; font-family: monospace;" dir="ltr">${escapeHtml(formatNumber(netBal))}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 5. شريط الوضع المالي المعتمد والحساب البنكي الرسمي -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div style="background: #F8FAFA; border: 1px solid #C1D0CD; border-radius: 8px; padding: 6px 12px; margin-bottom: 10px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="color: #475569; font-weight: 700;">الوضع المالي للحساب: </span>
        ${netBalanceText}
      </div>
      <div style="font-size: 10.5px; color: #0D4A39; font-weight: 800; background: #e6f0ed; padding: 3px 10px; border-radius: 6px; border: 1px solid #b8d5ce;">
        الحساب المعتمد للسداد: بنك الخرطوم 3283046 (طارق عثمان / تي ايه للدعايه والاعلان)
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════ -->
    <!-- 6. التذييل الرسمي المعتمد: الاعتماد + رمز QR + توقيع الإدارة المالية -->
    <!-- ═══════════════════════════════════════════════════════════════ -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 8px; border-top: 1px solid #1e293b; margin-bottom: 6px;">
      <!-- اعتماد واستلام العميل -->
      <div style="border: 1px solid #1e293b; border-radius: 10px; padding: 8px 12px; width: 220px; height: 84px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
        <div style="font-weight: 800; font-size: 11px; color: #0f172a;">اعتماد واستلام العميل:</div>
        <div style="font-size: 10px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
          التوقيع والختم: ...................................
        </div>
      </div>

      <!-- رمز QR للتوثيق بدون أي عبارة أسفله -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <div style="width: 70px; height: 70px; padding: 3px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <img src="${TA_QR_CODE_BASE64}" alt="QR Verification" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>
      </div>

      <!-- إدارة الحسابات المالية وتوقيع طارق عثمان علي -->
      <div style="border: 1px solid #1e293b; border-radius: 10px; padding: 8px 12px; width: 220px; height: 84px; display: flex; flex-direction: column; justify-content: space-between; position: relative; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-weight: 800; font-size: 11px; color: #0f172a;">إدارة الحسابات المالية:</span>
          <span style="font-weight: 900; font-size: 11.5px; color: #0D4A39;">طارق عثمان علي</span>
        </div>
        <div style="position: relative; height: 42px; display: flex; align-items: center; justify-content: flex-start;">
          <img
            src="${TA_SIGNATURE_TARIG_BASE64}"
            alt="Signature"
            style="max-height: 44px; width: auto; object-fit: contain; pointer-events: none; mix-blend-mode: multiply; transform: rotate(-1deg);"
          />
        </div>
        <div style="font-size: 9.5px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
          المدير المالي والتشغيلي المعتمد
        </div>
      </div>
    </div>

    <!-- السطر الإداري والقانوني المعتمد -->
    <div style="text-align: center; font-size: 9px; color: #94a3b8; font-weight: bold; padding-top: 4px;">
      نظام T.A Advertising Solution لإدارة الحسابات والمراسلات المالية — مستند رسمي صادر آلياً ومطابق للقيود المسجلة
    </div>
  `;

  return container;
}

export async function printCustomerStatement(
  statement: CustomerStatement,
  customer: CustomerRecord,
  currency = statement.currency || "SDG"
): Promise<boolean> {
  const container = buildStatementDomElement(statement, customer, currency);
  container.id = "customer-statement-print-mount";

  const mountWrapper = document.createElement("div");
  mountWrapper.id = "customer-statement-print-wrapper";
  mountWrapper.style.cssText = "position: fixed; left: -9999px; top: 0; width: 0; height: 0; overflow: hidden; pointer-events: none; z-index: -9999;";
  mountWrapper.appendChild(container);
  document.body.appendChild(mountWrapper);

  const docTitle = `كشف-حساب-${statement.customerName.replace(/[\s/]/g, "_")}-${currency}-${new Date().toISOString().slice(0, 10)}`;

  document.body.classList.add("printing-custom-invoice");
  try {
    await triggerPrintWithElement(container, docTitle, "a4", () => {
      document.body.classList.remove("printing-custom-invoice");
      if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    });
    return true;
  } catch (err) {
    document.body.classList.remove("printing-custom-invoice");
    if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    toast.error("تعذر طباعة كشف الحساب");
    return false;
  }
}

export async function shareCustomerStatementViaWhatsApp(
  statement: CustomerStatement,
  customer: CustomerRecord,
  currency = statement.currency || "SDG"
): Promise<boolean> {
  const container = buildStatementDomElement(statement, customer, currency);
  container.id = "customer-statement-share-mount";

  const mountWrapper = document.createElement("div");
  mountWrapper.id = "customer-statement-share-wrapper";
  mountWrapper.style.cssText = "position: fixed; left: -9999px; top: 0; width: 0; height: 0; overflow: hidden; pointer-events: none; z-index: -9999;";
  mountWrapper.appendChild(container);
  document.body.appendChild(mountWrapper);

  const docTitle = `كشف-حساب-${statement.customerName.replace(/[\s/]/g, "_")}-${currency}`;

  try {
    await shareInvoiceViaWhatsApp(container, {
      filename: docTitle,
      format: "a4",
      partyName: statement.customerName,
      invoiceRef: "كشف حساب",
      totalAmount: statement.outstanding,
      currency,
      invoiceTypeLabel: "كشف حساب",
      isRtl: true,
    });
    if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    return true;
  } catch (err) {
    if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    toast.error("تعذر مشاركة كشف الحساب عبر واتساب");
    return false;
  }
}
