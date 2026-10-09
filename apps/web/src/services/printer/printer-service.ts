import type { PrinterConfig, ReceiptData, ReceiptTemplateConfig } from '@restaurant-os/shared';
import { localDb, type LocalPrintJob } from '../../db/dexie.js';
import type { PrinterDriver, PrintResult } from './types.js';
import { BrowserPrintDriver } from './drivers/browser-driver.js';
import { BluetoothDriver } from './drivers/bluetooth-driver.js';
import { UsbDriver } from './drivers/usb-driver.js';
import { LanDriver } from './drivers/lan-driver.js';

const DEVICE_PRINTER_KEY = 'restaurant_os_device_printer';

export class PrinterService {
  private drivers: Map<string, PrinterDriver> = new Map();
  private browserFallbackDriver = new BrowserPrintDriver();

  constructor() {
    this.registerDriver(new BrowserPrintDriver());
    this.registerDriver(new BluetoothDriver());
    this.registerDriver(new UsbDriver());
    this.registerDriver(new LanDriver());
  }

  public registerDriver(driver: PrinterDriver): void {
    this.drivers.set(driver.transport, driver);
  }

  public getDriver(transport: string): PrinterDriver {
    return this.drivers.get(transport) || this.browserFallbackDriver;
  }

  /**
   * Retrieves the assigned printer configuration for this specific tablet/device.
   */
  public getDevicePrinter(): PrinterConfig | null {
    try {
      const stored = localStorage.getItem(DEVICE_PRINTER_KEY);
      if (stored) {
        return JSON.parse(stored) as PrinterConfig;
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  /**
   * Assigns the default printer for this specific device.
   */
  public setDevicePrinter(printer: PrinterConfig | null): void {
    if (printer) {
      localStorage.setItem(DEVICE_PRINTER_KEY, JSON.stringify(printer));
    } else {
      localStorage.removeItem(DEVICE_PRINTER_KEY);
    }
  }

  /**
   * Prints a bill receipt asynchronously without ever blocking the UI or billing state.
   */
  public async printBill(
    billId: string,
    options: {
      isReprint?: boolean;
      isDuplicate?: boolean;
      ownerPin?: string;
      printerOverride?: PrinterConfig;
      token?: string;
    } = {},
  ): Promise<{ success: boolean; error?: string; jobId: string }> {
    const jobId = crypto.randomUUID();
    const jobType = options.isDuplicate ? 'duplicate' : options.isReprint ? 'reprint' : 'print';

    // 1. Enqueue job locally in Dexie
    await localDb.printJobs.put({
      id: jobId,
      billId,
      billNumber: 'Loading...',
      type: jobType,
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
    });

    // 2. Execute printing asynchronously (fire-and-forget or awaited by caller)
    return this.executeJob(jobId, billId, options);
  }

  private async executeJob(
    jobId: string,
    billId: string,
    options: {
      isReprint?: boolean;
      isDuplicate?: boolean;
      ownerPin?: string;
      printerOverride?: PrinterConfig;
      token?: string;
    },
  ): Promise<{ success: boolean; error?: string; jobId: string }> {
    try {
      // Update status to printing
      await localDb.printJobs.update(jobId, {
        status: 'printing',
        lastAttemptAt: Date.now(),
      });

      const authToken = options.token || localStorage.getItem('access_token') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Fetch active device printer or fallback
      let targetPrinter = options.printerOverride || this.getDevicePrinter();

      // If no local device printer configured, fetch available printers from server
      if (!targetPrinter) {
        try {
          const listRes = await fetch('/api/printers', { headers });
          if (listRes.ok) {
            const list: PrinterConfig[] = await listRes.json();
            targetPrinter = list.find((p) => p.isDefault) || list[0] || null;
          }
        } catch {
          // Keep null to fallback to browser print
        }
      }

      // Fallback to browser print if no hardware printer configured
      if (!targetPrinter) {
        targetPrinter = {
          restaurantId: '',
          name: 'Browser Print',
          transport: 'browser',
          address: '',
          widthMm: 80,
          codepage: 'CP437',
          charsPerLine: 48,
          autoCut: true,
          drawerPulse: false,
          isDefault: true,
          active: true,
        };
      }

      // Fetch structured receipt data
      const url = `/api/bills/${billId}/receipt?widthMm=${targetPrinter.widthMm}${targetPrinter.id ? `&printerId=${targetPrinter.id}` : ''}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const errMsg = errorJson?.error?.message || `Failed to fetch receipt (${res.status})`;
        await this.markJobFailed(jobId, errMsg);
        return { success: false, error: errMsg, jobId };
      }

      const {
        receiptData,
        templateConfig,
        plainText,
        escposBase64,
      }: {
        receiptData: ReceiptData;
        templateConfig: ReceiptTemplateConfig;
        plainText: string;
        escposBase64: string;
      } = await res.json();

      // Update job with bill number and printer name
      await localDb.printJobs.update(jobId, {
        billNumber: receiptData.billNumber,
        printerId: targetPrinter.id,
        printerName: targetPrinter.name,
        transport: targetPrinter.transport,
        receiptData,
      });

      // Execute driver print
      const driver = this.getDriver(targetPrinter.transport);
      const printResult = await driver.print(
        escposBase64,
        plainText,
        targetPrinter,
        receiptData,
        templateConfig,
      );

      // Record print event to backend API
      const eventType = options.isDuplicate ? 'duplicate' : options.isReprint ? 'reprint' : 'print';
      await fetch(`/api/bills/${billId}/print-events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: eventType,
          printerId: targetPrinter.id,
          result: printResult.success ? 'success' : 'failed',
          error: printResult.error,
          ownerPin: options.ownerPin,
        }),
      }).catch(() => {
        // Log sync fail but don't break local print outcome
      });

      if (printResult.success) {
        await localDb.printJobs.update(jobId, {
          status: 'printed',
          error: undefined,
        });
        return { success: true, jobId };
      } else {
        await this.markJobFailed(jobId, printResult.error || 'Print failed');
        return { success: false, error: printResult.error, jobId };
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unexpected error during printing';
      await this.markJobFailed(jobId, errMsg);
      return { success: false, error: errMsg, jobId };
    }
  }

