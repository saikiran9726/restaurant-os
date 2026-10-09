import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button.js';
import { ReceiptPreview } from '../../components/ReceiptPreview.js';
import { isValidUpiVpa, type ReceiptData, type RestaurantSettings } from '@restaurant-os/shared';
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, QrCode, Sliders } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OwnerReceiptTemplate: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [previewWidth, setPreviewWidth] = useState<58 | 80>(80);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Form states
  const [upiVpa, setUpiVpa] = useState('');
  const [upiPayeeName, setUpiPayeeName] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [showGstin, setShowGstin] = useState(true);
  const [showCustomer, setShowCustomer] = useState(true);
  const [showItemNotes, setShowItemNotes] = useState(false);
  const [showServiceCharge, setShowServiceCharge] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [rupeeMode, setRupeeMode] = useState<'text_rs' | 'symbol' | 'image'>('text_rs');

  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem('access_token') || '';
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: RestaurantSettings = await res.json();
        setSettings(data);
        setUpiVpa(data.upiVpa || '');
        setUpiPayeeName(data.upiPayeeName || '');
        setHeaderText((data.receiptHeaderLines || []).join('\n'));
        setFooterText((data.receiptFooterLines || []).join('\n'));
        setShowGstin(data.receiptShowGstin ?? true);
        setShowCustomer(data.receiptShowCustomer ?? true);
        setShowItemNotes(data.receiptShowItemNotes ?? false);
        setShowServiceCharge(data.receiptShowServiceCharge ?? true);
        setShowQr(data.receiptShowQr ?? true);
        setRupeeMode(data.rupeeSymbolMode || 'text_rs');
      }
    };
    fetchSettings();
  }, []);

  const isVpaValid = upiVpa.trim() === '' || isValidUpiVpa(upiVpa.trim());

  const handleSave = async () => {
    if (upiVpa.trim() && !isValidUpiVpa(upiVpa.trim())) {
      setSaveStatus('Invalid UPI VPA format. Must be like merchant@bank');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const token = localStorage.getItem('access_token') || '';
      const payload = {
        ...settings,
        upiVpa: upiVpa.trim() || null,
        upiPayeeName: upiPayeeName.trim() || null,
        receiptHeaderLines: headerText.split('\n').filter((l) => l.trim().length > 0),
        receiptFooterLines: footerText.split('\n').filter((l) => l.trim().length > 0),
        receiptShowGstin: showGstin,
        receiptShowCustomer: showCustomer,
        receiptShowItemNotes: showItemNotes,
        receiptShowServiceCharge: showServiceCharge,
        receiptShowQr: showQr,
        rupeeSymbolMode: rupeeMode,
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Failed to update settings');
      }

      setSaveStatus('Template saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(err.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Sample receipt data for live preview
  const sampleReceipt: ReceiptData = {
    restaurantName: settings?.name || 'Grand Heritage Bistro',
    restaurantAddress: settings?.address || '42 Church Street, Bengaluru',
    restaurantPhone: settings?.phone || '+91 98765 43210',
    restaurantGstin: settings?.gstin || '29ABCDE1234F1Z5',
    billNumber: 'B-20261008-0042',
    orderType: 'dine_in',
    tableName: 'T-07',
    waiterName: 'Suresh K.',
    date: new Date(),
    lines: [
      {
        name: 'Paneer Butter Masala',
        qty: 1,
        pricePaise: 32000,
        totalPaise: 32000,
      },
      {
        name: 'Garlic Naan',
        qty: 3,
        pricePaise: 7000,
        totalPaise: 21000,
      },
      {
        name: 'Fresh Lime Soda',
        qty: 2,
        pricePaise: 8000,
        totalPaise: 16000,
        note: 'Less ice, sweet',
      },
    ],
    subtotalPaise: 69000,
    discountPaise: 6900,
    discountReason: 'Happy Hour 10%',
    serviceChargePaise: showServiceCharge ? 3105 : 0,
    cgstPaise: 1553,
    sgstPaise: 1553,
    roundOffPaise: -11,
    totalPaise: 68300,
    paidPaise: 0,
    balanceDuePaise: 68300,
    upiQrPayload:
      showQr && upiVpa.trim()
        ? `upi://pay?pa=${encodeURIComponent(upiVpa.trim())}&pn=${encodeURIComponent(upiPayeeName.trim() || 'Restaurant')}&am=683.00&cu=INR&tn=B-20261008-0042`
        : undefined,
  };

  const previewTemplateConfig = {
    widthMm: previewWidth,
    charsPerLine: previewWidth === 58 ? 32 : 48,
    headerLines: headerText.split('\n').filter((l) => l.trim()),
    footerLines: footerText.split('\n').filter((l) => l.trim()),
    showGstin,
    showCustomer,
    showItemNotes,
    showServiceCharge,
    showQr,
    rupeeMode,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/owner/printers')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Printers
          </Button>
          <div>
            <h1 className="text-2xl font-black text-content-primary tracking-tight">
              Receipt Template & Dynamic UPI
            </h1>
            <p className="text-xs text-content-secondary mt-0.5">
              Customize thermal slip layout, header/footer text, and NPCI dynamic UPI QR settings
            </p>
          </div>
        </div>

        <Button variant="primary" size="md" isLoading={isSaving} onClick={handleSave}>
          <Save className="w-4 h-4 mr-1.5" />
          Save Template
        </Button>
      </div>

      {saveStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
            saveStatus.includes('successfully')
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {saveStatus.includes('successfully') ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Main Grid: Form Controls Left, Live Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Dynamic UPI Section */}
          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4">
            <div className="flex items-center gap-2 text-content-primary font-bold text-sm">
              <QrCode className="w-4 h-4 text-primary" />
              Dynamic UPI QR Code Settings
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                  UPI VPA / ID (pa)
                </label>
                <input
                  type="text"
                  placeholder="e.g. restaurant@icici"
                  className={`w-full px-3 py-2 rounded-lg bg-surface-subtle border text-content-primary text-sm font-mono focus:outline-none ${
                    !isVpaValid ? 'border-rose-500' : 'border-surface-border focus:border-primary'
                  }`}
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                />
                {!isVpaValid && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    Must follow format: username@bank
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                  Payee Display Name (pn)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Grand Heritage Bistro"
                  className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-content-primary text-sm focus:outline-none focus:border-primary"
                  value={upiPayeeName}
                  onChange={(e) => setUpiPayeeName(e.target.value)}
                />
              </div>
            </div>

            <p className="text-xs text-content-secondary leading-relaxed bg-surface-subtle p-3 rounded-lg border border-surface-border">
              Per-bill dynamic QR codes embed the exact balance due. If partially paid, the QR
              adjusts automatically.
              <span className="block mt-1 text-amber-300 font-semibold">
                Note: Customer scans never automatically confirm settlement. Staff must verify
                payments before confirming.
              </span>
            </p>
          </div>

          {/* Header & Footer Customization */}
          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4">
            <div className="flex items-center gap-2 text-content-primary font-bold text-sm">
              <Sliders className="w-4 h-4 text-primary" />
              Custom Header & Footer Lines
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Receipt Header Lines (1 line per row, centered)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Welcome to Our Restaurant&#10;Authentic Indian Cuisine"
                className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-content-primary text-sm font-mono focus:outline-none focus:border-primary"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Receipt Footer Lines (1 line per row, centered)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Thank you for dining with us!&#10;Follow us on Instagram @bistro"
                className="w-full px-3 py-2 rounded-lg bg-surface-subtle border border-surface-border text-content-primary text-sm font-mono focus:outline-none focus:border-primary"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
              />
            </div>
          </div>

          {/* Section Toggles & Rupee Encoding */}
          <div className="p-5 rounded-2xl bg-surface-card border border-surface-border space-y-4">
            <h3 className="font-bold text-sm text-content-primary">Receipt Layout Toggles</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary p-2.5 rounded-lg bg-surface-subtle border border-surface-border">
                <input
                  type="checkbox"
                  checked={showGstin}
                  onChange={(e) => setShowGstin(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Print GSTIN Number</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary p-2.5 rounded-lg bg-surface-subtle border border-surface-border">
                <input
                  type="checkbox"
                  checked={showCustomer}
                  onChange={(e) => setShowCustomer(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Print Table & Server Info</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary p-2.5 rounded-lg bg-surface-subtle border border-surface-border">
                <input
                  type="checkbox"
                  checked={showItemNotes}
                  onChange={(e) => setShowItemNotes(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Print Item Special Notes</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary p-2.5 rounded-lg bg-surface-subtle border border-surface-border">
                <input
                  type="checkbox"
                  checked={showServiceCharge}
                  onChange={(e) => setShowServiceCharge(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Print Service Charge</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-content-primary p-2.5 rounded-lg bg-surface-subtle border border-surface-border sm:col-span-2">
                <input
                  type="checkbox"
                  checked={showQr}
                  onChange={(e) => setShowQr(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Print Dynamic UPI QR on Unpaid/Partial Bills</span>
              </label>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-content-secondary uppercase mb-1">
                Rupee Symbol Representation
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRupeeMode('text_rs')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                    rupeeMode === 'text_rs'
                      ? 'bg-primary/10 border-primary text-content-primary'
                      : 'bg-surface-subtle border-surface-border text-content-secondary'
                  }`}
                >
                  "Rs." Text (Recommended for all printers)
                </button>
                <button
                  type="button"
                  onClick={() => setRupeeMode('symbol')}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                    rupeeMode === 'symbol'
                      ? 'bg-primary/10 border-primary text-content-primary'
                      : 'bg-surface-subtle border-surface-border text-content-secondary'
                  }`}
                >
                  "₹" Unicode Symbol
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4 sticky top-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
              Live Thermal Preview
            </span>
            <div className="flex rounded-lg border border-surface-border p-0.5 bg-surface-subtle">
              <button
                type="button"
                onClick={() => setPreviewWidth(58)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  previewWidth === 58
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                58 mm (32c)
              </button>
              <button
                type="button"
                onClick={() => setPreviewWidth(80)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  previewWidth === 80
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-content-secondary hover:text-content-primary'
                }`}
              >
                80 mm (48c)
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-surface-border flex justify-center">
            <ReceiptPreview
              receiptData={sampleReceipt}
              templateConfig={previewTemplateConfig}
              widthMm={previewWidth}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
