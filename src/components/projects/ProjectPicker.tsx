import React, { useMemo } from "react";
import { FolderKanban } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/lib/projectsStore";

interface Props {
  /** المشروع المختار (null = بلا مشروع) */
  value: string | null | undefined;
  onChange: (projectId: string | null) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * منتقي المشروع — يُستخدم في نماذج الفواتير وعروض الأسعار لتحقيق الربط
 * الحقيقي بين المستندات والمشروع (PRD §3.2 التنقل السياقي).
 * يقرأ من متجر المشاريع (مصدر واحد للحقيقة) ولا يخترع مشاريع.
 */
export function ProjectPicker({ value, onChange, label = "المشروع", hint, disabled }: Props) {
  const projects = useProjects();
  const selectedProject = useMemo(
    () => (value ? projects.find((p) => p.id === value) ?? null : null),
    [projects, value]
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-foreground flex items-center gap-1.5">
          <FolderKanban className="h-3.5 w-3.5 text-primary" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50">
          اختياري
        </span>
      </div>

      <Select
        value={value ?? "__none__"}
        onValueChange={(next) => onChange(next === "__none__" ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-foreground text-right border-border">
          <SelectValue placeholder="بلا مشروع" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          <SelectItem value="__none__">بلا مشروع</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              <span className="font-mono text-[11px] font-bold text-primary dark:text-emerald-400">{project.reference}</span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="text-xs font-bold text-foreground">{project.title}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedProject && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-primary/40 bg-primary/8 dark:bg-primary/20 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-black text-primary dark:text-emerald-400 text-xs shrink-0" dir="ltr">
              {selectedProject.reference}
            </span>
            <span className="text-muted-foreground font-bold">·</span>
            <span className="font-black text-foreground truncate">
              {selectedProject.title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10.5px] font-bold text-muted-foreground hover:text-rose-500 hover:underline shrink-0 cursor-pointer"
          >
            إلغاء الربط
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-[10px] leading-snug text-muted-foreground">
          لا توجد مشاريع بعد. أنشئ مشروعاً من قسم «المشاريع» لربط الفواتير والتكاليف به.
        </p>
      ) : (
        hint && <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export default ProjectPicker;
