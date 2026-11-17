package android.print;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import java.io.File;

public class PrintAdapterHelper {
    public interface PdfCallback {
        void onSuccess(File file);
        void onError(String error);
    }

    public static void printAdapterToPdf(PrintDocumentAdapter adapter, PrintAttributes attributes, File targetFile, PdfCallback callback) {
        adapter.onLayout(null, attributes, new CancellationSignal(), new PrintDocumentAdapter.LayoutResultCallback() {
            @Override
            public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                try {
                    if (targetFile.exists()) {
                        targetFile.delete();
                    }
                    ParcelFileDescriptor pfd = ParcelFileDescriptor.open(
                        targetFile,
                        ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_READ_WRITE
                    );

                    adapter.onWrite(new PageRange[]{PageRange.ALL_PAGES}, pfd, new CancellationSignal(), new PrintDocumentAdapter.WriteResultCallback() {
                        @Override
                        public void onWriteFinished(PageRange[] pages) {
                            try {
                                pfd.close();
                            } catch (Exception ignored) {}
                            callback.onSuccess(targetFile);
                        }

                        @Override
                        public void onWriteFailed(CharSequence error) {
                            try {
                                pfd.close();
                            } catch (Exception ignored) {}
                            callback.onError(error != null ? error.toString() : "Write failed");
                        }
                    });
                } catch (Exception e) {
                    callback.onError(e.getMessage());
                }
            }

            @Override
            public void onLayoutFailed(CharSequence error) {
                callback.onError(error != null ? error.toString() : "Layout failed");
            }
        }, new Bundle());
    }
}
