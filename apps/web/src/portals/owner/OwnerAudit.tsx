import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Filter, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../stores/useAuthStore.js';

interface AuditItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  device: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
  } | null;
}

interface AuditResponse {
  items: AuditItem[];
  limit: number;
  offset: number;
}

export const OwnerAudit: React.FC = () => {
  const [actionFilter, setActionFilter] = useState<string>('');
  const [limit] = useState<number>(50);

  const { data, isLoading, error } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', actionFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      params.append('limit', String(limit));
      return apiFetch<AuditResponse>(`/audit-logs?${params.toString()}`);
    },
  });

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('auth.login_failure') || action.startsWith('auth.login_locked')) {
      return 'bg-danger/10 text-danger border-danger/30';
    }
    if (action.startsWith('auth.login_success')) {
      return 'bg-success/10 text-success border-success/30';
    }
    if (action.startsWith('staff.create') || action.startsWith('staff.reactivate')) {
      return 'bg-accent/10 text-accent border-accent/30';
    }
    if (action.startsWith('staff.deactivate')) {
      return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
    }
    return 'bg-surface-elevated text-content-secondary border-surface-border';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-title font-extrabold text-content-primary">System Audit Trail</h2>
        <p className="text-caption text-content-secondary mt-1">
          Immutable security activity log recording logins, staff provisioning, credential resets,
          and permission changes.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-surface-card border border-surface-border rounded-2xl">
        <div className="flex items-center gap-2 text-content-secondary text-sm font-semibold">
          <Filter className="w-4 h-4" />
          <span>Filter by Action:</span>
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          aria-label="Filter audit logs by action"
          className="h-9 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">All Actions</option>
          <option value="auth.login_success">auth.login_success</option>
          <option value="auth.login_failure">auth.login_failure</option>
          <option value="auth.login_locked">auth.login_locked</option>
          <option value="auth.logout">auth.logout</option>
          <option value="staff.create">staff.create</option>
          <option value="staff.edit">staff.edit</option>
          <option value="staff.deactivate">staff.deactivate</option>
          <option value="staff.reactivate">staff.reactivate</option>
          <option value="staff.role_change">staff.role_change</option>
          <option value="staff.reset_credential">staff.reset_credential</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-content-muted">Loading audit records...</div>
        ) : error ? (
          <div className="p-8 text-center text-danger">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-semibold">Unable to fetch audit logs</p>
            <p className="text-xs text-content-secondary mt-1">{(error as Error).message}</p>
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="p-12 text-center text-content-muted">
            <Shield className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No audit events match the current filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated text-xs font-bold text-content-secondary uppercase tracking-wider">
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-6">Action</th>
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-6">IP / Device</th>
                  <th className="py-3 px-6">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-sm font-mono">
                {data?.items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-3 px-6 text-xs text-content-secondary whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-6 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold ${getActionBadgeColor(
                          item.action,
                        )}`}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-xs text-content-primary">
                      {item.user ? (
                        <span>
                          {item.user.name}{' '}
                          <span className="text-content-muted">(@{item.user.username})</span>
                        </span>
                      ) : (
                        <span className="text-content-muted italic">System / Anonymous</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-xs text-content-muted max-w-[180px] truncate">
                      {item.ip || '—'} {item.device ? `• ${item.device}` : ''}
                    </td>
                    <td className="py-3 px-6 text-xs text-content-secondary max-w-[240px] truncate">
                      {item.after
                        ? JSON.stringify(item.after)
                        : item.before
                          ? JSON.stringify(item.before)
                          : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerAudit;
