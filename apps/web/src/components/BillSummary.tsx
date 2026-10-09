import React from 'react';
import { formatPaiseToRupeeString } from '@restaurant-os/shared';
import { StatusPill } from './ui/StatusPill.js';
import { Receipt, Scissors } from 'lucide-react';

export interface BillSummaryLine {
  id?: string;
  name: string;
  qty: number;
  pricePaise: number;
  subtotalPaise: number;
  discountPaise?: number;
  taxPaise?: number;
  cgstPaise?: number;
  sgstPaise?: number;
  modifiers?: Array<{ name: string }>;
  note?: string | null;
}

export interface BillSummaryData {
  id?: string;
  billNumber?: string;
  tableLabel?: string | null;
  status?: string;
  subtotalPaise: number;
  discountPaise: number;
  discountType?: 'percent' | 'flat' | null;
  discountValue?: number | null;
  discountReason?: string | null;
  serviceChargePaise?: number;
  taxPaise: number;
  cgstPaise?: number;
  sgstPaise?: number;
  roundOffPaise: number;
  totalPaise: number;
  lines: BillSummaryLine[];
  createdAt?: string;
}

interface BillSummaryProps {
  data: BillSummaryData;
  showLines?: boolean;
  className?: string;
}

export const BillSummary: React.FC<BillSummaryProps> = ({
  data,
  showLines = true,
  className = '',
}) => {
  const cgst = data.cgstPaise ?? Math.floor(data.taxPaise / 2);
  const sgst = data.sgstPaise ?? data.taxPaise - cgst;

  return (
    <div
      className={`rounded-2xl border-2 border-surface-border bg-surface-card p-5 space-y-4 shadow-lg ${className}`}
    >
      {/* Top Header if Bill # is provided */}
      {data.billNumber && (
        <div className="flex items-center justify-between border-b-2 border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" />
            <div>
              <span className="font-mono font-black text-title text-content-primary">
                {data.billNumber}
              </span>
              <span className="text-caption text-content-secondary ml-2 font-bold">
                {data.tableLabel ? `Table ${data.tableLabel}` : 'Takeaway'}
              </span>
            </div>
          </div>
          {data.status && <StatusPill status={data.status as any} size="sm" />}
        </div>
      )}

      {/* Line Items Snapshot */}
      {showLines && data.lines.length > 0 && (
        <div className="space-y-2 border-b border-surface-border pb-3">
          <div className="flex items-center justify-between text-xs font-bold text-content-muted uppercase tracking-wider">
            <span>Item & Qty</span>
            <span>Amount</span>
          </div>

          <div className="divide-y divide-surface-border/40">
            {data.lines.map((line, idx) => (
              <div
                key={line.id || idx}
                className="py-2 flex items-start justify-between gap-3 text-body"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono font-black text-accent min-w-[24px]">
                      {line.qty}×
                    </span>
                    <span className="font-bold text-content-primary truncate">{line.name}</span>
                  </div>
                  {line.modifiers && line.modifiers.length > 0 && (
                    <div className="text-xs text-content-muted pl-7">
                      {line.modifiers.map((m) => m.name).join(' • ')}
                    </div>
                  )}
                  {line.note && (
                    <div className="text-xs text-amber-400 pl-7 font-medium">Note: {line.note}</div>
                  )}
                </div>

                <div className="text-right font-mono font-bold text-content-primary tabular-nums shrink-0">
                  {formatPaiseToRupeeString(line.subtotalPaise)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial Breakdown Calculations */}
      <div className="space-y-2 text-body">
        {/* Gross Subtotal */}
        <div className="flex items-center justify-between text-content-secondary">
          <span>Subtotal</span>
          <span className="font-mono font-bold text-content-primary tabular-nums">
            {formatPaiseToRupeeString(data.subtotalPaise)}
          </span>
        </div>

        {/* Discount */}
        {data.discountPaise > 0 && (
          <div className="flex items-center justify-between text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs">
              <Scissors className="w-4 h-4" />
              <span>
                Discount {data.discountType === 'percent' ? `(${data.discountValue}%)` : ''}
                {data.discountReason ? ` • ${data.discountReason}` : ''}
              </span>
            </div>
            <span className="font-mono tabular-nums">
              -{formatPaiseToRupeeString(data.discountPaise)}
            </span>
          </div>
        )}

        {/* Service Charge */}
        {data.serviceChargePaise !== undefined && data.serviceChargePaise > 0 && (
          <div className="flex items-center justify-between text-content-secondary">
            <span>Service Charge</span>
            <span className="font-mono font-bold text-content-primary tabular-nums">
              {formatPaiseToRupeeString(data.serviceChargePaise)}
            </span>
          </div>
        )}

        {/* GST Breakdown */}
        {data.taxPaise > 0 && (
          <div className="space-y-1 pt-1 border-t border-surface-border/50 text-caption text-content-muted">
            <div className="flex items-center justify-between">
              <span>Total GST (5%)</span>
              <span className="font-mono font-bold text-content-secondary tabular-nums">
                {formatPaiseToRupeeString(data.taxPaise)}
              </span>
            </div>
            <div className="flex items-center justify-between pl-3 text-xs">
              <span>• CGST (Central Tax 2.5%)</span>
              <span className="font-mono tabular-nums">{formatPaiseToRupeeString(cgst)}</span>
            </div>
            <div className="flex items-center justify-between pl-3 text-xs">
              <span>• SGST (State Tax 2.5%)</span>
              <span className="font-mono tabular-nums">{formatPaiseToRupeeString(sgst)}</span>
            </div>
          </div>
        )}

        {/* Round-off Adjustment */}
        {data.roundOffPaise !== 0 && (
          <div className="flex items-center justify-between text-xs text-content-muted pt-1">
            <span>Round-off Adjustment</span>
            <span className="font-mono tabular-nums">
              {data.roundOffPaise > 0 ? '+' : ''}
              {formatPaiseToRupeeString(data.roundOffPaise)}
            </span>
          </div>
        )}

        {/* Grand Total */}
        <div className="flex items-center justify-between pt-3 border-t-2 border-surface-border">
          <span className="text-title font-black uppercase text-content-primary tracking-wide">
            Total Payable
          </span>
          <span className="text-2xl font-mono font-black text-accent tabular-nums">
            {formatPaiseToRupeeString(data.totalPaise)}
          </span>
        </div>
      </div>
    </div>
  );
};
