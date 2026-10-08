import { z } from 'zod';

export const restaurantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Restaurant name is required').max(100),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createRestaurantSchema = restaurantSchema.pick({
  name: true,
});

export const updateRestaurantSchema = restaurantSchema
  .pick({
    name: true,
  })
  .partial();

export type Restaurant = z.infer<typeof restaurantSchema>;
export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
