// نظام المؤثرات الصوتية الاحترافية باستخدام Web Audio API
// خفيف جداً (0 كيلوبايت)، بدون ملفات خارجية، ويعمل 100% دون اتصال بالإنترنت وبسرعة استجابة 0ms

const SOUND_STORAGE_KEY = "future_print_sound_enabled";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

let cachedSoundEnabled: boolean | null = null;

/** فحص هل الأصوات مفعلة في الإعدادات بسرعة استجابة لحظية 0ms وبدون I/O متكرر */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  if (cachedSoundEnabled === null) {
    try {
      const stored = localStorage.getItem(SOUND_STORAGE_KEY);
      cachedSoundEnabled = stored !== "false"; // مفعل افتراضياً
    } catch {
      cachedSoundEnabled = true;
    }
  }
  return cachedSoundEnabled;
}

/** تفعيل أو كتم الأصوات مع تحديث الكاش الفوري */
export function setSoundEnabled(enabled: boolean): void {
  cachedSoundEnabled = enabled;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "true" : "false");
  } catch {}
}

/** نقرة زر خفيفة احترافية (Tap / Click) — تنفذ بشكل غير معطل */
export function playTapSound(): void {
  if (!isSoundEnabled()) return;
  queueMicrotask(() => {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Ignore audio playback issues
    }
  });
}

/** صوت حساب المقاسات (Calculator Chime) */
export function playCalcSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {}
}

/** صوت إضافة بند جديد للطلبية (Add Item) */
export function playAddSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // نغمتان متتاليتان لطيفة مثل أجهزة نقاط البيع POS
    [587.33, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + i * 0.06;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.08, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    });
  } catch {}
}

/** صوت نجاح أو حفظ فاتورة أو فتح القفل (Success / Save Chime) */
export function playSuccessSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // وتر موسيقي تصاعدي لطيف جداً (E5 -> G#5 -> B5 -> E6)
    const chord = [659.25, 830.61, 987.77, 1318.51];

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.055;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.26);
    });
  } catch {}
}

/** صوت حذف بند أو مسح السجل (Delete / Clear) */
export function playDeleteSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.09);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {}
}

/** صوت تنبيه أو خطأ في الإدخال (Warning / Error) */
export function playErrorSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    [260, 220].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.08;

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.075);
    });
  } catch {}
}
