import React, { useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { OrderList } from "@/components/order/OrderList";
import { OrderSummaryBar } from "@/components/order/OrderSummaryBar";
import { InvoiceTypeSelectionDialog } from "@/components/invoice/InvoiceTypeSelectionDialog";
import { CustomInvoiceDialog } from "@/components/billing/CustomInvoiceDialog";
import { toCustomInvoiceItems } from "@/lib/billing/fromCalc";
import type { CustomInvoiceItem, CustomInvoiceType } from "@/lib/billing/types";
import { useOrderSession } from "@/lib/orderSession";
import { PageShell } from "@/components/layout/PageShell";
import { playTapSound, playDeleteSound } from "@/lib/soundEffects";
import { CalculatorInputsCard } from "@/components/calculator/CalculatorInputsCard";
import { useCalculatorForm } from "@/components/calculator/useCalculatorForm";
import { useUserProfile } from "@/lib/userProfileStore";
import { UserProfileDialog } from "@/components/common/UserProfileDialog";

/**
 * تحديد التحية المناسبة بناءً على وقت اليوم واسم المستخدم
 */
function getGreeting(name?: string) {
  const h = new Date().getHours();
  const trimmed = (name || "").trim();
  const namePart = trimmed ? ` يا ${trimmed}` : "";
  if (h >= 5 && h < 12) return { text: `صباح الخير${namePart}`, emoji: "☀️" };
  if (h >= 12 && h < 17) return { text: `نهارك سعيد${namePart}`, emoji: "🌤️" };
  if (h >= 17 && h < 21) return { text: `مساء الخير${namePart}`, emoji: "🌇" };
  return { text: `مرحباً بك${namePart}`, emoji: "🌙" };
}

/**
 * شاشة الحاسبة الرئيسية (Dedicated Invoicing Edition)
 * تُحوّل المقاسات والحسابات مباشرة إلى فواتير مبيعات وفواتير مبدئية معتمدة
 * خالية تماماً من إيصالات أوامر التشغيل والورشة.
 */
const Index: React.FC = () => {
  const [order, setOrder] = useOrderSession();
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CustomInvoiceType>("sales");
  const [salesInvoiceOpen, setSalesInvoiceOpen] = useState(false);
  const [salesItems, setSalesItems] = useState<CustomInvoiceItem[]>([]);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const { userName } = useUserProfile();

  const greeting = useMemo(() => getGreeting(userName), [userName]);

  const todayDateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("ar", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date());
    } catch {
      return "";
    }
  }, []);

  // إدارة دورة حياة الإدخال والتحقق بالحاسبة
  const { state, refs, actions } = useCalculatorForm((newItem) => {
    setOrder((prev) => [...prev, newItem]);
  });

  const totals = useMemo(
    () => ({
      area: order.reduce((a, b) => a + b.area, 0),
      cost: order.reduce((a, b) => a + b.cost, 0),
    }),
    [order]
  );

  const removeItem = (i: number) => {
    playDeleteSound();
    setOrder((prev) => prev.filter((_, idx) => idx !== i));
  };

  const clearAll = () => {
    playDeleteSound();
    setOrder([]);
    actions.resetCalculator();
  };

  const updateDescription = (index: number, newDesc: string) =>
    setOrder((items) =>
      items.map((item, i) => (i === index ? { ...item, description: newDesc } : item))
    );

  const handleSelectInvoiceType = (chosenType: CustomInvoiceType) => {
    setSelectedType(chosenType);
    const items = toCustomInvoiceItems(order);
    setSalesItems(items);
    setSalesInvoiceOpen(true);
  };

  return (
    <PageShell>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-4 pb-28 md:pb-12 min-w-0 touch-pan-y overscroll-contain select-none">
        {/* ── شريط الترحيب التنفيذي بالمسؤول والتاريخ ── */}
        <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/90 px-3.5 py-2 backdrop-blur-md shadow-2xs mb-3 w-full min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm sm:text-base shrink-0 select-none">{greeting.emoji}</span>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-black text-foreground truncate">
                {greeting.text}
              </span>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setShowProfileEdit(true);
                }}
                className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
                title="تعديل اسم الحساب"
              >
                (تعديل)
              </button>
            </div>
          </div>
          {todayDateStr && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground shrink-0">
              <Calendar className="h-3.5 w-3.5 text-primary/80" />
              <span className="hidden xs:inline">{todayDateStr}</span>
            </div>
          )}
        </div>

        {/* ── شبكة الحاسبة وسجل المقاسات ── */}
        <div className="grid gap-4 md:grid-cols-12 md:gap-5 flex-1 items-start w-full max-w-full min-w-0">
          {/* القسم 1: بطاقة إدخال بيانات المقاس والخامة */}
          <div className="md:col-span-5 space-y-3 w-full max-w-full min-w-0">
            <CalculatorInputsCard
              material={state.material}
              setMaterial={actions.setMaterial}
              unitPrice={state.unitPrice}
              qty={state.qty}
              width={state.width}
              height={state.height}
              description={state.description}
              setDescription={actions.setDescription}
              descriptionRef={refs.descriptionRef}
              widthRef={refs.widthRef}
              heightRef={refs.heightRef}
              qtyRef={refs.qtyRef}
              priceRef={refs.priceRef}
              fieldErrors={state.fieldErrors}
              onFieldChange={actions.handleFieldChange}
              onBlurField={actions.handleBlurField}
              focusNext={actions.focusNext}
              onCalc={actions.handleCalc}
              onAddToOrder={actions.handleAddToOrder}
              error={state.error}
              result={state.result}
              groupedMaterials={state.groupedMaterials}
            />
          </div>

          {/* القسم 2: سجل المقاسات وشريط الملخص العام للطلب */}
          <div className="md:col-span-7 flex flex-col min-h-0 space-y-3 w-full max-w-full min-w-0">
            <div className="rounded-3xl border border-border/80 bg-card p-3.5 sm:p-5 shadow-xs flex-1 flex flex-col overflow-hidden min-h-[340px] w-full max-w-full min-w-0">
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full max-w-full">
                <OrderList
                  items={order}
                  onRemove={removeItem}
                  onClear={clearAll}
                  onDescriptionChange={updateDescription}
                  totalArea={totals.area}
                />
              </div>
            </div>

            <OrderSummaryBar
              area={totals.area}
              cost={totals.cost}
              empty={order.length === 0}
              onInvoice={() => {
                if (order.length > 0) {
                  playTapSound();
                  setTypeSelectOpen(true);
                }
              }}
            />
          </div>
        </div>
      </main>

      {/* نافذة تحديد نوع الفاتورة الصادرة (مبدئية / مبيعات / مشتريات) */}
      <InvoiceTypeSelectionDialog
        open={typeSelectOpen}
        onClose={() => setTypeSelectOpen(false)}
        onSelectType={handleSelectInvoiceType}
      />

      {/* نافذة فاتورة المبيعات الرسمية المعتمدة A4/A5 */}
      <CustomInvoiceDialog
        open={salesInvoiceOpen}
        onOpenChange={setSalesInvoiceOpen}
        initialType={selectedType}
        initialItems={salesItems}
      />

      {/* نافذة تعديل بيانات الحساب */}
      <UserProfileDialog
        isOpen={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        isFirstLaunch={false}
      />
    </PageShell>
  );
};

export default Index;
