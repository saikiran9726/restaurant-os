import type { PrinterConfig, ReceiptData, ReceiptTemplateConfig } from '@restaurant-os/shared';
import type { PrinterDriver, PrintResult } from '../types.js';

export class BrowserPrintDriver implements PrinterDriver {
  public readonly transport = 'browser';

  public async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && typeof window.print === 'function';
  }

  public async print(
    _escposBase64: string,
    plainText: string,
    printer: PrinterConfig,
    _receiptData: ReceiptData,
    _templateConfig: ReceiptTemplateConfig,
  ): Promise<PrintResult> {
    try {
      const widthMm = printer.widthMm === 58 ? 58 : 80;

      // Create a hidden print iframe to avoid disturbing the main React UI layout
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Failed to create print document context');
      }

      // Format plain text preserving newlines, whitespace and monospace tabular columns
      const safeText = plainText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt Print</title>
            <style>
              @page {
                size: ${widthMm}mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 4mm;
                font-family: 'Courier New', Courier, monospace;
                font-size: ${widthMm === 58 ? '10px' : '12px'};
                line-height: 1.25;
                color: #000;
                background: #fff;
                width: ${widthMm}mm;
                box-sizing: border-box;
              }
              pre {
                margin: 0;
                white-space: pre-wrap;
                word-break: break-all;
                font-family: inherit;
              }
            </style>
          </head>
          <body>
            <pre>${safeText}</pre>
          </body>
        </html>
      `);
      doc.close();

      // Wait briefly for content rendering
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Trigger print
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Cleanup iframe after a short delay
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Browser print failed',
      };
    }
  }
}
