import React from "react";
import { AlertTriangle, RotateCcw, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: string | null;
}

/**
 * حاجز أخطاء على مستوى التطبيق (PRD §13.4: لا شاشة بيضاء أبداً).
 * عند وقوع خطأ غير متوقع يُعرض شرح عربي وزرّا استرجاع بدل صفحة فارغة، ويبقى
 * أثر الخطأ في السجل ليمكن تتبّعه. البيانات لا تُمس: الخطأ في الواجهة فقط.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[AppErrorBoundary] unexpected UI error:", error, info?.componentStack);
    this.setState({ errorInfo: info?.componentStack ?? null });
  }

  private handleReset = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  private handleReload = (): void => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div dir="rtl" className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-destructive/30 bg-card p-5 shadow-elegant">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-foreground">حدث خطأ غير متوقع في الواجهة</h1>
              <p className="field-hint mt-1">
                بياناتك المحفوظة لم تتأثر — الخطأ في عرض الشاشة فقط. يمكنك المتابعة أو إعادة تحميل التطبيق.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <p className="ref-mono text-destructive" dir="ltr">
              {this.state.error.name}: {this.state.error.message}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-black text-primary-foreground active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" />
              المتابعة
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-xs font-black text-foreground active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              إعادة تحميل
            </button>
          </div>

          <details className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <summary className="cursor-pointer text-2xs font-black text-muted-foreground">
              تفاصيل تقنية (للدعم)
            </summary>
            <pre dir="ltr" className="mt-2 max-h-40 overflow-auto text-4xs leading-relaxed text-muted-foreground">
              {this.state.errorInfo ?? this.state.error.stack ?? "لا توجد تفاصيل إضافية."}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
