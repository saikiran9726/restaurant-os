import type { PrinterConfig, ReceiptData, ReceiptTemplateConfig } from '@restaurant-os/shared';

export interface PrintResult {
  success: boolean;
  error?: string;
  bytesWritten?: number;
}

export interface PrinterDriver {
  transport: 'bluetooth' | 'usb' | 'lan' | 'browser';
  isAvailable(): Promise<boolean>;
  print(
    escposBase64: string,
    plainText: string,
    printer: PrinterConfig,
    receiptData: ReceiptData,
    templateConfig: ReceiptTemplateConfig,
  ): Promise<PrintResult>;
}
