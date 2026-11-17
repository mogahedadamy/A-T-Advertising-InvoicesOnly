import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { getStoredJsonSync, setMemoryCacheJson } from "./sqliteStorage";
import {
  cancelProject as repoCancelProject,
  createProject as repoCreateProject,
  getAllProjects,
  updateProject as repoUpdateProject,
} from "./repositories/ProjectRepository";
import type { Project, ProjectDraft } from "@/lib/domain/projects";

/**
 * متجر المشاريع — نمط useSyncExternalStore نفسه المستخدم في بقية المتاجر.
 * قاعدة البيانات هي مصدر الحقيقة: بعد أي كتابة ناجحة تُعاد القراءة منها
 * وتُنشر في الذاكرة، فلا تعرض الواجهة سجلاً لم يُحفظ فعلاً.
 */
const STORAGE_KEY = "future_print_projects_v1";

function loadProjectsFromStorage(): Project[] {
  const list = getStoredJsonSync<Project[]>(STORAGE_KEY, []);
  return Array.isArray(list) ? list : [];
}

let snapshot: Project[] = loadProjectsFromStorage();
const subscribers = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    snapshot = loadProjectsFromStorage();
    subscribers.forEach((fn) => fn());
  });
}

function notify() {
  setMemoryCacheJson(STORAGE_KEY, snapshot);
  subscribers.forEach((fn) => fn());
}

export function subscribeProjects(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function getProjectsSnapshot(): Project[] {
  return snapshot;
}

export function useProjects(): Project[] {
  return useSyncExternalStore(subscribeProjects, getProjectsSnapshot, () => []);
}

/** يستبدل الحالة في الذاكرة (يُستخدم بعد القراءة من القاعدة). */
function publish(projects: Project[]) {
  snapshot = projects;
  notify();
}

/** يقرأ المشاريع من قاعدة البيانات ويحدّث الواجهة. */
export async function refreshProjectsFromDb(): Promise<Project[]> {
  if (!Capacitor.isNativePlatform()) return snapshot;
  try {
    const projects = await getAllProjects();
    publish(projects);
    return projects;
  } catch (err) {
    console.warn("[ProjectsStore] refresh failed:", err);
    return snapshot;
  }
}

/** إنشاء مشروع — المرجع PRJ-YYYY-NNN يُسند في المستودع ذرّياً. */
export async function createProject(draft: ProjectDraft): Promise<Project> {
  if (!Capacitor.isNativePlatform()) {
    // بيئة المتصفح (تطوير): نبقي السلوك في الذاكرة فقط دون قاعدة بيانات.
    const project: Project = {
      id: `prj-local-${Date.now()}`,
      reference: `PRJ-${new Date().getFullYear()}-LOCAL`,
      customerId: draft.customerId,
      title: draft.title,
      description: draft.description,
      requestNotes: draft.requestNotes,
      executionStatus: draft.executionStatus ?? "new",
      financialStatus: "not_invoiced",
      deliveryDate: draft.deliveryDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    publish([project, ...snapshot]);
    return project;
  }

  const project = await repoCreateProject(draft);
  await refreshProjectsFromDb();
  return project;
}

export async function updateProject(id: string, changes: Partial<ProjectDraft>): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    publish(snapshot.map((p) => (p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p)));
    return;
  }
  await repoUpdateProject(id, changes);
  await refreshProjectsFromDb();
}

export async function cancelProject(id: string, reason: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    publish(snapshot.filter((p) => p.id !== id));
    return;
  }
  await repoCancelProject(id, reason);
  await refreshProjectsFromDb();
}

export function getProjectFromSnapshot(id: string): Project | undefined {
  return snapshot.find((p) => p.id === id);
}

/** تصفير حالة المتجر (للاختبارات فقط). */
export function resetProjectsStoreForTests(): void {
  snapshot = [];
}
