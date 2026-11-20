/**
 * ═══════════════════════════════════════════════════════════════
 * Executive Account Statement Document Engine (Corporate A4)
 * ═══════════════════════════════════════════════════════════════
 * Banking-grade Arabic RTL customer financial statement designed
 * for T.A Advertising Solution on standard A4 (210mm x 297mm).
 * Follows strict 3-token corporate palette (#0D4A39, #C5A059, neutrals),
 * zero metric duplication, full BiDi isolation, and XSS escaping.
 */

import type { CustomerStatement } from "@/lib/repositories/ReportsRepository";
import type { CustomerRecord } from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { triggerPrintWithElement, shareInvoiceViaWhatsApp } from "@/lib/pdfExport";
import {
  TA_LOGO_GREEN_BASE64,
  TA_SIGNATURE_TARIG_BASE64,
  TA_QR_CODE_BASE64,
} from "@/assets/invoiceImagesBase64";
import { escapeHtml } from "@/lib/security/htmlEscape";
import { getCompanyProfileSnapshot } from "@/lib/settings/companyProfileStore";
import { getLocalIsoDate } from "@/lib/dateUtils";
import { getInvoiceTafqeet } from "@/lib/proforma/tafqeet";
import type { AppCurrency } from "@/lib/currency/types";
import { toast } from "sonner";

const MIN_LEDGER_TABLE_ROWS = 12;

function toAppCurrency(currency: string): AppCurrency {
  if (currency === "USD" || currency === "SAR" || currency === "EGP" || currency === "SDG") {
    return currency;
  }
  return "SDG";
}

