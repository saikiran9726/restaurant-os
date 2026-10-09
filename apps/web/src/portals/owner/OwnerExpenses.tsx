import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import {
  formatPaiseToRupeeString,
  rupeesToPaise,
  paiseToRupees,
  type ExpenseOutput,
  type ExpenseCategoryOutput,
  type PaymentSource,
  PAYMENT_SOURCES,
} from '@restaurant-os/shared';
import {
  Receipt,
  Plus,
  Copy,
  Settings2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Info,
  DollarSign,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const OwnerExpenses: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  // Current month state (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentSourceFilter, setPaymentSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Selected expense for edit/delete
  const [activeExpense, setActiveExpense] = useState<ExpenseOutput | null>(null);

  // Add / Edit form state
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formAmountRupees, setFormAmountRupees] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formDescription, setFormDescription] = useState<string>('');
  const [formReference, setFormReference] = useState<string>('');
  const [formPaymentSource, setFormPaymentSource] = useState<PaymentSource>('upi');
  const [formEditReason, setFormEditReason] = useState<string>('');

  // Copy recurring state
  const [copySourceMonth, setCopySourceMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  const [selectedRecurringIds, setSelectedRecurringIds] = useState<string[]>([]);
  const [copyTargetDate, setCopyTargetDate] = useState<string>(() => {
    return `${new Date().toISOString().slice(0, 7)}-01`;
  });

  // Category management form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');
  const [newCatCountsAsOperating, setNewCatCountsAsOperating] = useState(true);

  // Month navigation helpers
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
  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery<{
    categories: ExpenseCategoryOutput[];
  }>({
    queryKey: ['expense-categories'],
    queryFn: () => apiFetch('/expense-categories'),
  });

  const { data: expensesData, isLoading: isExpensesLoading } = useQuery<{
    expenses: ExpenseOutput[];
  }>({
    queryKey: ['expenses', selectedMonth],
    queryFn: () => apiFetch(`/expenses?month=${selectedMonth}`),
  });

  const { data: sourceMonthExpensesData, isLoading: isSourceExpensesLoading } = useQuery<{
    expenses: ExpenseOutput[];
  }>({
    queryKey: ['expenses', copySourceMonth],
    queryFn: () => apiFetch(`/expenses?month=${copySourceMonth}`),
    enabled: isCopyModalOpen,
  });

  const categories = categoriesData?.categories || [];
  const expenses = expensesData?.expenses || [];

  // Compute stats
  const stats = useMemo(() => {
    let totalPaise = 0;
    let operatingPaise = 0;
    let nonOperatingPaise = 0;

    for (const exp of expenses) {
      totalPaise += exp.amountPaise;
      if (exp.countsAsOperating) {
        operatingPaise += exp.amountPaise;
      } else {
        nonOperatingPaise += exp.amountPaise;
      }
    }

    return {
      totalPaise,
      operatingPaise,
      nonOperatingPaise,
      operatingPercent: totalPaise > 0 ? Math.round((operatingPaise / totalPaise) * 100) : 0,
    };
  }, [expenses]);

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (categoryFilter !== 'all' && exp.categoryId !== categoryFilter) {
        return false;
      }
      if (paymentSourceFilter !== 'all' && exp.paymentSource !== paymentSourceFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesDesc = exp.description.toLowerCase().includes(query);
        const matchesRef = exp.reference ? exp.reference.toLowerCase().includes(query) : false;
        const matchesCategory = exp.categoryName.toLowerCase().includes(query);
        if (!matchesDesc && !matchesRef && !matchesCategory) {
          return false;
        }
      }
      return true;
    });
  }, [expenses, categoryFilter, paymentSourceFilter, searchQuery]);

  // Mutations
  const createExpenseMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Expense logged successfully' });
      setIsAddModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['month-review'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to log expense: ${err.message}` });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      apiFetch(`/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Expense updated successfully' });
      setIsEditModalOpen(false);
      setActiveExpense(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['month-review'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to update expense: ${err.message}` });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/expenses/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Expense deleted' });
      setIsDeleteModalOpen(false);
      setActiveExpense(null);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['month-review'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to delete expense: ${err.message}` });
    },
  });

  const copyRecurringMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/expenses/copy-recurring', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data: any) => {
      addToast({
        type: 'success',
        message: `Copied ${data.copiedCount} recurring expenses into ${selectedMonth}`,
      });
      setIsCopyModalOpen(false);
      setSelectedRecurringIds([]);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['month-review'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to copy expenses: ${err.message}` });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (body: any) =>
      apiFetch('/expense-categories', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Category added' });
      setNewCatName('');
      setNewCatDescription('');
      setNewCatCountsAsOperating(true);
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to add category: ${err.message}` });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      apiFetch(`/expense-categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Category updated' });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['month-review'] });
    },
    onError: (err: any) => {
      addToast({ type: 'danger', message: `Failed to update category: ${err.message}` });
    },
  });

  const resetForm = () => {
    setFormCategoryId(categories[0]?.id || '');
    setFormAmountRupees('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormDescription('');
    setFormReference('');
    setFormPaymentSource('upi');
    setFormEditReason('');
  };

  const openAddModal = () => {
    resetForm();
    if (categories.length > 0 && !formCategoryId) {
      setFormCategoryId(categories[0]!.id);
    }
    setIsAddModalOpen(true);
  };

  const openEditModal = (exp: ExpenseOutput) => {
    setActiveExpense(exp);
    setFormCategoryId(exp.categoryId);
    setFormAmountRupees(paiseToRupees(exp.amountPaise).toString());
    setFormDate(exp.expenseDate);
    setFormDescription(exp.description);
    setFormReference(exp.reference || '');
    setFormPaymentSource(exp.paymentSource);
    setFormEditReason('');
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (exp: ExpenseOutput) => {
    setActiveExpense(exp);
    setIsDeleteModalOpen(true);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = rupeesToPaise(Number(formAmountRupees));
    if (!amountPaise || amountPaise <= 0) {
      addToast({ type: 'danger', message: 'Amount must be greater than zero' });
      return;
    }
    if (!formCategoryId) {
      addToast({ type: 'danger', message: 'Please select an expense category' });
      return;
    }
    if (!formDescription.trim()) {
      addToast({ type: 'danger', message: 'Description is required' });
      return;
    }

    createExpenseMutation.mutate({
      categoryId: formCategoryId,
      amountPaise,
      expenseDate: formDate,
      description: formDescription.trim(),
      reference: formReference.trim() || undefined,
      paymentSource: formPaymentSource,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExpense) return;
    const amountPaise = rupeesToPaise(Number(formAmountRupees));
    if (!amountPaise || amountPaise <= 0) {
      addToast({ type: 'danger', message: 'Amount must be greater than zero' });
      return;
    }
    if (!formEditReason.trim() || formEditReason.trim().length < 3) {
      addToast({ type: 'danger', message: 'Please provide a valid edit reason (min 3 chars)' });
      return;
    }

    updateExpenseMutation.mutate({
      id: activeExpense.id,
      body: {
        categoryId: formCategoryId,
        amountPaise,
        expenseDate: formDate,
        description: formDescription.trim(),
        reference: formReference.trim() || null,
        paymentSource: formPaymentSource,
        editReason: formEditReason.trim(),
      },
    });
  };

  const handleCopyRecurringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecurringIds.length === 0) {
      addToast({ type: 'danger', message: 'Select at least one expense to copy' });
      return;
    }

    copyRecurringMutation.mutate({
      sourceMonth: copySourceMonth,
      targetMonth: selectedMonth,
      expenseIds: selectedRecurringIds,
      targetDate: copyTargetDate,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Month Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-title font-extrabold text-content-primary">Operating Expenses</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent/10 text-accent">
              Phase 13
            </span>
          </div>
          <p className="text-body text-content-secondary mt-0.5">
            Log overhead, rent, wages, power, and view operating cost breakdown.
          </p>
        </div>

        {/* Month Selector & Quick Navigation */}
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

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={openAddModal}
            className="flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsCopyModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Copy className="w-4 h-4" /> Copy Recurring
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 text-content-secondary hover:text-content-primary"
          >
            <Settings2 className="w-4 h-4" /> Categories
          </Button>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/owner/month-review')}
          className="flex items-center gap-1.5 font-bold text-accent border-accent/30 hover:bg-accent/10"
        >
          View Month Review <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Expenses */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-content-secondary">
            <span className="font-semibold">Total Logged Expenses</span>
            <Receipt className="w-4 h-4 text-content-muted" />
          </div>
          <div className="mt-2">
            <span className="text-headline font-black text-content-primary block">
              {formatPaiseToRupeeString(stats.totalPaise)}
            </span>
            <span className="text-xs text-content-muted">
              {expenses.length} entries for {selectedMonth}
            </span>
          </div>
        </div>

        {/* Operating Overhead Portion */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-content-secondary">
            <span className="font-semibold">Operating Overhead</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-600">
              {stats.operatingPercent}% of total
            </span>
          </div>
          <div className="mt-2">
            <span className="text-headline font-black text-amber-600 dark:text-amber-400 block">
              {formatPaiseToRupeeString(stats.operatingPaise)}
            </span>
            <span className="text-xs text-content-muted">
              Rent, wages, electricity, maintenance
            </span>
          </div>
        </div>

        {/* Direct Supplies / Non-Operating */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-content-secondary">
            <span className="font-semibold">Supplies & Non-Operating</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/10 text-blue-600">
              Not Double-Counted
            </span>
          </div>
          <div className="mt-2">
            <span className="text-headline font-black text-content-primary block">
              {formatPaiseToRupeeString(stats.nonOperatingPaise)}
            </span>
            <span className="text-xs text-content-muted">
              Direct till purchases (accounted in supply cost)
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search description or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-elevated rounded-lg border border-surface-border text-xs text-content-primary placeholder-content-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Category & Payment Source Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-content-muted" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-surface-elevated border border-surface-border text-content-primary rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.countsAsOperating ? '' : '(Supplies)'}
                </option>
              ))}
            </select>
          </div>

          <select
            value={paymentSourceFilter}
            onChange={(e) => setPaymentSourceFilter(e.target.value)}
            className="bg-surface-elevated border border-surface-border text-content-primary rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="all">All Payment Sources</option>
            {PAYMENT_SOURCES.map((source) => (
              <option key={source} value={source}>
                Source: {source.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Data Table */}
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-content-secondary">
            <thead className="bg-surface-elevated text-content-primary font-bold border-b border-surface-border">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Payment Source</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {isExpensesLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-content-muted">
                    Loading expenses for {selectedMonth}...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-content-muted">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No expenses logged for this period. Click "Add Expense" to record overhead.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-content-primary">
                      {exp.expenseDate}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-content-primary">{exp.categoryName}</span>
                        {!exp.countsAsOperating && (
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600"
                            title="Direct supplies (excluded from operating overhead to avoid double-counting)"
                          >
                            Supplies
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-content-primary font-medium">{exp.description}</div>
                      {exp.paidFromTill && (
                        <span className="text-[10px] text-amber-600 font-semibold block">
                          Paid from register till
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-content-muted">
                      {exp.reference || '—'}
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-surface-elevated text-content-secondary border border-surface-border">
                        {exp.paymentSource}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-black text-content-primary">
                      {formatPaiseToRupeeString(exp.amountPaise)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          className="p-1.5 rounded hover:bg-surface-elevated text-content-secondary hover:text-content-primary transition-colors"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(exp)}
                          className="p-1.5 rounded hover:bg-danger/10 text-content-secondary hover:text-danger transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK ADD EXPENSE MODAL (< 10s entry) */}
      {isAddModalOpen && (
        <Dialog
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Quick Add Expense"
          size="md"
        >
          <form onSubmit={handleAddSubmit} className="space-y-4 text-xs pt-1">
            {/* Amount & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-content-primary block mb-1">Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    autoFocus
                    required
                    placeholder="e.g. 35000"
                    value={formAmountRupees}
                    onChange={(e) => setFormAmountRupees(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-body font-black text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-content-primary block mb-1">Category *</label>
                <select
                  required
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.countsAsOperating ? '' : '(Supplies - non-operating)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Payment Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-content-primary block mb-1">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-bold text-content-primary block mb-1">Payment Method</label>
                <select
                  value={formPaymentSource}
                  onChange={(e) => setFormPaymentSource(e.target.value as PaymentSource)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="upi">UPI / Online</option>
                  <option value="bank">Bank Transfer / NEFT</option>
                  <option value="till">Cash Register (Till)</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="font-bold text-content-primary block mb-1">Description *</label>
              <input
                type="text"
                required
                placeholder="e.g. Monthly restaurant rent or Power bill"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Reference (Optional) */}
            <div>
              <label className="font-bold text-content-primary block mb-1">
                Reference / Bill # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. BESCOM-883491 or UPI Ref 38291..."
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAddModalOpen(false)}
                disabled={createExpenseMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createExpenseMutation.isPending}
                className="font-bold"
              >
                Save Expense
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* EDIT EXPENSE MODAL */}
      {isEditModalOpen && activeExpense && (
        <Dialog
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Expense"
          size="md"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-content-primary block mb-1">Amount (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formAmountRupees}
                    onChange={(e) => setFormAmountRupees(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-body font-black text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-content-primary block mb-1">Category *</label>
                <select
                  required
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.countsAsOperating ? '' : '(Supplies)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-content-primary block mb-1">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div>
                <label className="font-bold text-content-primary block mb-1">Payment Method</label>
                <select
                  value={formPaymentSource}
                  onChange={(e) => setFormPaymentSource(e.target.value as PaymentSource)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="upi">UPI / Online</option>
                  <option value="bank">Bank Transfer / NEFT</option>
                  <option value="till">Cash Register (Till)</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-content-primary block mb-1">Description *</label>
              <input
                type="text"
                required
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div>
              <label className="font-bold text-content-primary block mb-1">Reference</label>
              <input
                type="text"
                value={formReference}
                onChange={(e) => setFormReference(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-border rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Audit Edit Reason */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5">
              <label className="font-bold text-amber-800 dark:text-amber-300 block flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Reason for Modification (Required for Audit) *
              </label>
              <input
                type="text"
                required
                minLength={3}
                placeholder="e.g. Corrected invoice amount mismatch"
                value={formEditReason}
                onChange={(e) => setFormEditReason(e.target.value)}
                className="w-full px-3 py-2 bg-surface-card border border-amber-500/40 rounded-lg text-content-primary focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditModalOpen(false)}
                disabled={updateExpenseMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={updateExpenseMutation.isPending}
                className="font-bold"
              >
                Update Expense
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* DELETE CONFIRMATION */}
      {isDeleteModalOpen && activeExpense && (
        <ConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={() => deleteExpenseMutation.mutate(activeExpense.id)}
          title="Delete Expense"
          description={`Are you sure you want to delete "${activeExpense.description}" (${formatPaiseToRupeeString(activeExpense.amountPaise)})? This action is tracked in the audit trail.`}
          confirmLabel="Delete Expense"
          variant="danger"
          isLoading={deleteExpenseMutation.isPending}
        />
      )}

      {/* COPY RECURRING MODAL */}
      {isCopyModalOpen && (
        <Dialog
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          title="Copy Last Month's Recurring Expenses"
          size="lg"
        >
          <form onSubmit={handleCopyRecurringSubmit} className="space-y-4 text-xs pt-1">
            <p className="text-content-secondary">
              Copy standard monthly bills (Rent, Salaries, Internet, Maintenance) from a previous
              month into <strong className="text-content-primary">{selectedMonth}</strong> without
              manual re-entry.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-elevated p-3 rounded-lg border border-surface-border">
              <div>
                <label className="font-bold text-content-primary block mb-1">Source Month</label>
                <input
                  type="month"
                  value={copySourceMonth}
                  onChange={(e) => {
                    setCopySourceMonth(e.target.value);
                    setSelectedRecurringIds([]);
                  }}
                  className="w-full px-3 py-2 bg-surface-card border border-surface-border rounded-lg text-content-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-content-primary block mb-1">
                  Target Date in {selectedMonth}
                </label>
                <input
                  type="date"
                  value={copyTargetDate}
                  onChange={(e) => setCopyTargetDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-card border border-surface-border rounded-lg text-content-primary focus:outline-none"
                />
              </div>
            </div>

            {/* List of items from source month */}
            <div className="border border-surface-border rounded-lg overflow-hidden">
              <div className="bg-surface-elevated px-3 py-2 font-bold text-content-primary flex justify-between items-center">
                <span>Select expenses to copy ({selectedRecurringIds.length} selected):</span>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = (sourceMonthExpensesData?.expenses || []).map((e) => e.id);
                    if (selectedRecurringIds.length === allIds.length) {
                      setSelectedRecurringIds([]);
                    } else {
                      setSelectedRecurringIds(allIds);
                    }
                  }}
                  className="text-xs text-accent hover:underline font-bold"
                >
                  {selectedRecurringIds.length === (sourceMonthExpensesData?.expenses || []).length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-surface-border">
                {isSourceExpensesLoading ? (
                  <div className="p-4 text-center text-content-muted">
                    Loading source expenses...
                  </div>
                ) : (sourceMonthExpensesData?.expenses || []).length === 0 ? (
                  <div className="p-4 text-center text-content-muted">
                    No expenses found in source month {copySourceMonth}.
                  </div>
                ) : (
                  (sourceMonthExpensesData?.expenses || []).map((exp) => {
                    const isChecked = selectedRecurringIds.includes(exp.id);
                    return (
                      <label
                        key={exp.id}
                        className="px-3 py-2 flex items-center justify-between hover:bg-surface-elevated cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecurringIds([...selectedRecurringIds, exp.id]);
                              } else {
                                setSelectedRecurringIds(
                                  selectedRecurringIds.filter((id) => id !== exp.id),
                                );
                              }
                            }}
                            className="rounded border-surface-border text-accent focus:ring-accent"
                          />
                          <div>
                            <span className="font-bold text-content-primary block">
                              {exp.description}
                            </span>
                            <span className="text-[10px] text-content-muted">
                              {exp.categoryName} • {exp.expenseDate}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-content-primary">
                          {formatPaiseToRupeeString(exp.amountPaise)}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border">
              <Button type="button" variant="ghost" onClick={() => setIsCopyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={selectedRecurringIds.length === 0}
                isLoading={copyRecurringMutation.isPending}
                className="font-bold"
              >
                Copy {selectedRecurringIds.length} Expenses
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* CATEGORY SETTINGS MODAL */}
      {isCategoryModalOpen && (
        <Dialog
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title="Expense Categories Settings"
          size="lg"
        >
          <div className="space-y-5 text-xs pt-1">
            <div className="p-3 bg-surface-elevated rounded-lg text-content-secondary space-y-1">
              <strong className="text-content-primary block">
                Operating Overhead Classification:
              </strong>
              <p>
                Categories flagged as{' '}
                <strong className="text-emerald-600">Counts as Operating</strong> are summed into
                the monthly operating overhead. Categories flagged as Supplies / Direct Cash are
                excluded to prevent double-counting against recorded inventory supplier purchases.
              </p>
            </div>

            {/* Existing Categories Table */}
            <div className="border border-surface-border rounded-lg overflow-hidden">
              <div className="bg-surface-elevated px-3 py-2 font-bold text-content-primary">
                Configured Categories ({categories.length})
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-surface-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-content-primary">{cat.name}</span>
                        {!cat.active && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-600 font-bold">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-content-muted">
                        {cat.description || 'No description'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={cat.countsAsOperating}
                          onChange={(e) =>
                            updateCategoryMutation.mutate({
                              id: cat.id,
                              body: { countsAsOperating: e.target.checked },
                            })
                          }
                          className="rounded text-accent focus:ring-accent"
                        />
                        <span
                          className={
                            cat.countsAsOperating
                              ? 'text-emerald-600 font-bold'
                              : 'text-blue-600 font-bold'
                          }
                        >
                          {cat.countsAsOperating ? 'Operating' : 'Supplies (Excl.)'}
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Category Form */}
            <div className="p-3 bg-surface-elevated rounded-lg border border-surface-border space-y-3">
              <h4 className="font-bold text-content-primary">Add Custom Category</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Category Name (e.g. Laundry)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-content-primary"
                />
                <input
                  type="text"
                  placeholder="Description (Optional)"
                  value={newCatDescription}
                  onChange={(e) => setNewCatDescription(e.target.value)}
                  className="px-3 py-1.5 bg-surface-card border border-surface-border rounded-lg text-content-primary"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCatCountsAsOperating}
                    onChange={(e) => setNewCatCountsAsOperating(e.target.checked)}
                    className="rounded text-accent focus:ring-accent"
                  />
                  <span>Counts as Operating Overhead in Profitability</span>
                </label>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!newCatName.trim()}
                  isLoading={createCategoryMutation.isPending}
                  onClick={() =>
                    createCategoryMutation.mutate({
                      name: newCatName.trim(),
                      description: newCatDescription.trim() || undefined,
                      countsAsOperating: newCatCountsAsOperating,
                    })
                  }
                  className="font-bold"
                >
                  Add Category
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-surface-border">
              <Button type="button" variant="ghost" onClick={() => setIsCategoryModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
