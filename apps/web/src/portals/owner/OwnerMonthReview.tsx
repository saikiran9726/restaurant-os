import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { EstimateBadge } from '../../components/EstimateBadge.js';
import { ProfitWaterfall } from '../../components/ProfitWaterfall.js';
import { CompletenessChecklist } from '../../components/CompletenessChecklist.js';
import { FormulaPanel } from '../../components/FormulaPanel.js';
import {
  formatPaiseToRupeeString,
  type MonthlyReviewResponse,
  type MonthlyEvaluationSnapshotOutput,
} from '@restaurant-os/shared';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Save,
  Download,
  Printer,
  History,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Banknote,
  QrCode,
  Package,
} from 'lucide-react';

export const OwnerMonthReview: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState('');

  // Month navigation
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prev = new Date(year!, month! - 2, 1);
    setSelectedMonth(prev.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const next = new Date(year!, month!, 1);
    setSelectedMonth(next.toISOString().slice(0, 7));
  };

  // Queries
  const {
    data: reviewData,
    isLoading,
    isError,
    refetch,
  } = useQuery<MonthlyReviewResponse>({
    queryKey: ['month-review', selectedMonth],
    queryFn: () => apiFetch(`/reports/month-review?month=${selectedMonth}`),
  });

  const { data: snapshotsData, isLoading: isSnapshotsLoading } = useQuery<{
    snapshots: MonthlyEvaluationSnapshotOutput[];
  }>({
    queryKey: ['month-review-snapshots'],
    queryFn: () => apiFetch('/reports/month-review/snapshots'),
    enabled: isHistoryModalOpen,
  });

  // Mutations
  const saveSnapshotMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/reports/month-review/snapshot', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      addToast({
        type: 'success',
        message: `Saved evaluation snapshot v${data.snapshot.version} for ${selectedMonth}`,
      });
      setIsSaveModalOpen(false);
      setSnapshotNote('');
      queryClient.invalidateQueries({ queryKey: ['month-review'] });
      queryClient.invalidateQueries({ queryKey: ['month-review-snapshots'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to save snapshot: ${err.message}` });
    },
  });

  // CSV Export
  const handleExportCsv = () => {
    if (!reviewData) return;

    const rows: string[][] = [
      ['RESTOBAR MANAGEMENT PROFITABILITY EVALUATION'],
      ['Notice', 'Management Estimate - Internal Operational Use Only (Not Audited Tax Advice)'],
      ['Month', reviewData.month],
      ['Evaluated At', new Date().toISOString()],
      [],
      ['SUMMARY METRICS', 'AMOUNT (PAISE)', 'AMOUNT (INR)', 'NOTES'],
      [
        'Net Revenue',
        reviewData.revenuePaise.toString(),
        (reviewData.revenuePaise / 100).toFixed(2),
        'Excludes collected GST/VAT',
      ],
      [
        'Cost of Supplies',
        reviewData.suppliesCostPaise.toString(),
        (reviewData.suppliesCostPaise / 100).toFixed(2),
        `Method: ${reviewData.suppliesMethod}`,
      ],
      [
        'Operating Expenses',
        reviewData.operatingExpensesPaise.toString(),
        (reviewData.operatingExpensesPaise / 100).toFixed(2),
        'Rent, wages, electricity, overhead',
      ],
      [
        'Estimated Operating Profit',
        reviewData.estimatedProfitPaise.toString(),
        (reviewData.estimatedProfitPaise / 100).toFixed(2),
        'Revenue - Supplies - Expenses',
      ],
      [
        'Estimated Margin %',
        reviewData.profitMarginPercent !== null ? reviewData.profitMarginPercent.toString() : 'N/A',
        '',
        'Profit / Revenue',
      ],
      [
        'Supplies % of Revenue',
        reviewData.suppliesPercentOfRevenue !== null
          ? reviewData.suppliesPercentOfRevenue.toString()
          : 'N/A',
        '',
        '',
      ],
      [
        'Expenses % of Revenue',
        reviewData.expensesPercentOfRevenue !== null
          ? reviewData.expensesPercentOfRevenue.toString()
          : 'N/A',
        '',
        '',
      ],
      [
        'Logged Waste Cost',
        reviewData.wasteCostPaise.toString(),
        (reviewData.wasteCostPaise / 100).toFixed(2),
        'Tracked in supplies consumption',
      ],
      [],
      ['PAYMENT METHOD MIX', 'AMOUNT (PAISE)', 'AMOUNT (INR)'],
      [
        'Cash (Till)',
        reviewData.paymentMethodMix.cashPaise.toString(),
        (reviewData.paymentMethodMix.cashPaise / 100).toFixed(2),
      ],
      [
        'UPI / Dynamic QR',
        reviewData.paymentMethodMix.upiPaise.toString(),
        (reviewData.paymentMethodMix.upiPaise / 100).toFixed(2),
      ],
      [
        'Card / POS',
        reviewData.paymentMethodMix.cardPaise.toString(),
        (reviewData.paymentMethodMix.cardPaise / 100).toFixed(2),
      ],
      [],
      [
        'EXPENSE BREAKDOWN BY CATEGORY',
        'OPERATING FLAG',
        'CURRENT MONTH (INR)',
        'PREV MONTH (INR)',
        'CHANGE %',
        'ENTRIES',
      ],
      ...reviewData.categoryTotals.map((c) => [
        c.categoryName,
        c.countsAsOperating ? 'Operating' : 'Direct Supplies (Non-operating)',
        (c.currentMonthPaise / 100).toFixed(2),
        (c.previousMonthPaise / 100).toFixed(2),
        c.changePercent !== null ? `${c.changePercent}%` : 'N/A',
        c.count.toString(),
      ]),
      [],
      ['DATA COMPLETENESS STATUS'],
      ['Completeness Score', `${reviewData.completeness.completenessPercent}%`],
      [
        'Closed Days',
        `${reviewData.completeness.closedDaysCount} / ${reviewData.completeness.daysInMonth}`,
      ],
      ['Rent Recorded', reviewData.completeness.hasRentExpense ? 'Yes' : 'No'],
      ['Salaries Recorded', reviewData.completeness.hasSalariesExpense ? 'Yes' : 'No'],
      ['Utilities Recorded', reviewData.completeness.hasUtilitiesExpense ? 'Yes' : 'No'],
      ['Closing Stock Verified', reviewData.completeness.hasClosingStockCount ? 'Yes' : 'No'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `profitability_evaluation_${reviewData.month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:max-w-none print:m-0">
      {/* Top Header & Disclaimers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-title font-extrabold text-content-primary">
              Estimated Monthly Profitability
            </h2>
            <EstimateBadge size="md" />
          </div>
          <p className="text-body text-content-secondary mt-0.5">
            Internal executive review combining net sales, food/supplies cost, waste, and operating
            overhead.
          </p>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex items-center gap-2 bg-surface-card p-1.5 rounded-xl border border-surface-border shadow-sm">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-surface-elevated text-content-secondary hover:text-content-primary transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-4 h-4 text-accent" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-content-primary focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-lg hover:bg-surface-elevated text-content-secondary hover:text-content-primary transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prominent Non-Audited Legal Notice */}
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold block">Management Estimate Notice</span>
          <span>
            This report is an internal operational estimate calculated from daily register sales,
            entered supplier invoices, logged inventory waste, and recorded expenses. It does not
            constitute audited accounting records, statutory balance sheets, or official tax
            returns.
          </span>
        </div>
      </div>

      {/* Action Toolbar (hidden on print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center gap-1.5 font-bold"
            disabled={!reviewData}
          >
            <Save className="w-4 h-4" /> Save Snapshot
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <History className="w-4 h-4" /> Snapshot History
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/owner/expenses')}
            className="flex items-center gap-1.5 text-content-secondary hover:text-content-primary"
          >
            <Receipt className="w-4 h-4" /> Manage Expenses
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleExportCsv}
            disabled={!reviewData}
            className="flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export CSV
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={handlePrint}
            disabled={!reviewData}
            className="flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Print Report
          </Button>
        </div>
      </div>

      {/* Loading or Error State */}
      {isLoading ? (
        <div className="p-16 text-center text-content-muted bg-surface-card rounded-xl border border-surface-border">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Calculating monthly financial review for {selectedMonth}...</span>
        </div>
      ) : isError || !reviewData ? (
        <div className="p-12 text-center text-danger bg-surface-card rounded-xl border border-danger/30">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <h3 className="font-bold text-subhead">Failed to load monthly review</h3>
          <p className="text-xs text-content-secondary mt-1">
            Ensure the API service is reachable and dates are valid.
          </p>
          <Button type="button" variant="secondary" onClick={() => refetch()} className="mt-4">
            Retry Calculation
          </Button>
        </div>
      ) : (
        <>
          {/* Data Completeness Checklist */}
          <CompletenessChecklist checklist={reviewData.completeness} />

          {/* 4-Step Profit Waterfall */}
          <ProfitWaterfall
            revenuePaise={reviewData.revenuePaise}
            suppliesCostPaise={reviewData.suppliesCostPaise}
            operatingExpensesPaise={reviewData.operatingExpensesPaise}
            estimatedProfitPaise={reviewData.estimatedProfitPaise}
            profitMarginPercent={reviewData.profitMarginPercent}
          />

          {/* Key KPI Ratios Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Revenue */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
              <span className="text-xs text-content-secondary font-semibold">Net Revenue</span>
              <div className="mt-2">
                <span className="text-headline font-black text-content-primary block">
                  {formatPaiseToRupeeString(reviewData.revenuePaise)}
                </span>
                <span className="text-[11px] text-content-muted block mt-0.5">
                  Excludes collected GST / service charge
                </span>
              </div>
            </div>

            {/* Cost of Supplies */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-content-secondary">
                <span className="font-semibold">Cost of Supplies</span>
                {reviewData.suppliesPercentOfRevenue !== null && (
                  <span className="text-[11px] font-bold text-amber-600">
                    {reviewData.suppliesPercentOfRevenue}% rev
                  </span>
                )}
              </div>
              <div className="mt-2">
                <span className="text-headline font-black text-amber-600 dark:text-amber-400 block">
                  {formatPaiseToRupeeString(reviewData.suppliesCostPaise)}
                </span>
                <span className="text-[11px] text-content-muted block mt-0.5 capitalize">
                  Method: {reviewData.suppliesMethod}
                </span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-content-secondary">
                <span className="font-semibold">Operating Expenses</span>
                {reviewData.expensesPercentOfRevenue !== null && (
                  <span className="text-[11px] font-bold text-amber-600">
                    {reviewData.expensesPercentOfRevenue}% rev
                  </span>
                )}
              </div>
              <div className="mt-2">
                <span className="text-headline font-black text-amber-600 dark:text-amber-400 block">
                  {formatPaiseToRupeeString(reviewData.operatingExpensesPaise)}
                </span>
                <span className="text-[11px] text-content-muted block mt-0.5">
                  Rent, payroll, power, overhead
                </span>
              </div>
            </div>

            {/* Operating Margin */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-content-secondary">
                <span className="font-semibold">Operating Margin</span>
                <EstimateBadge size="sm" />
              </div>
              <div className="mt-2">
                <span
                  className={`text-headline font-black block ${
                    reviewData.estimatedProfitPaise >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {reviewData.profitMarginPercent !== null
                    ? `${reviewData.profitMarginPercent}%`
                    : 'N/A'}
                </span>
                <span className="text-[11px] text-content-muted block mt-0.5">
                  Est. profit {formatPaiseToRupeeString(reviewData.estimatedProfitPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Costing Method Details & Waste Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplies Costing Details */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-subhead text-content-primary">
                    Supplies Costing Method
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-accent/10 text-accent">
                  {reviewData.suppliesMethod}
                </span>
              </div>

              <p className="text-xs text-content-secondary leading-relaxed">
                {reviewData.suppliesMethodReason}
              </p>

              {reviewData.wasteCostPaise > 0 && (
                <div className="p-3 bg-surface-elevated rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-content-primary block">
                      Logged Kitchen Waste
                    </span>
                    <span className="text-[11px] text-content-muted">
                      Tracked inside supplies consumption (not double-counted)
                    </span>
                  </div>
                  <span className="font-black text-amber-600">
                    {formatPaiseToRupeeString(reviewData.wasteCostPaise)}
                  </span>
                </div>
              )}
            </div>

            {/* Previous Month Comparison */}
            <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-subhead text-content-primary">
                    Previous Month Comparison
                  </h3>
                </div>
                {reviewData.previousMonthComparison && (
                  <span className="text-xs font-mono font-bold text-content-secondary">
                    vs {reviewData.previousMonthComparison.prevMonth}
                  </span>
                )}
              </div>

              {reviewData.previousMonthComparison ? (
                <div className="space-y-3 text-xs">
                  <p className="text-content-secondary leading-relaxed font-medium">
                    {reviewData.previousMonthComparison.explanation}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 bg-surface-elevated rounded-lg">
                      <span className="text-[10px] text-content-muted block">Prev. Revenue</span>
                      <span className="font-bold text-content-primary">
                        {formatPaiseToRupeeString(
                          reviewData.previousMonthComparison.prevRevenuePaise,
                        )}
                      </span>
                    </div>

                    <div className="p-2 bg-surface-elevated rounded-lg">
                      <span className="text-[10px] text-content-muted block">Prev. Supplies</span>
                      <span className="font-bold text-content-primary">
                        {formatPaiseToRupeeString(
                          reviewData.previousMonthComparison.prevSuppliesCostPaise,
                        )}
                      </span>
                    </div>

                    <div className="p-2 bg-surface-elevated rounded-lg">
                      <span className="text-[10px] text-content-muted block">Prev. Profit</span>
                      <span className="font-bold text-content-primary">
                        {formatPaiseToRupeeString(
                          reviewData.previousMonthComparison.prevProfitPaise,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-content-muted pt-2">
                  No historical records available for the previous month to compare against.
                </p>
              )}
            </div>
          </div>

          {/* Payment Method Mix */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-subhead text-content-primary">
              Customer Settlement Tender Mix
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Cash */}
              <div className="p-3.5 bg-surface-elevated rounded-xl border border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Banknote className="w-5 h-5 text-emerald-500" />
                  <div>
                    <span className="font-bold text-content-primary block">Cash (Till)</span>
                    <span className="text-[11px] text-content-muted">Reconciled at Day Close</span>
                  </div>
                </div>
                <span className="font-black text-content-primary">
                  {formatPaiseToRupeeString(reviewData.paymentMethodMix.cashPaise)}
                </span>
              </div>

              {/* UPI */}
              <div className="p-3.5 bg-surface-elevated rounded-xl border border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <QrCode className="w-5 h-5 text-accent" />
                  <div>
                    <span className="font-bold text-content-primary block">UPI / QR Code</span>
                    <span className="text-[11px] text-content-muted">Instant Bank Credit</span>
                  </div>
                </div>
                <span className="font-black text-content-primary">
                  {formatPaiseToRupeeString(reviewData.paymentMethodMix.upiPaise)}
                </span>
              </div>

              {/* Card */}
              <div className="p-3.5 bg-surface-elevated rounded-xl border border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  <div>
                    <span className="font-bold text-content-primary block">Card / POS</span>
                    <span className="text-[11px] text-content-muted">Terminal settlements</span>
                  </div>
                </div>
                <span className="font-black text-content-primary">
                  {formatPaiseToRupeeString(reviewData.paymentMethodMix.cardPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* Category-by-Category Spend Breakdown */}
          <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-surface-border bg-surface-elevated flex items-center justify-between">
              <div>
                <h3 className="font-bold text-subhead text-content-primary">
                  Expense Category Breakdown
                </h3>
                <p className="text-xs text-content-secondary">
                  Overhead tracking across all 12 operational and supply accounts
                </p>
              </div>
              <span className="text-xs text-content-muted">
                {reviewData.categoryTotals.length} categories active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-content-secondary">
                <thead className="bg-surface-elevated/50 text-content-primary font-bold border-b border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4 text-center">Entries</th>
                    <th className="py-3 px-4 text-right">Current Month</th>
                    <th className="py-3 px-4 text-right">Prev Month</th>
                    <th className="py-3 px-4 text-right">MoM Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {reviewData.categoryTotals.map((cat) => (
                    <tr key={cat.categoryId} className="hover:bg-surface-elevated/40">
                      <td className="py-3 px-4 font-bold text-content-primary">
                        {cat.categoryName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cat.countsAsOperating
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-blue-500/10 text-blue-600'
                          }`}
                        >
                          {cat.countsAsOperating
                            ? 'Operating Overhead'
                            : 'Direct Supplies (Non-operating)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{cat.count}</td>
                      <td className="py-3 px-4 text-right font-black text-content-primary">
                        {formatPaiseToRupeeString(cat.currentMonthPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-content-muted">
                        {formatPaiseToRupeeString(cat.previousMonthPaise)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold">
                        {cat.changePercent === null ? (
                          <span className="text-content-muted">—</span>
                        ) : cat.changePercent > 0 ? (
                          <span className="text-amber-600">+{cat.changePercent}%</span>
                        ) : cat.changePercent < 0 ? (
                          <span className="text-emerald-600">{cat.changePercent}%</span>
                        ) : (
                          <span className="text-content-muted">0%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formula & Assumptions Panel */}
          <FormulaPanel
            suppliesMethod={reviewData.suppliesMethod}
            suppliesMethodReason={reviewData.suppliesMethodReason}
          />
        </>
      )}

      {/* SAVE SNAPSHOT MODAL */}
      {isSaveModalOpen && (
        <Dialog
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          title={`Save Snapshot for ${selectedMonth}`}
          size="md"
        >
          <div className="space-y-4 text-xs pt-1">
            <p className="text-content-secondary leading-relaxed">
              Saving a snapshot freezes a versioned record of this evaluation (v1, v2, etc.) with
              timestamp and your user identifier for historical audit and tax preparation reference.
            </p>

            <div>
              <label className="font-bold text-content-primary block mb-1">
                Audit Note (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Final month close after reconciling BESCOM bill and staff bonuses"
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                className="w-full p-2.5 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <Button type="button" variant="ghost" onClick={() => setIsSaveModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                isLoading={saveSnapshotMutation.isPending}
                onClick={() =>
                  saveSnapshotMutation.mutate({
                    month: selectedMonth,
                    note: snapshotNote.trim() || undefined,
                  })
                }
                className="font-bold"
              >
                Save Evaluation Snapshot
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* SNAPSHOT HISTORY MODAL */}
      {isHistoryModalOpen && (
        <Dialog
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title="Saved Evaluation Snapshots"
          size="lg"
        >
          <div className="space-y-4 text-xs pt-1">
            <p className="text-content-secondary">
              Immutable versioned evaluations preserved across all months for this restaurant.
            </p>

            <div className="border border-surface-border rounded-lg overflow-hidden max-h-80 overflow-y-auto divide-y divide-surface-border">
              {isSnapshotsLoading ? (
                <div className="p-6 text-center text-content-muted">Loading snapshots...</div>
              ) : (snapshotsData?.snapshots || []).length === 0 ? (
                <div className="p-8 text-center text-content-muted">
                  No saved snapshots yet. Click "Save Snapshot" to freeze a month's evaluation.
                </div>
              ) : (
                (snapshotsData?.snapshots || []).map((s) => (
                  <div key={s.id} className="p-3.5 space-y-1.5 hover:bg-surface-elevated/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-accent text-sm">{s.month}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-surface-elevated text-content-secondary border border-surface-border">
                          Version {s.version}
                        </span>
                        <span className="text-emerald-600 font-bold text-[10px]">
                          {s.completenessPercent}% complete
                        </span>
                      </div>

                      <span className="text-[11px] text-content-muted">
                        {new Date(s.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-content-secondary text-[11px]">
                      <span>
                        Revenue: <strong>{formatPaiseToRupeeString(s.revenuePaise)}</strong>
                      </span>
                      <span>
                        Supplies: <strong>{formatPaiseToRupeeString(s.suppliesCostPaise)}</strong>
                      </span>
                      <span>
                        Overhead:{' '}
                        <strong>{formatPaiseToRupeeString(s.operatingExpensesPaise)}</strong>
                      </span>
                      <span>
                        Profit:{' '}
                        <strong
                          className={
                            s.estimatedProfitPaise >= 0 ? 'text-emerald-600' : 'text-danger'
                          }
                        >
                          {formatPaiseToRupeeString(s.estimatedProfitPaise)} (
                          {s.profitMarginPercent ?? 'N/A'}%)
                        </strong>
                      </span>
                    </div>

                    {s.note && (
                      <div className="text-[11px] text-content-muted italic bg-surface-elevated p-2 rounded">
                        "{s.note}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-surface-border">
              <Button type="button" variant="ghost" onClick={() => setIsHistoryModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
