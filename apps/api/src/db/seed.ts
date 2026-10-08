import { eq } from 'drizzle-orm';
import {
  Permissions,
  Roles,
  ROLE_DEFAULT_PERMISSIONS,
  generateUuidV7,
} from '@restaurant-os/shared';
import { db, closeDatabaseConnection } from './client.js';
import { restaurants } from './schema/restaurants.js';
import { roles } from './schema/roles.js';
import { permissions } from './schema/permissions.js';
import { rolePermissions } from './schema/role-permissions.js';
import { users } from './schema/users.js';
import { hashPassword } from '../auth/crypto.js';
import { env } from '../config/env.js';

/**
 * Seed script for Restaurant OS.
 *
 * 1. Seeds standard roles: OWNER, WAITER, KITCHEN, MANAGER, CASHIER.
 *    NOTE: MANAGER and CASHIER are seeded into the database, allowing their permission sets
 *    to be configured or modified dynamically via database rows without code changes.
 * 2. Seeds all 25 granular system permissions.
 * 3. Associates roles with their default permissions via role_permissions.
 * 4. Ensures a default restaurant exists.
 * 5. Creates the initial OWNER user using SEED_OWNER_USERNAME and SEED_OWNER_PASSWORD env vars.
 */
export async function seed(): Promise<void> {
  console.log('--- Starting Database Seed ---');

  // 1. Seed Roles
  const allRoles = [
    { name: Roles.OWNER, description: 'Restaurant owner with full system access' },
    { name: Roles.WAITER, description: 'Floor staff handling table service and order taking' },
    { name: Roles.KITCHEN, description: 'Kitchen display screen staff managing orders & KOTs' },
    { name: Roles.MANAGER, description: 'Floor manager managing shifts, staff, and discounts' },
    { name: Roles.CASHIER, description: 'Billing counter staff processing payments and bills' },
  ];

  const roleIdMap = new Map<string, string>();

  for (const r of allRoles) {
    const [existing] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, r.name))
      .limit(1);
    if (existing) {
      roleIdMap.set(r.name, existing.id);
    } else {
      const id = generateUuidV7();
      await db.insert(roles).values({
        id,
        name: r.name,
        description: r.description,
      });
      roleIdMap.set(r.name, id);
      console.log(`+ Seeded role: ${r.name}`);
    }
  }

  // 2. Seed Permissions
  const allPermissions = Object.values(Permissions);
  const permissionIdMap = new Map<string, string>();

  for (const permName of allPermissions) {
    const [existing] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.name, permName))
      .limit(1);

    if (existing) {
      permissionIdMap.set(permName, existing.id);
    } else {
      const id = generateUuidV7();
      await db.insert(permissions).values({
        id,
        name: permName,
        description: `Permission to ${permName}`,
      });
      permissionIdMap.set(permName, id);
      console.log(`+ Seeded permission: ${permName}`);
    }
  }

  // 3. Seed Role-Permissions
  for (const [roleName, permList] of Object.entries(ROLE_DEFAULT_PERMISSIONS)) {
    const roleId = roleIdMap.get(roleName);
    if (!roleId) continue;

    for (const permName of permList) {
      const permId = permissionIdMap.get(permName);
      if (!permId) continue;

      try {
        await db
          .insert(rolePermissions)
          .values({
            roleId,
            permissionId: permId,
            discountCapPercent:
              roleName === Roles.OWNER ? 100 : roleName === Roles.MANAGER ? 25 : 10,
          })
          .onConflictDoNothing();
      } catch {
        // Already exists
      }
    }
  }
  console.log('+ Seeded role permissions matrix');

  // 4. Ensure Default Restaurant
  let restaurantId: string;
  const [existingRest] = await db.select({ id: restaurants.id }).from(restaurants).limit(1);
  if (existingRest) {
    restaurantId = existingRest.id;
  } else {
    restaurantId = generateUuidV7();
    await db.insert(restaurants).values({
      id: restaurantId,
      name: 'Restaurant OS Flagship',
    });
    console.log(`+ Seeded default restaurant: 'Restaurant OS Flagship'`);
  }

  // 5. Seed Initial Owner User from env
  const ownerUsername = env.SEED_OWNER_USERNAME || 'owner';
  const ownerPassword = env.SEED_OWNER_PASSWORD;

  if (!ownerPassword) {
    console.warn(
      '⚠️ SEED_OWNER_PASSWORD not set in environment. Skipping initial owner user creation.',
    );
  } else {
    const [existingOwner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, ownerUsername))
      .limit(1);

    if (existingOwner) {
      console.log(`ℹ️ Owner user '${ownerUsername}' already exists.`);
    } else {
      const ownerRoleId = roleIdMap.get(Roles.OWNER)!;
      const passwordHash = await hashPassword(ownerPassword);
      const ownerId = generateUuidV7();

      await db.insert(users).values({
        id: ownerId,
        restaurantId,
        roleId: ownerRoleId,
        name: 'Chief Owner',
        username: ownerUsername,
        passwordHash,
        active: true,
        failedAttempts: 0,
      });
      console.log(`+ Seeded initial owner user: '${ownerUsername}'`);
    }
  }

  console.log('--- Database Seed Completed Successfully ---');
}

// Allow running directly via tsx
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seed()
    .then(async () => {
      await closeDatabaseConnection();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await closeDatabaseConnection();
      process.exit(1);
    });
}
