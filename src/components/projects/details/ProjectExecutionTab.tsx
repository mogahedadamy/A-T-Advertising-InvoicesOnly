import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_TONES,
  type Project,
} from "@/lib/domain/projects";
import type { ProjectRelations } from "@/lib/repositories/ProjectRepository";
import { DocumentList } from "./ProjectDetailShared";

interface ProjectExecutionTabProps {
  project: Project | null;
  relations: ProjectRelations | null;
}

export function ProjectExecutionTab({ project, relations }: ProjectExecutionTabProps) {
  return (
    <div className="space-y-3">
      <DocumentList
        items={relations?.orders ?? []}
        emptyLabel="لا توجد أوامر شغل مرتبطة بهذا المشروع بعد."
        icon={<FileText className="h-4 w-4 text-sky-600" />}
      />
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-black text-foreground">حالة التنفيذ الحالية</p>
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10.5px] font-black",
              EXECUTION_STATUS_TONES[project?.executionStatus ?? "new"]
            )}
          >
            {EXECUTION_STATUS_LABELS[project?.executionStatus ?? "new"]}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          يمكنك تحديث مرحلة التنفيذ أو تاريخ التسليم في أي وقت عبر زر «تعديل البيانات» أعلى المشروع.
        </p>
      </div>
    </div>
  );
}
