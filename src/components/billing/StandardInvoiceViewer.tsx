import React, { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { InvoiceZoomControls } from "@/components/invoice/InvoiceZoomControls";
import { StandardInvoiceDocument } from "./StandardInvoiceDocument";
import type { CustomInvoice } from "@/lib/billing/types";

// أبعاد ورقة A4 القياسية بالبكسل عند 96 DPI
export const INVOICE_A4_WIDTH = 794;
export const INVOICE_A4_HEIGHT = 1123;

interface Props {
  invoice: CustomInvoice;
  className?: string;
}

/**
 * عارض الفاتورة التفاعلي المرن:
 * يدعم التكبير والتصغير الذكي (Zoom in/out)، السحب (Pan)، والملاءمة التلقائية
 * لشاشات الهواتف المحمولة وشاشات الحواسيب مع دعم الـ Pinch باللمس.
 */
export function StandardInvoiceViewer({ invoice, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState<number | null>(null);
  const [currentScale, setCurrentScale] = useState<number>(1);

  const invoiceId = invoice?.id;
  const itemsCount = invoice?.items?.length || 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calculateFit = () => {
      // هوامش أمان للمعاينة
      const isMobile = window.innerWidth < 768;
      const paddingX = isMobile ? 16 : 32;
      const paddingY = isMobile ? 24 : 40;

      const availableW = Math.max(120, el.clientWidth - paddingX);
      const availableH = Math.max(120, el.clientHeight - paddingY);

      const scaleW = availableW / INVOICE_A4_WIDTH;
      const scaleH = availableH / INVOICE_A4_HEIGHT;

      // اختيار المقياس الأمثل بحيث تظهر الورقة بشكل مقروء وواضح على الهاتف
      let optimal: number;
      if (isMobile) {
        optimal = Math.max(0.38, Math.min(1.0, scaleW));
      } else {
        optimal = Math.max(0.25, Math.min(1.2, Math.min(scaleW, scaleH)));
      }
      const rounded = Number(optimal.toFixed(3));
      setFitScale(rounded);
      setCurrentScale(rounded);
    };

    const ro = new ResizeObserver(calculateFit);
    calculateFit();
    ro.observe(el);

    const t1 = setTimeout(calculateFit, 60);
    const t2 = setTimeout(calculateFit, 200);

    return () => {
      ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [invoiceId, itemsCount]);

  if (!invoice) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-xs font-bold text-muted-foreground bg-slate-950/80">
        جاري تجهيز معاينة الفاتورة...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={`relative h-full w-full min-h-[350px] overflow-hidden rounded-2xl bg-slate-900/95 dark:bg-zinc-950 flex flex-col items-center justify-start select-none ${
        className || ""
      }`}
    >
      {fitScale !== null && (
        <TransformWrapper
          initialScale={fitScale}
          minScale={fitScale * 0.4}
          maxScale={fitScale * 4.5}
          centerOnInit={false}
          initialPositionX={0}
          initialPositionY={0}
          limitToBounds={false}
          doubleClick={{ mode: "reset" }}
          onTransform={(ref) => {
            setCurrentScale(Number(ref.state.scale.toFixed(2)));
          }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                }}
                contentStyle={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  width: "100%",
                  minWidth: "100%",
                  paddingTop: "10px",
                  paddingBottom: "56px",
                  paddingLeft: "8px",
                  paddingRight: "8px",
                }}
              >
                <div className="rounded-md shadow-2xl ring-1 ring-black/40 overflow-hidden bg-white origin-top">
                  <StandardInvoiceDocument invoice={invoice} />
                </div>
              </TransformComponent>

              <InvoiceZoomControls
                zoomOut={() => zoomOut(0.15)}
                reset={() => resetTransform()}
                zoomIn={() => zoomIn(0.15)}
                scalePercent={Math.round((currentScale / fitScale) * 100)}
              />
            </>
          )}
        </TransformWrapper>
      )}
    </div>
  );
}
