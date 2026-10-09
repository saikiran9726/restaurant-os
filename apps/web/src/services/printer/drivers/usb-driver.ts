import type { PrinterConfig, ReceiptData, ReceiptTemplateConfig } from '@restaurant-os/shared';
import type { PrinterDriver, PrintResult } from '../types.js';
import {
  isCapacitorNative,
  nativeConnect,
  nativeWrite,
  nativeDisconnect,
} from '../native-bridge.js';

export class UsbDriver implements PrinterDriver {
  public readonly transport = 'usb';

  public async isAvailable(): Promise<boolean> {
    return isCapacitorNative();
  }

  public async print(
    escposBase64: string,
    _plainText: string,
    printer: PrinterConfig,
    _receiptData: ReceiptData,
    _templateConfig: ReceiptTemplateConfig,
  ): Promise<PrintResult> {
    if (!isCapacitorNative()) {
      return {
        success: false,
        error:
          'Direct USB thermal printing requires the Restaurant OS Android App with USB-OTG. Please install the mobile app or select "Browser Print".',
      };
    }

    try {
      await nativeConnect('usb', printer.address);
      const bytesWritten = await nativeWrite('usb', printer.address, escposBase64);
      await nativeDisconnect('usb', printer.address);

      return {
        success: true,
        bytesWritten,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `USB print failed: ${err.message || 'USB printer disconnected or permission denied'}`,
      };
    }
  }
}
