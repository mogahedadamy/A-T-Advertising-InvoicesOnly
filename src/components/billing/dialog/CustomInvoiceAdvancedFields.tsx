import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SupplierPicker } from "@/components/suppliers/SupplierPicker";
import { playTapSound } from "@/lib/soundEffects";

interface CustomInvoiceAdvancedFieldsProps {
  isPurchase: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  attn: string;
  setAttn: (v: string) => void;
  partyEnName: string;
  setPartyEnName: (v: string) => void;
  supplierId?: string | null;
  setSupplierId?: (id: string | null) => void;
  supplierInvoiceNumber?: string;
  setSupplierInvoiceNumber?: (v: string) => void;
  onSupplierSelectedName: (name: string) => void;
}

export function CustomInvoiceAdvancedFields({
  isPurchase,
  showAdvanced,
  onToggleAdvanced,
  attn,
  setAttn,
  partyEnName,
  setPartyEnName,
  supplierId,
  setSupplierId,
  supplierInvoiceNumber,
  setSupplierInvoiceNumber,
  onSupplierSelectedName,
}: CustomInvoiceAdvancedFieldsProps) {
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => {
          playTapSound();
          onToggleAdvanced();
        }}
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer py-1"
      >
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span>
          {showAdvanced
            ? "إخفاء الخيارات الإضافية"
            : "خيارات إضافية (عناية المسؤول Attn، الاسم بالإنجليزية)"}
        </span>
      </button>

      {showAdvanced && (
        <div className="space-y-3 pt-2.5 animate-in fade-in duration-150 border-t border-border/40 mt-1">
          {isPurchase && setSupplierId && (
            <div className="space-y-2">
              <SupplierPicker
                value={supplierId ?? null}
                onChange={(nextId, supplier) => {
                  setSupplierId(nextId);
                  if (supplier) onSupplierSelectedName(supplier.name);
                }}
              />
              {setSupplierInvoiceNumber && (
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-muted-foreground block text-right">
                    رقم فاتورة المورد الأصلي
                  </Label>
                  <Input
                    value={supplierInvoiceNumber || ""}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    placeholder="كما ورد من المورد أو المحل"
                    className="h-9.5 text-xs rounded-xl font-medium bg-background text-right"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10.5px] font-bold text-muted-foreground block text-right">
                عناية السيد / المسؤول (Attn)
              </Label>
              <Input
                value={attn}
                onChange={(e) => setAttn(e.target.value)}
                placeholder="مثال: مدير المشتريات، المهندس المشرف..."
                className="h-9.5 text-xs rounded-xl font-medium bg-background text-right"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10.5px] font-bold text-muted-foreground block text-right">
                الاسم بالإنجليزية (Customer EN)
              </Label>
              <Input
                value={partyEnName}
                onChange={(e) => setPartyEnName(e.target.value)}
                placeholder="e.g. Al-Amal Co."
                className="h-9.5 text-xs rounded-xl font-mono bg-background text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
