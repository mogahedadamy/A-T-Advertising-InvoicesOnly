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
  container.className = "statement-print-root standard-invoice-sheet invoice-paper statement-print-document font-sans text-right";
  container.dir = "rtl";
  container.style.cssText = `
    width: 210mm;
    min-height: 297mm;
    padding: 12mm 14mm 10mm 14mm;
    background: #ffffff;
    color: #0f172a;
    box-sizing: border-box;
    position: relative;
    font-family: 'Tajawal', 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
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

  const rowsHtml = statement.lines.map((line, idx) => {
    const isOpening = line.kind === "opening_balance";
    const bg = idx % 2 === 0 ? "#ffffff" : "#f8faf9";
    const balanceColor = line.runningBalance > 0 ? "#b91c1c" : line.runningBalance < 0 ? "#047857" : "#0f172a";

    return `
      <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 7px 6px; font-size: 11px; font-weight: 700; color: #475569; text-align: center;">${idx + 1}</td>
        <td style="padding: 7px 6px; font-size: 11px; font-weight: 700; font-family: monospace; direction: ltr; text-align: center;">${line.date}</td>
        <td style="padding: 7px 8px; font-size: 11px; font-weight: 800; color: #0f172a;">
          ${line.label}
          ${line.notes ? `<div style="font-size: 9.5px; font-weight: normal; color: #64748b; margin-top: 2px;">${line.notes}</div>` : ""}
        </td>
        <td style="padding: 7px 6px; font-size: 11px; font-family: monospace; font-weight: 700; color: #0D4A39; text-align: center;" dir="ltr">${line.reference || "—"}</td>
        <td style="padding: 7px 6px; font-size: 11px; font-family: monospace; font-weight: 800; color: #b91c1c; text-align: left;" dir="ltr">
          ${line.debit > 0 ? formatNumber(line.debit) : "—"}
        </td>
        <td style="padding: 7px 6px; font-size: 11px; font-family: monospace; font-weight: 800; color: #047857; text-align: left;" dir="ltr">
          ${line.credit > 0 ? formatNumber(line.credit) : "—"}
        </td>
        <td style="padding: 7px 6px; font-size: 11px; font-family: monospace; font-weight: 900; color: ${balanceColor}; text-align: left;" dir="ltr">
          ${formatNumber(line.runningBalance)}
        </td>
      </tr>
    `;
  }).join("");

  const netBalanceText = statement.outstanding > 0
    ? `<span style="color: #b91c1c; font-weight: 900;">${formatNumber(statement.outstanding)} ${currencySymbol} (مديونية مستحقة على العميل)</span>`
    : statement.outstanding < 0
    ? `<span style="color: #047857; font-weight: 900;">${formatNumber(Math.abs(statement.outstanding))} ${currencySymbol} (رصيد دائن / دفعة مقدمة لصالح العميل)</span>`
    : `<span style="color: #059669; font-weight: 900;">0.00 (الحساب متزن بالكامل ومسدد)</span>`;

  container.innerHTML = `
    <!-- 1. الترويسة الرسمية المعتمدة (شعار T.A الأخضر + شارة العنوان الموحدة) -->
    <div style="position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 80px; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; z-index: 10;">
        <img src="${TA_LOGO_GREEN_BASE64}" alt="T.A Advertising Solution" style="height: 74px; width: auto; object-fit: contain;" />
      </div>

      <!-- شارة عنوان كشف الحساب في المنتصف تماماً مطابقة لنموذج الفاتورة -->
      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 10;">
        <div style="background-color: #C1D0CD; border-radius: 20px; min-width: 230px; height: 52px; padding: 0 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 1px solid #a3b8b4;">
          <div style="font-size: 21px; font-weight: 900; color: #000000; line-height: 1.1; font-style: italic;">
            كشف حساب مالي
          </div>
          <div style="font-size: 9px; font-weight: 700; color: #1e293b; letter-spacing: 0.5px; margin-top: 1px;">
            STATEMENT OF ACCOUNT
          </div>
        </div>
      </div>

      <div style="text-align: left; z-index: 10; font-size: 10px; color: #334155; line-height: 1.4;" dir="ltr">
        <div style="font-weight: 900; font-size: 12px; color: #0D4A39;">T.A Advertising Solution</div>
        <div>t.a.advertising@gmail.com</div>
        <div>+249 12371 1444 | +249 91296 8886</div>
        <div>Khartoum - Port Sudan</div>
      </div>
    </div>

    <!-- خط فاصل زمردي ملكي -->
    <div style="height: 3px; background: linear-gradient(90deg, #0D4A39, #C5A059, #0D4A39); border-radius: 2px; margin-bottom: 12px;"></div>

    <!-- 2. بطاقة معلومات العميل وبيانات المستند المزدوجة (مطابقة لـ StandardInvoiceHeader) -->
    <div style="display: grid; grid-template-columns: 1.35fr 1fr; gap: 10px; margin-bottom: 12px;">
      <!-- صندوق بيانات العميل -->
      <div style="background: #F8FAFA; border: 1.5px solid #C1D0CD; border-radius: 12px; padding: 8px 12px;">
        <div style="font-size: 10px; font-weight: 900; color: #0D4A39; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
          <span>بيانات العميل / CLIENT DETAILS</span>
        </div>
        <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${statement.customerName}</div>
        <div style="display: flex; gap: 12px; margin-top: 4px; font-size: 11px;">
          <div style="color: #475569;">
            <span style="font-weight: 700;">كود العميل:</span>
            <span style="font-family: monospace; font-weight: 800; color: #0D4A39;">${customer.id}</span>
          </div>
          ${customer.phone ? `
            <div style="color: #475569;" dir="ltr">
              <span style="font-weight: 700;">الهاتف:</span>
              <span style="font-family: monospace; font-weight: 800; color: #0f172a;">${customer.phone}</span>
            </div>
          ` : ""}
        </div>
        ${customer.address ? `
          <div style="font-size: 10.5px; color: #64748b; margin-top: 3px;">
            <span style="font-weight: 700;">العنوان:</span> ${customer.address}
          </div>
        ` : ""}
      </div>

      <!-- صندوق بيانات الكشف المالي -->
      <div style="background: #F8FAFA; border: 1.5px solid #C1D0CD; border-radius: 12px; padding: 8px 12px; display: flex; flex-direction: column; justify-content: space-around;">
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #475569; font-weight: 700;">تاريخ إصدار الكشف:</span>
          <span style="font-family: monospace; font-weight: 900; color: #0f172a;">${todayStr}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #475569; font-weight: 700;">العملة المعتمدة:</span>
          <span style="font-weight: 900; color: #0D4A39;">${currencyLabel}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #475569; font-weight: 700;">إجمالي عدد الحركات:</span>
          <span style="font-family: monospace; font-weight: 900; color: #0f172a;">${statement.lines.length} قيد محاسبي</span>
        </div>
      </div>
    </div>

    <!-- 3. لوحة المؤشرات المالية التنفيذية (KPI Financial Summary Bar) -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1.25fr; gap: 8px; margin-bottom: 12px;">
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 7px 10px; text-align: center;">
        <div style="font-size: 9.5px; font-weight: 800; color: #64748b;">إجمالي الفواتير والمطالبات (مدين +)</div>
        <div style="font-size: 14.5px; font-weight: 900; font-family: monospace; color: #b91c1c; margin-top: 1px;" dir="ltr">
          ${formatNumber(statement.totalInvoiced)} <span style="font-size: 10px; font-weight: 700;">${currencySymbol}</span>
        </div>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 7px 10px; text-align: center;">
        <div style="font-size: 9.5px; font-weight: 800; color: #047857;">إجمالي التحصيلات والمدفوعات (دائن -)</div>
        <div style="font-size: 14.5px; font-weight: 900; font-family: monospace; color: #047857; margin-top: 1px;" dir="ltr">
          ${formatNumber(statement.totalCollected)} <span style="font-size: 10px; font-weight: 700;">${currencySymbol}</span>
        </div>
      </div>

      <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 7px 10px; text-align: center;">
        <div style="font-size: 9.5px; font-weight: 800; color: #c2410c;">الرصيد الصافي المتبقي</div>
        <div style="font-size: 15px; font-weight: 900; font-family: monospace; color: ${statement.outstanding > 0 ? "#b91c1c" : statement.outstanding < 0 ? "#047857" : "#0f172a"}; margin-top: 1px;" dir="ltr">
          ${formatNumber(statement.outstanding)} <span style="font-size: 10px; font-weight: 700;">${currencySymbol}</span>
        </div>
      </div>
    </div>

    <!-- 4. جدول كشف الحساب المحاسبي التفصيلي (Chronological Ledger Table) -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1.5px solid #0D4A39; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #0D4A39; color: #ffffff; font-size: 10.5px;">
          <th style="padding: 7px 6px; width: 28px; text-align: center;">#</th>
          <th style="padding: 7px 6px; width: 85px; text-align: center;">التاريخ</th>
          <th style="padding: 7px 8px; text-align: right;">البيان وتفاصيل المعاملة</th>
          <th style="padding: 7px 6px; width: 95px; text-align: center;">المرجع</th>
          <th style="padding: 7px 6px; width: 88px; text-align: left;" dir="ltr">مدين (+)</th>
          <th style="padding: 7px 6px; width: 88px; text-align: left;" dir="ltr">دائن (-)</th>
          <th style="padding: 7px 6px; width: 98px; text-align: left;" dir="ltr">الرصيد التراكمي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8; font-weight: bold;">لا توجد حركات مالية مسجلة لهذا العميل حتى تاريخه</td></tr>`}
      </tbody>
      <tfoot>
        <tr style="background: #F1F5F4; border-top: 2px solid #0D4A39; font-weight: 900; font-size: 11px;">
          <td colspan="4" style="padding: 7px 8px; text-align: right; color: #0D4A39;">الإجماليات الكلية:</td>
          <td style="padding: 7px 6px; color: #b91c1c; text-align: left; font-family: monospace;" dir="ltr">${formatNumber(statement.totalInvoiced)}</td>
          <td style="padding: 7px 6px; color: #047857; text-align: left; font-family: monospace;" dir="ltr">${formatNumber(statement.totalCollected)}</td>
          <td style="padding: 7px 6px; color: #0f172a; text-align: left; font-family: monospace;" dir="ltr">${formatNumber(statement.outstanding)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- 5. شريط الوضع المالي الختامي والحساب البنكي الرسمي -->
    <div style="background: #F8FAFA; border: 1px solid #C1D0CD; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span style="color: #475569; font-weight: 700;">الوضع المالي الختامي للحساب: </span>
        ${netBalanceText}
      </div>
      <div style="font-size: 10px; color: #0D4A39; font-weight: 800; background: #e6f0ed; padding: 4px 10px; border-radius: 6px; border: 1px solid #b8d5ce;">
        الحساب المعتمد: بنك الخرطوم 3283046 (طارق عثمان / تي ايه للدعايه والاعلان)
      </div>
    </div>

    <!-- 6. التذييل الرسمي المعتمد: التواقيع والختم ورمز QR -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 8px; border-top: 1.5px solid #C1D0CD; margin-top: auto;">
      <!-- اعتماد العميل -->
      <div style="text-align: right; font-size: 10.5px; color: #334155; width: 170px;">
        <div style="font-weight: 800; color: #0f172a;">اعتماد واستلام العميل:</div>
        <div style="height: 30px;"></div>
        <div style="font-size: 9.5px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 3px;">
          التوقيع والختم: .......................
        </div>
      </div>

      <!-- رمز QR للتوثيق الإلكتروني -->
      <div style="text-align: center;">
        <img src="${TA_QR_CODE_BASE64}" alt="QR Verification" style="width: 52px; height: 52px; object-fit: contain;" />
        <div style="font-size: 8.5px; font-weight: 800; color: #0D4A39; margin-top: 2px;">توثيق إلكتروني معتمد</div>
      </div>

      <!-- توقيع الإدارة المالية المعتمد مع توقيع طارق عثمان علي الأصلي المتداخل -->
      <div style="text-align: left; font-size: 10.5px; color: #334155; width: 170px;">
        <div style="font-weight: 800; text-align: center; color: #0f172a;">إدارة الحسابات المالية:</div>
        <div style="position: relative; height: 38px; display: flex; justify-content: center; align-items: center;">
          <img
            src="${TA_SIGNATURE_TARIG_BASE64}"
            alt="Signature"
            style="position: absolute; top: -6px; max-height: 48px; object-fit: contain; pointer-events: none; z-index: 5;"
          />
        </div>
        <div style="font-size: 10.5px; color: #0D4A39; text-align: center; font-weight: 900; border-top: 1px dashed #cbd5e1; padding-top: 3px;">
          طارق عثمان علي
        </div>
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

  // إلحاق العنصر بحاوية مخفية حتى لا تنتقل إحداثيات left:-9999px إلى مستند الطباعة النهائي
  const mountWrapper = document.createElement("div");
  mountWrapper.id = "customer-statement-print-wrapper";
  mountWrapper.style.cssText = "position: fixed; left: -9999px; top: 0; width: 0; height: 0; overflow: hidden; pointer-events: none; z-index: -9999;";
  mountWrapper.appendChild(container);
  document.body.appendChild(mountWrapper);

  const docTitle = `كشف-حساب-${statement.customerName.replace(/[\s/]/g, "_")}-${new Date().toISOString().slice(0, 10)}`;

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
    if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    return true;
  } catch (err) {
    if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    toast.error("تعذر مشاركة كشف الحساب عبر واتساب");
    return false;
  }
}
