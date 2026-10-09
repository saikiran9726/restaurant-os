# Restaurant Health Score (0–100)

## 1. Architectural Principles & Overview

The Restaurant OS Health Score provides a completely transparent, explainable 0–100 operational index for restaurant owners.

### Core Design Rules:

1. **Zero Black-Box or "AI" Scoring**: Every single score and point contribution is derived through deterministic mathematical formulas from raw database entries.
2. **Reproducible by Hand**: Given the raw database numbers, any owner or accountant can compute the exact score displayed on screen with a pocket calculator.
3. **No Fabricated Data**: If an operational pillar lacks sufficient historical records, it is excluded and remaining weights are renormalised. The system never invents baseline proxies.
4. **Strict Immutable Versioning**: Model weight or target updates increment the model version (v1 $\rightarrow$ v2). Historical snapshots retain the model version they were calculated under.
5. **Full Change Attribution**: When a score moves between snapshots, the sum of factor point changes equals the total score delta identically:
   $$\sum \Delta C_f = \Delta \text{Overall Score}$$

---

## 2. The 8 Operational Pillars & Formulas

Evaluation is performed over a rolling 30-day window (configurable from 7 to 90 days) and compared against the prior consecutive window of identical duration.

### 2.1 Sales Performance (Default Weight: 15%)

Measures net revenue trend against the prior comparison window:
$$\text{growthPercent} = \frac{\text{Net Revenue}_{\text{current}} - \text{Net Revenue}_{\text{previous}}}{\text{Net Revenue}_{\text{previous}}} \times 100$$

- **Target**: Default $\ge +10\%$ growth.
- **Scoring Scale**:
  - $\ge +10\%$ growth: **100**
  - $0\%$ (flat revenue): **50**
  - $\le -20\%$ contraction: **0**
  - Linear piecewise interpolation between $-20\%$ and $+10\%$.
- **Minimum Data Requirement**: At least 1 day with closed register sales in comparison window.

---

### 2.2 Operating Profitability (Default Weight: 20%)

Measures estimated operating profit margin from net sales, food supplies, and operating overhead:
$$\text{operatingMarginPercent} = \frac{\text{Net Revenue} - \text{Supplies Cost} - \text{Operating Expenses}}{\text{Net Revenue}} \times 100$$

- **Target**: Default $\ge 20\%$ operating margin.
- **Scoring Scale**:
  - $\ge \text{targetMargin}$: **100**
  - $\le 0\%$ margin (operating loss): **0**
  - Linear in between:
    $$\text{score} = \text{clamp}\left(0, 100, \frac{\text{operatingMarginPercent}}{\text{targetMargin}} \times 100\right)$$
- **Minimum Data Requirement**: Net revenue $> 0$ in the window.

---

### 2.3 Customer Retention (Default Weight: 12%)

Measures the repeat visitation rate among guests active during the window:
$$\text{repeatRatePercent} = \frac{\text{Active Guests with } \ge 2 \text{ Visits}}{\text{Total Active Guests}} \times 100$$

- **Target**: Default $\ge 40\%$ repeat visit rate.
- **Scoring Scale**:
  - $\ge 40\%$: **100**
  - Linear from $0\%$ to $40\%$:
    $$\text{score} = \text{clamp}\left(0, 100, \frac{\text{repeatRatePercent}}{40} \times 100\right)$$
- **Minimum Data Requirement**: At least 3 active guests recorded in window.

---

### 2.4 Food & Supplies Cost (Default Weight: 15%)

Measures the efficiency of ingredient purchasing relative to revenue:
$$\text{suppliesPercentOfRevenue} = \frac{\text{Supplies Purchases (paise)}}{\text{Net Revenue (paise)}} \times 100$$

- **Target**: Default $\le 32\%$ of net revenue (lower is better).
- **Scoring Scale**:
  - $\le 32\%$: **100**
  - $\ge 47\%$ ($32\% + 15\%$ tolerance): **0**
  - Linear in between:
    $$\text{score} = \text{clamp}\left(0, 100, 100 - \frac{\text{suppliesPercent} - 32}{15} \times 100\right)$$
- **Minimum Data Requirement**: Recorded revenue and supplies purchases $> 0$.

---

### 2.5 Inventory Efficiency (Default Weight: 8%)

Evaluates safety stock levels and physical stock count audit accuracy:
$$\text{inStockPercent} = \frac{\text{Active Items Above Reorder Level}}{\text{Total Active Inventory Items}} \times 100$$

- **Target**: Default $\ge 90\%$ healthy in-stock items.
- **Scoring Scale**:
  - $\ge 90\%$: Base score **100**
  - $\le 50\%$: Base score **0**
  - Variance Penalty: Deducts 2 points per percentage point of stock count audit variance $> 5\%$.
- **Minimum Data Requirement**: Active items present in inventory catalog.

---

### 2.6 Kitchen Waste Management (Default Weight: 8%)

Measures prep trimming, spoilage, and logged waste as a percentage of supply spend:
$$\text{wastePercentOfSupplies} = \frac{\text{Logged Waste Cost (paise)}}{\text{Supplies Purchases (paise)}} \times 100$$

