# Customer Data Privacy & Compliance (DPDPA 2023)

## 1. Overview

The **Digital Personal Data Protection Act (DPDPA) 2023** regulates the processing of digital personal data in India. This document outlines RestaurantOS's architecture, data retention practices, role-based access restrictions, and customer data rights compliance.

---

## 2. Data Fiduciary & Data Principal Roles

- **Data Fiduciary**: The Restaurant Owner / Operating Business.
- **Data Processor**: RestaurantOS backend services & local offline clients.
- **Data Principal**: The Restaurant Guest / Customer.

---

## 3. Data Collection & Purpose Limitation

RestaurantOS captures minimal personal data strictly necessary to fulfill dining services, respect dietary requirements, and track dining history:

| Field                       | Purpose                                                                | Lawful Basis                                 |
| :-------------------------- | :--------------------------------------------------------------------- | :------------------------------------------- |
| **Phone Number (+91)**      | Primary customer identifier, order lookup, digital bill delivery       | Legitimate dining service & customer consent |
| **Customer Name**           | Hospitality personalization                                            | Voluntary disclosure / Consent               |
| **Food Preferences & Tags** | Allergen safety (e.g. `No onion`, `Jain`, `Gluten free`, `Less spicy`) | Vital health / guest request                 |
| **Visit Metrics & Spend**   | Billing reconciliation, loyalty tiering, sales tax audits              | Legitimate business operation                |
| **Email & Birthday**        | Voluntary fields for owner records                                     | Optional consent                             |

---

## 4. Strict Role-Based Access Controls (RBAC)

To prevent internal data misuse or unauthorized profiling:

### A. Waiter Portal (`WAITER` Role)

- **Permissions**: `customer.read` (restricted subset), `order.create`, `order.update`.
- **Exposed Data**:
  - Name and normalized phone number.
  - Dietary preference tags and notes.
  - Top 3 favourite menu items and previous order items (for 1-tap reordering).
- **Prohibited Data**:
  - **Financial Data**: Waiters have **ZERO access** to `totalSpentPaise` or `averageOrderValuePaise`.
  - **Analytics**: Waiters **CANNOT view** customer segments (`regular`, `high_value`, `inactive`, etc.) or visit frequency analytics.

### B. Owner Console (`OWNER` Role)

- **Permissions**: `customer.read`, `customer.manage`.
- **Full Access**:
  - Customer directory and automated segments.
  - Aggregate spending metrics, average order value, and order history.
  - CSV exports for accounting and business reporting.
  - Profile modification and right-to-erasure anonymization.

---

## 5. Right to Erasure & Anonymization

Under Section 12 of the DPDPA 2023, data principals have the right to request the erasure of personal data when the purpose of collection has been served.

### Anonymization Protocol:

Hard deletion of customer rows would corrupt financial accounting, GST tax compliance, and order history totals. Therefore, when an Owner invokes customer deletion (`DELETE /customers/:id`):

1. **Name** is erased (`NULL`).
2. **Phone Number** is replaced with a cryptographic pseudonymous string: `+910000000000_anonymized_<UUID_PREFIX>`.
3. **Email, Birthday, Preferences, and Staff Notes** are completely wiped (`NULL` / empty).
4. **Historical Accounting Preserved**: Past `orders` and `bills` maintain their financial amounts, items sold counts, and tax breakdowns.
5. **Audit Logging**: An immutable audit event (`customer.anonymize`) is recorded with device, IP, and timestamp info.

---

## 6. Offline Storage & Local Security

- Customer lookup responses are cached in browser-local IndexedDB (`Dexie`) using an isolated `cachedCustomers` store.
- Cached records only store fields authorized for the respective logged-in role.
- Upon logout, tokens and sensitive session records are cleared.
