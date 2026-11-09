// خوارزميات الطباعة الاحترافية - T.A Advertising Solution
// Print calculation algorithms

// الرولات المتاحة للخامات العامة (سم). الرولة الكبيرة عرضها الفعلي للحساب 300 سم،
// لكن تقبل مقاسات تصل إلى 320 سم كحد أقصى للإدخال.
export const ROLLS_NORMAL = [100, 150, 200, 300];
export const ROLL_MAX_INPUT = 320; // أقصى مقاس مقبول للإدخال

// رولات الاستيكر الأوت دور المتاحة تجارياً في المطابع (سم)
// قياسات الرولات المتوفرة في السوق: 100، 120، 127، 137، 150 سم
// ولا تتوفر خامة استيكر بعرض أكبر من 150 سم
export const ROLLS_STICKER = [100, 120, 127, 137, 150];
export const ROLL_STICKER_MAX = 150;

export type MaterialKey =
  | "flex"
  | "banner"
  | "reflective"
  | "mesh"
  | "coated"
  | "sticker"
  | "indoor_sticker";

export interface Material {
  key: MaterialKey;
  label: string;
  group: string;
  defaultPrice: number;
}

export const MATERIALS: Material[] = [
  { key: "flex",           label: "فلكس",           group: "خامات عامة",   defaultPrice: 28000 },
  { key: "banner",         label: "بنر",            group: "خامات عامة",   defaultPrice: 8000 },
  { key: "reflective",     label: "بنر عاكس",       group: "خامات عامة",   defaultPrice: 25000 },
  { key: "mesh",           label: "مش",             group: "خامات عامة",   defaultPrice: 28000 },
  { key: "coated",         label: "كوتيد",          group: "خامات عامة",   defaultPrice: 28000 },
  { key: "sticker",        label: "استيكر",         group: "قسم الاستيكر", defaultPrice: 28000 },
  { key: "indoor_sticker", label: "استيكر ان دور",   group: "قسم الاستيكر", defaultPrice: 28000 },
];

export interface CalcInput {
  width: number;   // cm
  height: number;  // cm
  qty: number;
  unitPrice: number;
  material: MaterialKey;
}

export interface CalcResult {
  area: number;            // m²
  cost: number;
  displayRoll: string;
  type: string;
  material: MaterialKey;
  width: number;
  height: number;
  qty: number;
  unitPrice: number;
}

export type CalcOutcome =
  | { ok: true; result: CalcResult }
  | { ok: false; error: string };

export function calculate(input: CalcInput): CalcOutcome {
  const { width: w, height: h, qty: q, unitPrice: p, material: mat } = input;

  if (!w || !h) return { ok: false, error: "أدخل العرض والارتفاع" };
  if (q < 1) return { ok: false, error: "الكمية غير صحيحة" };

  // 1. استيكر إن دور (حساب المتر الصافي المباشر بدون هدر رول)
  if (mat === "indoor_sticker") {
    if (w > ROLL_STICKER_MAX && h > ROLL_STICKER_MAX) {
      return { ok: false, error: "⚠️ الاستيكر لا يتوفر برولة أكبر من 150 سم" };
    }
    const area = (w / 100) * (h / 100) * q;
    return {
      ok: true,
      result: {
        area,
        cost: area * p,
        displayRoll: "صافي طباعة",
        type: "استيكر ان دور",
        material: mat,
        width: w,
        height: h,
        qty: q,
        unitPrice: p,
      },
    };
  }

  // 2. استيكر أوت دور (حساب الرولات العادية مثل الفلكس مع رولات الاستيكر المتاحة حتى 150 سم)
  if (mat === "sticker") {
    if (w > ROLL_STICKER_MAX && h > ROLL_STICKER_MAX) {
      return { ok: false, error: "⚠️ الاستيكر لا يتوفر برولة أكبر من 150 سم" };
    }

    const fitRollSticker = (d: number) =>
      ROLLS_STICKER.find((r) => r >= d);

    const r1 = fitRollSticker(w);
    const r2 = fitRollSticker(h);
    const options: { r: number; a: number }[] = [];
    if (r1) options.push({ r: r1, a: (r1 / 100) * (h / 100) * q });
    if (r2) options.push({ r: r2, a: (r2 / 100) * (w / 100) * q });

    if (!options.length) {
      return { ok: false, error: "⚠️ الاستيكر لا يتوفر برولة أكبر من 150 سم" };
    }

    const best = options.reduce((prev, cur) => (prev.a <= cur.a ? prev : cur));
    return {
      ok: true,
      result: {
        area: best.a,
        cost: best.a * p,
        displayRoll: `${best.r} سم`,
        type: "رولة استيكر",
        material: mat,
        width: w,
        height: h,
        qty: q,
        unitPrice: p,
      },
    };
  }

  // 3. خامة كوتيد (Coated Banner) - يمكن لحامها لذا لا يهم حجم عرض الرولة
  // يتم حسابه مباشرة كأمتار صافية: (العرض / 100) × (الارتفاع / 100) × الكمية
  // مثال: 1200 سم × 400 سم = 12 × 4 = 48 متر مربع مباشرة (هذا الشرط في الكوتيد فقط)
  if (mat === "coated") {
    const area = (w / 100) * (h / 100) * q;
    const isWelded = w > ROLL_MAX_INPUT && h > ROLL_MAX_INPUT;
    return {
      ok: true,
      result: {
        area,
        cost: area * p,
        displayRoll: isWelded ? "لحام مباشر" : "أمتار صافية",
        type: isWelded ? "كوتيد (لحام)" : "كوتيد",
        material: mat,
        width: w,
        height: h,
        qty: q,
        unitPrice: p,
      },
    };
  }

  // 4. الخامات العامة الأخرى (فلكس، بنر، عاكس، مش): رولات عادية حتى 300 سم وتستوعب حتى 320 سم
  if (w > ROLL_MAX_INPUT && h > ROLL_MAX_INPUT) {
    return { ok: false, error: "⚠️ المقاس يتجاوز عرض أكبر رولة متاحة" };
  }

  const findBest = (d1: number, d2: number) => {
    // ابحث عن أصغر رولة تستوعب البُعد، مع السماح للرولة 300 باستيعاب حتى 320 سم
    const fitRoll = (d: number) =>
      ROLLS_NORMAL.find((r) => r >= d) ??
      (d <= ROLL_MAX_INPUT ? 300 : undefined);

    const r1 = fitRoll(d1);
    const r2 = fitRoll(d2);
    const options: { r: number; a: number }[] = [];
    if (r1) options.push({ r: r1, a: (r1 / 100) * (d2 / 100) * q });
    if (r2) options.push({ r: r2, a: (r2 / 100) * (d1 / 100) * q });
    return options.length
      ? options.reduce((prev, cur) => (prev.a <= cur.a ? prev : cur))
      : null;
  };

  const best = findBest(w, h);
  if (!best) return { ok: false, error: "⚠️ المقاس يتجاوز عرض أكبر رولة متاحة" };

  const displayRollName = `${best.r} سم`;
  return {
    ok: true,
    result: {
      area: best.a,
      cost: best.a * p,
      displayRoll: displayRollName,
      type: "رولة",
      material: mat,
      width: w,
      height: h,
      qty: q,
      unitPrice: p,
    },
  };
}

export const formatNumber = (n: number) =>
  Math.round(n).toLocaleString("en-US");

export const materialLabel = (key: MaterialKey) =>
  MATERIALS.find((m) => m.key === key)?.label ?? key;

