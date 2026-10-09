import React, { useState } from 'react';
import { Dialog } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import type { PrinterConfig, CreatePrinterInput } from '@restaurant-os/shared';
import { Smartphone, Wifi, Usb, Globe } from 'lucide-react';

interface PrinterFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePrinterInput) => Promise<void>;
  initialData?: PrinterConfig | null;
}

export const PrinterForm: React.FC<PrinterFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [transport, setTransport] = useState<'bluetooth' | 'usb' | 'lan' | 'browser'>(
    initialData?.transport || 'lan',
  );
  const [address, setAddress] = useState(initialData?.address || '');
  const [widthMm, setWidthMm] = useState<58 | 80>(initialData?.widthMm || 80);
  const [charsPerLine, setCharsPerLine] = useState(
    initialData?.charsPerLine || (initialData?.widthMm === 58 ? 32 : 48),
  );
  const [autoCut, setAutoCut] = useState(initialData?.autoCut ?? true);
  const [drawerPulse, setDrawerPulse] = useState(initialData?.drawerPulse ?? false);
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWidthChange = (w: 58 | 80) => {
    setWidthMm(w);
    setCharsPerLine(w === 58 ? 32 : 48);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Printer name is required');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        transport,
        address: address.trim(),
        widthMm,
        codepage: 'CP437',
        charsPerLine,
        autoCut,
        drawerPulse,
        isDefault,
        active: true,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save printer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAddressPlaceholder = () => {
    switch (transport) {
      case 'bluetooth':
        return 'e.g. 00:11:22:33:44:55 (MAC Address)';
      case 'lan':
        return 'e.g. 192.168.1.100:9100 (IP:Port)';
      case 'usb':
        return 'e.g. /dev/bus/usb/001/002 or leave blank';
      default:
        return 'Not applicable for Browser Print';
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Printer' : 'Add Thermal Printer'}
      description="Configure hardware thermal printer parameters"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
            Printer Name
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-content-primary text-sm focus:outline-none focus:border-primary"
            placeholder="e.g. Main Cashier 80mm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
            Transport
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'bluetooth', label: 'Bluetooth', icon: <Smartphone className="w-4 h-4" /> },
              { id: 'lan', label: 'LAN (Raw TCP)', icon: <Wifi className="w-4 h-4" /> },
              { id: 'usb', label: 'USB (OTG)', icon: <Usb className="w-4 h-4" /> },
              { id: 'browser', label: 'Browser Print', icon: <Globe className="w-4 h-4" /> },
            ].map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setTransport(t.id as any)}
                className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs font-semibold transition-all ${
                  transport === t.id
                    ? 'bg-primary/10 border-primary text-content-primary'
                    : 'bg-surface-subtle border-surface-border text-content-secondary hover:bg-surface-card'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {transport !== 'browser' && (
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Printer Address / Endpoint
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-content-primary text-sm font-mono focus:outline-none focus:border-primary"
              placeholder={getAddressPlaceholder()}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Paper Width
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleWidthChange(58)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                  widthMm === 58
                    ? 'bg-primary/10 border-primary text-content-primary'
                    : 'bg-surface-subtle border-surface-border text-content-secondary'
                }`}
              >
                58 mm
              </button>
              <button
                type="button"
                onClick={() => handleWidthChange(80)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                  widthMm === 80
                    ? 'bg-primary/10 border-primary text-content-primary'
                    : 'bg-surface-subtle border-surface-border text-content-secondary'
                }`}
              >
                80 mm
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
              Chars per Line
            </label>
            <input
              type="number"
              min={20}
              max={80}
              className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-content-primary text-sm font-mono focus:outline-none focus:border-primary"
              value={charsPerLine}
              onChange={(e) => setCharsPerLine(parseInt(e.target.value) || 48)}
            />
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="space-y-2 pt-2 border-t border-surface-border">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary">
            <input
              type="checkbox"
              checked={autoCut}
              onChange={(e) => setAutoCut(e.target.checked)}
              className="rounded border-surface-border text-primary focus:ring-primary"
            />
            <span>Auto-cut paper at the end of the receipt (GS V)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary">
            <input
              type="checkbox"
              checked={drawerPulse}
              onChange={(e) => setDrawerPulse(e.target.checked)}
              className="rounded border-surface-border text-primary focus:ring-primary"
            />
            <span>Pulse Cash Drawer Kick (ESC p)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-surface-border text-primary focus:ring-primary"
            />
            <span>Set as Restaurant Default Printer</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-surface-border">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            {initialData ? 'Save Changes' : 'Add Printer'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
