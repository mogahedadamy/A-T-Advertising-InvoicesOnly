import { useState, useEffect, useCallback } from "react";

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

/**
 * دالة استخراج قيمة البكسل من الـ CSS computed style لـ env(safe-area-inset-*)
 */
function readComputedInset(property: string, fallback = 0): number {
  if (typeof window === "undefined" || typeof document === "undefined") return fallback;
  try {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.top = "0";
    div.style.left = "0";
    div.style.visibility = "hidden";
    div.style.pointerEvents = "none";
    div.style.paddingTop = `env(${property}, 0px)`;
    document.body.appendChild(div);
    const val = parseFloat(window.getComputedStyle(div).paddingTop) || fallback;
    document.body.removeChild(div);
    return Math.max(0, val);
  } catch {
    return fallback;
  }
}

/**
 * خطاف إدارة واستعلام مساحات الأمان (Safe Area) على مستوى التطبيق بالكامل
 * يشمل دعم الـ Status Bar، Navigation Bar، الشق (Notch)، الكيبورد (IME)،
 * واتجاه الشاشة عمودياً وأفقياً.
 */
export function useSafeArea(): SafeAreaInsets {
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

  const updateInsets = useCallback(() => {
    if (typeof window === "undefined") return;

    const top = readComputedInset("safe-area-inset-top", 0);
    const bottom = readComputedInset("safe-area-inset-bottom", 0);
    const left = readComputedInset("safe-area-inset-left", 0);
    const right = readComputedInset("safe-area-inset-right", 0);

    const vp = window.visualViewport;
    const winH = window.innerHeight;
    const winW = window.innerWidth;
    const vpH = vp ? vp.height : winH;
    const vpW = vp ? vp.width : winW;

    // احتساب ارتفاع لوحة المفاتيح الافتراضية
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
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    updateInsets();

    window.addEventListener("resize", updateInsets, { passive: true });
    window.addEventListener("orientationchange", updateInsets, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateInsets, { passive: true });
      window.visualViewport.addEventListener("scroll", updateInsets, { passive: true });
    }

    return () => {
      window.removeEventListener("resize", updateInsets);
      window.removeEventListener("orientationchange", updateInsets);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateInsets);
        window.visualViewport.removeEventListener("scroll", updateInsets);
      }
    };
  }, [updateInsets]);

  return insets;
}

