import React, { useState } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  ChevronRight,
  Check,
  Moon,
  X,
  Clock,
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Dialog } from '../ui/Overlay.js';
import type { AlertOutput, AlertSeverity } from '@restaurant-os/shared';

interface ActionAlertCardProps {
  alert: AlertOutput;
  onAcknowledge: (alertId: string, note: string) => Promise<void>;
  onSnooze: (alertId: string, duration: '1d' | '7d') => Promise<void>;
  onDismiss: (alertId: string, reason: string) => Promise<void>;
  onNavigateAction?: (url: string) => void;
}

export const ActionAlertCard: React.FC<ActionAlertCardProps> = ({
  alert,
  onAcknowledge,
  onSnooze,
  onDismiss,
  onNavigateAction,
}) => {
  const [showAckModal, setShowAckModal] = useState(false);
  const [showDismissModal, setShowDismissModal] = useState(false);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [ackNote, setAckNote] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCashMismatch = alert.type === 'cash_mismatch';
  const isCritical = alert.severity === 'critical';

  const severityBadgeClass = isCritical
    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
    : alert.severity === 'warning'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';

  const borderClass = isCritical
    ? 'border-red-500/30 bg-red-500/[0.02]'
    : alert.severity === 'warning'
      ? 'border-amber-500/30 bg-amber-500/[0.02]'
      : 'border-surface-border bg-surface-card';

  const handleAcknowledgeSubmit = async () => {
    if (!ackNote.trim()) return;
    setSubmitting(true);
    try {
      await onAcknowledge(alert.id, ackNote.trim());
      setShowAckModal(false);
      setAckNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissSubmit = async () => {
    setSubmitting(true);
    try {
      await onDismiss(alert.id, dismissReason.trim());
      setShowDismissModal(false);
      setDismissReason('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all duration-200 animate-in fade-in slide-in-from-top-1 ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {isCritical ? (
              <AlertOctagon className="w-5 h-5 text-red-500" />
            ) : alert.severity === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <Info className="w-5 h-5 text-blue-500" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${severityBadgeClass}`}
              >
                {alert.severity}
              </span>
              <h4 className="text-body font-bold text-content-primary">{alert.payload.title}</h4>
            </div>

            <p className="text-caption text-content-secondary leading-relaxed">
              <strong className="text-content-primary font-medium">What is wrong: </strong>
              {alert.payload.whatIsWrong}
            </p>

            <p className="text-caption text-content-muted leading-relaxed">
              <strong className="text-content-secondary font-medium">Why it matters: </strong>
              {alert.payload.whyItMatters}
            </p>

            {alert.payload.items && alert.payload.items.length > 0 && (
              <div className="mt-2 text-xs bg-surface-elevated/70 p-2.5 rounded-lg border border-surface-border">
                <span className="font-semibold text-content-primary">Items involved: </span>
                <span className="text-content-secondary">
                  {alert.payload.items
                    .map((i) => `${i.name} (${i.currentStock}/${i.reorderLevel} ${i.unit})`)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Snooze & Actions Menu */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
              title="Snooze alert"
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-content-muted hover:text-content-secondary transition-colors"
            >
              <Moon className="w-4 h-4" />
            </button>

            {showSnoozeMenu && (
              <div className="absolute right-0 mt-1 w-36 bg-surface-card border border-surface-border rounded-lg shadow-lg py-1 z-20 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowSnoozeMenu(false);
                    onSnooze(alert.id, '1d');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-elevated flex items-center gap-2 text-content-secondary"
                >
                  <Clock className="w-3.5 h-3.5" /> Snooze 1 day
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSnoozeMenu(false);
                    onSnooze(alert.id, '7d');
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-surface-elevated flex items-center gap-2 text-content-secondary"
                >
                  <Clock className="w-3.5 h-3.5" /> Snooze 7 days
                </button>
              </div>
            )}
          </div>

          {!isCashMismatch && (
            <button
              type="button"
              onClick={() => setShowDismissModal(true)}
              title="Dismiss alert"
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-content-muted hover:text-content-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Primary Actions Bottom Row */}
      <div className="mt-3 pt-3 border-t border-surface-border/50 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-content-muted">
          First seen: {new Date(alert.firstSeen).toLocaleDateString()}
        </span>

        <div className="flex items-center gap-2">
          {isCashMismatch ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAckModal(true)}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              Acknowledge Gap
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAckModal(true)}
              className="text-xs"
            >
              Resolve with Note
            </Button>
          )}

          {alert.payload.actionUrl && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              onClick={() => {
                if (onNavigateAction && alert.payload.actionUrl) {
                  onNavigateAction(alert.payload.actionUrl);
                }
              }}
            >
              {alert.payload.actionLabel || 'Investigate'}
            </Button>
          )}
        </div>
      </div>

      {/* Acknowledge Modal */}
      <Dialog
        isOpen={showAckModal}
        onClose={() => setShowAckModal(false)}
        title={isCashMismatch ? 'Acknowledge Cash Mismatch' : 'Resolve Alert'}
        description={
          isCashMismatch
            ? 'Cash mismatches require an explicit explanatory note for bookkeeping and audit trails before resolution.'
            : 'Enter an optional note explaining what action was taken to clear this alert.'
        }
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setShowAckModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={submitting || (isCashMismatch && ackNote.trim().length < 3)}
              onClick={handleAcknowledgeSubmit}
            >
              {submitting ? 'Saving...' : 'Confirm Resolution'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <label className="block text-xs font-semibold text-content-secondary">
            Resolution / Acknowledgement Note{' '}
            {isCashMismatch && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={ackNote}
            onChange={(e) => setAckNote(e.target.value)}
            placeholder={
              isCashMismatch
                ? 'e.g., Shortage verified against drawer log. ₹200 counted as tip payout voucher.'
                : 'e.g., Reordered 5kg butter from vendor.'
            }
            rows={3}
            className="w-full text-xs p-3 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </Dialog>

      {/* Dismiss with Reason Modal */}
      <Dialog
        isOpen={showDismissModal}
        onClose={() => setShowDismissModal(false)}
        title="Dismiss Alert"
        description="Provide a brief reason why this alert is being dismissed."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setShowDismissModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" disabled={submitting} onClick={handleDismissSubmit}>
              {submitting ? 'Dismissing...' : 'Dismiss Alert'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <label className="block text-xs font-semibold text-content-secondary">
            Reason for Dismissal
          </label>
          <input
            type="text"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            placeholder="e.g., One-off catering purchase expected this month."
            className="w-full text-xs p-3 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </Dialog>
    </div>
  );
};
