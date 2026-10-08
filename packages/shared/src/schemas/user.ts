import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().min(1, 'User name is required').max(100),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createUserSchema = userSchema.pick({
  restaurantId: true,
  name: true,
});

export const updateUserSchema = userSchema
  .pick({
    name: true,
  })
  .partial();

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
