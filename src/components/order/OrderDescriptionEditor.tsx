import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OrderDescriptionField } from "./OrderDescriptionField";

export function OrderDescriptionEditor({ index, value, onSave, onClose }: { index: number; value: string; onSave: (value: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent dir="rtl" aria-describedby={undefined} className="w-[calc(100%-24px)] rounded-lg p-4">
        <DialogTitle className="pe-8 text-right text-base">بيان المقاس {index + 1}</DialogTitle>
        <form onSubmit={(e) => { e.preventDefault(); onSave(draft); onClose(); }} className="space-y-4">
          <OrderDescriptionField index={index} value={draft} onChange={setDraft} />
          <Button type="submit" className="w-full">حفظ البيان</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}