- **Target**: Default $\le 3\%$ of supply cost (lower is better).
- **Scoring Scale**:
  - $\le 3\%$: **100**
  - $\ge 10\%$ ($3\% + 7\%$ tolerance): **0**
  - Linear in between:
    $$\text{score} = \text{clamp}\left(0, 100, 100 - \frac{\text{wastePercent} - 3}{7} \times 100\right)$$
- **Minimum Data Requirement**: Supplies purchases $> 0$ in window.

---

### 2.7 Kitchen Speed (Default Weight: 10%)

Measures kitchen punctuality: share of tickets reaching READY within the warning threshold (default 15 minutes / 900 seconds):
$$\text{onTimePercent} = \frac{\text{KOTs with } (\text{readyAt} - \text{createdAt}) \le 900\text{s}}{\text{Total Completed KOTs}} \times 100$$

- **Target**: Default $\ge 85\%$ on-time tickets.
- **Scoring Scale**:
  - $\ge 85\%$: **100**
  - $\le 50\%$: **0**
  - Linear in between:
    $$\text{score} = \text{clamp}\left(0, 100, \frac{\text{onTimePercent} - 50}{35} \times 100\right)$$
- **Minimum Data Requirement**: At least 5 completed KOT tickets in window.

---

### 2.8 Payment Reconciliation (Default Weight: 12%)

Evaluates settlement integrity: ratio of bills settled without unconfirmed UPI disputes combined with cash drawer reconciliation accuracy:
$$\text{reconciliationPercent} = 60\% \times \left(\frac{\text{Clean Bills}}{\text{Total Bills}}\right) + 40\% \times \left(\frac{\text{Closed Days with } |\text{Cash Diff}| \le \text{₹50}}{\text{Total Closed Days}}\right)$$

- **Target**: Default $\ge 95\%$ clean reconciliation.
- **Scoring Scale**:
  - $\ge 95\%$: **100**
  - $\le 75\%$: **0**
  - Linear in between:
    $$\text{score} = \text{clamp}\left(0, 100, \frac{\text{reconciliationPercent} - 75}{20} \times 100\right)$$
- **Minimum Data Requirement**: At least 3 bills recorded in window.

---

## 3. Missing Data & Renormalisation Rule

When a restaurant lacks data for one or more factors (e.g. newly opened outlet without loyalty data, or inventory module not yet populated):

1. The factor is excluded with an explicit reason displayed in the UI.
2. The remaining available weights ($W_{\text{avail}}$) are renormalised so they sum to 100%:
   $$W_f^{\text{norm}} = \frac{W_f}{W_{\text{avail}}} \times 100$$
3. Each factor's contribution points:
   $$C_f = \frac{\text{rawScore}_f \times W_f^{\text{norm}}}{100}$$
4. The Overall Score is the rounded sum of active contribution points:
   $$\text{Overall Score} = \text{round}\left(\sum C_f\right)$$
5. **Data Adequacy Guard**: If there are fewer than 14 days of closed sales or fewer than 3 active factors, the system displays an explanatory notice: _"Not enough data yet (need ≥ 14 days of closed sales)"_ and does not invent a fabricated number.

---

## 4. Confidence Rating & Bands

### Confidence Levels

- **High Confidence**: $\ge 7$ active factors AND $\ge 14$ days of closed sales.
- **Medium Confidence**: $5–6$ active factors AND $\ge 7$ days of closed sales.
- **Low Confidence**: $< 5$ active factors OR $< 7$ days of closed sales.

### Score Bands

- **Strong**: $80–100$
- **Stable**: $65–79$
- **Needs Attention**: $50–64$
- **At Risk**: $0–49$

---

## 5. Change Attribution & Rule-Based Suggestions

### Why the Score Changed

Compares the current snapshot to the preceding snapshot. The contribution point delta for each factor is calculated:
$$\Delta C_f = C_f^{\text{current}} - C_f^{\text{previous}}$$
Deltas are ranked by magnitude and explained in plain English:

> _"-6.2 pts from Food & Supply Cost: 35.1% of revenue vs your 32% target"_
> _"+3.1 pts from Customer Retention: repeat guest share rose from 32% to 41%"_

### What You Can Improve

Ranks the top 3 factors by maximum potential score gain:
$$\text{Potential Gain}_f = (100 - \text{rawScore}_f) \times \frac{W_f^{\text{norm}}}{100}$$
Each suggestion directly links to the respective module (`/owner/purchases`, `/owner/inventory`, `/owner/expenses`, `/owner/loyalty`, `/owner/close-day`, `/kitchen`).

---

## 6. Security & RBAC Enforcement

- **Strictly Owner-Only**: The Health Score portal and API endpoints are exclusively accessible to users with the `OWNER` role.
- **Waiter & Kitchen Isolation**: Both API endpoints (`/health-score`, `/health-score/model`, etc.) and frontend routes are blocked with HTTP 403 / route guard protection.
