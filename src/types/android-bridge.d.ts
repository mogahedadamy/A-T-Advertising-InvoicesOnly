/**
 * Typed ambient declarations for native Android WebView bridges and callbacks.
 */

export interface AndroidPrintBridge {
  printHtml?(html: string, title: string, pageSize?: string): void;
  print?(title: string): void;
  savePdf?(base64: string, filename: string): void;
  saveHtmlAsPdf?(html: string, filename: string, pageSize?: string): void;
  saveFile?(base64: string, filename: string, mimeType?: string): void;
  sharePdf?(base64: string, filename: string, message?: string): void;
  shareToWhatsApp?(base64: string, filename: string, message?: string): void;
  shareHtmlToWhatsApp?(html: string, filename: string, pageSize?: string, message?: string): void;
}

declare global {
  interface Window {
    AndroidPrint?: AndroidPrintBridge;
    __onInvoiceShared?: (success: boolean, msg: string) => void;
    __TA_STORAGE_READY__?: boolean;
  }
}

export {};
