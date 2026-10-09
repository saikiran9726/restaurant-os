import { z } from 'zod';

export const printerTransportSchema = z.enum(['bluetooth', 'usb', 'lan', 'browser']);
export type PrinterTransport = z.infer<typeof printerTransportSchema>;

export const printerWidthSchema = z.union([z.literal(58), z.literal(80)]);
export type PrinterWidth = z.infer<typeof printerWidthSchema>;

export const printerConfigSchema = z.object({
  id: z.string().uuid().optional(),
  restaurantId: z.string().uuid(),
  name: z.string().trim().min(1, 'Printer name is required').max(50),
  transport: printerTransportSchema.default('browser'),
  address: z.string().trim().default(''), // IP:port, MAC address, USB path, or empty for browser
  widthMm: printerWidthSchema.default(80),
  codepage: z.string().trim().default('CP437'),
  charsPerLine: z.number().int().min(20).max(80).default(48),
  autoCut: z.boolean().default(true),
  drawerPulse: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type PrinterConfig = z.infer<typeof printerConfigSchema>;

export const createPrinterSchema = z.object({
  name: z.string().trim().min(1, 'Printer name is required').max(50),
  transport: printerTransportSchema,
  address: z.string().trim().default(''),
  widthMm: printerWidthSchema.default(80),
  codepage: z.string().trim().default('CP437'),
  charsPerLine: z.number().int().min(20).max(80).optional(),
  autoCut: z.boolean().default(true),
  drawerPulse: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
});

export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;

export const updatePrinterSchema = createPrinterSchema.partial();
export type UpdatePrinterInput = z.infer<typeof updatePrinterSchema>;

export const printEventSchema = z.object({
  type: z.enum(['print', 'reprint', 'duplicate', 'test']),
  printerId: z.string().uuid().optional().nullable(),
  result: z.enum(['success', 'failed']),
  error: z.string().optional().nullable(),
  ownerPin: z.string().optional(),
});

export type PrintEventInput = z.infer<typeof printEventSchema>;

export const createPaymentRequestSchema = z.object({
  amountPaise: z.number().int().positive('Payment request amount must be greater than 0'),
  upiRef: z.string().trim().optional(),
});

export type CreatePaymentRequestInput = z.infer<typeof createPaymentRequestSchema>;
