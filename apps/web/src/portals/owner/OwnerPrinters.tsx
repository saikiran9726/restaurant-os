import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button.js';
import { StatusPill } from '../../components/ui/StatusPill.js';
import { PrinterForm } from '../../components/PrinterForm.js';
import { printerService } from '../../services/printer/printer-service.js';
import type { PrinterConfig, CreatePrinterInput } from '@restaurant-os/shared';
import {
  Printer,
  Plus,
  Play,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Wifi,
  Usb,
  Globe,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OwnerPrinters: React.FC = () => {
  const navigate = useNavigate();
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  const fetchPrinters = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch('/api/printers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPrinters(data);
      }
    } catch (err) {
      console.error('Failed to load printers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrinters();
  }, []);

  const handleCreateOrUpdate = async (input: CreatePrinterInput) => {
    const token = localStorage.getItem('access_token') || '';
    const url = editingPrinter ? `/api/printers/${editingPrinter.id}` : '/api/printers';
    const method = editingPrinter ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Failed to save printer');
    }

    await fetchPrinters();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this printer?')) return;
    const token = localStorage.getItem('access_token') || '';
    const res = await fetch(`/api/printers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchPrinters();
    }
  };

  const handleTestPrint = async (printer: PrinterConfig) => {
    if (!printer.id) return;
    setTestingId(printer.id);
    setTestResult(null);

    const result = await printerService.testPrint(printer);

    setTestResult({
      id: printer.id,
      success: result.success,
      message: result.success
        ? 'Test slip printed successfully!'
        : result.error || 'Test print failed',
    });
    setTestingId(null);
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-content-primary tracking-tight flex items-center gap-2">
            <Printer className="w-7 h-7 text-primary" />
            Thermal Printers & Hardware
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Configure 58mm / 80mm thermal receipt printers over Bluetooth, USB, LAN, or Browser
            Print.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => navigate('/owner/receipt-template')}>
            <Settings className="w-4 h-4 mr-1.5" />
            Receipt Template
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setEditingPrinter(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Printer
          </Button>
        </div>
      </div>

      {/* Test feedback banner */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
            testResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span className="text-sm font-medium">{testResult.message}</span>
        </div>
      )}

      {/* Printers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {printers.map((printer) => (
          <div
            key={printer.id}
            className="p-5 rounded-2xl bg-surface-card border border-surface-border shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-surface-subtle border border-surface-border">
                    {getTransportIcon(printer.transport)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-content-primary">{printer.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-subtle text-content-secondary border border-surface-border">
                        {printer.widthMm}mm &bull; {printer.transport}
                      </span>
                      {printer.isDefault && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          DEFAULT
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingPrinter(printer);
                      setIsFormOpen(true);
                    }}
                    className="p-1.5 text-content-secondary hover:text-content-primary rounded-lg hover:bg-surface-subtle transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => printer.id && handleDelete(printer.id)}
                    className="p-1.5 text-content-secondary hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {printer.address && (
                <div className="mt-3 p-2 rounded-lg bg-surface-subtle border border-surface-border font-mono text-xs text-content-secondary truncate">
                  {printer.address}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-content-secondary">
                <div className="flex items-center justify-between p-2 rounded bg-surface-subtle">
                  <span>Chars/Line:</span>
                  <span className="font-mono font-bold text-content-primary">
                    {printer.charsPerLine}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-surface-subtle">
                  <span>Auto-cut:</span>
                  <span className="font-bold text-content-primary">
                    {printer.autoCut ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-surface-border flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs font-bold"
                isLoading={testingId === printer.id}
                onClick={() => handleTestPrint(printer)}
              >
                <Play className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Test Print Slip
              </Button>
            </div>
          </div>
        ))}

        {printers.length === 0 && !isLoading && (
          <div className="col-span-full py-16 text-center rounded-2xl border border-dashed border-surface-border bg-surface-subtle/50">
            <Printer className="w-12 h-12 mx-auto mb-3 text-content-secondary opacity-40" />
            <h3 className="text-base font-bold text-content-primary">No printers configured yet</h3>
            <p className="text-xs text-content-secondary mt-1 max-w-sm mx-auto">
              Add your thermal receipt printer (LAN, Bluetooth, USB) or use standard Browser Print.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => {
                setEditingPrinter(null);
                setIsFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add First Printer
            </Button>
          </div>
        )}
      </div>

      <PrinterForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateOrUpdate}
        initialData={editingPrinter}
      />
    </div>
  );
};
