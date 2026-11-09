import { PageShell } from "@/components/layout/PageShell";
import { WelcomeBanner } from "./WelcomeBanner";
import { ActionPillsBar } from "./ActionPillsBar";
import { DashboardStats } from "./DashboardStats";
import { ModuleGrid } from "./ModuleGrid";
import { OrdersTrendChart } from "./OrdersTrendChart";
import { OrderTypeDonut } from "./OrderTypeDonut";
import { RecentOrdersTableCompact } from "./RecentOrdersTableCompact";
import { UpcomingTasksCard } from "./UpcomingTasksCard";
import { SystemStatusFooter } from "./SystemStatusFooter";

export function DashboardPage() {
  return (
    <PageShell>
      <main
        className="mx-auto w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 md:px-6 md:py-4 scroll-smooth touch-pan-y"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3 sm:space-y-3.5 md:space-y-4 pb-28 md:pb-8">
          {/* Row 1: البانر الترحيبي البانورامي */}
          <WelcomeBanner />

          {/* Row 2: الإجراءات التشغيلية المباشرة */}
          <ActionPillsBar />

          {/* Row 3: بطاقات المؤشرات الأربعة الرئيسية الملونة */}
          <DashboardStats />

          {/* Row 4: شبكة وحدات نظام المطبعة */}
          <ModuleGrid />

          {/* Row 5: حركة الطلبات خلال الفترة + توزيع الطلبات حسب النوع */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
            <div className="md:col-span-7 xl:col-span-8">
              <OrdersTrendChart />
            </div>
            <div className="md:col-span-5 xl:col-span-4">
              <OrderTypeDonut />
            </div>
          </div>

          {/* Row 6: أحدث الطلبات + المهام القادمة */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
            <div className="md:col-span-7 xl:col-span-8">
              <RecentOrdersTableCompact />
            </div>
            <div className="md:col-span-5 xl:col-span-4">
              <UpcomingTasksCard />
            </div>
          </div>

          {/* Row 7: شريط حالة النظام وإجمالي طلبات اليوم */}
          <div className="pt-1">
            <SystemStatusFooter />
          </div>
        </div>
      </main>
    </PageShell>
  );
}
