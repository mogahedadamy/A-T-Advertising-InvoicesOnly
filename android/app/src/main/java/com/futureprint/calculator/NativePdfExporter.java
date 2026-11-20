package com.futureprint.calculator;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.regex.Pattern;

/**
 * Native Chromium WebView -> Android PdfDocument vector exporter.
 * Eliminates html2canvas Arabic baseline drift by using the exact same
 * Chromium layout/font engine as Android native printing, preserving
 * crisp vector text and lossless original QR/stamp/logo images.
 */
public final class NativePdfExporter {
    private static final String TAG = "NativePdfExporter";
    private static final Pattern SAFE_FONT_NAME = Pattern.compile("^[A-Za-z0-9_.-]+\\.ttf$");

    public interface ExportCallback {
        void onSuccess(File pdfFile);
        void onError(String message);
    }

    private NativePdfExporter() {}

    /**
     * Serves bundled offline Tajawal TTF fonts from APK assets/public/fonts/
     * when standalone print/PDF HTML references https://localhost/fonts/*.ttf.
     */
    public static WebResourceResponse interceptLocalFontAsset(Context context, WebResourceRequest request) {
        if (context == null || request == null || request.getUrl() == null) {
            return null;
        }
        Uri uri = request.getUrl();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !"localhost".equalsIgnoreCase(uri.getHost())) {
            return null;
        }
        String path = uri.getPath();
        if (path == null || !path.startsWith("/fonts/")) {
            return null;
        }
        String fileName = path.substring("/fonts/".length());
        if (!SAFE_FONT_NAME.matcher(fileName).matches()) {
            return null;
        }
        try {
            InputStream stream = context.getAssets().open("public/fonts/" + fileName);
            return new WebResourceResponse("font/ttf", "UTF-8", stream);
        } catch (Exception e) {
            Log.w(TAG, "Local font asset not found: " + fileName, e);
            return null;
        }
    }

    /**
     * Renders standalone invoice/statement/letter HTML into a true vector PDF file
     * at exact ISO A4 (595x842 pt) or A5 landscape (595x420 pt) dimensions.
     */
    public static void renderHtmlToPdfFile(
        Activity activity,
        String htmlContent,
        String pageSize,
        File targetFile,
        ExportCallback callback
    ) {
        activity.runOnUiThread(() -> {
            final boolean isA5Landscape = "A5".equalsIgnoreCase(pageSize);
            final int cssW = 794;
            final int cssH = isA5Landscape ? 559 : 1123;
            final int pageW = 595;
            final int pageH = isA5Landscape ? 420 : 842;

            final float density = Math.max(1.0f, activity.getResources().getDisplayMetrics().density);
            final int viewW = Math.round(cssW * density);
            final int viewH = Math.round(cssH * density);

            final WebView pdfWebView = new WebView(activity);
            pdfWebView.setVisibility(View.INVISIBLE);
            pdfWebView.setBackgroundColor(Color.WHITE);

            final ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
            decor.addView(pdfWebView, new ViewGroup.LayoutParams(viewW, viewH));

            WebSettings pSettings = pdfWebView.getSettings();
            pSettings.setJavaScriptEnabled(false);
            pSettings.setDomStorageEnabled(false);
            pSettings.setAllowFileAccess(false);
            pSettings.setAllowContentAccess(false);
            pSettings.setDefaultTextEncodingName("utf-8");
            pSettings.setLoadsImagesAutomatically(true);
            pSettings.setTextZoom(100);
            pSettings.setUseWideViewPort(true);
            pSettings.setLoadWithOverviewMode(false);
            pSettings.setSupportZoom(false);

            pdfWebView.measure(
                View.MeasureSpec.makeMeasureSpec(viewW, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(viewH, View.MeasureSpec.EXACTLY)
            );
            pdfWebView.layout(0, 0, viewW, viewH);

            final boolean[] completed = {false};

            Runnable cleanupView = () -> {
                try {
                    ViewGroup parent = (ViewGroup) pdfWebView.getParent();
                    if (parent != null) {
                        parent.removeView(pdfWebView);
                    }
                    pdfWebView.stopLoading();
                    pdfWebView.destroy();
                } catch (Exception ignored) {}
            };

            Runnable drawPdf = () -> {
                if (completed[0]) return;
                completed[0] = true;
                PdfDocument document = null;
                try {
                    pdfWebView.measure(
                        View.MeasureSpec.makeMeasureSpec(viewW, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(viewH, View.MeasureSpec.EXACTLY)
                    );
                    pdfWebView.layout(0, 0, viewW, viewH);

                    document = new PdfDocument();
                    PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageW, pageH, 1).create();
                    PdfDocument.Page page = document.startPage(pageInfo);
                    Canvas canvas = page.getCanvas();
                    canvas.drawColor(Color.WHITE);
                    canvas.save();
                    float scaleX = (float) pageW / (float) viewW;
                    float scaleY = (float) pageH / (float) viewH;
                    canvas.scale(scaleX, scaleY);
                    pdfWebView.draw(canvas);
                    canvas.restore();
                    document.finishPage(page);

                    try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                        document.writeTo(fos);
                        fos.flush();
                    }
                    document.close();
                    document = null;

                    cleanupView.run();

                    if (targetFile.exists() && targetFile.length() > 1024) {
                        callback.onSuccess(targetFile);
                    } else {
                        callback.onError("تعذر توليد ملف PDF صالح");
                    }
                } catch (Exception ex) {
                    Log.e(TAG, "Native PDF draw failed", ex);
                    if (document != null) {
                        try { document.close(); } catch (Exception ignored) {}
                    }
                    cleanupView.run();
                    callback.onError("تعذر تصيير ملف PDF الأصلي");
                }
            };

            pdfWebView.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    WebResourceResponse fontResp = interceptLocalFontAsset(activity, request);
                    if (fontResp != null) return fontResp;
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    view.postDelayed(drawPdf, 420);
                }
            });

            // Safety timeout if WebView page-finish callback is delayed
            pdfWebView.postDelayed(drawPdf, 2000);

            pdfWebView.loadDataWithBaseURL("https://localhost", htmlContent, "text/html", "UTF-8", null);
        });
    }
}
