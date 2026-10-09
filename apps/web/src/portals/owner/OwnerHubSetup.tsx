import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../stores/useAuthStore.js';
import { useConnectionStore } from '../../stores/useConnectionStore.js';
import { Button } from '../../components/ui/Button.js';
import { ConnectionBadge } from '../../components/ConnectionBadge.js';
import { useToastStore } from '../../stores/useToastStore.js';
import {
  Server,
  Wifi,
  Cloud,
  CheckCircle2,
  XCircle,
  QrCode,
  RefreshCw,
  HardDrive,
  Info,
} from 'lucide-react';
import type { SyncStatusOverview, HubRegistryItem } from '@restaurant-os/shared';

export const OwnerHubSetup: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const {
    hubAddress,
    setHubAddress,
    activeConnection,
    isHubReachable,
    isCloudReachable,
    probeConnection,
  } = useConnectionStore();

  const [inputAddress, setInputAddress] = useState(hubAddress || '192.168.1.100:3000');
  const [isRegistering, setIsRegistering] = useState(false);
  const [hubName, setHubName] = useState('Floor Local Hub');
  const [hubApiKey, setHubApiKey] = useState('restaurant-hub-key-2026');

  const { data: statusRes, isLoading } = useQuery<{ success: boolean; data: SyncStatusOverview }>({
    queryKey: ['sync-status'],
    queryFn: () => apiFetch('/sync/status'),
    refetchInterval: 10000,
  });

  const overview = statusRes?.data;

  const registerHubMutation = useMutation({
    mutationFn: () =>
      apiFetch('/sync/hub/register', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: `hub-${Date.now().toString(36)}`,
          name: hubName,
          hostAddress: inputAddress,
          apiKey: hubApiKey,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      setHubAddress(inputAddress);
      addToast({ message: 'Local Hub registered and configured', type: 'success' });
    },
    onError: (err: any) => {
      addToast({ message: err.message || 'Failed to register Hub', type: 'danger' });
    },
  });

  const handleTestConnection = async () => {
    setHubAddress(inputAddress);
    const conn = await probeConnection();
    if (conn === 'hub') {
      addToast({ message: 'Local Hub reachable on local network!', type: 'success' });
    } else {
      addToast({ message: 'Cannot reach Local Hub at specified address.', type: 'danger' });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary flex items-center gap-2">
            <Server className="w-6 h-6 text-accent" />
            <span>Local Hub Configuration & Topology</span>
          </h2>
          <p className="text-caption text-content-secondary mt-0.5">
            Keep waiter ordering, KOT printing, and kitchen screens functioning seamlessly during
            internet outages.
          </p>
        </div>

        <ConnectionBadge />
      </div>

      {/* Honest Scope Callout */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.03] p-5 space-y-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
          <Info className="w-4 h-4" />
          <span>Honest Offline Scope & Operation Guarantee</span>
        </div>
        <ul className="text-xs text-content-secondary space-y-1.5 list-disc pl-5">
          <li>
            <strong>With Local Hub:</strong> Waiter devices, kitchen displays, and thermal printers
            continue operating normally on local Wi-Fi during an internet drop. Batched transactions
            sync automatically once internet returns.
          </li>
          <li>
            <strong>Without Local Hub:</strong> Each device works offline on its own. Orders from
            Device A will <em>not</em> reach kitchen Device B until internet returns.
          </li>
          <li>
            <strong>If Hub or Wi-Fi Fails:</strong> Devices safely fall back to per-device IndexedDB
            offline mode with zero data loss.
          </li>
        </ul>
      </div>

      {/* Hub Status Card */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-subhead font-bold text-content-primary border-b border-surface-border pb-3 flex items-center justify-between">
          <span>Hub Connection & Sync Status</span>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              probeConnection();
              queryClient.invalidateQueries({ queryKey: ['sync-status'] });
            }}
          >
            Probe Now
          </Button>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border space-y-1">
            <span className="text-[11px] font-semibold text-content-muted uppercase">
              Active Route
            </span>
            <div className="text-sm font-bold text-content-primary capitalize flex items-center gap-2">
              {activeConnection === 'hub' ? (
                <>
                  <Server className="w-4 h-4 text-emerald-500" />
                  <span>Local Hub (LAN)</span>
                </>
              ) : activeConnection === 'cloud' ? (
                <>
                  <Cloud className="w-4 h-4 text-blue-500" />
                  <span>Cloud Primary</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>Device Offline</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border space-y-1">
            <span className="text-[11px] font-semibold text-content-muted uppercase">
              Monotonic Sequence
            </span>
            <div className="text-sm font-bold text-content-primary font-mono">
              Seq #{overview?.currentSeq ?? 0}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-surface-elevated border border-surface-border space-y-1">
            <span className="text-[11px] font-semibold text-content-muted uppercase">
              Registered Devices
            </span>
            <div className="text-sm font-bold text-content-primary">
              {overview?.devicesCount ?? 0} devices
            </div>
          </div>
        </div>
      </div>

      {/* Hub Setup Form */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-subhead font-bold text-content-primary border-b border-surface-border pb-3">
          Configure Restaurant Hub Address
        </h3>

        <div className="space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-content-primary">
              Hub IP Address & Port (on Local Wi-Fi)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                placeholder="192.168.1.100:3000"
                className="flex-1 text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
              />
              <Button variant="secondary" size="md" onClick={handleTestConnection}>
                Test Link
              </Button>
            </div>
            <p className="text-[11px] text-content-secondary">
              Enter the static local IP address of the in-restaurant machine running the Hub
              container.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-content-primary">Hub Secret API Key</label>
            <input
              type="password"
              value={hubApiKey}
              onChange={(e) => setHubApiKey(e.target.value)}
              placeholder="API Key"
              className="w-full text-sm p-2.5 rounded-lg bg-surface-elevated border border-surface-border text-content-primary focus:outline-none focus:ring-1 focus:ring-accent font-mono"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              disabled={registerHubMutation.isPending}
              onClick={() => registerHubMutation.mutate()}
            >
              {registerHubMutation.isPending ? 'Registering...' : 'Save & Authorize Hub'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
