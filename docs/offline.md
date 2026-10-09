# Restaurant OS: Offline Architecture & Local Hub Guide

## 1. Honest Scope & Operational Guarantees

In hospitality operations, data loss or silent order duplication cannot be tolerated. The architecture operates under three distinct connection topologies:

### Topology Modes

1. **With Local Hub (Primary High-Reliability Deployment)**
   - A low-power mini-PC or laptop runs the Local Hub container on the local network (Wi-Fi/Ethernet).
   - Waiter handhelds, kitchen displays (KDS), and thermal printers communicate directly with the Local Hub.
   - **During Internet Outages**: Waiters order, KOTs print, kitchen staff mark orders preparing/ready, and cash bills settle continuously with zero disruption.
   - **When Internet Returns**: The Hub reconciles batched operational logs with the cloud sequentially without duplicates.
2. **Without Local Hub (Direct Cloud Deployment)**
   - Each handheld device operates standalone with local IndexedDB (Dexie) outbox storage.
   - **During Internet Outages**: Orders created on device A **will not reach** kitchen device B until cloud connectivity is restored. Devices display an honest offline warning banner.
3. **Hub or Wi-Fi Failure (Fallback)**
   - If the Local Hub or router goes down, all devices gracefully drop to standalone per-device offline storage. No transactions are discarded.

---

## 2. Single-Writer Topology & Data Domain Ownership

To avoid split-brain conflicts and distributed deadlocks, domains enforce strict single-writer rules:

| Data Domain                                                                   | Authoritative Writer               | Direction       | Conflict Invariant                                   |
| ----------------------------------------------------------------------------- | ---------------------------------- | --------------- | ---------------------------------------------------- |
| **Operational Transactions** (Orders, Items, KOTs, Bills, Payments)           | **Local Hub** (or Cloud if no Hub) | Hub $\to$ Cloud | Sequence numbered log (`seq`), monotonic, idempotent |
| **Configuration Data** (Menu, Categories, Modifiers, Prices, Settings, Staff) | **Cloud Console**                  | Cloud $\to$ Hub | Version vector checks, applied atomically on pull    |
| **Audit Log & Reviews**                                                       | **Both**                           | Merged          | Append-only                                          |

---

## 3. Strict Conflict Resolution Rules

1. **Order Line Additions**:
   - Commutative. Multiple devices adding lines to an order are merged by line items in arrival sequence.
2. **Concurrent Table Orders (Collision Rule)**:
   - If Device 1 and Device 2 both open an order on Table 4 offline, **both orders are preserved**.
   - Neither order is silently merged or discarded.
   - The second order is marked with a table collision review flag (`table_collision`) for the waiter/manager to bill separately. Table merging is prohibited to prevent lost revenue.
3. **KOT State Machine**:
   - Forward-only: $\text{new} \to \text{preparing} \to \text{ready} \to \text{served}$.
   - Out-of-order or stale backward updates arriving later are ignored and logged in audit trails.
4. **Duplicate Payments**:
   - If a payment arrives for a bill that is already marked `paid`, the payment is recorded, marked with `[POSSIBLE DUPLICATE PAYMENT]`, and immediately routed to the **Owner Conflict Review Queue** (`/owner/sync/problems`). No funds are silently discarded or auto-refunded.
5. **Bill Generation**:
   - A bill can be generated once per order version. Concurrent duplicate requests return the existing bill.

---

## 4. Failure Handling & Poison Command Isolation

- **Exponential Backoff**: Failed network requests retry with randomized jitter ($1\text{s}, 2\text{s}, 4\text{s}, 8\text{s}, \dots$).
- **Dead-Letter Queue**: If a command fails 5 consecutive attempts or triggers an unrecoverable validation error, it is moved to `dead_letter_commands`.
- **Sync Problems Screen (`/owner/sync/problems`)**:
  - Owners and managers can inspect failed payloads, review errors, retry replay, or discard with an audited reason.
  - Data is never deleted without an explicit owner action.

---

## 5. Transport Security & Network Requirements

1. **Android / Mobile Handhelds (Capacitor)**:
   - Configured via Android Network Security Config (`res/xml/network_security_config.xml`) to permit cleartext HTTP exclusively to the designated local IP subnet (e.g. `192.168.1.0/24`).
2. **Browser / Web**:
   - Progressive Web Apps (PWA) operating over plain HTTP on LAN do not support ServiceWorker offline caches due to browser TLS security boundaries. Production browser kiosks must use the Local Hub reverse-proxy with a locally trusted certificate or Android wrapper app.
