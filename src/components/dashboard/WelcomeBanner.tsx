import { useState, useEffect, useMemo, memo } from "react";
import { Calendar, Clock } from "lucide-react";
import { useOrders } from "@/lib/ordersStore";
import { formatNumber } from "@/lib/printCalculator";
import { useUserProfile } from "@/lib/userProfileStore";

/* ─── Isolated Leaf Live Clock Component (Prevents Re-rendering the Entire Banner) ─── */
const LiveClockBadge = memo(function LiveClockBadge() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return <span>{time}</span>;
});

/* ─── Greeting ────────────────────────────────────────────────── */
function getGreeting(name?: string) {
  const h = new Date().getHours();
  const trimmed = (name || "").trim();
  const namePart = trimmed ? ` يا ${trimmed}` : "";
  if (h >= 5  && h < 12) return { text: `صباح الخير${namePart}`,   emoji: "☀️" };
  if (h >= 12 && h < 17) return { text: `نهارك سعيد${namePart}`,     emoji: "🌤️" };
  if (h >= 17 && h < 21) return { text: `مساء الخير${namePart}`,    emoji: "🌇" };
  return                        { text: `مرحباً بك${namePart}`,    emoji: "🌙" };
}

/* ─── Date formatter ──────────────────────────────────────────── */
const dateLong = new Intl.DateTimeFormat("ar", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/* ─── WelcomeBanner ───────────────────────────────────────────── */
export function WelcomeBanner() {
  const orders = useOrders();
  const { userName } = useUserProfile();
  const greeting = useMemo(() => getGreeting(userName), [userName]);

  const [dateStr, setDateStr] = useState("");
  useEffect(() => {
    try { setDateStr(dateLong.format(new Date())); } catch { /* ignore */ }
  }, []);

  /* Live session summary: single-pass memoized aggregation (0ms blocking) */
  const { activeOrders, todayRevenue } = useMemo(() => {
    let active = 0;
    let rev = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (o) {
        if (o.status !== "delivered" && o.status !== "cancelled") {
          active++;
        }
        if (o.paidAmount) {
          rev += o.paidAmount;
        }
      }
    }
    return { activeOrders: active, todayRevenue: rev };
  }, [orders]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-border/50 animate-slide-up"
      style={{ animationDelay: "0ms" }}
      dir="rtl"
    >
      {/* ── High-performance static subtle backdrop (0% GPU animation overhead) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 60% 50% at 85% 20%, hsl(var(--primary) / 0.12) 0%, transparent 70%),
              radial-gradient(ellipse 55% 45% at 15% 80%, hsl(var(--brand-gold) / 0.1) 0%, transparent 70%),
              linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--surface-elevated)) 100%)
            `,
          }}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="relative z-10 flex items-stretch justify-between gap-3 p-4 sm:p-5">

        {/* Left: text info */}
        <div className="flex flex-col justify-between gap-2.5 flex-1 min-w-0">

          {/* Status + date row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Branch badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              الخرطوم - بورتسودان
            </span>

            {/* Date */}
            {dateStr && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                <Calendar className="h-3 w-3 text-primary shrink-0" />
                {dateStr}
              </span>
            )}

            {/* Live clock */}
            <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-secondary/50 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
              <Clock className="h-3 w-3 text-primary shrink-0" />
              <LiveClockBadge />
            </span>
          </div>

          {/* Greeting headline */}
          <div>
            <h1 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-foreground flex items-center gap-2 flex-wrap">
              <span>{greeting.text}</span>
              <span aria-hidden="true" className="text-lg">{greeting.emoji}</span>
            </h1>
            <p className="mt-1 text-[11.5px] sm:text-xs font-medium text-muted-foreground leading-relaxed">
              نظام متكامل للطباعة والإيصالات ·{" "}
              <span className="font-bold text-foreground">T.A Advertising Solution</span>
            </p>
          </div>

          {/* Mini stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/8 px-2.5 py-1 text-[10.5px] font-bold text-amber-600 dark:text-amber-400">
              <span className="font-mono font-black num-display">{activeOrders}</span>
              <span>أمر جاري</span>
            </span>
            {todayRevenue > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/8 px-2.5 py-1 text-[10.5px] font-bold text-primary">
                <span className="font-mono font-black num-display">{formatNumber(todayRevenue)}</span>
                <span className="text-[9px] text-muted-foreground">ج.س</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: decorative image (desktop only) */}
        <div className="relative hidden sm:block h-[90px] sm:h-[100px] md:h-[110px] w-[140px] sm:w-[180px] md:w-[220px] shrink-0 overflow-hidden rounded-xl border border-border/30">
          <img
            src="/print-press-banner.jpg"
            alt="ماكينات طباعة الرولات"
            className={[
              "absolute inset-0 h-full w-full object-cover object-center",
              "transition-transform duration-500 hover:scale-105",
              "dark:brightness-75 dark:contrast-110",
              /* Fade to transparent on left side */
              "[mask-image:linear-gradient(to_right,transparent_0%,black_30%,black_100%)]",
              "[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_30%,black_100%)]",
            ].join(" ")}
            loading="eager"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none";
            }}
          />
          {/* Overlay gradient */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-card/40"
          />
        </div>
      </div>
    </div>
  );
}
