/**
 * Capacitor Native Printer Plugin Bridge.
 * Safely communicates with Android Kotlin PrinterPlugin when running inside Capacitor shell.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: {
        PrinterPlugin?: {
          discover: (options: { transport: string }) => Promise<{ devices: any[] }>;
          connect: (options: {
            transport: string;
            address: string;
          }) => Promise<{ connected: boolean }>;
          write: (options: {
            transport: string;
            address: string;
            data: string;
          }) => Promise<{ bytesWritten: number }>;
          disconnect: (options: {
            transport?: string;
            address?: string;
          }) => Promise<{ disconnected: boolean }>;
        };
      };
    };
  }
}

export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export async function nativeDiscover(transport: 'bluetooth' | 'usb' | 'lan'): Promise<any[]> {
  if (!isCapacitorNative() || !window.Capacitor?.Plugins?.PrinterPlugin) {
    return [];
  }
  const result = await window.Capacitor.Plugins.PrinterPlugin.discover({ transport });
  return result?.devices || [];
}

export async function nativeConnect(transport: string, address: string): Promise<boolean> {
  if (!isCapacitorNative() || !window.Capacitor?.Plugins?.PrinterPlugin) {
    throw new Error('Native hardware printing is only available in the Android app shell');
  }
  const result = await window.Capacitor.Plugins.PrinterPlugin.connect({ transport, address });
  return Boolean(result?.connected);
}

export async function nativeWrite(
  transport: string,
  address: string,
  dataBase64: string,
): Promise<number> {
  if (!isCapacitorNative() || !window.Capacitor?.Plugins?.PrinterPlugin) {
    throw new Error('Native hardware printing is only available in the Android app shell');
  }
  const result = await window.Capacitor.Plugins.PrinterPlugin.write({
    transport,
    address,
    data: dataBase64,
  });
  return result?.bytesWritten || 0;
}

export async function nativeDisconnect(transport?: string, address?: string): Promise<boolean> {
  if (!isCapacitorNative() || !window.Capacitor?.Plugins?.PrinterPlugin) {
    return true;
  }
  const result = await window.Capacitor.Plugins.PrinterPlugin.disconnect({ transport, address });
  return Boolean(result?.disconnected);
}
