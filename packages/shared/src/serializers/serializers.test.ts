import { describe, it, expect } from 'vitest';
import { serializeKitchenOrder, serializeOrderForRole, type OrderPayload } from './index.js';

describe('Per-Role Data Serializers', () => {
  const sampleOrder: OrderPayload = {
    id: 'ord-123',
    restaurantId: 'rest-456',
    tableNumber: 'T-04',
    waiterId: 'waiter-789',
    waiterName: 'Rahul S.',
    status: 'preparing',
    customerName: 'Anand Verma',
    customerPhone: '+919876543210',
    totalPaise: 185000,
    items: [
      {
        id: 'item-1',
        name: 'Butter Chicken',
        qty: 1,
        diet: 'nonveg',
        notes: 'Less spicy',
        pricePaise: 42000,
      },
      {
        id: 'item-2',
        name: 'Garlic Naan',
        qty: 2,
        diet: 'veg',
        pricePaise: 9000,
      },
    ],
    createdAt: '2026-10-08T12:00:00.000Z',
  };

  it('kitchen serializer strips all price fields and customer PII', () => {
    const kitchenView = serializeKitchenOrder(sampleOrder);

    // Snapshot check
    expect(kitchenView).toMatchInlineSnapshot(`
      {
        "createdAt": "2026-10-08T12:00:00.000Z",
        "id": "ord-123",
        "items": [
          {
            "diet": "nonveg",
            "id": "item-1",
            "name": "Butter Chicken",
            "notes": "Less spicy",
            "qty": 1,
          },
          {
            "diet": "veg",
            "id": "item-2",
            "name": "Garlic Naan",
            "notes": undefined,
            "qty": 2,
          },
        ],
        "restaurantId": "rest-456",
        "status": "preparing",
        "tableNumber": "T-04",
        "waiterName": "Rahul S.",
      }
    `);

    // Explicit assertions verifying absence of sensitive keys
    expect(kitchenView).not.toHaveProperty('totalPaise');
    expect(kitchenView).not.toHaveProperty('customerName');
    expect(kitchenView).not.toHaveProperty('customerPhone');

    for (const item of kitchenView.items) {
      expect(item).not.toHaveProperty('pricePaise');
    }
  });

  it('serializeOrderForRole routes KITCHEN role to sanitized view and WAITER to full view', () => {
    const kitchenResult = serializeOrderForRole(sampleOrder, 'KITCHEN');
    expect(kitchenResult).not.toHaveProperty('totalPaise');
    expect(kitchenResult).not.toHaveProperty('customerPhone');

    const waiterResult = serializeOrderForRole(sampleOrder, 'WAITER');
    expect(waiterResult).toHaveProperty('totalPaise', 185000);
    expect(waiterResult).toHaveProperty('customerPhone', '+919876543210');
  });
});