  private async markJobFailed(jobId: string, error: string): Promise<void> {
    const job = await localDb.printJobs.get(jobId);
    await localDb.printJobs.update(jobId, {
      status: 'failed',
      error,
      attempts: (job?.attempts || 0) + 1,
    });
  }

  /**
   * Retries a failed print job using same or specified printer.
   */
  public async retryJob(jobId: string, printerOverride?: PrinterConfig): Promise<PrintResult> {
    const job = await localDb.printJobs.get(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    const res = await this.executeJob(jobId, job.billId, {
      isReprint: job.type === 'reprint',
      isDuplicate: job.type === 'duplicate',
      printerOverride,
    });

    return { success: res.success, error: res.error };
  }

  /**
   * Fallback: immediately prints the failed receipt via Browser Print.
   */
  public async fallbackToBrowserPrint(jobId: string): Promise<PrintResult> {
    const browserPrinter: PrinterConfig = {
      restaurantId: '',
      name: 'Browser Print',
      transport: 'browser',
      address: '',
      widthMm: 80,
      codepage: 'CP437',
      charsPerLine: 48,
      autoCut: true,
      drawerPulse: false,
      isDefault: true,
      active: true,
    };
    return this.retryJob(jobId, browserPrinter);
  }

  /**
   * Executes a Test Print for a given printer configuration.
   */
  public async testPrint(printer: PrinterConfig, token?: string): Promise<PrintResult> {
    try {
      const authToken = token || localStorage.getItem('access_token') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`/api/printers/${printer.id}/test`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson?.error?.message || `Test print failed (${res.status})`);
      }

      const { plainText, escposBase64 } = await res.json();
      const driver = this.getDriver(printer.transport);

      return await driver.print(escposBase64, plainText, printer, {} as any, {} as any);
    } catch (err: any) {
      return { success: false, error: err.message || 'Test print error' };
    }
  }
}

export const printerService = new PrinterService();
