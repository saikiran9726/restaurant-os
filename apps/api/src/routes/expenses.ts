import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ExpensesService } from '../services/expenses.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import {
  Permissions,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  copyRecurringExpensesSchema,
  saveMonthlySnapshotSchema,
} from '@restaurant-os/shared';

export async function expensesRoutes(app: FastifyInstance): Promise<void> {
  // Register permissions in central route registry for automated audits
  registerRouteGuard({
    method: 'GET',
    url: '/expense-categories',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/expense-categories',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/expense-categories/:id',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/expenses',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/expenses',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/expenses/:id',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/expenses/:id',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/expenses/copy-recurring',
    isPublic: false,
    permission: Permissions.EXPENSE_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/reports/month-review',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/reports/month-review/snapshot',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/reports/month-review/snapshots',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });

  // ===================== CATEGORIES =====================

  app.get(
    '/expense-categories',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const categories = await ExpensesService.listCategories(restaurantId);
      return { categories };
    },
  );

  app.post(
    '/expense-categories',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = createExpenseCategorySchema.parse(request.body);

      const category = await ExpensesService.createCategory(restaurantId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'expense_category.created',
        entity: 'expense_category',
        entityId: category.id,
        after: category as any,
        request,
      });

      return reply.status(201).send({ category });
    },
  );

  app.patch(
    '/expense-categories/:id',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const { id } = request.params as { id: string };
      const body = updateExpenseCategorySchema.parse(request.body);

      const updated = await ExpensesService.updateCategory(restaurantId, id, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'expense_category.updated',
        entity: 'expense_category',
        entityId: id,
        after: updated as any,
        request,
      });

      return { category: updated };
    },
  );

  // ===================== EXPENSES =====================

  app.get(
    '/expenses',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const query = request.query as {
        month?: string;
        categoryId?: string;
        paymentSource?: string;
      };

      const expenses = await ExpensesService.listExpenses({
        restaurantId,
        month: query.month,
        categoryId: query.categoryId,
        paymentSource: query.paymentSource,
      });

      return { expenses };
    },
  );

  app.post(
    '/expenses',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = createExpenseSchema.parse(request.body);

      const expense = await ExpensesService.createExpense(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'expense.created',
        entity: 'expense',
        entityId: expense.id,
        after: expense as any,
        request,
      });

      return reply.status(201).send({ expense });
    },
  );

  app.patch(
    '/expenses/:id',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const { id } = request.params as { id: string };
      const body = updateExpenseSchema.parse(request.body);

      const updated = await ExpensesService.updateExpense(restaurantId, id, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'expense.updated',
        entity: 'expense',
        entityId: id,
        after: updated as any,
        request,
      });

      return { expense: updated };
    },
  );

  app.delete(
    '/expenses/:id',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const { id } = request.params as { id: string };

      const result = await ExpensesService.deleteExpense(restaurantId, id);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'expense.deleted',
        entity: 'expense',
        entityId: id,
        before: result.deletedExpense as any,
        request,
      });

      return result;
    },
  );

  app.post(
    '/expenses/copy-recurring',
    { preHandler: [requirePermission(Permissions.EXPENSE_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const body = copyRecurringExpensesSchema.parse(request.body);

      const result = await ExpensesService.copyRecurringExpenses(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'expense.copied_recurring',
        entity: 'expense_batch',
        entityId: restaurantId,
        after: { copiedCount: result.copiedCount } as any,
        request,
      });

      return result;
    },
  );

  // ===================== MONTH EVALUATION & REVIEW =====================

  app.get(
    '/reports/month-review',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const query = request.query as { month?: string };
      const month = query.month || new Date().toISOString().slice(0, 7);

      const review = await ExpensesService.getMonthlyReview(restaurantId, month);
      return review;
    },
  );

  app.post(
    '/reports/month-review/snapshot',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = saveMonthlySnapshotSchema.parse(request.body);

      const snapshot = await ExpensesService.saveMonthlySnapshot(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'month_review.snapshot_created',
        entity: 'monthly_evaluation',
        entityId: snapshot.id,
        after: snapshot as any,
        request,
      });

      return reply.status(201).send({ snapshot });
    },
  );

  app.get(
    '/reports/month-review/snapshots',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const snapshots = await ExpensesService.listSnapshots(restaurantId);
      return { snapshots };
    },
  );
}
