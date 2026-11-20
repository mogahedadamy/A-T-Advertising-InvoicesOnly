import React, { useEffect, type CSSProperties, type ReactNode } from "react";
import { useSafeArea } from "@/hooks/useSafeArea";
import { cn } from "@/lib/utils";

interface SafeAreaContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  edges?: Array<"top" | "bottom" | "left" | "right">;
  as?: React.ElementType;
}

export function SafeAreaContainer({
  children,
  edges = ["top", "bottom", "left", "right"],
  className,
  as: Component = "div",
  style,
  ...props
}: SafeAreaContainerProps) {
  const computedStyle: CSSProperties = {
    ...style,
    paddingTop: edges.includes("top") ? `max(0px, env(safe-area-inset-top, 0px))` : undefined,
    paddingBottom: edges.includes("bottom") ? `max(0px, env(safe-area-inset-bottom, 0px))` : undefined,
    paddingLeft: edges.includes("left") ? `max(0px, env(safe-area-inset-left, 0px))` : undefined,
    paddingRight: edges.includes("right") ? `max(0px, env(safe-area-inset-right, 0px))` : undefined,
  };

  return (
    <Component
      style={computedStyle}
      className={cn("w-full h-full", className)}
      {...props}
    >
      {children}
    </Component>
  );
}

export function useKeyboardAvoidance() {
  const insets = useSafeArea();

  useEffect(() => {
    if (!insets.isKeyboardOpen) return;

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      const timerId = window.setTimeout(() => {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
      return () => window.clearTimeout(timerId);
    }
  }, [insets.isKeyboardOpen]);
}
