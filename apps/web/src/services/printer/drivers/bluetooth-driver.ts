import type { PrinterConfig, ReceiptData, ReceiptTemplateConfig } from '@restaurant-os/shared';
import type { PrinterDriver, PrintResult } from '../types.js';
import {
  isCapacitorNative,
  nativeConnect,
  nativeWrite,
  nativeDisconnect,
} from '../native-bridge.js';

export class BluetoothDriver implements PrinterDriver {
  public readonly transport = 'bluetooth';

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
          'Direct Bluetooth thermal printing requires the Restaurant OS Android App. Please install the mobile app or select "Browser Print".',
      };
    }

    if (!printer.address) {
      return {
        success: false,
        error: 'Printer Bluetooth MAC address is not configured.',
      };
    }

    try {
      await nativeConnect('bluetooth', printer.address);
      const bytesWritten = await nativeWrite('bluetooth', printer.address, escposBase64);
      await nativeDisconnect('bluetooth', printer.address);

      return {
        success: true,
        bytesWritten,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Bluetooth print failed: ${err.message || 'Printer unreachable or not paired'}`,
      };
    }
  }
}
