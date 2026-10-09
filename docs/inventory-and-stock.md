# Inventory & Stock System

## 1. Overview & Architectural Principles

The Restaurant OS Inventory subsystem provides lightweight, practical, low-friction stock management tailored for operational restaurant owners.

### Key Principles:

1. **Single Unit per Item (No Unit Conversions)**: Each ingredient is tracked in a single chosen unit (`kg`, `g`, `L`, `ml`, `pcs`, `packet`, `dozen`, or `custom`). Eliminating multi-unit conversions removes complex fractional rounding, configuration errors, and mental overhead for staff during rapid bulk data entry.
2. **Derived Consumption via Real Stock Counts (No Recipe Auto-Deductions)**: Restaurant kitchen prep involves spillage, chef trimming, batch adjustments, and informal tasting. Theoretical recipe deductions reliably drift away from reality within days. Instead, actual consumption is derived cleanly from periodic physical stock counts:
   $$\text{Implied Consumption} = (\text{Previous Stock} + \text{Purchases} - \text{Logged Waste}) - \text{Physical Count}$$
   The system records a `stock_count` movement representing this exact delta.
3. **Integer Paise & Weighted-Average Costing**: Currency amounts are stored in integer paise. Weighted-average cost per unit updates on every incoming purchase:
   $$\text{New Average Cost} = \frac{(\text{Current Stock} \times \text{Current Avg Cost}) + \text{Purchase Total}}{\text{Current Stock} + \text{Purchase Quantity}}$$
   All cost values displayed in the user interface are labeled _"estimate based on purchases"_.
4. **Strict Immutability & Audit Integrity**: Stock movements are never silently deleted. When an owner edits an existing purchase invoice, compensating reverse stock movements are recorded, and the audit trail logs full before/after states.
5. **Role-Based Isolation**: Waiters and kitchen staff have zero access to inventory items, stock levels, suppliers, purchase costs, or stock movement endpoints. Access is strictly restricted to `inventory.manage` (`OWNER` and `MANAGER`).

---

## 2. Invariant Consistency Rule

The system enforces a core transactional invariant:
$$\text{Current Stock} = \sum (\text{stock\_movements.quantity})$$

This is verified programmatically via `GET /inventory/verify-consistency` to guarantee zero silent drift across purchases, manual usage, recorded waste, opening balances, and physical stock counts.

---

## 3. Core Workflows & User Flows

### 3.1 Bulk Purchase & Restock

1. Owner opens **Purchases & Restock** (`/owner/purchases`) $\rightarrow$ clicks **Record Purchase**.
2. Selects supplier via typeahead (or adds a supplier inline).
3. Adds line items using the bulk editor:
   - Example: _Rice, 50 kg, ₹2,500, ABC Foods_.
   - Either unit price or total price can be typed; the bidirectional engine auto-computes the counterpart.
   - Hitting `Enter` in the total price field instantly adds the next line.
4. On save:
   - Stock rises by $+50\text{ kg}$.
   - Weighted-average cost updates to ₹50/kg (5,000 paise).
   - Last purchase price is recorded.
   - An immutable `purchase` stock movement is created.

### 3.2 Recording Manual Usage & Waste

- **Usage**: Payout/usage for large prep batches or banquet functions can be deducted with a single tap.
- **Waste & Spoilage**: Logged with standardized reasons (`spoilage`, `spillage`, `expired`, `returned`, `other`). The cost impact of waste is derived from the item's weighted-average unit cost.

### 3.3 Physical Stock Count & Variance Audits

- Owner opens **Audit Stock Count** drawer.
- System displays current expected stock side-by-side with numeric input fields.
- Entering counted stock reveals real-time variance and shortage/surplus tags.
- Committing the audit updates `inventory_items.current_stock` directly to the counted amount and records a `stock_count` movement.

### 3.4 Reorder List

- Ingredients at or below their configured `reorder_level` automatically populate the **Reorder List** view with their last known supplier and purchase price.

### 3.5 Initial Setup & CSV Import

- Paste CSV data containing item name, unit, category, opening stock, reorder level, and cost price to bulk-populate opening inventory.
