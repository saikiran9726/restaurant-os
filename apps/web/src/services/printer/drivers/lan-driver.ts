import type { PrinterConfig, ReceiptData, ReceiptTemplateConfig } from '@restaurant-os/shared';
import type { PrinterDriver, PrintResult } from '../types.js';
import {
  isCapacitorNative,
  nativeConnect,
  nativeWrite,
  nativeDisconnect,
} from '../native-bridge.js';

export class LanDriver implements PrinterDriver {
  public readonly transport = 'lan';

  public async isAvailable(): Promise<boolean> {
    return true; // Available via native TCP or network proxy
  }

  public async print(
    escposBase64: string,
    _plainText: string,
    printer: PrinterConfig,
    _receiptData: ReceiptData,
    _templateConfig: ReceiptTemplateConfig,
  ): Promise<PrintResult> {
    if (!printer.address) {
      return {
        success: false,
        error: 'Printer IP address or hostname is not configured (e.g. 192.168.1.100:9100).',
      };
    }

    if (isCapacitorNative()) {
      try {
        await nativeConnect('lan', printer.address);
        const bytesWritten = await nativeWrite('lan', printer.address, escposBase64);
        await nativeDisconnect('lan', printer.address);

        return {
          success: true,
          bytesWritten,
        };
      } catch (err: any) {
        return {
          success: false,
          error: `LAN print failed: ${err.message || 'Printer unreachable on network'}`,
        };
      }
    }

    // In desktop browser, raw TCP port 9100 cannot be opened directly from sandbox JS.
    // Return friendly error with prompt to use Browser Print or Android App
    return {
      success: false,
      error:
        'Raw LAN port 9100 printing is supported via the Restaurant OS Android App. In web browsers, please use Browser Print.',
    };
  }
}
