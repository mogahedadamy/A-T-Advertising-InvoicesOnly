package com.futureprint.calculator;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
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
 * Native Chromium WebView -> 300 DPI Lossless Print-Quality PDF Exporter.
 * Uses Android's real Chromium layout & bundled Tajawal fonts (eliminating
 * html2canvas Arabic baseline drift) and rasterizes at true 300 DPI
 * (2480x3508 px for ISO A4) into an ISO-sized PdfDocument so print sharpness
 * and QR code scanning match print-shop quality.
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
     * Renders standalone invoice/statement/letter HTML into a crisp 300 DPI PDF
     * at exact ISO A4 (595x842 pt) or A5 landscape (595x420 pt) physical page size.
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

            // True 300 DPI pixel targets (ISO A4: 2480x3508, ISO A5 Landscape: 2480x1748)
            final int hiResW = 2480;
            final int hiResH = isA5Landscape ? 1748 : 3508;

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
                Bitmap hiResBitmap = null;
                try {
                    pdfWebView.measure(
                        View.MeasureSpec.makeMeasureSpec(viewW, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(viewH, View.MeasureSpec.EXACTLY)
                    );
                    pdfWebView.layout(0, 0, viewW, viewH);

                    int bmpW = hiResW;
                    int bmpH = hiResH;
                    try {
                        hiResBitmap = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888);
                    } catch (OutOfMemoryError oom) {
                        // Graceful fallback to 200 DPI on memory-constrained devices
                        bmpW = 1654;
                        bmpH = isA5Landscape ? 1166 : 2339;
                        hiResBitmap = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888);
                    }

                    Canvas bmpCanvas = new Canvas(hiResBitmap);
                    bmpCanvas.drawColor(Color.WHITE);
                    bmpCanvas.save();
                    bmpCanvas.scale((float) bmpW / (float) viewW, (float) bmpH / (float) viewH);
                    pdfWebView.draw(bmpCanvas);
                    bmpCanvas.restore();

                    document = new PdfDocument();
                    PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageW, pageH, 1).create();
                    PdfDocument.Page page = document.startPage(pageInfo);
                    Canvas pdfCanvas = page.getCanvas();
                    pdfCanvas.drawColor(Color.WHITE);

                    Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
                    Rect srcRect = new Rect(0, 0, bmpW, bmpH);
                    Rect dstRect = new Rect(0, 0, pageW, pageH);
                    pdfCanvas.drawBitmap(hiResBitmap, srcRect, dstRect, paint);
                    document.finishPage(page);

                    hiResBitmap.recycle();
                    hiResBitmap = null;

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
                    Log.e(TAG, "Native 300 DPI PDF draw failed", ex);
                    if (hiResBitmap != null && !hiResBitmap.isRecycled()) {
                        hiResBitmap.recycle();
                    }
                    if (document != null) {
                        try { document.close(); } catch (Exception ignored) {}
                    }
                    cleanupView.run();
                    callback.onError("تعذر تصيير ملف PDF عالي الدقة");
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
                    view.postDelayed(drawPdf, 450);
                }
            });

            // Safety timeout if WebView page-finish callback is delayed
            pdfWebView.postDelayed(drawPdf, 2200);

            pdfWebView.loadDataWithBaseURL("https://localhost", htmlContent, "text/html", "UTF-8", null);
        });
    }
}
