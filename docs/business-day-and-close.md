# Business Day Engine, Sales Analytics & End-of-Day (EOD) Closing

## 1. Overview & Architectural Principles

The Restaurant OS financial core operates under strict deterministic accounting and immutability invariants:

1. **Integer Paise Representation**: All currency values are stored, computed, and transferred as non-negative or signed 64-bit integers (`BIGINT` paise in PostgreSQL, where $1\text{ INR} = 100\text{ paise}$). Zero floating-point rounding errors exist anywhere in the billing, refund, or closing pipeline.
2. **Business-Day Boundary Across Midnight**: Restaurants frequently operate past midnight (e.g. 11 PM to 2 AM). Transactions occurring in early morning hours belong legally and operationally to the preceding operational shift. The system computes `business_date` server-side relative to a configurable `business_day_start_hour` (default: `05:00 AM`, timezone `Asia/Kolkata`).
3. **Immutability of Closed Shifts**: Once a business date is closed and locked by an authorized manager or owner, no new payments, discounts, refunds, or bill cancellations may be executed on bills of that business date. Modifying a closed day requires an explicit `POST /day/reopen` with an Owner PIN override and mandatory audit log reason.
4. **Reconciliation Invariant**: Shift reports derive directly from underlying immutable bill, payment, and refund records rather than pre-aggregated caches that could drift.

---

## 2. Business Day Calculation Engine

The business date formula shifts the transaction timestamp backwards by `business_day_start_hour` before extracting the calendar date in the restaurant's operational timezone.

```
Given:
  T: UTC Timestamp of transaction
  tz: "Asia/Kolkata" (UTC +5:30)
  H_start: 5 (5:00 AM)

Shifted Epoch:
  T_shifted = T - (H_start * 3,600,000 ms)

Business Date:
  business_date = format_date(T_shifted, "YYYY-MM-DD", tz)
```

### Examples:

- Transaction at `2026-10-09 23:45:00 IST` $\rightarrow$ `business_date = '2026-10-09'`
- Transaction at `2026-10-10 02:30:00 IST` (2:30 AM after midnight) $\rightarrow$ shifted by -5 hours gives `2026-10-09 21:30:00 IST` $\rightarrow$ `business_date = '2026-10-09'`
- Transaction at `2026-10-10 05:05:00 IST` $\rightarrow$ shifted gives `2026-10-10 00:05:00 IST` $\rightarrow$ `business_date = '2026-10-10'` (new business day)

---

## 3. End-of-Day (EOD) Closing & Cash Reconciliation

### 3.1 Four-Step Closing Workflow (`OwnerCloseDay.tsx`)

1. **Pre-checks**:
   - Verify zero unbilled active kitchen/waiter orders.
   - Verify zero draft or unpaid bills.
   - Verify zero pending UPI transactions awaiting staff confirmation.
   - Verify offline outbox sync queue is clear.
2. **Shift Financial Summary**:
   - Net Sales, Gross Sales, Discounts, GST Breakdown.
   - Payment method breakup: Cash, UPI, Card.
   - Payout logging: Cash expenses taken out of the till drawer (`POST /day/expenses`).
3. **Till Cash Reconciliation**:
   - Physical cash count by total or denominations (₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5).
   - Expected cash formula:
     $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Sales} - \text{Cash Expenses} - \text{Cash Refunds}$$
   - Discrepancy calculation:
     $$\text{Difference} = \text{Actual Counted Cash} - \text{Expected Cash}$$
   - If $|\text{Difference}| > \text{Cash Tolerance}$ (default 0), a **Mandatory Explanation Note** is required before the shift can be closed.
4. **Lock & Confirm**:
   - Creates an immutable record in `daily_summaries` (`locked = true`).
   - Locks the business date against further transactional mutations.

---

## 4. Reopening a Locked Business Day

If an emergency modification (such as late refund or billing correction) is necessary on a closed day:

1. Manager/Owner clicks "Reopen" in the closed days history table.
2. System prompts for Owner PIN and a detailed reason.
3. `POST /day/reopen` validates the PIN with bcrypt/argon2 and sets `daily_summaries.status = 'reopened'` and `locked = false`.
4. High-priority audit log entry is recorded with before/after state.

---

## 5. Deterministic Analytics Insights Engine

The analytics engine produces deterministic mathematical insights without LLM nondeterminism:

- **Weekday Comparison**: Compares current day's net sales and AOV with the 4-week average for that same day of the week (e.g. today's Friday vs past 4 Fridays). Requires at least 4 historical days of data; otherwise outputs `"Not enough data yet"`.
- **Period Trend**: Compares current period with previous equivalent duration (e.g. this week vs last week).
- **Payment Method Dominance**: Detects if UPI, Cash, or Card accounts for more than 50% of collections.
- **Category Leadership**: Highlights the top-grossing category and its percentage contribution to gross revenue.
- **Peak Hour Detection**: Pinpoints the 1-hour window with the highest order volume and sales.
- **Bottom Performers Guard**: Bottom 10 menu performers exclude items on the menu for less than 7 days (`daysOnMenu < 7`) to prevent penalizing newly introduced dishes.
