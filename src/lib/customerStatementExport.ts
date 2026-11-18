/**
 * ═══════════════════════════════════════════════════════════════
 * Customer Statement Print & PDF Export Engine
 * ═══════════════════════════════════════════════════════════════
 * Generates an authoritative, beautifully designed Arabic RTL
 * customer financial statement matching the T.A Advertising brand identity.
 */

import type { CustomerStatement } from "@/lib/repositories/ReportsRepository";
import type { CustomerRecord } from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { triggerPrintWithElement, shareInvoiceViaWhatsApp } from "@/lib/pdfExport";
import { TA_LOGO_GREEN_BASE64, TA_SIGNATURE_TARIG_BASE64, TA_QR_CODE_BASE64 } from "@/assets/invoiceImagesBase64";
import { toast } from "sonner";

export function buildStatementDomElement(
  statement: CustomerStatement,
  customer: CustomerRecord,
  currency = statement.currency || "SDG"
): HTMLElement {
  const container = document.createElement("div");
  container.className = "statement-print-document font-sans text-right";
  container.dir = "rtl";
  container.style.cssText = `
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 15mm;
    background: #ffffff;
    color: #111827;
    box-sizing: border-box;
    position: relative;
    font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  `;

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, " / ");
  const currencyLabel = currency === "USD" ? "دولار أمريكي (USD)" : currency === "SAR" ? "ريال سعودي (SAR)" : currency === "EGP" ? "جنيه مصري (EGP)" : "جنيه سوداني (SDG)";
  const currencySymbol = currency === "USD" ? "$" : currency;

  const rowsHtml = statement.lines.map((line, idx) => {
    const isOpening = line.kind === "opening_balance";
    const isInvoice = line.kind === "invoice";
    const bg = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
    const balanceColor = line.runningBalance > 0 ? "#b91c1c" : line.runningBalance < 0 ? "#047857" : "#374151";

    return `
      <tr style="background: ${bg}; border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 7px 8px; font-size: 11px; font-weight: 700; color: #4b5563; text-align: center;">${idx + 1}</td>
        <td style="padding: 7px 8px; font-size: 11px; font-weight: 700; font-family: monospace; direction: ltr; text-align: center;">${line.date}</td>
        <td style="padding: 7px 8px; font-size: 11px; font-weight: 800; color: #111827;">
          ${line.label}
          ${line.notes ? `<div style="font-size: 9.5px; font-weight: normal; color: #6b7280; margin-top: 2px;">${line.notes}</div>` : ""}
        </td>
        <td style="padding: 7px 8px; font-size: 11px; font-family: monospace; font-weight: 700; color: #2563eb; text-align: center;" dir="ltr">${line.reference || "—"}</td>
        <td style="padding: 7px 8px; font-size: 11px; font-family: monospace; font-weight: 800; color: #b91c1c; text-align: left;" dir="ltr">
          ${line.debit > 0 ? formatNumber(line.debit) : "—"}
        </td>
        <td style="padding: 7px 8px; font-size: 11px; font-family: monospace; font-weight: 800; color: #047857; text-align: left;" dir="ltr">
          ${line.credit > 0 ? formatNumber(line.credit) : "—"}
        </td>
        <td style="padding: 7px 8px; font-size: 11.5px; font-family: monospace; font-weight: 900; color: ${balanceColor}; text-align: left;" dir="ltr">
          ${formatNumber(line.runningBalance)}
        </td>
      </tr>
    `;
  }).join("");

  const netBalanceText = statement.outstanding > 0
    ? `<span style="color: #b91c1c; font-weight: 900;">${formatNumber(statement.outstanding)} ${currencySymbol} (مديونية مستحقة على العميل)</span>`
    : statement.outstanding < 0
    ? `<span style="color: #047857; font-weight: 900;">${formatNumber(Math.abs(statement.outstanding))} ${currencySymbol} (رصيد مقدم لصالح العميل)</span>`
    : `<span style="color: #059669; font-weight: 900;">0.00 (الحساب متزن بالكامل)</span>`;

  container.innerHTML = `
    <!-- 1. Header Banner -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
      <div style="text-align: right;">
        <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0;">تي ايه للدعاية والإعلان</h1>
        <p style="font-size: 11px; color: #475569; margin: 0; font-weight: 600;">T.A Advertising Solution | الخرطوم - بورتسودان</p>
        <p style="font-size: 10.5px; color: #64748b; margin: 2px 0 0 0;" dir="ltr">+249 12371 1444 | +249 91296 8886 | t.a.advertising@gmail.com</p>
      </div>
      <div style="text-align: center;">
        <div style="background: #0f172a; color: #ffffff; padding: 6px 18px; border-radius: 8px; font-size: 14px; font-weight: 900; letter-spacing: 0.5px;">
          كشف حساب مالي تفصيلي
        </div>
        <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 4px;">Statement of Account</div>
      </div>
      <div style="width: 70px; height: 50px; display: flex; align-items: center; justify-content: center;">
        <img src="${TA_LOGO_GREEN_BASE64}" alt="T.A Logo" style="max-height: 48px; object-fit: contain;" />
      </div>
    </div>

    <!-- 2. Customer & Statement Metadata Card -->
    <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin-bottom: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px;">
      <div style="border-left: 1px solid #e2e8f0; padding-left: 12px;">
        <div style="font-size: 10.5px; color: #64748b; font-weight: bold;">بيانات العميل:</div>
        <div style="font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px;">${statement.customerName}</div>
        ${customer.phone ? `<div style="font-size: 11px; color: #334155; font-weight: 700; margin-top: 3px;" dir="ltr"><span style="color: #64748b;">الهاتف:</span> ${customer.phone}</div>` : ""}
        ${customer.address ? `<div style="font-size: 10.5px; color: #475569; margin-top: 2px;">العنوان: ${customer.address}</div>` : ""}
      </div>
      <div style="display: flex; flex-direction: column; justify-content: center; gap: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #64748b; font-weight: 700;">تاريخ الإصدار:</span>
          <span style="font-family: monospace; font-weight: 800; color: #0f172a;">${todayStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #64748b; font-weight: 700;">عملة الحساب:</span>
          <span style="font-weight: 800; color: #0f172a;">${currencyLabel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #64748b; font-weight: 700;">عدد الحركات:</span>
          <span style="font-family: monospace; font-weight: 800; color: #0f172a;">${statement.lines.length} حركة</span>
        </div>
      </div>
    </div>

    <!-- 3. KPI Financial Summary Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 10px; margin-bottom: 14px;">
      <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b;">إجمالي الفواتير والمطالبات (مدين)</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: #0f172a; margin-top: 2px;" dir="ltr">
          ${formatNumber(statement.totalInvoiced)} <span style="font-size: 10px; font-weight: 700;">${currencySymbol}</span>
        </div>
      </div>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 12px;">
        <div style="font-size: 10px; font-weight: 700; color: #047857;">إجمالي التحصيلات والمدفوعات (دائن)</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: #047857; margin-top: 2px;" dir="ltr">
          ${formatNumber(statement.totalCollected)} <span style="font-size: 10px; font-weight: 700;">${currencySymbol}</span>
        </div>
      </div>
      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 8px 12px;">
        <div style="font-size: 10px; font-weight: 700; color: #be123c;">الرصيد الصافي المتبقي</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: #be123c; margin-top: 2px;" dir="ltr">
          ${formatNumber(statement.outstanding)} <span style="font-size: 10px; font-weight: 700;">${currencySymbol}</span>
        </div>
      </div>
    </div>

    <!-- 4. Chronological Ledger Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #0f172a; color: #ffffff; font-size: 10.5px;">
          <th style="padding: 8px; width: 28px; text-align: center;">#</th>
          <th style="padding: 8px; width: 85px; text-align: center;">التاريخ</th>
          <th style="padding: 8px; text-align: right;">البيان وتفاصيل المعاملة</th>
          <th style="padding: 8px; width: 95px; text-align: center;">المرجع</th>
          <th style="padding: 8px; width: 85px; text-align: left;" dir="ltr">مدين (+)</th>
          <th style="padding: 8px; width: 85px; text-align: left;" dir="ltr">دائن (-)</th>
          <th style="padding: 8px; width: 95px; text-align: left;" dir="ltr">الرصيد الجاري</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8; font-weight: bold;">لا توجد حركات مالية مسجلة لهذا العميل في هذه الفترة</td></tr>`}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; border-top: 2px solid #0f172a; font-weight: 900; font-size: 11px;">
          <td colspan="4" style="padding: 8px; text-align: right; color: #0f172a;">الإجماليات الكلية:</td>
          <td style="padding: 8px; color: #b91c1c; text-align: left; font-family: monospace;" dir="ltr">${formatNumber(statement.totalInvoiced)}</td>
          <td style="padding: 8px; color: #047857; text-align: left; font-family: monospace;" dir="ltr">${formatNumber(statement.totalCollected)}</td>
          <td style="padding: 8px; color: #0f172a; text-align: left; font-family: monospace;" dir="ltr">${formatNumber(statement.outstanding)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- 5. Net Status Banner -->
    <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="color: #475569; font-weight: bold;">الوضع المالي الختامي للحساب: </span>
        ${netBalanceText}
      </div>
      <div style="font-size: 10px; color: #64748b; font-family: monospace;">الحساب: بنك الخرطوم 3283046</div>
    </div>

    <!-- 6. Footer Signatures & QR -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 10px; border-top: 1px solid #cbd5e1;">
      <div style="text-align: right; font-size: 11px; color: #334155;">
        <div style="font-weight: bold;">اعتماد واستلام العميل:</div>
        <div style="height: 35px;"></div>
        <div style="font-size: 10px; color: #94a3b8;">التوقيع والختم: .......................................</div>
      </div>
      <div style="text-align: center;">
        <img src="${TA_QR_CODE_BASE64}" alt="QR Verification" style="width: 50px; height: 50px; object-fit: contain;" />
        <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">توثيق إلكتروني معتمد</div>
      </div>
      <div style="text-align: left; font-size: 11px; color: #334155;">
        <div style="font-weight: bold; text-align: center;">إدارة الحسابات المالية:</div>
        <div style="display: flex; justify-content: center; height: 35px;">
          <img src="${TA_SIGNATURE_TARIG_BASE64}" alt="Signature" style="max-height: 35px; object-fit: contain;" />
        </div>
        <div style="font-size: 10px; color: #475569; text-align: center; font-weight: bold;">طارق عثمان علي</div>
      </div>
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
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  const docTitle = `كشف-حساب-${statement.customerName.replace(/[\s/]/g, "_")}-${new Date().toISOString().slice(0, 10)}`;

  document.body.classList.add("printing-custom-invoice");
  try {
    await triggerPrintWithElement(container, docTitle, "a4", () => {
      document.body.classList.remove("printing-custom-invoice");
      if (container.parentNode) container.parentNode.removeChild(container);
    });
    return true;
  } catch (err) {
    document.body.classList.remove("printing-custom-invoice");
    if (container.parentNode) container.parentNode.removeChild(container);
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
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  const docTitle = `كشف-حساب-${statement.customerName.replace(/[\s/]/g, "_")}`;

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
    if (container.parentNode) container.parentNode.removeChild(container);
    return true;
  } catch (err) {
    if (container.parentNode) container.parentNode.removeChild(container);
    toast.error("تعذر مشاركة كشف الحساب عبر واتساب");
    return false;
  }
}
