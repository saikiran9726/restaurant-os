import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgres://postgres:postgres@localhost:5432/restaurant_os'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Auth & Security
  JWT_SECRET: z.string().default('dev-jwt-super-secret-key-32chars-minimum!!'),
  COOKIE_SECRET: z.string().default('dev-cookie-super-secret-signing-key!!'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().default(10),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),

  // Seed credentials (initial owner setup)
  SEED_OWNER_USERNAME: z.string().default('owner'),
  SEED_OWNER_PASSWORD: z.string().default('RestaurantOwner123!'),
  SEED_RESTAURANT_NAME: z.string().default('The Grand Bistro'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
