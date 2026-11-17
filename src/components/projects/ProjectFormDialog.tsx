import React, { useState } from "react";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { addCustomer, useCustomers } from "@/lib/customersStore";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { createProject, updateProject } from "@/lib/projectsStore";
import {
  EXECUTION_STATUS_LABELS,
  PROJECT_EXECUTION_STATUSES,
  validateProjectDraft,
  type Project,
  type ProjectExecutionStatus,
} from "@/lib/domain/projects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** مشروع للتعديل، أو null للإنشاء */
  project?: Project | null;
  onSaved?: (project: Project) => void;
}

/**
 * نموذج المشروع — الحقول الأساسية أولاً ثم التفاصيل الإضافية
 * (PRD §13.2 الإفصاح التدريجي).
 */
export function ProjectFormDialog({ open, onOpenChange, project, onSaved }: Props) {
  const { toast } = useToast();
  const customers = useCustomers();
  const isEdit = Boolean(project);

  const [customerId, setCustomerId] = useState<string>(project?.customerId ?? "");
  const [title, setTitle] = useState(project?.title ?? "");
  const [deliveryDate, setDeliveryDate] = useState(project?.deliveryDate ?? "");
  const [executionStatus, setExecutionStatus] = useState<ProjectExecutionStatus>(
    project?.executionStatus ?? "new"
  );
  const [description, setDescription] = useState(project?.description ?? "");
  const [requestNotes, setRequestNotes] = useState(project?.requestNotes ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  // أعِد التهيئة عند كل فتح
  React.useEffect(() => {
    if (!open) return;
    setCustomerId(project?.customerId ?? "");
    setTitle(project?.title ?? "");
    setDeliveryDate(project?.deliveryDate ?? "");
    setExecutionStatus(project?.executionStatus ?? "new");
    setDescription(project?.description ?? "");
    setRequestNotes(project?.requestNotes ?? "");
    setShowAdvanced(false);
  }, [open, project]);

  const handleSave = async () => {
    const draft = {
      customerId,
      title,
      description: description.trim() || undefined,
      requestNotes: requestNotes.trim() || undefined,
      executionStatus,
      deliveryDate: deliveryDate || undefined,
    };

    const validation = validateProjectDraft(draft);
    if (!validation.ok) {
      toast({ title: "بيانات ناقصة", description: validation.errors.join("، "), variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      if (isEdit && project) {
        await updateProject(project.id, draft);
        toast({ title: "تم تحديث المشروع", description: `المرجع ${project.reference}` });
        onSaved?.({ ...project, ...draft, updatedAt: new Date().toISOString() } as Project);
      } else {
        const created = await createProject(draft);
        toast({ title: "تم إنشاء المشروع", description: `المرجع ${created.reference}` });
        onSaved?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      toast({
        title: isEdit ? "تعذّر تحديث المشروع" : "تعذّر إنشاء المشروع",
        description: err instanceof Error ? err.message : "خطأ غير متوقع.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-black">
            {isEdit ? `تعديل المشروع ${project?.reference ?? ""}` : "مشروع جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-foreground">
                العميل <span className="text-rose-500">*</span>
              </label>
              {/* إضافة عميل من هنا مباشرة: بدون عميل لا يمكن إنشاء مشروع (PRD §4.1) */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCustomerDialogOpen(true)}
                className="h-7 rounded-lg gap-1 text-[10px] font-bold"
              >
                <Plus className="h-3 w-3" />
                عميل جديد
              </Button>
            </div>
            <Select value={customerId || "__none__"} onValueChange={(v) => setCustomerId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                <SelectValue placeholder="اختر العميل" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="__none__">— اختر العميل —</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customers.length === 0 && (
              <p className="text-[10px] text-muted-foreground">
                لا يوجد عملاء بعد — اضغط «عميل جديد» لإضافته فوراً دون مغادرة هذه النافذة.
              </p>
            )}
          </div>

          <CustomerDialog
            open={customerDialogOpen}
            onClose={() => setCustomerDialogOpen(false)}
            onSave={async (data) => {
              try {
                const created = await addCustomer(data);
                setCustomerDialogOpen(false);
                // حدّد العميل الجديد مباشرة حتى يكتمل إنشاء المشروع
                setCustomerId(created.id);
                toast({ title: "تم إضافة العميل", description: created.name });
              } catch (err) {
                toast({
                  title: "تعذّر حفظ العميل",
                  description: err instanceof Error ? err.message : undefined,
                  variant: "destructive",
                });
              }
            }}
          />

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-foreground">
              عنوان المشروع <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: حملة إعلانية لافتات ولوحات"
              className="h-10 rounded-xl text-xs font-bold bg-background text-right"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-foreground">تاريخ التسليم المتوقع</label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="h-10 rounded-xl text-xs font-mono font-bold bg-background text-right"
            />
          </div>

          {isEdit && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">حالة التنفيذ</label>
              <Select value={executionStatus} onValueChange={(v) => setExecutionStatus(v as ProjectExecutionStatus)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {PROJECT_EXECUTION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {EXECUTION_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                الحالة المالية تُحسب تلقائياً من الفواتير والمدفوعات ولا تُضبط يدوياً.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-black text-foreground"
          >
            <span>تفاصيل إضافية</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>

          {showAdvanced && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">وصف المشروع</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-right"
                  placeholder="نطاق العمل والمواصفات المتفق عليها"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">ملاحظات الطلب</label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-right"
                  placeholder="ملاحظات العميل أو مواعيد مهمة"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl text-xs font-bold">
            إلغاء
          </Button>
          <Button type="button" onClick={handleSave} disabled={busy} className="flex-1 h-10 rounded-xl text-xs font-bold">
            {busy && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            {isEdit ? "حفظ التعديلات" : "إنشاء المشروع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectFormDialog;
