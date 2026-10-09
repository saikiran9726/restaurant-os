import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { generateUpiIntentUrl, formatPaiseToRupeeString } from '@restaurant-os/shared';
import { QrCode, AlertCircle, Copy, Check } from 'lucide-react';

interface DynamicUpiQrProps {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  billNumber: string;
  transactionRef: string;
  className?: string;
}

export const DynamicUpiQr: React.FC<DynamicUpiQrProps> = ({
  vpa,
  payeeName,
  amountPaise,
  billNumber,
  transactionRef,
  className = '',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [upiUrl, setUpiUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (amountPaise <= 0) {
        setQrDataUrl(null);
        return;
      }

      const url = generateUpiIntentUrl({
        vpa,
        payeeName,
        amountPaise,
        billNumber,
        transactionRef,
      });

      setUpiUrl(url);

      QRCode.toDataURL(url, {
        width: 256,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((dataUrl) => {
          setQrDataUrl(dataUrl);
          setError(null);
        })
        .catch((err) => {
          setError('Failed to generate visual QR code');
          console.error(err);
        });
    } catch (err: any) {
      setError(err.message || 'Invalid UPI configuration');
      setQrDataUrl(null);
    }
  }, [vpa, payeeName, amountPaise, billNumber, transactionRef]);

  const handleCopy = () => {
    if (!upiUrl) return;
    navigator.clipboard.writeText(upiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (amountPaise <= 0) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
        <span className="text-emerald-400 font-bold text-sm">
          Bill is fully paid &bull; No amount due for UPI QR
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div
      className={`p-5 rounded-2xl bg-surface-card border border-surface-border text-center flex flex-col items-center space-y-3 ${className}`}
    >
      <div className="flex items-center gap-2 text-content-primary font-black tracking-tight text-base">
        <QrCode className="w-5 h-5 text-primary" />
        <span>SCAN TO PAY {formatPaiseToRupeeString(amountPaise)}</span>
      </div>

      <p className="text-xs text-content-secondary">
        Scan using GPay, PhonePe, Paytm, BHIM, or any UPI app
      </p>

      {/* High Contrast Visual QR Code */}
      {qrDataUrl && (
        <div className="p-3 bg-white rounded-2xl shadow-md border-4 border-white inline-block">
          <img
            src={qrDataUrl}
            alt={`UPI QR Code for ${formatPaiseToRupeeString(amountPaise)}`}
            className="w-48 h-48 block mx-auto"
          />
        </div>
      )}

      {/* Payee Info & Copy Link */}
      <div className="w-full pt-1 flex items-center justify-between text-xs text-content-secondary px-2">
        <div className="text-left font-mono truncate max-w-[200px]">
          <span className="block text-[10px] uppercase text-content-muted">Payee VPA</span>
          {vpa}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-subtle hover:bg-surface-elevated border border-surface-border text-xs text-content-primary transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span>{copied ? 'Copied' : 'Copy Intent'}</span>
        </button>
      </div>

      {/* Mandatory Staff Warning */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed text-left flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
        <span>
          <strong>Staff verification required:</strong> Customer payment via QR will not
          automatically confirm here. Verify credits in your bank account or soundbox, then tap{' '}
          <em>"Payment Received"</em> below.
        </span>
      </div>
    </div>
  );
};
