# Realtime Layer Architecture & Events

The Restaurant OS Realtime layer is powered by **Socket.IO** mounted on top of Fastify. It provides sub-second event broadcasts across role-scoped rooms (`kitchen`, `floor`, `owner`) with JWT authentication, replay protection, and catch-up synchronization on reconnection.

---

## 1. Authentication & Room Authorisation

### Handshake Authentication

Every client socket connection must provide an authenticated JWT Bearer token either in `auth.token` or in the `Authorization: Bearer <token>` header:

```typescript
const socket = io(SERVER_URL, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

Handshake rejects invalid or expired tokens immediately with an authentication error.

### Role-Scoped Rooms

Upon successful handshake, the server inspects the caller's role and automatically binds the connection to isolated rooms:

- **`restaurant:{restaurantId}`**: Base restaurant room for system-wide alerts.
- **`restaurant:{restaurantId}:kitchen`**: Joined by `KITCHEN`, `MANAGER`, and `OWNER`.
- **`restaurant:{restaurantId}:floor`**: Joined by `WAITER`, `MANAGER`, and `OWNER`.
- **`restaurant:{restaurantId}:owner`**: Joined strictly by `OWNER` and `MANAGER`.

> [!SECURITY]
> Server-side authorisation prevents unauthorized room joins:
> Waiters attempting to emit `join_room` targeting `:owner` or `:kitchen` are rejected server-side with an `Unauthorized` acknowledgment.

---

## 2. Reconnection & Catch-Up Cursor

When a mobile device or tablet disconnects (e.g. Wi-Fi drop on floor):

1. The client maintains `lastEventTimestamp` (cursor).
2. Upon reconnecting, the client emits `catch_up`:
   ```typescript
   socket.emit('catch_up', { since: lastEventTimestamp }, (missedEvents) => {
     for (const ev of missedEvents) {
       handleIncomingRealtimeEvent(ev.event, ev.data);
     }
   });
   ```
3. The server maintains a ring buffer of recent events per restaurant (up to 500 entries) and replays any missed events in order.

---

## 3. Realtime Events Specification

| Event Name                 | Target Room        | Payload                                       | Purpose                                                                                                      |
| :------------------------- | :----------------- | :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `kot.created`              | `kitchen`, `floor` | `{ kotId, orderId, kotNumber, type, status }` | Emitted when a new, additional, or modified KOT is dispatched.                                               |
| `kot.updated`              | `all`              | `{ kotId, status, seenAt }`                   | Emitted when kitchen marks a KOT seen.                                                                       |
| `kot.itemDone`             | `all`              | `{ kotItemId, kotId, orderId }`               | Emitted when a cook marks an item prepared.                                                                  |
| `kot.statusChanged`        | `all`              | `{ kotId, orderId, status }`                  | Emitted when KOT transitions (e.g. `preparing`, `ready`, `served`).                                          |
| `order.ready`              | `floor`            | `{ orderId, tableId }`                        | Emitted when all active KOT items for an order are done. Waiter UI triggers tile pulse & haptic/audio alert. |
| `table.statusChanged`      | `all`              | `{ tableId, status }`                         | Emitted when table status shifts (`occupied`, `preparing`, `ready`).                                         |
| `menu.availabilityChanged` | `all`              | `{ itemId, available, oosReason }`            | Emitted when item is marked out-of-stock or returned to stock. Instantly greys out item and blocks addition. |

---

## 4. Kitchen Privacy & Data Shaping

Responses served to the kitchen or emitted over kitchen streams strictly omit customer profiles, prices, payment details, and discounts. Sanitization is enforced via `serializeKitchenState` and `serializeMenuForRole`.
