import React from 'react';
import { type LoyaltyTransactionOutput, formatPaiseToRupeeString } from '@restaurant-os/shared';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Sliders, Gift, Clock } from 'lucide-react';

interface LedgerTableProps {
  transactions: LoyaltyTransactionOutput[];
  className?: string;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({ transactions, className = '' }) => {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-content-muted rounded-2xl bg-surface-card border border-surface-border">
        No loyalty ledger transactions recorded yet.
      </div>
    );
  }

  const getTypeIcon = (type: string, points: number) => {
    switch (type) {
      case 'earn':
        return <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />;
      case 'redeem':
        return <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />;
      case 'reversal':
        return <RotateCcw className="w-3.5 h-3.5 text-amber-400" />;
      case 'bonus':
        return <Gift className="w-3.5 h-3.5 text-indigo-400" />;
      case 'adjust':
        return <Sliders className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-surface-border bg-surface-card shadow-sm ${className}`}
    >
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-subtle text-content-secondary border-b border-surface-border uppercase tracking-wider font-semibold">
          <tr>
            <th className="py-3 px-4">Date / Time</th>
            <th className="py-3 px-4">Type</th>
            <th className="py-3 px-4 text-right">Points</th>
            <th className="py-3 px-4">Bill #</th>
            <th className="py-3 px-4">Reason / Notes</th>
            <th className="py-3 px-4">Authorized By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {transactions.map((tx) => {
            const isCredit = tx.points > 0;
            return (
              <tr key={tx.id} className="hover:bg-surface-elevated/40 transition-colors">
                <td className="py-3 px-4 text-content-secondary font-mono text-[11px] whitespace-nowrap">
                  {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-1.5 uppercase font-bold text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-surface-subtle border border-surface-border">
                    {getTypeIcon(tx.type, tx.points)}
                    <span>{tx.type}</span>
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                  <span className={isCredit ? 'text-emerald-400' : 'text-rose-400'}>
                    {isCredit ? `+${tx.points}` : tx.points} pts
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-content-primary">
                  {tx.billNumber ? `#${tx.billNumber}` : '—'}
                </td>
                <td className="py-3 px-4 text-content-secondary max-w-xs truncate">
                  {tx.reason || '—'}
                </td>
                <td className="py-3 px-4 text-content-muted">{tx.createdByName || 'System'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