export function buildStatementDomElement(
  statement: CustomerStatement,
  customer: CustomerRecord,
  currency = statement.currency || "SDG"
): HTMLElement {
  const container = document.createElement("div");
  const isSinglePage = statement.lines.length <= MIN_LEDGER_TABLE_ROWS;

  // Exclude "invoice-paper" so pdfExport.ts never applies A5 landscape heuristics
  container.className =
    "statement-print-root standard-invoice-sheet statement-print-document font-sans text-right";
  container.dir = "rtl";
  container.style.cssText = `
    width: 210mm;
    min-height: 297mm;
    height: ${isSinglePage ? "297mm" : "auto"};
    padding: 11mm 13mm 10mm 13mm;
    background: #ffffff;
    color: #0f172a;
    box-sizing: border-box;
    position: relative;
    font-family: 'Tajawal', 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  `;

  const companyProfile = getCompanyProfileSnapshot();
  const safeCompanyPhone = escapeHtml(companyProfile.phone);
  const safeCompanyEmail = escapeHtml(companyProfile.email);
  const safeCompanyAddress = escapeHtml(companyProfile.addressAr);

  const localIsoDate = getLocalIsoDate();
  const todayStr = localIsoDate.replace(/-/g, " / ");
  const resolvedCurrency = toAppCurrency(currency);

  const currencyLabel =
    resolvedCurrency === "USD"
      ? "دولار أمريكي (USD)"
      : resolvedCurrency === "SAR"
      ? "ريال سعودي (SAR)"
      : resolvedCurrency === "EGP"
      ? "جنيه مصري (EGP)"
      : "جنيه سوداني (SDG)";
  const currencySymbol = resolvedCurrency === "USD" ? "$" : currency;

  const customerTypeLabel =
    customer.type === "company"
      ? "شركة"
      : customer.type === "institution" ||
        customer.type === "agency" ||
        customer.type === "internal"
      ? "مؤسسة"
      : customer.type === "client"
      ? "زبون"
      : "أفراد";

  const safeCurrencyLabel = escapeHtml(currencyLabel);
  const safeCurrencySymbol = escapeHtml(currencySymbol);
  const safeCustomerName = escapeHtml(statement.customerName);
  const safeCustomerTypeLabel = escapeHtml(customerTypeLabel);
  const safeCustomerPhone = customer.phone?.trim() ? escapeHtml(customer.phone.trim()) : "";
  const safeCustomerAddress = customer.address?.trim() ? escapeHtml(customer.address.trim()) : "";
  const safeTodayStr = escapeHtml(todayStr);

  const netBal = statement.netBalance ?? statement.outstanding;
  const absNetBal = Math.abs(netBal);
  const tafqeetText =
    netBal === 0
      ? "الحساب متزن بالكامل ومسدد"
      : getInvoiceTafqeet(absNetBal, true, resolvedCurrency);
  const safeTafqeetText = escapeHtml(tafqeetText);

  const netStatusLabel =
    netBal > 0
      ? "صافي الرصيد المستحق"
      : netBal < 0
      ? "صافي الرصيد الدائن للعميل"
      : "حالة الحساب";
  const netStatusHint =
    netBal > 0
      ? "مديونية مستحقة على العميل"
      : netBal < 0
      ? "رصيد دائن / دفعة مقدمة لصالح العميل"
      : "الحساب متزن بالكامل ومسدد";
  const netAmountColor = netBal > 0 ? "#991b1b" : "#0D4A39";
  const tafqeetHeading =
    netBal > 0
      ? "صافي المستحق بالحروف:"
      : netBal < 0
      ? "الرصيد الدائن بالحروف:"
      : "الوضع المالي للحساب:";

  const monoStyle =
    "font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-variant-numeric: tabular-nums;";

  // 1. صفوف القيود المحاسبية الفعلية
  const rowsHtml = statement.lines
    .map((line, idx) => {
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8faf9";
      const balanceColor =
        line.runningBalance > 0
          ? "#991b1b"
          : line.runningBalance < 0
          ? "#0D4A39"
          : "#0f172a";
      const safeDate = escapeHtml(line.date);
      const safeLabel = escapeHtml(line.label);
      const safeNotes = line.notes?.trim() ? escapeHtml(line.notes.trim()) : "";
      const safeReference = line.reference?.trim() ? escapeHtml(line.reference.trim()) : "—";

      return `
        <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0; height: 32px;">
          <td style="padding: 6px 6px; font-size: 10.5px; font-weight: 700; color: #64748b; text-align: center; border-left: 1px solid #e2e8f0; ${monoStyle}">${idx + 1}</td>
          <td style="padding: 6px 8px; font-size: 10.5px; font-weight: 700; color: #334155; text-align: center; border-left: 1px solid #e2e8f0; ${monoStyle}"><bdi dir="ltr">${safeDate}</bdi></td>
          <td style="padding: 6px 10px; font-size: 11px; font-weight: 800; color: #0f172a; text-align: right; border-left: 1px solid #e2e8f0;">
            <span>${safeLabel}</span>
            ${
              safeNotes
                ? `<bdi dir="auto" style="display: inline-block; font-size: 9.5px; font-weight: 600; color: #64748b; margin-right: 6px;">(${safeNotes})</bdi>`
                : ""
            }
          </td>
          <td style="padding: 6px 8px; font-size: 10.5px; font-weight: 700; color: #0D4A39; text-align: center; border-left: 1px solid #e2e8f0; ${monoStyle}"><bdi dir="ltr">${safeReference}</bdi></td>
          <td style="padding: 6px 8px; font-size: 11px; font-weight: 700; color: ${line.debit > 0 ? "#991b1b" : "#94a3b8"}; text-align: left; border-left: 1px solid #e2e8f0; ${monoStyle}"><bdi dir="ltr">${
        line.debit > 0 ? escapeHtml(formatNumber(line.debit)) : "—"
      }</bdi></td>
          <td style="padding: 6px 8px; font-size: 11px; font-weight: 700; color: ${line.credit > 0 ? "#0D4A39" : "#94a3b8"}; text-align: left; border-left: 1px solid #e2e8f0; ${monoStyle}"><bdi dir="ltr">${
        line.credit > 0 ? escapeHtml(formatNumber(line.credit)) : "—"
      }</bdi></td>
          <td style="padding: 6px 8px; font-size: 11px; font-weight: 900; color: ${balanceColor}; text-align: left; ${monoStyle}"><bdi dir="ltr">${escapeHtml(
        formatNumber(line.runningBalance)
      )}</bdi></td>
        </tr>
      `;
    })
    .join("");

  // 2. صفوف فارغة منظمة بدون نقاط زخرفية للحفاظ على تناسق ورقة A4
  const emptyRowsCount = Math.max(0, MIN_LEDGER_TABLE_ROWS - statement.lines.length);
  let emptyRowsHtml = "";
  for (let i = 0; i < emptyRowsCount; i++) {
    const isFirstEmpty = i === 0 && statement.lines.length === 0;
    const isLastEmpty = i === emptyRowsCount - 1;
    emptyRowsHtml += `
      <tr style="background: #ffffff; border-bottom: ${isLastEmpty ? "none" : "1px solid #f1f5f9"}; height: 32px;">
        <td style="padding: 6px 6px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 10px; border-left: 1px solid #f1f5f9; color: #94a3b8; font-size: 10.5px; font-weight: 600;">${
          isFirstEmpty ? "لا توجد معاملات مالية مسجلة لهذه الفترة" : ""
        }</td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 8px; border-left: 1px solid #f1f5f9;"></td>
        <td style="padding: 6px 8px;"></td>
      </tr>
    `;
  }

  container.innerHTML = `
    <!-- 1. الترويسة المؤسسية الرسمية -->
    <div style="position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 70px; margin-bottom: 8px;">
      <div style="display: flex; align-items: center; z-index: 10;">
        <img src="${TA_LOGO_GREEN_BASE64}" alt="T.A Advertising Solution" style="height: 66px; width: auto; object-fit: contain;" />
      </div>

      <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 10;">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4px 20px;">
          <div style="font-size: 21px; font-weight: 900; color: #0D4A39; line-height: 1.15; font-style: normal;">
            كشف حساب مالي
          </div>
          <div style="width: 52px; height: 2px; background: #C5A059; margin: 4px 0 3px 0; border-radius: 1px;"></div>
          <div style="font-size: 9px; font-weight: 800; color: #475569; letter-spacing: 1.4px; text-transform: uppercase;">
            STATEMENT OF ACCOUNT
          </div>
        </div>
      </div>

      <div style="width: 100px; flex-shrink: 0;"></div>
    </div>

    <!-- شريط بيانات التواصل الرسمي (متصل بإعدادات الشركة) -->
    <div style="margin: 0 0 12px 0; min-height: 32px; padding: 6px 14px; background: #f4f7f6; border-top: 2px solid #0D4A39; border-bottom: 1px solid #cbd5e1; border-radius: 4px; font-size: 10.5px; font-weight: 700; color: #0f172a; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <span style="font-weight: 800; color: #0f172a;">${safeCompanyAddress}</span>
      <bdi dir="ltr" style="font-weight: 800; color: #334155;">${safeCompanyEmail}</bdi>
      <bdi dir="ltr" style="font-weight: 800; color: #0f172a; ${monoStyle}">${safeCompanyPhone}</bdi>
    </div>

    <!-- 2. بطاقتا البيانات التنفيذية: بيانات العميل + ملخص كشف الحساب -->
    <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; margin-bottom: 12px; align-items: stretch;">
      <!-- بطاقة العميل (يمين) -->
      <div style="border: 1px solid #cbd5e1; border-top: 2.5px solid #0D4A39; border-radius: 6px; padding: 10px 14px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
          <span style="color: #475569; font-weight: 800; font-size: 10px;">بيانات العميل</span>
          <span style="font-size: 9.5px; font-weight: 800; background: #f0f5f3; color: #0D4A39; border: 1px solid #c5d6d1; padding: 1px 8px; border-radius: 4px;">
            ${safeCustomerTypeLabel}
          </span>
        </div>
        <div style="font-weight: 900; font-size: 15px; color: #0f172a; line-height: 1.25;">
          ${safeCustomerName}
        </div>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px; font-size: 10.5px; color: #475569;">
          ${
            safeCustomerPhone
              ? `<div style="display: inline-flex; align-items: center; gap: 5px;"><span style="font-weight: 700; color: #64748b;">الهاتف:</span><bdi dir="ltr" style="font-weight: 800; color: #0f172a; ${monoStyle}">${safeCustomerPhone}</bdi></div>`
              : ""
          }
          ${
            safeCustomerAddress
              ? `<div style="display: inline-flex; align-items: center; gap: 5px;"><span style="font-weight: 700; color: #64748b;">العنوان:</span><span style="font-weight: 700; color: #334155;">${safeCustomerAddress}</span></div>`
              : ""
          }
        </div>
      </div>

      <!-- بطاقة ملخص كشف الحساب والرصيد الصافي الموحد (يسار) -->
      <div style="border: 1px solid #cbd5e1; border-top: 2.5px solid #C5A059; border-radius: 6px; padding: 10px 14px; background: #fafcfb; display: flex; flex-direction: column; justify-content: space-between; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">
          <span style="color: #475569; font-weight: 800; font-size: 10px;">ملخص كشف الحساب</span>
          <bdi dir="ltr" style="font-size: 10px; font-weight: 800; color: #334155; ${monoStyle}">${safeTodayStr}</bdi>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10.5px;">
          <span style="color: #64748b; font-weight: 700;">العملة المحاسبية:</span>
          <span style="font-weight: 800; color: #0D4A39;">${safeCurrencyLabel}</span>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
          <div>
            <div style="font-size: 10px; font-weight: 800; color: #475569;">${netStatusLabel}</div>
            <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-top: 1px;">${netStatusHint}</div>
          </div>
          <bdi dir="ltr" style="font-size: 16px; font-weight: 900; color: ${netAmountColor}; white-space: nowrap; ${monoStyle}">
            ${escapeHtml(formatNumber(absNetBal))} <span style="font-size: 10.5px; font-weight: 800;">${safeCurrencySymbol}</span>
          </bdi>
        </div>
      </div>
    </div>

    <!-- 3. جدول كشف الحساب المحاسبي التفصيلي -->
    <div style="flex: 1; min-height: 510px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 10px; background: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; height: 100%;">
        <thead>
          <tr style="background: #0D4A39; color: #ffffff; height: 36px; border-bottom: 2px solid #C5A059;">
            <th style="padding: 6px 6px; width: 34px; text-align: center; font-size: 10.5px; font-weight: 800; border-left: 1px solid rgba(255,255,255,0.16);">#</th>
            <th style="padding: 6px 8px; width: 92px; text-align: center; font-size: 10.5px; font-weight: 800; border-left: 1px solid rgba(255,255,255,0.16);">التاريخ</th>
            <th style="padding: 6px 10px; text-align: right; font-size: 11px; font-weight: 800; border-left: 1px solid rgba(255,255,255,0.16);">البيان وتفاصيل المعاملة المالية</th>
            <th style="padding: 6px 8px; width: 88px; text-align: center; font-size: 10.5px; font-weight: 800; border-left: 1px solid rgba(255,255,255,0.16);">المرجع</th>
            <th style="padding: 6px 8px; width: 94px; text-align: left; font-size: 10.5px; font-weight: 800; border-left: 1px solid rgba(255,255,255,0.16);">مدين</th>
            <th style="padding: 6px 8px; width: 94px; text-align: left; font-size: 10.5px; font-weight: 800; border-left: 1px solid rgba(255,255,255,0.16);">دائن</th>
            <th style="padding: 6px 8px; width: 106px; text-align: left; font-size: 10.5px; font-weight: 800;">الرصيد التراكمي</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          ${emptyRowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f4f7f6; border-top: 2px solid #0D4A39; height: 36px; font-weight: 900; font-size: 11px;">
            <td colspan="4" style="padding: 6px 12px; text-align: right; color: #0D4A39; border-left: 1px solid #cbd5e1;">الإجماليات الكلية للفترة (${safeCurrencySymbol}):</td>
            <td style="padding: 6px 8px; color: #991b1b; text-align: left; border-left: 1px solid #cbd5e1; ${monoStyle}"><bdi dir="ltr">${escapeHtml(formatNumber(statement.totalInvoiced))}</bdi></td>
            <td style="padding: 6px 8px; color: #0D4A39; text-align: left; border-left: 1px solid #cbd5e1; ${monoStyle}"><bdi dir="ltr">${escapeHtml(formatNumber(statement.totalCollected))}</bdi></td>
            <td style="padding: 6px 8px; color: ${netAmountColor}; text-align: left; ${monoStyle}"><bdi dir="ltr">${escapeHtml(formatNumber(netBal))}</bdi></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- 4. شريط التفقيط الرسمي وبيانات الحساب البنكي المعتمد -->
    <div style="background: #f8faf9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 12px; margin-bottom: 10px; font-size: 10.5px; display: flex; justify-content: space-between; align-items: center; gap: 14px;">
      <div style="flex: 1; min-width: 0;">
        <span style="color: #475569; font-weight: 800;">${tafqeetHeading} </span>
        <span style="color: #0f172a; font-weight: 800;">${safeTafqeetText}</span>
      </div>
      <div style="flex-shrink: 0; font-size: 10px; color: #0D4A39; font-weight: 800; padding-right: 12px; border-right: 1px solid #cbd5e1; white-space: nowrap;">
        الحساب المعتمد للسداد: بنك الخرطوم <bdi dir="ltr" style="${monoStyle}">3283046</bdi> (طارق عثمان / تي ايه للدعايه والاعلان)
      </div>
    </div>

    <!-- 5. التذييل الرسمي المتوازن: اعتماد العميل + رمز QR + توقيع الإدارة المالية -->
    <div style="display: grid; grid-template-columns: 1fr 86px 1fr; gap: 14px; align-items: stretch; padding-top: 8px; border-top: 1px solid #cbd5e1; margin-bottom: 4px;">
      <!-- اعتماد واستلام العميل -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; height: 86px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; background: #ffffff;">
        <div style="font-weight: 800; font-size: 10.5px; color: #0f172a;">اعتماد واستلام العميل</div>
        <div style="flex: 1;"></div>
        <div style="font-size: 9.5px; color: #64748b; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 4px;">
          التوقيع والختم الرسمي
        </div>
      </div>

      <!-- رمز QR للتوثيق (مطابق لارتفاع بطاقتي الاعتماد) -->
      <div style="width: 86px; height: 86px; padding: 6px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
        <img src="${TA_QR_CODE_BASE64}" alt="QR Verification" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>

      <!-- إدارة الحسابات المالية وتوقيع طارق عثمان علي -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; height: 86px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; background: #ffffff;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
          <span style="font-weight: 800; font-size: 10.5px; color: #0f172a;">إدارة الحسابات المالية</span>
          <span style="font-weight: 900; font-size: 11px; color: #0D4A39;">طارق عثمان علي</span>
        </div>
        <div style="height: 34px; display: flex; align-items: center; justify-content: flex-start; overflow: hidden;">
          <img
            src="${TA_SIGNATURE_TARIG_BASE64}"
            alt="Signature"
            style="max-height: 32px; width: auto; object-fit: contain; pointer-events: none; mix-blend-mode: multiply;"
          />
        </div>
        <div style="font-size: 9.5px; color: #64748b; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 3px;">
          المدير المالي والتشغيلي المعتمد
        </div>
      </div>
    </div>

    <!-- السطر الإداري والقانوني المعتمد -->
    <div style="text-align: center; font-size: 8.5px; color: #64748b; font-weight: 700; padding-top: 4px;">
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
  mountWrapper.style.cssText =
    "position: fixed; left: -9999px; top: 0; width: 0; height: 0; overflow: hidden; pointer-events: none; z-index: -9999;";
  mountWrapper.appendChild(container);
  document.body.appendChild(mountWrapper);

  const docTitle = `كشف-حساب-${statement.customerName.replace(/[\s/]/g, "_")}-${currency}-${getLocalIsoDate()}`;

  document.body.classList.add("printing-custom-invoice");
  try {
    await triggerPrintWithElement(container, docTitle, "a4", () => {
      document.body.classList.remove("printing-custom-invoice");
      if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    });
    return true;
  } catch {
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
  mountWrapper.style.cssText =
    "position: fixed; left: -9999px; top: 0; width: 0; height: 0; overflow: hidden; pointer-events: none; z-index: -9999;";
  mountWrapper.appendChild(container);
  document.body.appendChild(mountWrapper);

  const docTitle = `كشف-حساب-${statement.customerName.replace(/[\s/]/g, "_")}-${currency}`;

  try {
    await shareInvoiceViaWhatsApp(container, {
      filename: docTitle,
      format: "a4",
      partyName: statement.customerName,
      invoiceRef: "كشف حساب",
      totalAmount: statement.netBalance ?? statement.outstanding,
      currency,
      invoiceTypeLabel: "كشف حساب",
      isRtl: true,
    });
    if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    return true;
  } catch {
    if (mountWrapper.parentNode) mountWrapper.parentNode.removeChild(mountWrapper);
    toast.error("تعذر مشاركة كشف الحساب عبر واتساب");
    return false;
  }
}
