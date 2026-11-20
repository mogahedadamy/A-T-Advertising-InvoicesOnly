import { useState, useEffect, useCallback, useRef } from "react";

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
  viewportWidth: number;
  viewportHeight: number;
  isPortrait: boolean;
  usableHeight: number;
  usableWidth: number;
}

function readComputedInset(property: string, fallback = 0): number {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  try {
    const rootStyle = window.getComputedStyle(document.documentElement);
    const varMap: Record<string, string> = {
      "safe-area-inset-top": "--safe-area-top",
      "safe-area-inset-bottom": "--safe-area-bottom",
      "safe-area-inset-left": "--safe-area-left",
      "safe-area-inset-right": "--safe-area-right",
    };
    const cssVar = varMap[property];
    if (cssVar) {
      const parsed = parseFloat(rootStyle.getPropertyValue(cssVar));
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const div = document.createElement("div");
    div.style.cssText = `position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(${property}, 0px)`;
    document.body.appendChild(div);
    const val = parseFloat(window.getComputedStyle(div).paddingTop) || fallback;
    document.body.removeChild(div);
    return Math.max(0, val);
  } catch {
    return fallback;
  }
}

export function useSafeArea(): SafeAreaInsets {
  const cachedEnvRef = useRef<{ top: number; bottom: number; left: number; right: number }>({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  const [insets, setInsets] = useState<SafeAreaInsets>(() => {
    const isClient = typeof window !== "undefined";
    const width = isClient ? window.innerWidth : 375;
    const height = isClient ? window.innerHeight : 812;
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      keyboardHeight: 0,
      isKeyboardOpen: false,
      viewportWidth: width,
      viewportHeight: height,
      isPortrait: height >= width,
      usableHeight: height,
      usableWidth: width,
    };
  });

  const refreshEnvInsets = useCallback(() => {
    cachedEnvRef.current = {
      top: readComputedInset("safe-area-inset-top", 0),
      bottom: readComputedInset("safe-area-inset-bottom", 0),
      left: readComputedInset("safe-area-inset-left", 0),
      right: readComputedInset("safe-area-inset-right", 0),
    };
  }, []);

  const updateViewportMetrics = useCallback((recomputeEnv = false) => {
    if (typeof window === "undefined") return;
    if (recomputeEnv) {
      refreshEnvInsets();
    }

    const { top, bottom, left, right } = cachedEnvRef.current;
    const vp = window.visualViewport;
    const winH = window.innerHeight;
    const winW = window.innerWidth;
    const vpH = vp ? vp.height : winH;
    const vpW = vp ? vp.width : winW;

    const keyboardDelta = Math.max(0, winH - vpH);
    const isKeyboard = keyboardDelta > 100;
    const keyboardHeight = isKeyboard ? keyboardDelta : 0;

    const isPortrait = winH >= winW;
    const usableHeight = Math.max(200, vpH - (isKeyboard ? 0 : bottom) - top);
    const usableWidth = Math.max(200, vpW - left - right);

    setInsets((prev) => {
      if (
        prev.top === top &&
        prev.bottom === bottom &&
        prev.left === left &&
        prev.right === right &&
        prev.keyboardHeight === keyboardHeight &&
        prev.isKeyboardOpen === isKeyboard &&
        prev.viewportHeight === vpH &&
        prev.viewportWidth === vpW &&
        prev.isPortrait === isPortrait
      ) {
        return prev;
      }
      return {
        top,
        bottom,
        left,
        right,
        keyboardHeight,
        isKeyboardOpen: isKeyboard,
        viewportWidth: vpW,
        viewportHeight: vpH,
        isPortrait,
        usableHeight,
        usableWidth,
      };
    });
  }, [refreshEnvInsets]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    updateViewportMetrics(true);

    const handleResizeOrOrientation = () => updateViewportMetrics(true);
    const handleViewportResize = () => updateViewportMetrics(false);

    window.addEventListener("resize", handleResizeOrOrientation, { passive: true });
    window.addEventListener("orientationchange", handleResizeOrOrientation, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize, { passive: true });
    }

    return () => {
      window.removeEventListener("resize", handleResizeOrOrientation);
      window.removeEventListener("orientationchange", handleResizeOrOrientation);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportResize);
      }
    };
  }, [updateViewportMetrics]);

  return insets;
}
