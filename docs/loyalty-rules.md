# Restaurant OS • Loyalty Program & Anti-Abuse Specifications

## 1. Architectural Principles & Ledger Invariance

- **Strictly Append-Only Ledger (`loyalty_transactions`)**:
  - The loyalty ledger records all point lifecycle changes with an explicit `type`:
    - `earn`: Points earned on fully paid bills.
    - `redeem`: Points debited at checkout for bill discounts.
    - `reversal`: Reversal of points due to bill cancellation or refund.
    - `bonus`: Milestone visits, birthdays, or referral rewards.
    - `adjust`: Manual credits or debits issued by the owner with an audited mandatory reason.
    - `expire`: Periodic automated forfeiture of expired points.
  - Transactions are **never updated or deleted**. Reversals and corrections append compensating ledger entries.
  - Idempotency is enforced by the database unique constraint:
    $$\text{UNIQUE}(\text{bill\_id}, \text{type})$$
    Preventing duplicate earns or redemptions for any single bill.
- **Cached Balances with Strong Reconciliation**:
  - `loyalty_accounts.points_balance` acts as an indexed cache of active points.
  - Invariance condition verified by the owner console:
    $$\sum \text{loyalty\_accounts.points\_balance} \equiv \sum \text{loyalty\_transactions.points}$$
    Any variance is immediately flagged as a reconciliation discrepancy.

---

## 2. Earn Rules & Order of Operations

### Earn Timing

- Points are earned **only when a bill reaches `paid` status** and an identified customer is attached.
- In-flight or draft bills never grant loyalty points.

### Eligible Spend Basis

- By default, points earn on the net post-discount amount.
- **Redemption Discount Exclusion**:
  - Points redeemed on a bill represent loyalty burn and are **strictly excluded** from eligible earn spend.
    $$\text{Eligible Spend} = \max(0, \text{bill.subtotalPaise} - \text{bill.discountPaise})$$
- **Spend-per-Block Calculation**:
  - Given spend block $S$ (`spendPaisePerBlock`, e.g., ₹100 = 10,000 paise) and base points $P$ (`pointsPerBlock`, e.g., 5 points):
    $$\text{Base Blocks} = \left\lfloor \frac{\text{Eligible Spend}}{S} \right\rfloor$$
    $$\text{Base Points} = \text{Base Blocks} \times P$$

### Tier Multipliers

- Accounts are categorized into up to 3 tiers (e.g., _Silver_, _Gold_, _Platinum_) based on cumulative lifetime spend:
  $$\text{Tier Multiplier} = M_{\text{tier}} \quad (1.0 \le M \le 5.0)$$
  $$\text{Earned Points} = \left\lfloor \text{Base Points} \times M_{\text{tier}} \right\rfloor$$

---

## 3. Redemption Mechanics

### Point-to-Rupee Conversion

- Points redeem in discrete blocks (`redeemPointsBlock`, default: 500 points).
- Each block yields a fixed Rupee discount (`redeemValuePaise`, default: ₹50 = 5,000 paise):
  $$\text{Discount per Point} = \frac{\text{redeemValuePaise}}{\text{redeemPointsBlock}} = \frac{5000\text{ paise}}{500\text{ pts}} = 10\text{ paise/pt} \quad (₹0.10)$$
- Redemptions must be exact multiples of `redeemPointsBlock`. Fractional blocks are disallowed.

---

## 4. Anti-Abuse Rules & System Guards

To protect restaurant revenue from collusion, automated cycling, or fraudulent point creation, the following guards are built into the core engine:

### 1. New Account Cooldown (24 Hours)

- Newly created customer records are prohibited from redeeming points during their initial cooldown window (`newAccountCooldownHours`, default: 24h).
- Prevents immediate account generation loops on single-use phone numbers.

### 2. Maximum Percentage of Bill Cap (`maxRedeemPercentOfBill`)

- Points cannot be used to extinguish an entire bill.
- Configurable cap (default: $20\%$, maximum: $50\%$):
  $$\text{Max Discount Allowed} = \left\lfloor \frac{\text{billTotalPaise} \times \text{maxRedeemPercentOfBill}}{100} \right\rfloor$$
- Protects food cost margins and prevents free meals from points accumulation.

### 3. Daily Customer Redemption Cap (`dailyRedeemPointsCap`)

- A single customer account cannot redeem more than a configured daily ceiling across all tables or visits in a 24-hour business day (default: 2,000 points = ₹200).
- Prevents rapid drain in case of compromised credentials or staff misbehavior.

### 4. Non-Negative Balances Invariant

- A customer balance **can never drop below zero**.
- Manual adjustments and redemption transactions reject any operation where $\text{Balance} + \Delta < 0$.

### 5. Automatic Ledger Reversals on Bill Cancellation/Refund

- If a paid bill is cancelled or refunded:
  1. Points earned from the bill are debited via a compensating `type = 'reversal'` entry.
  2. Any points redeemed on the bill are refunded back to the customer's balance via a credit `type = 'reversal'` entry.
- Points cannot be retained from refunded transactions.

### 6. Concurrency Protection (`SELECT ... FOR UPDATE`)

- In concurrent POS scenarios (e.g., simultaneous redemption requests across multiple terminals for the same phone number), the backend locks the customer's `loyalty_accounts` row with row-level pessimistic locking (`SELECT ... FOR UPDATE`).
- Eliminates race conditions and double-spend exploits.

### 7. Staff Privilege Separation

- **Waiters**:
  - View only the customer's tier badge, current points balance, and redemption stepper.
  - **Financial liability, monetary valuations, and raw ledger entries are completely stripped** from waiter responses to prevent leakage.
- **Owners**:
  - View full transaction history, total circulation liability in ₹, reconciliation status, and perform audited manual adjustments.

---

## 5. Financial Liability & Nightly Reconciliation

- **Outstanding Liability in ₹**:
  $$\text{Liability (Paise)} = \text{Total Active Points} \times \left( \frac{\text{redeemValuePaise}}{\text{redeemPointsBlock}} \right)$$
- Reflected live in the Owner Console as an active balance sheet liability.
- **Nightly Reconciliation Check**:
  - Verifies that the sum of cached balances matches the transaction ledger sum:
    $$\Delta = \left| \sum \text{account.balance} - \sum \text{tx.points} \right|$$
  - If $\Delta > 0$, the dashboard alerts the owner to run an audit trail review.
