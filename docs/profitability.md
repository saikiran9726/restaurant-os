# Estimated Monthly Profitability & Expense System

## 1. Executive Overview & Management Estimate Notice

The Restaurant OS Monthly Profitability and Expense module gives restaurant owners clear, actionable visibility into their true operating health by synthesizing point-of-sale revenues, ingredient restock invoices, recorded prep waste, and overhead expenses.

> [!IMPORTANT]
> **Management Estimate Notice**: All figures produced by this module represent internal management operational estimates derived from daily POS registers, supplier invoices, inventory counts, and recorded expenses. This report does **not** constitute audited financial statements, statutory balance sheets, or official tax returns.

---

## 2. Core Accounting Formulas & Definitions

### 2.1 Revenue (Net Sales)

Revenue is defined strictly as earned restaurant sales net of customer discounts and refunds, excluding collected pass-through taxes and service charge liabilities:

$$\text{Net Revenue} = \sum (\text{bill.subtotal} - \text{bill.discount} - \text{bill.refunds})$$

- **Excluded Liabilities**: GST/VAT and restaurant service charges are collected on behalf of tax authorities and service pools respectively. They do not constitute restaurant income and are omitted from revenue.

---

### 2.2 Cost of Supplies (Ingredients & Materials)

Supplies cost is determined using one of two explicit methods depending on available physical stock counts:

#### A. Consumption-Based Method (Preferred)

When physical stock count audits exist for both the beginning (first 5 calendar days) and end (last 5 calendar days) of the month:

$$\text{Cost of Supplies} = \text{Opening Stock Value} + \text{Total Purchases} - \text{Closing Stock Value}$$

- **Inventory Value**: Value is calculated across all active inventory items using weighted-average unit costs.
- **Waste & Spoilage**: Any recorded waste movements are inherently captured in the consumption delta ($\text{Opening} + \text{Purchases} - \text{Closing}$). The cost of waste is displayed separately for owner insight but is **never double-counted**.

#### B. Purchase-Based Method (Fallback)

When boundary physical counts are absent:

$$\text{Cost of Supplies} = \sum (\text{purchases.total\_paise})$$

- The system explicitly displays: _"Calculated from total supplier purchases in this calendar month because boundary stock counts were not recorded."_

---

### 2.3 Operating Overhead (Operating Expenses)

Operating expenses represent the fixed and variable non-supply overhead required to run the establishment:

$$\text{Operating Expenses} = \sum_{\text{category.counts\_as\_operating} = \text{true}} (\text{expense.amount\_paise})$$

#### Double-Counting Prevention

- Standard operational categories include: _Rent, Salaries, Electricity, Gas, Internet, Maintenance, Cleaning, Transport, Marketing, Repairs, Other_. All have `counts_as_operating = true`.
- Direct cash payouts for kitchen supplies logged at Day Close (EOD) are categorized as `Supplies (Direct)` with `counts_as_operating = false`.
- This ensures supply purchases are accounted for **only once** under Cost of Supplies, preventing artificial inflation of operating overhead.

---

### 2.4 Estimated Operating Profit & Profit Margin

$$\text{Estimated Operating Profit} = \text{Net Revenue} - \text{Cost of Supplies} - \text{Operating Expenses}$$

$$\text{Operating Profit Margin \%} = \frac{\text{Estimated Operating Profit}}{\text{Net Revenue}} \times 100$$

#### Acceptance Test Benchmark Example

The profitability calculation satisfies the exact reference test case:

- **Net Revenue**: ₹6,20,000 (62,000,000 paise)
- **Cost of Supplies**: ₹2,10,000 (21,000,000 paise)
- **Operating Expenses**: ₹1,43,000 (14,300,000 paise)
- **Estimated Operating Profit**: ₹2,67,000 (26,700,000 paise)
- **Operating Margin**: **43.1%**

---

## 3. Data Completeness Indicator

The monthly evaluation calculates a 0–100% data completeness score to inform the owner before reviewing metrics:

| Checklist Check   | Criteria                                                                 | Completeness Weight |
| ----------------- | ------------------------------------------------------------------------ | ------------------- |
| **Closed Shifts** | All calendar days have completed EOD reconciliations (`daily_summaries`) | 40%                 |
| **Rent Overhead** | At least one expense recorded under Rent                                 | 15%                 |
| **Staff Payroll** | At least one expense recorded under Salaries                             | 15%                 |
| **Utilities**     | At least one expense recorded under Electricity or Gas                   | 15%                 |
| **Stock Audit**   | Physical closing stock count logged within the month                     | 15%                 |

Missing items trigger clear actionable banners (e.g., _"Missing facility rent expense for this month"_ or _"3 unclosed daily register shifts"_).

---

## 4. Month-over-Month Comparison Engine

The system provides plain-English narrative explanations comparing current performance with the preceding calendar month:

- **Profit Growth**: _"Estimated profit rose by ₹25,000 (+10.3%) driven by higher sales, despite a 4.1% rise in operating expenses."_
- **Margin Compression**: _"Estimated profit decreased by ₹12,000 (-4.5%) as supply costs increased faster than net revenue."_
- **Flat Comparison**: Detailed breakdown of revenue deltas, supply percentage changes, and overhead differences.

---

## 5. Workflow & UI Specifications

### 5.1 Operating Expenses Management (`/owner/expenses`)

- **Fast Entry (< 10 seconds)**: Quick modal with amount in ₹, category dropdown, auto-filled today's date, description, reference, and payment source (`upi`, `bank`, `till`, `other`).
- **Recurring Expense Copy Helper**: One-tap tool to copy standard monthly recurring bills (Rent, Internet, Salaries) from the prior month into the active month.
- **Audited Edits**: Any modifications to logged expenses require a minimum 3-character reason recorded directly to the audit log.
- **Category Customization**: Allows creating custom categories and configuring the `counts_as_operating` flag.

### 5.2 Month Review Portal (`/owner/month-review`)

- **Visual Waterfall Deduction**: 4-step deduction card (Net Revenue $\rightarrow$ Cost of Supplies $\rightarrow$ Operating Overhead $\rightarrow$ Estimated Operating Profit).
- **Payment Method Settlement Mix**: Cash (till), UPI (instant bank credit), and Card (POS terminals).
- **Category Spend Breakdown Table**: Current month vs previous month with percentage variances.
- **Formula & Assumptions Panel**: Expandable transparency drawer explaining accounting rules.
- **Freeze Snapshot**: Saves an immutable versioned record (`v1`, `v2`, etc.) in `monthly_evaluations` with optional audit note and user attribution.
- **Export & Print**: Clean CSV download and printer-formatted summary (`window.print()`).

---

## 6. Security & RBAC Enforcement

- `Permissions.EXPENSE_MANAGE`: Required for creating, editing, and deleting expenses, managing expense categories, and copying recurring expenses. Restricted to `OWNER` and `MANAGER`.
- `Permissions.REPORT_READ`: Required for viewing monthly profitability reviews and managing snapshots. Restricted to `OWNER` and `MANAGER`.
- Waiters and kitchen staff have zero visibility into profitability evaluations, restaurant expenses, or cost structures.
