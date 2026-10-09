# Restaurant OS • Tax & Billing Specifications

## 1. Monetary Precision

- **Fintech-grade integer paise**: All monetary values in the database, schemas, APIs, and client-side calculators are represented and persisted strictly as integer **paise** ($1\text{ INR} = 100\text{ paise}$).
- No floating point numbers are used in financial calculations to eliminate IEEE 754 precision errors.

---

## 2. Indian Goods and Services Tax (GST) Model

### Assumptions

- **Intra-State Supply**: All restaurant sales are assumed to be intra-state transactions.
- **Tax Split**: GST is equally bifurcated into:
  - **CGST (Central GST)**: $50\%$ of Total GST
  - **SGST (State GST)**: $50\%$ of Total GST
- **Integer Split Guarantee**:
  $$\text{CGST} = \left\lfloor \frac{\text{Total GST}}{2} \right\rfloor$$
  $$\text{SGST} = \text{Total GST} - \text{CGST}$$
  This strictly ensures $\text{CGST} + \text{SGST} \equiv \text{Total GST}$ to the exact single paisa with zero rounding leak.

---

## 3. Order of Operations & Tax Modes

### Exclusive Tax Mode (`taxMode = 'exclusive'`)

1. **Gross Subtotal**: Sum of active line items:
   $$\text{Gross Subtotal} = \sum (\text{qty}_i \times \text{unit\_price}_i)$$
2. **Discount Calculation**:
   - Discount is applied **before tax**.
   - If percent: $\text{Discount} = \text{round}\left(\frac{\text{Gross Subtotal} \times \text{Percent}}{100}\right)$
   - If flat: Flat paise amount, capped to Gross Subtotal.
   - Discount is allocated proportionally across individual line items with integer remainder reconciliation.
3. **Line Tax**:
   $$\text{Taxable}_i = \text{Subtotal}_i - \text{LineDiscount}_i$$
   $$\text{LineTax}_i = \text{round}\left(\frac{\text{Taxable}_i \times \text{TaxRateBp}_i}{10000}\right)$$
4. **Service Charge (Optional)**:
   - Calculated on net subtotal after discount:
     $$\text{Service Charge} = \text{round}\left(\frac{\text{Net Subtotal} \times \text{ServiceChargePercent}}{100}\right)$$
   - Attracts GST at the restaurant's default GST rate (typically 5% in Indian F&B):
     $$\text{Service Charge Tax} = \text{round}\left(\frac{\text{Service Charge} \times \text{DefaultGstRateBp}}{10000}\right)$$
5. **Total before Round-off**:
   $$\text{Total Pre-Round} = \text{Net Subtotal} + \text{Service Charge} + \text{Total Items Tax} + \text{Service Charge Tax}$$

### Inclusive Tax Mode (`taxMode = 'inclusive'`)

- Item menu price already includes GST.
- For each item:
  $$\text{Taxable Base} = \text{round}\left(\frac{\text{Net Inclusive Amount} \times 10000}{10000 + \text{TaxRateBp}}\right)$$
  $$\text{Line Tax} = \text{Net Inclusive Amount} - \text{Taxable Base}$$
- Total payable is the net menu price plus any optional service charges.

---

## 4. Round-off Conventions

- Configurable per restaurant profile (`roundOffEnabled: true` by default).
- Rounds to the nearest whole rupee ($100\text{ paise}$):
  $$\text{Final Total} = \text{round}\left(\frac{\text{Total Pre-Round}}{100}\right) \times 100$$
  $$\text{Round-Off Adjustment} = \text{Final Total} - \text{Total Pre-Round}$$
- The round-off adjustment is always within $[-50\text{ paise}, +50\text{ paise}]$.

---

## 5. Discount Limits & Owner Authorization

- **Per-role discount caps** defined in restaurant settings:
  - **OWNER**: $100\%$
  - **MANAGER**: $25\%$
  - **CASHIER**: $10\%$
  - **WAITER**: $0\%$ (cannot apply discounts without owner override)
- Any discount exceeding the actor's role cap strictly requires an **Owner PIN override**.
- The override event, requested percentage, actor, and mandatory reason are permanently logged in `audit_logs`.

---

## 6. Payment Processing & Settlement

### Payment Methods

1. **Cash**:
   - Supports customer tendered amounts.
   - Calculates change due: $\text{Change} = \text{Tendered} - \text{Amount}$.
   - Immediately confirmed upon entry.
2. **UPI**:
   - **Never auto-confirmed**: Created in `pending_confirmation` status.
   - Must be verified and acknowledged by staff tapping "Payment Received" / "Confirmed by staff".
   - The bill transitions to `paid` only after all payments (including UPI) are confirmed.
3. **Card**:
   - Processed via external POS terminal.
   - Supports optional authorization code or card last-4 reference.
   - Immediately recorded as confirmed upon staff entry.
4. **Split Payments**:
   - Live remaining balance tracking.
   - Any combination of Cash, UPI, and Card.
   - Overpayment is disallowed except for Cash (which calculates change).

### Table & Order Lifecycle on Settlement

- When confirmed payments reach or exceed the bill total:
  1. `bills.status` $\rightarrow$ `'paid'`, `bills.paid_at` set to current timestamp.
  2. `orders.status` $\rightarrow$ `'billed'`.
  3. `tables.status` $\rightarrow$ `'available'`, `tables.current_order_id` cleared.

---

## 7. Refunds & Cancellations

- **Cancellations**:
  - Unpaid bills may be voided with reason.
  - Paid bills require Owner authorization / PIN override and reason.
- **Refunds**:
  - Restricted to users with `bill.refund` permission (Waiters blocked by default).
  - Can be full or partial.
  - Cannot exceed total confirmed payments on the bill.
  - Recorded against original payment method and audited.
