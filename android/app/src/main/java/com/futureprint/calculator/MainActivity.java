package com.futureprint.calculator;

import android.content.ClipData;
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
import com.futureprint.calculator.backup.BackupPlugin;
import com.futureprint.calculator.backup.BridgeAccess;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    private WebView printWebView;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Native backup engine must be registered before the bridge is created.
        registerPlugin(BackupPlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() != null) {
            BridgeAccess.set(getBridge());
        }

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
                                    android.view.ViewGroup parent = (android.view.ViewGroup) printWebView.getParent();
                                    if (parent != null) {
                                        parent.removeView(printWebView);
                                    }
                                    printWebView.destroy();
                                } catch (Exception ignored) {}
                                printWebView = null;
                            }

                            printWebView = new WebView(MainActivity.this);
                            printWebView.setVisibility(android.view.View.INVISIBLE);

                            // إلحاق الـ WebView بشجرة العرض لتمكين محرك أندرويد من التخطيط والطباعة الحقيقية
                            android.view.ViewGroup decor = (android.view.ViewGroup) getWindow().getDecorView();
                            decor.addView(printWebView, new android.view.ViewGroup.LayoutParams(1080, 1920));

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

                            final boolean[] hasPrinted = {false};
                            Runnable triggerPrint = () -> {
                                if (hasPrinted[0]) return;
                                hasPrinted[0] = true;
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
                                    Toast.makeText(MainActivity.this, "خطأ في تشغيل الطابعة: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
                                }
                            };

                            printWebView.setWebViewClient(new WebViewClient() {
                                @Override
                                public void onPageFinished(WebView view, String url) {
                                    view.postDelayed(triggerPrint, 200);
                                }
                            });

                            // صمام أمان زمني لضمان استدعاء الطابعة حتى في حال تأخر أحداث الصفحة
                            printWebView.postDelayed(triggerPrint, 1000);

                            printWebView.loadDataWithBaseURL("https://localhost", htmlContent, "text/html", "UTF-8", null);
                        } catch (Exception e) {
                            e.printStackTrace();
                            Toast.makeText(MainActivity.this, "تعذر تشغيل أمر الطباعة: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                }

                @JavascriptInterface
                public void savePdf(String base64Data, String filename) {
                    String safeName = (filename != null && !filename.trim().isEmpty())
                        ? (filename.endsWith(".pdf") ? filename : filename + ".pdf")
                        : "فاتورة-TA.pdf";
                    saveFileInternal(base64Data, safeName, "application/pdf", true);
                }

                @JavascriptInterface
                public void saveFile(String base64Data, String filename, String mimeType) {
                    String resolvedMime = (mimeType != null && !mimeType.trim().isEmpty())
                        ? mimeType
                        : "application/octet-stream";
                    String safeName = (filename != null && !filename.trim().isEmpty())
                        ? filename.trim()
                        : "backup.json";
                    boolean openViewer = "application/pdf".equalsIgnoreCase(resolvedMime);
                    saveFileInternal(base64Data, safeName, resolvedMime, openViewer);
                }

                private void saveFileInternal(String base64Data, String safeName, String mimeType, boolean openViewer) {
                    runOnUiThread(() -> {
                        try {
                            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                            String successMsg = openViewer
                                ? "تم حفظ الفاتورة بنجاح"
                                : "تم حفظ النسخة الاحتياطية بنجاح";

                            // 1. كتابة الملف في مجلد cache الداخلي لضمان الفتح المؤكد بنسبة 100% عبر FileProvider دون حظر /Android/data/
                            File targetDir = new File(getCacheDir(), "saved_invoices");
                            if (!targetDir.exists()) targetDir.mkdirs();
                            File targetFile = new File(targetDir, safeName);
                            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                                fos.write(fileBytes);
                                fos.flush();
                            }

                            // 2. حفظ نسخة في مجلد Downloads/A-T-Advertising ليجدها المستخدم في مدير الملفات
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                try {
                                    ContentValues values = new ContentValues();
                                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/A-T-Advertising");
                                    values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                                    Uri mediaUri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                                    if (mediaUri != null) {
                                        try (OutputStream os = getContentResolver().openOutputStream(mediaUri)) {
                                            if (os != null) {
                                                os.write(fileBytes);
                                                os.flush();
                                            }
                                        }
                                        values.clear();
                                        values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                                        getContentResolver().update(mediaUri, values, null, null);
                                    }
                                } catch (Exception exMedia) {
                                    exMedia.printStackTrace();
                                }
                            }

                            Toast.makeText(MainActivity.this, successMsg, Toast.LENGTH_LONG).show();

                            // 3. فتح المستند في قارئ PDF عبر FileProvider الحصري لمنع الشاشات البيضاء نهائياً
                            if (openViewer && targetFile.exists() && targetFile.length() > 0) {
                                try {
                                    Uri viewUri = FileProvider.getUriForFile(
                                        MainActivity.this,
                                        getPackageName() + ".fileprovider",
                                        targetFile
                                    );

                                    Intent intent = new Intent(Intent.ACTION_VIEW);
                                    intent.setDataAndType(viewUri, mimeType);
                                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    intent.setClipData(ClipData.newRawUri("PDF", viewUri));

                                    Intent chooser = Intent.createChooser(intent, "عرض الفاتورة");
                                    chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    chooser.setClipData(ClipData.newRawUri("PDF", viewUri));

                                    android.content.pm.PackageManager pm = getPackageManager();
                                    java.util.List<android.content.pm.ResolveInfo> handlers =
                                        pm.queryIntentActivities(intent, 0);
                                    for (android.content.pm.ResolveInfo info : handlers) {
                                        if (info.activityInfo != null && info.activityInfo.packageName != null) {
                                            grantUriPermission(info.activityInfo.packageName, viewUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                                        }
                                    }

                                    startActivity(chooser);
                                } catch (Exception exView) {
                                    exView.printStackTrace();
                                }
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                            Toast.makeText(MainActivity.this, "خطأ في حفظ الملف: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                }

                @JavascriptInterface
                public void shareToWhatsApp(String base64Data, String filename, String messageText) {
                    sharePdfInternal(base64Data, filename, messageText, true);
                }

                @JavascriptInterface
                public void sharePdf(String base64Data, String filename, String messageText) {
                    sharePdfInternal(base64Data, filename, messageText, false);
                }

                private void sharePdfInternal(String base64Data, String filename, String messageText, boolean targetWhatsApp) {
                    runOnUiThread(() -> {
                        try {
                            if (base64Data == null || base64Data.trim().isEmpty()) {
                                Toast.makeText(MainActivity.this, "ملف الفاتورة غير صالح للمشاركة", Toast.LENGTH_SHORT).show();
                                return;
                            }

                            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                            String safeName = (filename != null && !filename.trim().isEmpty())
                                ? (filename.toLowerCase().endsWith(".pdf") ? filename.trim() : filename.trim() + ".pdf")
                                : "فاتورة-TA.pdf";

                            File shareDir = new File(getCacheDir(), "shared_invoices");
                            if (!shareDir.exists()) {
                                shareDir.mkdirs();
                            }
                            File targetFile = new File(shareDir, safeName);
                            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                                fos.write(fileBytes);
                                fos.flush();
                            }

                            Uri fileUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getPackageName() + ".fileprovider",
                                targetFile
                            );

                            Intent sendIntent = new Intent(Intent.ACTION_SEND);
                            sendIntent.setType("application/pdf");
                            sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
                            if (messageText != null && !messageText.trim().isEmpty()) {
                                sendIntent.putExtra(Intent.EXTRA_TEXT, messageText);
                            }
                            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                            if (targetWhatsApp) {
                                // محاولة الإرسال لتطبيق واتساب الرسمي أولاً
                                sendIntent.setPackage("com.whatsapp");
                                try {
                                    startActivity(sendIntent);
                                    return;
                                } catch (Exception exWa) {
                                    // محاولة واتساب للأعمال (WhatsApp Business)
                                    try {
                                        Intent waBusiness = new Intent(sendIntent);
                                        waBusiness.setPackage("com.whatsapp.w4b");
                                        startActivity(waBusiness);
                                        return;
                                    } catch (Exception exWab) {
                                        // في حال عدم توفر تطبيق واتساب محدد، فتح نافذة المشاركة العامة
                                        sendIntent.setPackage(null);
                                    }
                                }
                            }

                            Intent chooser = Intent.createChooser(sendIntent, "مشاركة الفاتورة");
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(chooser);
                        } catch (Exception e) {
                            e.printStackTrace();
                            Toast.makeText(MainActivity.this, "تعذر مشاركة الفاتورة: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }, "AndroidPrint");
        }
    }
}

