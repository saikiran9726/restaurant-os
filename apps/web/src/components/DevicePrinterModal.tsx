import React, { useEffect, useState } from 'react';
import { Dialog } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { printerService } from '../services/printer/printer-service.js';
import type { PrinterConfig } from '@restaurant-os/shared';
import { Printer, Check, Smartphone, Wifi, Usb, Globe } from 'lucide-react';

interface DevicePrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DevicePrinterModal: React.FC<DevicePrinterModalProps> = ({ isOpen, onClose }) => {
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPrinters();
    }
  }, [isOpen]);

  const loadPrinters = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch('/api/printers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const list: PrinterConfig[] = await res.json();
        setPrinters(list);
      }
    } catch {
      // Ignore network errors
    } finally {
      setIsLoading(false);
      const current = printerService.getDevicePrinter();
      setSelectedId(current?.id || null);
    }
  };

  const handleSelect = (printer: PrinterConfig | null) => {
    printerService.setDevicePrinter(printer);
    setSelectedId(printer?.id || null);
    onClose();
  };

  const getTransportIcon = (transport: string) => {
    switch (transport) {
      case 'bluetooth':
        return <Smartphone className="w-4 h-4 text-blue-400" />;
      case 'lan':
        return <Wifi className="w-4 h-4 text-emerald-400" />;
      case 'usb':
        return <Usb className="w-4 h-4 text-amber-400" />;
      default:
        return <Globe className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Choose Printer on this Device"
      description="Select the default thermal receipt printer for this tablet or terminal"
      size="md"
    >
      <div className="space-y-3">
        {/* Browser Print Fallback Option */}
        <div
          onClick={() => handleSelect(null)}
          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
            selectedId === null
              ? 'bg-primary/10 border-primary text-content-primary'
              : 'bg-surface-subtle border-surface-border hover:bg-surface-card text-content-secondary'
          }`}
        >
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="font-semibold text-sm text-content-primary">
                Browser Print (System Dialog)
              </div>
              <div className="text-xs text-content-secondary">
                Works on all browsers without paired hardware
              </div>
            </div>
          </div>
          {selectedId === null && <Check className="w-5 h-5 text-primary" />}
        </div>

        {/* Configured Printers */}
        {printers.map((p) => {
          const isSelected = selectedId === p.id;
          return (
            <div
              key={p.id}
              onClick={() => handleSelect(p)}
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                isSelected
                  ? 'bg-primary/10 border-primary text-content-primary'
                  : 'bg-surface-subtle border-surface-border hover:bg-surface-card text-content-secondary'
              }`}
            >
              <div className="flex items-center gap-3">
                {getTransportIcon(p.transport)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-content-primary">{p.name}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-card border border-surface-border">
                      {p.widthMm}mm &bull; {p.transport}
                    </span>
                  </div>
                  {p.address && (
                    <div className="text-xs font-mono text-content-secondary mt-0.5">
                      {p.address}
                    </div>
                  )}
                </div>
              </div>
              {isSelected && <Check className="w-5 h-5 text-primary" />}
            </div>
          );
        })}

        {printers.length === 0 && !isLoading && (
          <div className="text-center py-4 text-xs text-content-secondary">
            No hardware printers registered yet. Owner can add printers in Owner Settings &rarr;
            Printers.
          </div>
        )}
      </div>
    </Dialog>
  );
};
