import { describe, it, expect } from 'vitest';
import { serializeKitchenMenuItem, serializeMenuForRole, type MenuItemView } from './index.js';

describe('Menu Item Serializers', () => {
  const sampleItems: MenuItemView[] = [
    {
      id: '018f9e1e-2895-7800-9831-111111111111',
      categoryId: '018f9e1e-2895-7800-9831-222222222222',
      categoryName: 'Biryani',
      name: 'Hyderabadi Dum Biryani',
      aliases: ['biryani', 'briyani'],
      isVeg: false,
      pricePaise: 35000,
      available: true,
      oosReason: null,
      sortOrder: 0,
      modifierGroupIds: [],
    },
    {
      id: '018f9e1e-2895-7800-9831-333333333333',
      categoryId: '018f9e1e-2895-7800-9831-222222222222',
      categoryName: 'Biryani',
      name: 'Paneer Biryani',
      aliases: ['veg biryani'],
      isVeg: true,
      pricePaise: 28000,
      available: true,
      oosReason: null,
      sortOrder: 1,
      modifierGroupIds: [],
    },
  ];

  it('serializeKitchenMenuItem completely removes pricePaise', () => {
    const serialized = serializeKitchenMenuItem(sampleItems[0]!);
    expect(serialized).not.toHaveProperty('pricePaise');
    expect((serialized as any).pricePaise).toBeUndefined();
    expect(serialized.name).toBe('Hyderabadi Dum Biryani');
    expect(serialized.isVeg).toBe(false);
  });

  it('serializeMenuForRole preserves price for WAITER and OWNER', () => {
    const waiterMenu = serializeMenuForRole(sampleItems, 'WAITER');
    expect(waiterMenu[0]).toHaveProperty('pricePaise', 35000);

    const ownerMenu = serializeMenuForRole(sampleItems, 'OWNER');
    expect(ownerMenu[0]).toHaveProperty('pricePaise', 35000);
  });

  it('serializeMenuForRole strictly strips price keys for KITCHEN', () => {
    const kitchenMenu = serializeMenuForRole(sampleItems, 'KITCHEN');
    for (const item of kitchenMenu) {
      expect(item).not.toHaveProperty('pricePaise');
      expect((item as any).pricePaise).toBeUndefined();
    }
  });
});
