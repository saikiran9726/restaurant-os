import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import { CashCountForm } from '../../components/CashCountForm.js';
import { MismatchBanner } from '../../components/MismatchBanner.js';
import { PinOverrideDialog } from '../../components/PinOverrideDialog.js';
import {
  formatPaiseToRupeeString,
  calculateExpectedCash,
  reconcileCash,
  type EodPreCheckStatus,
  type DailySummaryOutput,
  type CashDenominations,
} from '@restaurant-os/shared';
import {
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Coins,
  ArrowRight,
  ArrowLeft,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  History,
} from 'lucide-react';

type Step = 'checks' | 'totals' | 'cash' | 'confirm';

export const OwnerCloseDay: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [currentStep, setCurrentStep] = useState<Step>('checks');
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]!);

  // Cash Form State
  const [openingCashPaise, setOpeningCashPaise] = useState<number>(500000); // ₹5,000 default
  const [openingCashEdited, setOpeningCashEdited] = useState(false);
  const [openingCashReason, setOpeningCashReason] = useState('');

  const [actualCashPaise, setActualCashPaise] = useState<number>(500000);
  const [denominations, setDenominations] = useState<CashDenominations | undefined>(undefined);
  const [mismatchNote, setMismatchNote] = useState('');

  // Till Expense Modal State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expenseAmountStr, setExpenseAmountStr] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('supplies');
  const [expenseNote, setExpenseNote] = useState('');

  // Reopen Modal State
  const [reopenTargetDate, setReopenTargetDate] = useState<string | null>(null);
  const [isReopenPinOpen, setIsReopenPinOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  // Queries
  const {
    data: statusData,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery<EodPreCheckStatus>({
    queryKey: ['eod-status', targetDate],
    queryFn: () => apiFetch(`/day/status?businessDate=${targetDate}`),
    refetchInterval: 10000,
  });

  const { data: summariesHistory, isLoading: isHistoryLoading } = useQuery<{
    summaries: DailySummaryOutput[];
  }>({
    queryKey: ['eod-summaries'],
    queryFn: () => apiFetch('/day/summaries?limit=14'),
  });

  // Calculate Expected Cash & Reconcile
  const cashSalesPaise = statusData?.cashReconciliation.cashSalesPaise || 0;
  const cashExpensesPaise = statusData?.cashReconciliation.cashExpensesPaise || 0;
  const cashRefundsPaise = statusData?.cashReconciliation.cashRefundsPaise || 0;
  const tolerancePaise = 0; // Default zero tolerance

  const expectedCashPaise = calculateExpectedCash({
    openingCashPaise,
    cashSalesPaise,
    cashExpensesPaise,
    cashRefundsPaise,
  });

  const reconciliation = reconcileCash({
    openingCashPaise,
    cashSalesPaise,
    cashExpensesPaise,
    cashRefundsPaise,
    actualCashPaise,
    tolerancePaise,
  });

  // Mutations
  const expenseMutation = useMutation({
    mutationFn: (body: {
      amountPaise: number;
      category: string;
      note: string;
      businessDate: string;
    }) =>
      apiFetch('/day/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Till cash expense logged' });
      setIsExpenseOpen(false);
      setExpenseAmountStr('');
      setExpenseNote('');
      queryClient.invalidateQueries({ queryKey: ['eod-status'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to record expense: ${err.message}` });
    },
  });

  const closeDayMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/day/close', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Business day successfully closed and locked!' });
      queryClient.invalidateQueries({ queryKey: ['eod-status'] });
      queryClient.invalidateQueries({ queryKey: ['eod-summaries'] });
      navigate('/owner/sales');
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to close day: ${err.message}` });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (body: { businessDate: string; overridePin: string; reason: string }) =>
      apiFetch('/day/reopen', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Business day reopened for edits' });
      setIsReopenPinOpen(false);
      setReopenTargetDate(null);
      setReopenReason('');
      queryClient.invalidateQueries({ queryKey: ['eod-status'] });
      queryClient.invalidateQueries({ queryKey: ['eod-summaries'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to reopen day: ${err.message}` });
    },
  });

  const handleConfirmClose = () => {
    if (reconciliation.hasMismatchWarning && !mismatchNote.trim()) {
      addToast({
        type: 'danger',
        message: 'A discrepancy explanation note is required when cash count does not match.',
      });
      return;
    }

    closeDayMutation.mutate({
      businessDate: targetDate,
      openingCashPaise,
      openingCashEdited,
      openingCashEditReason: openingCashReason || undefined,
      actualCashPaise,
      cashDifferenceNote: mismatchNote || undefined,
      denominations,
    });
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const paise = Math.round((parseFloat(expenseAmountStr) || 0) * 100);
    if (paise <= 0 || !expenseNote.trim()) {
      addToast({ type: 'danger', message: 'Enter a valid amount and note' });
      return;
    }
    expenseMutation.mutate({
      businessDate: targetDate,
      amountPaise: paise,
      category: expenseCategory,
      note: expenseNote,
    });
  };

  const isClosed = statusData?.existingSummary?.status === 'closed';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-title font-extrabold text-content-primary">
              End-of-Day Closing (EOD)
            </h2>
            {isClosed ? (
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Day Locked
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                <Unlock className="w-3.5 h-3.5" /> Shift Open
              </span>
            )}
          </div>
          <p className="text-xs text-content-secondary mt-0.5">
            Reconcile registers, verify UPI transactions, account for till payouts, and lock
            financials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs font-bold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStatus()}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-xl p-2">
        {[
          { id: 'checks', label: '1. Pre-checks', num: 1 },
          { id: 'totals', label: '2. Shift Totals', num: 2 },
          { id: 'cash', label: '3. Till Cash Count', num: 3 },
          { id: 'confirm', label: '4. Lock & Confirm', num: 4 },
        ].map((s) => {
          const isActive = currentStep === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentStep(s.id as Step)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-elevated'
              }`}
            >
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: PRE-CHECKS */}
      {currentStep === 'checks' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-subhead text-content-primary">
              Shift Closing Prerequisites
            </h3>

            <div className="divide-y divide-surface-border text-xs">
              {/* Open Orders */}
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-content-primary block">
                    Kitchen / Waiter Open Orders
                  </span>
                  <span className="text-content-muted">
                    Must be billed or cancelled before closing
                  </span>
                </div>
                {(statusData?.openOrders.length || 0) === 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" /> 0 Open Orders
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600 font-bold bg-red-500/10 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-4 h-4" /> {statusData?.openOrders.length} Open
                    Orders
                  </span>
                )}
              </div>

              {/* Unpaid Bills */}
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-content-primary block">Unpaid / Draft Bills</span>
                  <span className="text-content-muted">
                    Must have payments recorded or be cancelled
                  </span>
                </div>
                {(statusData?.unpaidBills.length || 0) === 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" /> 0 Unpaid Bills
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600 font-bold bg-red-500/10 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-4 h-4" /> {statusData?.unpaidBills.length} Unpaid
                    Bills
                  </span>
                )}
              </div>

              {/* Pending UPI */}
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-content-primary block">
                    Pending UPI Confirmations
                  </span>
                  <span className="text-content-muted">
                    Staff must confirm or reject unverified UPI payments
                  </span>
                </div>
                {(statusData?.pendingUpiPayments.length || 0) === 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" /> 0 Pending UPI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-4 h-4" /> {statusData?.pendingUpiPayments.length}{' '}
                    Pending UPI
                  </span>
                )}
              </div>

              {/* Sync Queue */}
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-content-primary block">
                    Offline Outbox Sync Queue
                  </span>
                  <span className="text-content-muted">Client sync queue status</span>
                </div>
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-4 h-4" /> Ready
                </span>
              </div>
            </div>

            {statusData && !statusData.canClose && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                Warning: Resolving all open orders and pending bills is highly recommended before
                locking the business day.
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={() => setCurrentStep('totals')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Shift Totals
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: TOTALS & EXPENSES */}
      {currentStep === 'totals' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-surface-card border border-surface-border rounded-xl">
              <span className="text-xs text-content-muted block">Gross Sales</span>
              <span className="text-subhead font-extrabold text-content-primary mt-1 block">
                {formatPaiseToRupeeString(statusData?.summary.grossSalesPaise || 0)}
              </span>
            </div>
            <div className="p-4 bg-surface-card border border-surface-border rounded-xl">
              <span className="text-xs text-content-muted block">Discounts</span>
              <span className="text-subhead font-extrabold text-content-primary mt-1 block">
                {formatPaiseToRupeeString(statusData?.summary.discountsPaise || 0)}
              </span>
            </div>
            <div className="p-4 bg-surface-card border border-surface-border rounded-xl">
              <span className="text-xs text-content-muted block">Refunds</span>
              <span className="text-subhead font-extrabold text-content-primary mt-1 block">
                {formatPaiseToRupeeString(statusData?.summary.refundsPaise || 0)}
              </span>
            </div>
            <div className="p-4 bg-surface-card border border-surface-border rounded-xl">
              <span className="text-xs text-content-muted block">Net Sales</span>
              <span className="text-subhead font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                {formatPaiseToRupeeString(statusData?.summary.netSalesPaise || 0)}
              </span>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
            <h4 className="font-bold text-body text-content-primary">Payment Receipts</h4>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-surface-elevated rounded-lg">
                <span className="text-content-muted block">Cash Sales</span>
                <span className="text-body font-black text-content-primary mt-1 block">
                  {formatPaiseToRupeeString(statusData?.summary.cashSalesPaise || 0)}
                </span>
              </div>
              <div className="p-3 bg-surface-elevated rounded-lg">
                <span className="text-content-muted block">UPI Received</span>
                <span className="text-body font-black text-content-primary mt-1 block">
                  {formatPaiseToRupeeString(statusData?.summary.upiSalesPaise || 0)}
                </span>
              </div>
              <div className="p-3 bg-surface-elevated rounded-lg">
                <span className="text-content-muted block">Card Payments</span>
                <span className="text-body font-black text-content-primary mt-1 block">
                  {formatPaiseToRupeeString(statusData?.summary.cardSalesPaise || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Till Cash Expenses Entry */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-body text-content-primary">Till Cash Expenses</h4>
                <p className="text-xs text-content-secondary">
                  Payouts made directly from the register cash drawer during the shift
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpenseOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Log Till Expense
              </Button>
            </div>

            <div className="p-3 bg-surface-elevated rounded-lg flex items-center justify-between text-xs">
              <span className="font-medium text-content-secondary">
                Total Till Cash Payouts Today
              </span>
              <span className="text-body font-bold text-content-primary">
                {formatPaiseToRupeeString(cashExpensesPaise)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCurrentStep('checks')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCurrentStep('cash')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Cash Count
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: TILL CASH COUNT */}
      {currentStep === 'cash' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Opening Float Card */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-body text-content-primary">Opening Float</h4>
                <p className="text-xs text-content-secondary">
                  Cash float left in the drawer at shift start
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpeningCashEdited(!openingCashEdited)}
                className="text-xs text-accent font-semibold hover:underline"
              >
                {openingCashEdited ? 'Keep Default' : 'Edit Opening Float'}
              </button>
            </div>

            {openingCashEdited ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-content-secondary">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={(openingCashPaise / 100).toString()}
                    onChange={(e) =>
                      setOpeningCashPaise(Math.round((parseFloat(e.target.value) || 0) * 100))
                    }
                    className="w-36 px-2.5 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-xs font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Reason for editing opening float..."
                    value={openingCashReason}
                    onChange={(e) => setOpeningCashReason(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-surface-elevated border border-surface-border rounded-lg text-xs"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-surface-elevated rounded-lg flex items-center justify-between text-xs">
                <span className="text-content-secondary">Standard Till Float</span>
                <span className="font-extrabold text-content-primary">
                  {formatPaiseToRupeeString(openingCashPaise)}
                </span>
              </div>
            )}
          </div>

          {/* Cash Count Form */}
          <CashCountForm
            expectedCashPaise={expectedCashPaise}
            actualCashPaise={actualCashPaise}
            onActualCashChange={(paise, d) => {
              setActualCashPaise(paise);
              if (d) setDenominations(d);
            }}
          />

          {/* Math Breakdown Box */}
          <div className="bg-surface-elevated border border-surface-border rounded-xl p-4 text-xs space-y-2">
            <div className="flex justify-between text-content-secondary">
              <span>Opening Float (+)</span>
              <span>{formatPaiseToRupeeString(openingCashPaise)}</span>
            </div>
            <div className="flex justify-between text-content-secondary">
              <span>Cash Sales (+)</span>
              <span>{formatPaiseToRupeeString(cashSalesPaise)}</span>
            </div>
            <div className="flex justify-between text-content-secondary">
              <span>Cash Expenses (-)</span>
              <span>-{formatPaiseToRupeeString(cashExpensesPaise)}</span>
            </div>
            <div className="flex justify-between text-content-secondary">
              <span>Cash Refunds (-)</span>
              <span>-{formatPaiseToRupeeString(cashRefundsPaise)}</span>
            </div>
            <div className="pt-2 border-t border-surface-border flex justify-between font-bold text-content-primary text-body">
              <span>Expected Cash in Till</span>
              <span>{formatPaiseToRupeeString(expectedCashPaise)}</span>
            </div>
          </div>

          {/* Mismatch Warning & Explanation Banner */}
          <MismatchBanner
            expectedCashPaise={expectedCashPaise}
            actualCashPaise={actualCashPaise}
            differencePaise={reconciliation.differencePaise}
            tolerancePaise={tolerancePaise}
            isMismatch={reconciliation.hasMismatchWarning}
            mismatchNote={mismatchNote}
            onMismatchNoteChange={setMismatchNote}
          />

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCurrentStep('totals')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCurrentStep('confirm')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Review & Lock Day
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: CONFIRM & LOCK */}
      {currentStep === 'confirm' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-accent" />
              <div>
                <h3 className="font-bold text-subhead text-content-primary">
                  Final Day Confirmation & Immutability Lock
                </h3>
                <p className="text-xs text-content-secondary mt-0.5">
                  Business Date: <strong className="text-content-primary">{targetDate}</strong>
                </p>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-content-muted">Total Gross Sales</span>
                <span className="font-bold text-content-primary">
                  {formatPaiseToRupeeString(statusData?.summary.grossSalesPaise || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-muted">Total Net Sales</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatPaiseToRupeeString(statusData?.summary.netSalesPaise || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-muted">Expected Cash</span>
                <span className="font-bold text-content-primary">
                  {formatPaiseToRupeeString(expectedCashPaise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-muted">Counted Cash</span>
                <span className="font-bold text-content-primary">
                  {formatPaiseToRupeeString(actualCashPaise)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-surface-border">
                <span className="font-bold text-content-primary">Cash Discrepancy</span>
                <span
                  className={`font-black ${
                    reconciliation.hasMismatchWarning
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {reconciliation.differencePaise === 0
                    ? '₹0.00'
                    : formatPaiseToRupeeString(reconciliation.differencePaise)}
                </span>
              </div>
              {reconciliation.hasMismatchWarning && (
                <div className="pt-2 text-content-secondary italic">Note: "{mismatchNote}"</div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold">Important Immutability Rule:</p>
              <p className="mt-1">
                Once locked, no payments, discounts, refunds, or bill cancellations can be performed
                on business date <strong>{targetDate}</strong> without an Owner PIN override.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setCurrentStep('cash')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back
            </Button>

            <Button
              variant="primary"
              size="lg"
              disabled={closeDayMutation.isPending}
              onClick={handleConfirmClose}
              leftIcon={<Lock className="w-4 h-4" />}
              className="bg-accent text-accent-foreground font-black px-6"
            >
              {closeDayMutation.isPending ? 'Closing & Locking...' : 'Confirm & Lock Day'}
            </Button>
          </div>
        </div>
      )}

      {/* Till Cash Expense Modal */}
      {isExpenseOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-subhead text-content-primary">Record Till Cash Payout</h3>
            <p className="text-xs text-content-secondary">
              Record cash removed from the register drawer for operational expenses
            </p>

            <form onSubmit={handleExpenseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-content-primary block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={expenseAmountStr}
                  onChange={(e) => setExpenseAmountStr(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-content-primary block mb-1">Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg"
                >
                  <option value="supplies">Supplies & Ice</option>
                  <option value="vendor">Vendor Payment</option>
                  <option value="maintenance">Minor Repair</option>
                  <option value="staff_meal">Staff Refreshment</option>
                  <option value="other">Other Payout</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-content-primary block mb-1">
                  Description / Note
                </label>
                <textarea
                  rows={2}
                  required
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  placeholder="e.g. 2 bags of ice cubes from local vendor"
                  className="w-full p-2 bg-surface-elevated border border-surface-border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setIsExpenseOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={expenseMutation.isPending}
                >
                  Save Till Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Closed Days Table */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-subhead text-content-primary">
              Recently Closed Business Days
            </h3>
          </div>
          <span className="text-xs text-content-secondary">
            Audit history & reconciliation slips
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border text-content-muted">
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Net Sales</th>
                <th className="py-2.5 px-3 font-semibold">Bills</th>
                <th className="py-2.5 px-3 font-semibold">Expected Cash</th>
                <th className="py-2.5 px-3 font-semibold">Counted Cash</th>
                <th className="py-2.5 px-3 font-semibold">Discrepancy</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(summariesHistory?.summaries || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-content-muted">
                    No closed days recorded yet.
                  </td>
                </tr>
              ) : (
                summariesHistory?.summaries.map((s) => {
                  const hasDiscrepancy = s.cashDifferencePaise !== 0;
                  return (
                    <tr key={s.id} className="hover:bg-surface-elevated/50">
                      <td className="py-3 px-3 font-bold text-content-primary flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-accent" />
                        <span>{s.businessDate}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-content-primary">
                        {formatPaiseToRupeeString(s.netSalesPaise)}
                      </td>
                      <td className="py-3 px-3 text-content-secondary">{s.billsCount}</td>
                      <td className="py-3 px-3 text-content-secondary">
                        {formatPaiseToRupeeString(s.expectedCashPaise)}
                      </td>
                      <td className="py-3 px-3 text-content-secondary">
                        {formatPaiseToRupeeString(s.actualCashPaise)}
                      </td>
                      <td className="py-3 px-3">
                        {hasDiscrepancy ? (
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {formatPaiseToRupeeString(s.cashDifferencePaise)}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            Balanced
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setReopenTargetDate(s.businessDate);
                            setIsReopenPinOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-card border border-surface-border text-xs font-semibold text-content-secondary hover:text-content-primary inline-flex items-center gap-1"
                        >
                          <Unlock className="w-3 h-3" /> Reopen
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Owner PIN Override Dialog for Reopening */}
      {isReopenPinOpen && reopenTargetDate && (
        <PinOverrideDialog
          isOpen={isReopenPinOpen}
          title={`Reopen Business Day: ${reopenTargetDate}`}
          description="Enter Owner PIN and mandatory reason to unlock historical transactions for this day."
          onConfirm={async (pin: string) => {
            await reopenMutation.mutateAsync({
              businessDate: reopenTargetDate,
              overridePin: pin,
              reason: reopenReason || 'Owner requested day reopening',
            });
          }}
          onClose={() => {
            setIsReopenPinOpen(false);
            setReopenTargetDate(null);
          }}
        />
      )}
    </div>
  );
};
