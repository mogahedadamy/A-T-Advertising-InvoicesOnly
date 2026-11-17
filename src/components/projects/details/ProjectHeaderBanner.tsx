import { Ban, Calendar, FolderKanban, Pencil, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_TONES,
  FINANCIAL_STATUS_LABELS,
  FINANCIAL_STATUS_TONES,
  type Project,
  type ProjectFinancialStatus,
} from "@/lib/domain/projects";

interface ProjectHeaderBannerProps {
  project: Project | null;
  customerName: string;
  derivedFinancialStatus: ProjectFinancialStatus;
  onEditClick: () => void;
  onCancelClick: () => void;
}

export function ProjectHeaderBanner({
  project,
  customerName,
  derivedFinancialStatus,
  onEditClick,
  onCancelClick,
}: ProjectHeaderBannerProps) {
  return (
    <DialogHeader className="border-b border-border/70 bg-card px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-3.5 pl-14 sm:px-5 sm:pl-16 space-y-2.5 text-right shrink-0">
      <div className="flex items-start gap-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
          <FolderKanban className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <DialogTitle className="text-sm sm:text-base font-black text-foreground leading-snug truncate">
            {project?.title || "مساحة عمل المشروع"}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-bold text-muted-foreground">
            <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10.5px] font-black text-primary border border-primary/20">
              <bdi dir="ltr">{project?.reference ?? "—"}</bdi>
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3 text-primary/70" />
              <span>{customerName}</span>
            </span>
            {project?.deliveryDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary/70" />
                <span>التسليم:</span>
                <bdi dir="ltr" className="font-mono">
                  {project.deliveryDate}
                </bdi>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* شريط الحالتين المستقلتين وأزرار إدارة المشروع */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10.5px] font-black",
              EXECUTION_STATUS_TONES[project?.executionStatus ?? "new"]
            )}
          >
            التنفيذ: {EXECUTION_STATUS_LABELS[project?.executionStatus ?? "new"]}
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10.5px] font-black",
              FINANCIAL_STATUS_TONES[derivedFinancialStatus]
            )}
          >
            مالياً: {FINANCIAL_STATUS_LABELS[derivedFinancialStatus]}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onEditClick}
            className="h-8 rounded-xl gap-1.5 px-2.5 text-[11px] font-black cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>تعديل البيانات</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancelClick}
            className="h-8 rounded-xl gap-1 px-2.5 text-[11px] font-bold text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <Ban className="h-3.5 w-3.5" />
            <span>إلغاء المشروع</span>
          </Button>
        </div>
      </div>
    </DialogHeader>
  );
}
