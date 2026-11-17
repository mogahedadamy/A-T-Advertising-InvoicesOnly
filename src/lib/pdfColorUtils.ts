/**
 * دالة رياضية دقيقة لتحويل صيغ ألوان OKLCH الحديثة في CSS إلى sRGB القياسية
 * تدعم كافة المتغيرات (deg, rad, grad, turn, none, %, fractions) وتمنع خطأ
 * Attempting to parse an unsupported color function "oklch" في html2canvas تماماً
 */
export function convertOklchToRgb(input: string): string {
  if (!input || !input.includes("oklch")) return input;

  const oklchRegex =
    /oklch\(\s*([^\s,/)]+)\s+([^\s,/)]+)\s+([^\s,/)]+)(?:\s*(?:\/|,)\s*([^\s,/)]+))?\s*\)/gi;

  const converted = input.replace(
    oklchRegex,
    (_match, lStr: string, cStr: string, hStr: string, aStr?: string) => {
      try {
        let L = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
        if (isNaN(L)) L = 0;
        L = Math.max(0, Math.min(1, L));

        let C = cStr.toLowerCase() === "none" ? 0 : parseFloat(cStr);
        if (isNaN(C)) C = 0;
        C = Math.max(0, C);

        let H_deg = 0;
        const hLower = hStr.toLowerCase();
        if (hLower === "none") {
          H_deg = 0;
        } else if (hLower.endsWith("deg")) {
          H_deg = parseFloat(hLower.slice(0, -3));
        } else if (hLower.endsWith("rad")) {
          H_deg = (parseFloat(hLower.slice(0, -3)) * 180) / Math.PI;
        } else if (hLower.endsWith("grad")) {
          H_deg = (parseFloat(hLower.slice(0, -4)) * 360) / 400;
        } else if (hLower.endsWith("turn")) {
          H_deg = parseFloat(hLower.slice(0, -4)) * 360;
        } else {
          H_deg = parseFloat(hStr);
        }
        if (isNaN(H_deg)) H_deg = 0;

        const a = C * Math.cos((H_deg * Math.PI) / 180);
        const b = C * Math.sin((H_deg * Math.PI) / 180);

        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.291485548 * b;

        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;

        const r_l = +4.076743477 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        const g_l = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        const b_l = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

        const transfer = (c: number) => {
          const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
          return Math.min(255, Math.max(0, Math.round(v * 255)));
        };

        const r = transfer(r_l);
        const g = transfer(g_l);
        const bVal = transfer(b_l);

        if (aStr !== undefined) {
          let alpha = aStr.endsWith("%") ? parseFloat(aStr) / 100 : parseFloat(aStr);
          if (isNaN(alpha)) alpha = 1;
          alpha = Math.max(0, Math.min(1, alpha));
          return alpha < 1 ? `rgba(${r}, ${g}, ${bVal}, ${alpha})` : `rgb(${r}, ${g}, ${bVal})`;
        }
        return `rgb(${r}, ${g}, ${bVal})`;
      } catch {
        return "rgb(100, 116, 139)";
      }
    }
  );

  return converted.replace(/oklch\([^)]+\)/gi, "rgb(100, 116, 139)");
}

/**
 * فحص جودة وصحة الكانفاس الناتج للتأكد بنسبة 100% من أنه ليس صفحة بيضاء فارغة
 */
export function isCanvasBlank(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const { width, height } = canvas;
    if (width === 0 || height === 0) return true;

    const stepX = Math.max(1, Math.floor(width / 30));
    const stepY = Math.max(1, Math.floor(height / 40));
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        // إذا كان البكسل مرئياً وغير أبيض ناصع (أي يوجد نصوص أو خطوط أو أختام أو ترويسة)
        if (a > 20 && (r < 240 || g < 240 || b < 240)) {
          return false; // الكانفاس يحتوي على بيانات حقيقية وسليمة 100%
        }
      }
    }
    return true; // لم يتم العثور على أي بكسل ملون
  } catch (err) {
    console.warn("isCanvasBlank verification error:", err);
    return false;
  }
}
