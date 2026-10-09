export interface SyncCommandBatchItem {
  id: string; // client-generated UUIDv7
  idempotencyKey: string;
  deviceId: string;
  claimedAt?: string | null; // device timestamp (ISO)
  baseVersion?: number | null;
  type: string; // e.g. 'order.create', 'order.update', 'kot.status', 'payment.record', 'bill.generate'
  payload: Record<string, any>;
}

export interface SyncPushBatchRequest {
  restaurantId: string;
  deviceId: string;
  batchId: string;
  commands: SyncCommandBatchItem[];
}

export interface SyncPushCommandResult {
  commandId: string;
  idempotencyKey: string;
  seq: number;
  status: 'applied' | 'duplicate' | 'rejected' | 'conflict';
  serverTimestamp: string;
  resultPayload?: Record<string, any>;
  errorMessage?: string;
}

export interface SyncPushBatchResponse {
  success: boolean;
  batchId: string;
  lastSeq: number;
  results: SyncPushCommandResult[];
}

export interface SyncEventItem {
  seq: number;
  restaurantId: string;
  deviceId: string;
  commandId: string;
  idempotencyKey: string;
  type: string;
  payload: Record<string, any>;
  serverTimestamp: string;
  appliedAt: string;
}

export interface SyncPullResponse {
  success: boolean;
  lastSeq: number;
  hasMore: boolean;
  events: SyncEventItem[];
}

export interface DeviceRegistryItem {
  id: string;
  restaurantId: string;
  name: string;
  role: 'waiter' | 'kitchen' | 'pos' | 'hub';
  appVersion?: string | null;
  lastSeen: string;
  createdAt: string;
}

export interface HubRegistryItem {
  id: string;
  restaurantId: string;
  deviceId: string;
  name: string;
  hostAddress: string;
  isActive: boolean;
  lastHeartbeat: string;
  lastSyncedSeq: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeadLetterCommandItem {
  id: string;
  restaurantId: string;
  commandId: string;
  idempotencyKey: string;
  deviceId: string;
  type: string;
  payload: Record<string, any>;
  errorMessage: string;
  attempts: number;
  status: 'dead_letter' | 'replayed' | 'discarded';
  discardReason?: string | null;
  discardedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictReviewItem {
  id: string;
  restaurantId: string;
  type: 'duplicate_payment' | 'table_collision' | 'order_concurrent_edit';
  referenceId: string;
  severity: 'warning' | 'critical';
  details: Record<string, any>;
  status: 'pending' | 'resolved' | 'acknowledged';
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface SyncStatusOverview {
  currentSeq: number;
  activeHub: HubRegistryItem | null;
  pendingDeadLettersCount: number;
  pendingConflictsCount: number;
  devicesCount: number;
  isCloudWriter: boolean;
}
