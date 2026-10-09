# Thermal Printing Hardware Compatibility Matrix

## 1. Overview & Protocol Architecture

RestaurantOS communicates with point-of-sale thermal printers using the standard **ESC/POS** byte command set. The system supports direct printing through:

- **LAN / Network Ethernet (Raw TCP Port 9100):** Recommended for Kitchen KOT printers and billing counters.
- **USB (Direct Virtual COM / libusb):** Supported on Windows/Linux POS terminals and Local Hub.
- **Bluetooth (SPP / RFCOMM):** Supported on handheld mobile waiter terminals.
- **Web Browser Print Fallback:** Modern thermal-optimized CSS printable popups for environments without direct socket access.

---

## 2. Tested & Certified Hardware Models

| Manufacturer       | Model                | Width | Interfaces Tested          | Column Width                    | Auto-Cutter    | Cash Drawer Kick        | Status               |
| :----------------- | :------------------- | :---- | :------------------------- | :------------------------------ | :------------- | :---------------------- | :------------------- |
| **Epson**          | TM-T82II / TM-T82III | 80mm  | Ethernet (LAN), USB        | 48 chars (Font A) / 64 (Font B) | Full / Partial | Dual Drawer (pin 2 & 5) | **Certified Tier 1** |
| **Epson**          | TM-m30II             | 80mm  | Ethernet, Wi-Fi, Bluetooth | 48 chars                        | Full / Partial | Single Drawer           | **Certified Tier 1** |
| **TVS-E**          | RP 3200 Star         | 80mm  | Ethernet, USB              | 42 / 48 chars                   | Partial Cut    | Supported               | **Certified Tier 1** |
| **TVS-E**          | RP 3160 Gold         | 80mm  | USB, Serial                | 42 chars                        | Partial Cut    | Supported               | **Certified Tier 1** |
| **Everycom**       | EC-58                | 58mm  | USB, Bluetooth             | 32 chars                        | Manual tear    | Not supported           | **Certified Tier 2** |
| **POS-58**         | 5890K Generic        | 58mm  | USB                        | 32 chars                        | Manual tear    | Supported (RJ11)        | **Certified Tier 2** |
| **Star Micronics** | TSP143III            | 80mm  | Ethernet, USB              | 48 chars                        | Full / Partial | Supported               | **Certified Tier 1** |
| **Sunmi**          | V2 Pro (Built-in)    | 58mm  | Internal Android Spooler   | 32 chars                        | Manual tear    | N/A                     | **Certified Tier 2** |

---

## 3. Formatting & Character Budget Guidelines

Receipt layout generation dynamically scales based on printer paper profile (`paper_width_mm: 58 | 80`):

```
+------------------------------------------------+  <-- 80mm (48 Columns)
| Table: 04              KOT #1024         19:42 |
| Server: Rahul S.              Guest Count: 04  |
| ---------------------------------------------- |
| QTY  ITEM                        MOD     NOTES |
| 2x   Paneer Butter Masala                Extra |
| 4x   Butter Naan                 Crisp         |
| 1x   Fresh Lime Soda (Sweet)                   |
| ---------------------------------------------- |
| [Special Instruction: Less spicy for kids]     |
+------------------------------------------------+

+--------------------------------+  <-- 58mm (32 Columns)
| T: 04   KOT #1024        19:42 |
| Server: Rahul S.        Guests:4|
| ------------------------------ |
| QTY ITEM                 NOTES |
| 2x  Paneer Butter Masala Extra |
| 4x  Butter Naan          Crisp |
| 1x  Fresh Lime Soda (Swt)      |
| ------------------------------ |
| [Note: Less spicy for kids]    |
+--------------------------------+
```

### Column Constraints:

- **80mm Standard:** 48 characters width. Accommodates item description, quantity, variant, and line total on a single line.
- **58mm Compact:** 32 characters width. Requires two-line wrapping for long item names and right-aligned prices.

---

## 4. Hardware Command Standards (ESC/POS)

| Action                   | Hex Command Sequence                | Description                                            |
| :----------------------- | :---------------------------------- | :----------------------------------------------------- |
| **Initialize Printer**   | `1B 40` (`ESC @`)                   | Clears print buffer and restores default character set |
| **Line Feed**            | `0A` (`LF`)                         | Advances paper by 1 line                               |
| **Paper Cut (Partial)**  | `1D 56 42 00` (`GS V 66 0`)         | Partial feed and cut (preserves connected stub)        |
| **Paper Cut (Full)**     | `1D 56 00` (`GS V 0`)               | Complete severance of paper                            |
| **Drawer Kick (Pin 2)**  | `1B 70 00 19 FA` (`ESC p 0 25 250`) | 50ms pulse to 24V solenoid cash drawer pin 2           |
| **Drawer Kick (Pin 5)**  | `1B 70 01 19 FA` (`ESC p 1 25 250`) | Pulse to drawer pin 5                                  |
| **QR Code Model 2**      | `1D 28 6B 04 00 31 41 32 00`        | Native hardware 2D QR rendering for UPI payment links  |
| **Character Code Table** | `1B 74 00` (`ESC t 0`)              | Page 0 [PC437: USA, Standard Europe]                   |

---

## 5. Fault Tolerance & Spooler Recovery

1. **Paper-Out & Cover-Open Telemetry:** For networked printers, `GET_STATUS` (`DLE EOT 1`) runs before spooling. If paper is out, the print job pauses in `PENDING` state with an alert dispatched to the cashier console.
2. **Offline Local Buffer:** If the printer's TCP port (9100) fails to respond within 2500ms, the command worker retries 3 times before marking the job `RETRYING`.
3. **Failover Redirection:** Owners can configure fallback printers (e.g. if Kitchen KOT Printer 1 is unreachable, print automatically to Backup KOT Printer 2 or Cashier Counter).
