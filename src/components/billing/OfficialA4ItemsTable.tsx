import React from "react";
import { formatNumber } from "@/lib/printCalculator";
import type { AppCurrency } from "@/lib/currency/types";
import { StandardInvoiceStampWatermark } from "./StandardInvoiceStampWatermark";
import { formatBiDiDimensions } from "@/lib/bidiUtils";

export interface OfficialA4LineRow {
  id?: string;
  description: string;
  qty?: number;
  unitPrice?: number;
  total: number;
}

interface OfficialA4ItemsTableProps {
  rows: OfficialA4LineRow[];
  rowCount: number;
  emptyRowsCount: number;
  isRtl: boolean;
  currency: AppCurrency;
  totalAmount: number;
  invoiceTafqeet: string;
  formatAccountingNumber: (n: number | undefined) => string;
  totalDisplayText?: string;
}

export const OfficialA4ItemsTable: React.FC<OfficialA4ItemsTableProps> = ({
  rows,
  rowCount,
  emptyRowsCount,
  isRtl,
  currency,
  totalAmount,
  invoiceTafqeet,
  formatAccountingNumber,
  totalDisplayText,
}) => {
  return (
    <div
      className="relative overflow-hidden mt-1.5 flex-1 flex flex-col justify-between"
      style={{
        border: "1px solid #1e293b",
        borderRadius: "10px",
        minHeight: "560px",
      }}
    >
      <StandardInvoiceStampWatermark isRtl={isRtl} />

      <table
        className="w-full border-collapse relative z-10 text-[12px] h-full flex flex-col justify-between"
        style={{ backgroundColor: "transparent" }}
      >
        <thead className="w-full shrink-0">
          <tr
            className="w-full flex"
            style={{
              backgroundColor: "#C1D0CD",
              minHeight: "38px",
              height: "38px",
              borderBottom: "1px solid #1e293b",
            }}
          >
            <th
              className="py-1 px-3 text-center font-black italic text-[13.5px] text-black flex items-center justify-center"
              style={{
                width: "54%",
                ...(isRtl
                  ? { borderLeft: "1px solid #1e293b" }
                  : { borderRight: "1px solid #1e293b" }),
              }}
            >
              {isRtl ? "البيان وتفاصيل العمل" : "Description & Specifications"}
            </th>
            <th
              className="py-1 px-2 text-center font-black italic text-[13.5px] text-black flex items-center justify-center"
              style={{
                width: "10%",
                ...(isRtl
                  ? { borderLeft: "1px solid #1e293b" }
                  : { borderRight: "1px solid #1e293b" }),
              }}
            >
              {isRtl ? "العدد" : "Qty"}
            </th>
            <th
              className="py-1 px-2 text-center font-black italic text-[13px] text-black flex items-center justify-center whitespace-nowrap"
              style={{
                width: "18%",
                ...(isRtl
                  ? { borderLeft: "1px solid #1e293b" }
                  : { borderRight: "1px solid #1e293b" }),
              }}
            >
              {isRtl ? `الفئة (${currency})` : `Unit Price (${currency})`}
            </th>
            <th
              className="py-1 px-3 text-center font-black italic text-[13px] text-black flex items-center justify-center whitespace-nowrap"
              style={{ width: "18%" }}
            >
              {isRtl ? `الجملة (${currency})` : `Total (${currency})`}
            </th>
          </tr>
        </thead>

        <tbody
          className="w-full flex-1 flex flex-col justify-between font-bold text-black"
          style={{ backgroundColor: "transparent" }}
        >
          {rows.map((item, idx) => (
            <tr
              key={item.id || idx}
              className="flex flex-1 items-stretch"
              style={{
                minHeight: "27px",
                backgroundColor: "transparent",
                borderBottom: idx === rowCount - 1 ? "none" : "1px solid #1e293b",
              }}
            >
              <td
                className="py-1 px-3 flex items-center text-[12px] font-extrabold text-black"
                style={{
                  width: "54%",
                  backgroundColor: "transparent",
                  ...(isRtl
                    ? { borderLeft: "1px solid #1e293b" }
                    : { borderRight: "1px solid #1e293b" }),
                }}
              >
                <bdi
                  dir="auto"
                  className="block w-full text-start leading-normal"
                  style={{ unicodeBidi: "isolate", lineHeight: "1.35", overflow: "visible" }}
                >
                  {formatBiDiDimensions(item.description)}
                </bdi>
              </td>
              <td
                className="py-1 px-2 flex items-center justify-center font-mono font-black text-[12.5px] text-black leading-normal"
                style={{
                  width: "10%",
                  backgroundColor: "transparent",
                  ...(isRtl
                    ? { borderLeft: "1px solid #1e293b" }
                    : { borderRight: "1px solid #1e293b" }),
                }}
              >
                {item.qty || ""}
              </td>
              <td
                className="py-1 px-2 flex items-center justify-center font-mono font-black text-[12.5px] text-black leading-normal"
                style={{
                  width: "18%",
                  backgroundColor: "transparent",
                  ...(isRtl
                    ? { borderLeft: "1px solid #1e293b" }
                    : { borderRight: "1px solid #1e293b" }),
                }}
              >
                {item.unitPrice !== undefined ? formatAccountingNumber(item.unitPrice) : ""}
              </td>
              <td
                className="py-1 px-3 flex items-center justify-center font-mono font-black text-[13px] text-black leading-normal"
                style={{
                  width: "18%",
                  backgroundColor: "transparent",
                }}
              >
                {formatAccountingNumber(item.total)}
              </td>
            </tr>
          ))}

          {Array.from({ length: emptyRowsCount }).map((_, idx) => {
            const isLast = rows.length + idx === rowCount - 1;
            return (
              <tr
                key={`empty-${idx}`}
                className="flex flex-1 items-stretch"
                style={{
                  minHeight: "27px",
                  backgroundColor: "transparent",
                  borderBottom: isLast ? "none" : "1px solid #1e293b",
                }}
              >
                <td
                  className="py-1 px-3 flex items-center"
                  style={{
                    width: "54%",
                    backgroundColor: "transparent",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                />
                <td
                  className="py-1 px-2 flex items-center justify-center"
                  style={{
                    width: "10%",
                    backgroundColor: "transparent",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                />
                <td
                  className="py-1 px-2 flex items-center justify-center"
                  style={{
                    width: "18%",
                    backgroundColor: "transparent",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                />
                <td
                  className="py-1 px-3 flex items-center justify-center"
                  style={{
                    width: "18%",
                    backgroundColor: "transparent",
                  }}
                />
              </tr>
            );
          })}
        </tbody>

        <tfoot className="w-full shrink-0">
          <tr
            className="w-full flex items-center"
            style={{
              minHeight: "42px",
              height: "42px",
              borderTop: "1px solid #1e293b",
              backgroundColor: "#C1D0CD",
            }}
          >
            <td
              className="px-3 flex items-center font-black italic text-[12px] text-black h-full py-1"
              style={{
                width: "64%",
                minWidth: 0,
                boxSizing: "border-box",
                ...(isRtl
                  ? { borderLeft: "1px solid #1e293b" }
                  : { borderRight: "1px solid #1e293b" }),
              }}
            >
              <span className="shrink-0 leading-normal select-none" style={{ whiteSpace: "nowrap" }}>
                {isRtl ? "المجموع الكلي:\u00A0\u00A0" : "Grand Total:\u00A0\u00A0"}
              </span>
              <span
                className="not-italic font-bold text-[11px] text-slate-900 leading-normal"
                style={{ lineHeight: "1.25", whiteSpace: "normal", marginInlineStart: "6px" }}
              >
                {invoiceTafqeet}
              </span>
            </td>
            <td
              className="px-3 flex items-center justify-between font-mono font-black text-black h-full py-1"
              style={{
                width: "36%",
                minWidth: 0,
                boxSizing: "border-box",
                backgroundColor: "#ffffff",
              }}
            >
              <span className="text-[14.5px] font-black tracking-tight tabular-nums leading-normal">
                {totalDisplayText ?? formatNumber(totalAmount)}
              </span>
              <span
                className="inline-flex items-center justify-center font-sans font-black text-[11px] px-2 py-0.5 rounded border tracking-wider shrink-0 uppercase leading-normal"
                style={{
                  backgroundColor: "#F1F5F4",
                  borderColor: "#C1D0CD",
                  color: "#0D4A39",
                }}
              >
                {currency}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
