package com.futureprint.calculator;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    private WebView printWebView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);

            // واجهة الطباعة والحفظ في ملفات الأندرويد الأصلية
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void print(String documentName) {
                    runOnUiThread(() -> {
                        try {
                            String jobName = (documentName != null && !documentName.trim().isEmpty())
                                ? documentName
                                : "فاتورة-فيوتشر";
                            PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                            if (printManager != null) {
                                PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                                printManager.print(jobName, printAdapter, new PrintAttributes.Builder().build());
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });
                }

                @JavascriptInterface
                public void printHtml(String htmlContent, String documentName) {
                    printHtml(htmlContent, documentName, "A4");
                }

                @JavascriptInterface
                public void printHtml(String htmlContent, String documentName, String pageSize) {
                    runOnUiThread(() -> {
                        try {
                            String jobName = (documentName != null && !documentName.trim().isEmpty())
                                ? documentName
                                : "فاتورة-TA";

                            if (printWebView != null) {
                                try {
                                    printWebView.destroy();
                                } catch (Exception ignored) {}
                            }
                            printWebView = new WebView(MainActivity.this);
                            WebSettings pSettings = printWebView.getSettings();
                            pSettings.setJavaScriptEnabled(true);
                            pSettings.setDomStorageEnabled(true);
                            pSettings.setDefaultTextEncodingName("utf-8");
                            pSettings.setLoadsImagesAutomatically(true);
                            pSettings.setTextZoom(100);
                            pSettings.setUseWideViewPort(true);
                            pSettings.setLoadWithOverviewMode(true);
                            pSettings.setSupportZoom(false);

                            final boolean isA5Landscape = "A5".equalsIgnoreCase(pageSize) ||
                                (jobName != null && (jobName.contains("A5") || jobName.contains("a5")));

                            printWebView.setWebViewClient(new WebViewClient() {
                                @Override
                                public void onPageFinished(WebView view, String url) {
                                    view.postDelayed(() -> {
                                        try {
                                            PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                            if (printManager != null && printWebView != null) {
                                                PrintDocumentAdapter printAdapter = printWebView.createPrintDocumentAdapter(jobName);
                                                PrintAttributes.Builder builder = new PrintAttributes.Builder();
                                                builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                                                builder.setMinMargins(PrintAttributes.Margins.NO_MARGINS);

                                                if (isA5Landscape) {
                                                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A5.asLandscape());
                                                } else {
                                                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                                                }

                                                printManager.print(jobName, printAdapter, builder.build());
                                            }
                                        } catch (Exception ex) {
                                            ex.printStackTrace();
                                        }
                                    }, 200);
                                }
                            });

                            printWebView.loadDataWithBaseURL("https://localhost", htmlContent, "text/html", "UTF-8", null);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    });
                }

                @JavascriptInterface
                public void savePdf(String base64Data, String filename) {
                    runOnUiThread(() -> {
                        try {
                            byte[] pdfBytes = Base64.decode(base64Data, Base64.DEFAULT);
                            String safeName = (filename != null && !filename.trim().isEmpty())
                                ? (filename.endsWith(".pdf") ? filename : filename + ".pdf")
                                : "فاتورة-TA.pdf";

                            // على أندرويد 10 والأحدث: حفظ مباشر في مجلد Downloads/A-T-Advertising
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                ContentValues values = new ContentValues();
                                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
                                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/A-T-Advertising");

                                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                if (uri != null) {
                                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                                        if (os != null) {
                                            os.write(pdfBytes);
                                            os.flush();
                                        }
                                    }

                                    Toast.makeText(MainActivity.this, "تم حفظ الفاتورة في مجلد التنزيلات بنجاح", Toast.LENGTH_LONG).show();

                                    try {
                                        Intent intent = new Intent(Intent.ACTION_VIEW);
                                        intent.setDataAndType(uri, "application/pdf");
                                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                        startActivity(Intent.createChooser(intent, "عرض الفاتورة"));
                                    } catch (Exception ignored) {}

                                    return;
                                }
                            }

                            // Fallback للأجهزة السابقة
                            File docsDir = getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
                            if (docsDir == null) docsDir = getCacheDir();
                            File targetFile = new File(docsDir, safeName);
                            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                                fos.write(pdfBytes);
                                fos.flush();
                            }

                            Toast.makeText(MainActivity.this, "تم حفظ الفاتورة بنجاح", Toast.LENGTH_LONG).show();

                            try {
                                Uri fileUri = FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getPackageName() + ".fileprovider",
                                    targetFile
                                );

                                Intent intent = new Intent(Intent.ACTION_VIEW);
                                intent.setDataAndType(fileUri, "application/pdf");
                                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(Intent.createChooser(intent, "عرض الفاتورة"));
                            } catch (Exception ignored) {}
                        } catch (Exception e) {
                            e.printStackTrace();
                            Toast.makeText(MainActivity.this, "خطأ في حفظ الفاتورة: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }, "AndroidPrint");
        }
    }
}

