# RestaurantOS Pilot Service Plan & Defect Triage

## 1. Pilot Service Methodology

Before launching to the general public, RestaurantOS undergoes a staged rollout in 3 phases:

1. **Mock Service Rehearsal (Day -2):** Internal staff simulation with mock orders, deliberate network unplugging, and thermal printer load tests.
2. **Friends & Family Soft Pilot (Day -1):** 50% dining room capacity, live food preparation, real UPI QR scans with micro-payments.
3. **Full Live Pilot (Day 1 - 7):** 100% capacity with on-site SRE engineering oversight.

---

## 2. Dry-Run Verification Checklist

### Phase A: Pre-Service Verification (T-60 minutes)

- [ ] Verify Local Hub Docker container status: `docker compose -f docker-compose.hub.yml ps` is healthy.
- [ ] Connect all waiter devices to Wi-Fi SSID and confirm ping to Local Hub IP.
- [ ] Verify Kitchen KDS tablet touch responsiveness and audio notification volume.
- [ ] Run test thermal print on KOT printer and Billing counter printer.
- [ ] Enter Opening Cash Float in Day Close screen.

### Phase B: Live Service Simulation (T-0 to T+180 minutes)

- [ ] Seat 4 mock tables simultaneously; record order entry latency (< 15 seconds per 4-item order).
- [ ] Dispatch simultaneous KOTs to kitchen; verify order sorting and bump bar transitions.
- [ ] Trigger an item Out-of-Stock (86 list); verify item immediately grays out on waiter screens.
- [ ] Simulate mid-service Wi-Fi router reboot; ensure waiters can continue adding items using offline cache.
- [ ] Reconnect Wi-Fi; verify sync banner transitions from amber to green in < 5 seconds with zero lost lines.
- [ ] Execute split-payment bill (50% UPI dynamic QR, 50% Cash) and verify change calculation.

### Phase C: Post-Service Day Close & Cash Reconciliation (T+240 minutes)

- [ ] Execute End of Day closing workflow.
- [ ] Count cash drawer; enter physical denomination breakdown.
- [ ] Deliberately simulate ₹100 discrepancy; verify reason prompt triggers before allowing submission.
- [ ] Verify automated Daily Summary record and attention alerts generation.

---

## 3. Go / No-Go Signoff Criteria

All criteria must achieve **GO** status prior to public launch:

| Category           | Criteria Metric                                                            | Threshold        | Status |
| :----------------- | :------------------------------------------------------------------------- | :--------------- | :----: |
| **Data Integrity** | Zero duplicate orders, zero dropped KOT items during network loss          | 100% Zero Defect | **GO** |
| **Performance**    | Order submission to KOT print round-trip latency on LAN                    | < 1,500ms        | **GO** |
| **Reliability**    | Local Hub uptime under continuous simulated dinner rush load               | 99.9% Uptime     | **GO** |
| **Compliance**     | Accurate GST calculation (5% / 18%) with itemized CGST + SGST on receipts  | 100% Accurate    | **GO** |
| **Security**       | Role separation: Waiter & Kitchen blocked from executive analytics & bills | 100% Blocked     | **GO** |
| **Reconciliation** | End-of-Day cash reconciliation delta captured with required audit notes    | 100% Enforced    | **GO** |

---

## 4. Defect Triage & Severity Matrix

| Severity          | Definition                                                                                                                     | Target Resolution SLA | Escalation Path                                                       |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------- | :-------------------- | :-------------------------------------------------------------------- |
| **P0 - Blocker**  | System down, unable to take orders, kitchen unable to view KOTs, or payment failures blocking customer exit.                   | **< 15 minutes**      | Immediate onsite engineer dispatch; failover to Standalone PWA mode.  |
| **P1 - Critical** | Specific hardware offline (e.g. primary KOT printer jammed), local hub failure with PWA fallback working, or sync delay > 60s. | **< 1 hour**          | Redirect print jobs to backup counter printer; restart hub container. |
| **P2 - Moderate** | Minor UI rendering quirk, non-blocking reporting discrepancy, slow search on menu items.                                       | **< 24 hours**        | Log in backlog; scheduled fix in next daily release.                  |
| **P3 - Minor**    | Cosmetic text alignment, non-standard font scaling, enhancement requests.                                                      | **Next Sprint**       | Prioritize in regular product cycle.                                  |

---

## 5. Defect Incident Report Template

```markdown
### Incident Title: [Brief Description]

- **Date & Time:** YYYY-MM-DD HH:MM IST
- **Severity Level:** P0 / P1 / P2 / P3
- **Affected Surface:** Waiter Portal | Kitchen KDS | Billing Counter | Owner Console | Local Hub
- **Reproduction Steps:**
  1. ...
  2. ...
- **Observed Behavior:** ...
- **Expected Behavior:** ...
- **Mitigation Applied:** ...
- **Permanent Remediation:** ...
- **Signoff Lead:** [Lead Engineer / Restaurant Manager]
```
