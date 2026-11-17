import React, { useState, useEffect } from "react";
import { useAppTour } from "@/lib/appTourStore";
import { PageTourModal } from "../tour/PageTourModal";
import { getPageGuide } from "../tour/guides";
import type { PageTourGuide } from "../tour/types";
import { AppTourLauncherBanner } from "../tour/AppTourLauncherBanner";

export { AppTourLauncherBanner };

/**
 * المساعد الإرشادي الذكي الموزع على أقسام التطبيق
 * مكون مركزي خفيف الحجم (< 70 سطر) يربط النوافذ بأدلة الصفحات المستقلة
 */
export function AppTourAssistant() {
  const { isOpen, closeTour, initialSectionId } = useAppTour();
  const [selectedGuide, setSelectedGuide] = useState<PageTourGuide>(() =>
    getPageGuide(initialSectionId)
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedGuide(getPageGuide(initialSectionId));
    }
  }, [isOpen, initialSectionId]);

  return (
    <PageTourModal
      isOpen={isOpen}
      guide={selectedGuide}
      onClose={closeTour}
      onSelectGuide={(g) => setSelectedGuide(g)}
    />
  );
}

export default AppTourAssistant;
