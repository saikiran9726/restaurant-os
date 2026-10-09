# Alerts & Plain-English Business Insights Architecture

Deterministic, rule-based operations and financial intelligence for restaurant owners.

---

## 1. Allowed Alert Types (Strictly Constrained)

To avoid noisy notification syndrome, exactly **5 alert types** are defined and monitored:

| Alert Type               | Severity   | Trigger Condition                                                                                                             | Auto-Resolve Condition                                  | Primary Action                                |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| `cash_mismatch`          | `critical` | Closed business day with $\|\text{Difference}\| > \text{Tolerance}$ (`default: ₹50`) without an explanatory note              | Drawer difference resolved or acknowledged with note    | Review Day Close (`/owner/close-day`)         |
| `low_stock`              | `warning`  | One or more active inventory items at or below reorder level. **Grouped into ONE alert card** listing the top items and count | All inventory items replenished above reorder level     | Manage Stock (`/owner/inventory`)             |
| `high_expense`           | `warning`  | Expense item $> 1.5\times$ trailing 3-month category average AND $\ge$ minimum threshold (`default: ₹5,000`)                  | Condition clears / expense audited                      | Review Expenses (`/owner/expenses`)           |
| `payment_reconciliation` | `critical` | Electronic UPI payment requests pending confirmation $> X$ hours (`default: 2h`), or partially paid bills at day close        | All pending electronic payments settled or bills closed | Reconcile Payments (`/owner/close-day`)       |
| `profit_decline`         | `critical` | Operating margin contracted $> N$ percentage points (`default: 5.0 pts`) between consecutive monthly evaluations              | Subsequent monthly evaluation recovers margin           | Inspect Profitability (`/owner/month-review`) |

> [!NOTE]
> No additional alert types may be registered without explicit schema updates.

---

## 2. Alert Lifecycle & Anti-Abuse Rules

1. **Deduplication Key (`dedupe_key`)**:
   - `alert:cash_mismatch:<businessDate>`
   - `alert:low_stock` (singleton grouped card)
   - `alert:high_expense:<expenseId>`
   - `alert:payment_reconciliation` (singleton grouped card)
   - `alert:profit_decline:<month>`
2. **Acknowledgements vs. Dismissals**:
   - Critical **Cash Mismatch** alerts **CANNOT** be dismissed without an acknowledgement note. Bookkeeping and audit trails require an explanatory string (min 3 chars).
   - Low stock, high expenses, and payment reconciliation can be snoozed (`1d` or `7d`) or dismissed with an explanatory reason.
3. **Auto-Resolution**:
   - Background sync deterministically marks alerts as `resolved` (`[Auto-resolved] ...`) when underlying data conditions are restored.

---

## 3. Deterministic Plain-English Insights

Business insights are generated deterministically and backed by mathematical evidence.

### Additive 3-Factor Sales Decomposition

Given Period 1 (baseline: $S_1, N_1$) and Period 2 (current: $S_2, N_2$):

- Baseline average spend: $A_1 = \frac{S_1}{N_1}$
- Current average spend: $A_2 = \frac{S_2}{N_2}$
- **Order Volume Effect**: $\Delta S_{\text{orders}} = (N_2 - N_1) \cdot A_1$
- **Average Spend Effect (AOV)**: $\Delta S_{\text{AOV}} = N_1 \cdot (A_2 - A_1)$
- **Interaction / Mix Effect**: $\Delta S_{\text{mix}} = (N_2 - N_1) \cdot (A_2 - A_1)$
- **Exact Invariant**: $\Delta S = \Delta S_{\text{orders}} + \Delta S_{\text{AOV}} + \Delta S_{\text{mix}}$

### Other Generated Insights

1. **Top Seller Movement**: Identifies category and item volume changes.
2. **Supply Cost Shift**: Highlights leading ingredient cost changes.
3. **Monthly Margin Fluctuations**: Tracks operating margin changes with contributing expense categories.
4. **Lapsed Regular Customers**: Highlights regular customers ($\ge 3$ visits) who have not returned within the configured threshold (`default: 30 days`).
5. **Ingredient Consumption Changes**: Measured from verified physical stock movement audits.

---

## 4. Owner Console & Realtime Integration

- **Realtime Delivery**: Alerts are pushed over Socket.IO room `restaurant:<id>:owner` (`alert:new`, `alert:resolved`, `alert:snoozed`, `alert:dismissed`).
- **Owner Navigation Badge**: Dynamic counter indicates currently open alerts in both desktop and mobile navigation bars.
- **Top Section of Today Screen**: Displays up to 5 critical action cards with a "Show all" toggle.
- **"All Clear" State**: Calm, reassuring banner rendered when zero alerts require attention.
- **Evidence Drawer**: Every insight card includes a collapsible "Show numbers" drawer exposing underlying metrics and mathematical details.
