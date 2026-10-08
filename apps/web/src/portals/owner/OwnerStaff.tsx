import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users2,
  Plus,
  KeyRound,
  UserX,
  UserCheck,
  ShieldAlert,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Overlay.js';
import { RoleBadge } from '../../components/RoleBadge.js';
import { PasswordField } from '../../components/PasswordField.js';
import { apiFetch } from '../../stores/useAuthStore.js';
import { Roles } from '@restaurant-os/shared';
import { useToastStore } from '../../stores/useToastStore.js';

interface StaffMember {
  id: string;
  name: string;
  username: string;
  role: string;
  active: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export const OwnerStaff: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  // One-time credential display modal
  const [oneTimeCredential, setOneTimeCredential] = useState<{
    username: string;
    type: string;
    value: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<string>(Roles.WAITER);
  const [credentialType, setCredentialType] = useState<'password' | 'pin'>('pin');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Query staff list
  const {
    data: staffList = [],
    isLoading,
    error,
  } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: () => apiFetch<StaffMember[]>('/staff'),
  });

  // Create Staff Mutation
  const createMutation = useMutation({
    mutationFn: (newStaff: {
      name: string;
      username: string;
      role: string;
      credentialType: 'password' | 'pin';
      password?: string;
      pin?: string;
    }) =>
      apiFetch<{
        id: string;
        name: string;
        username: string;
        role: string;
        credential: { type: string; value: string };
      }>('/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsCreateModalOpen(false);
      resetForm();
      // Show one-time credential modal
      setOneTimeCredential({
        username: data.username,
        type: data.credential.type,
        value: data.credential.value,
      });
      addToast({
        type: 'success',
        message: `${data.name} (@${data.username}) created successfully`,
      });
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // Toggle Active (Deactivate / Reactivate)
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/staff/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      addToast({
        type: 'info',
        message: vars.active ? 'Staff reactivated' : 'Staff deactivated',
      });
    },
    onError: (err: Error) => {
      addToast({
        type: 'danger',
        message: `Action failed: ${err.message}`,
      });
    },
  });

  // Reset Credential Mutation
  const resetMutation = useMutation({
    mutationFn: ({
      id,
      credType,
      newVal,
    }: {
      id: string;
      credType: 'password' | 'pin';
      newVal?: string;
    }) =>
      apiFetch<{ credentialType: string; credentialValue: string }>(
        `/staff/${id}/reset-credential`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentialType: credType,
            password: credType === 'password' ? newVal : undefined,
            pin: credType === 'pin' ? newVal : undefined,
          }),
        },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsResetModalOpen(false);
      if (selectedStaff) {
        setOneTimeCredential({
          username: selectedStaff.username,
          type: data.credentialType,
          value: data.credentialValue,
        });
      }
      addToast({
        type: 'success',
        message: 'New credentials generated successfully.',
      });
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  const resetForm = () => {
    setName('');
    setUsername('');
    setRole(Roles.WAITER);
    setCredentialType('pin');
    setPassword('');
    setPin('');
    setFormError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !username.trim()) {
      setFormError('Name and username are required');
      return;
    }

    if (credentialType === 'password' && (!password || password.length < 10)) {
      setFormError('Password must be at least 10 characters');
      return;
    }

    if (credentialType === 'pin' && (!pin || !/^\d{4,6}$/.test(pin))) {
      setFormError('PIN must be 4 to 6 numeric digits');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      username: username.trim(),
      role,
      credentialType,
      password: credentialType === 'password' ? password : undefined,
      pin: credentialType === 'pin' ? pin : undefined,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-title font-extrabold text-content-primary">Staff Management</h2>
          <p className="text-caption text-content-secondary mt-1">
            Manage restaurant personnel, role access levels, and secure device credentials.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </Button>
      </div>

      {/* Staff Table / List */}
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-content-muted">Loading staff roster...</div>
        ) : error ? (
          <div className="p-8 text-center text-danger">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-semibold">Failed to load staff list</p>
            <p className="text-xs text-content-secondary mt-1">{(error as Error).message}</p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-12 text-center text-content-muted">
            <Users2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No staff members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated text-xs font-bold text-content-secondary uppercase tracking-wider">
                  <th className="py-3.5 px-6">Staff Member</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Last Login</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-sm">
                {staffList.map((member) => (
                  <tr key={member.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-content-primary">{member.name}</div>
                      <div className="text-xs text-content-muted">@{member.username}</div>
                    </td>
                    <td className="py-4 px-6">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          member.active
                            ? 'bg-success/10 text-success'
                            : 'bg-surface-elevated text-content-muted'
                        }`}
                      >
                        {member.active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-content-secondary">
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleString()
                        : 'Never logged in'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Reset Credential */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStaff(member);
                            setCredentialType(member.role === Roles.OWNER ? 'password' : 'pin');
                            setPassword('');
                            setPin('');
                            setFormError(null);
                            setIsResetModalOpen(true);
                          }}
                          className="text-accent hover:bg-accent/10"
                          title="Reset Password or PIN"
                        >
                          <KeyRound className="w-4 h-4 mr-1" />
                          <span>Reset</span>
                        </Button>

                        {/* Deactivate / Reactivate Toggle */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: member.id,
                              active: !member.active,
                            })
                          }
                          className={
                            member.active
                              ? 'text-danger hover:bg-danger/10'
                              : 'text-success hover:bg-success/10'
                          }
                          title={member.active ? 'Deactivate Account' : 'Reactivate Account'}
                        >
                          {member.active ? (
                            <>
                              <UserX className="w-4 h-4 mr-1" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 mr-1" />
                              <span>Activate</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE STAFF MODAL */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Staff Member"
        description="Create an account and assign portal permissions. Credentials will be displayed once."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-caption flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rahul_waiter"
              className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  if (e.target.value === Roles.OWNER || e.target.value === Roles.MANAGER) {
                    setCredentialType('password');
                  } else {
                    setCredentialType('pin');
                  }
                }}
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm"
              >
                <option value={Roles.WAITER}>WAITER (Floor Portal)</option>
                <option value={Roles.KITCHEN}>KITCHEN (KDS Display)</option>
                <option value={Roles.MANAGER}>MANAGER</option>
                <option value={Roles.CASHIER}>CASHIER</option>
                <option value={Roles.OWNER}>OWNER (Console)</option>
              </select>
            </div>

            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                Credential Type
              </label>
              <select
                value={credentialType}
                onChange={(e) => setCredentialType(e.target.value as 'password' | 'pin')}
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm"
              >
                <option value="pin">4–6 Digit PIN (Shared Device)</option>
                <option value="password">Password (Console Login)</option>
              </select>
            </div>
          </div>

          {credentialType === 'password' ? (
            <PasswordField
              label="Initial Password (min 10 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
              required
            />
          ) : (
            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                Initial PIN (4 to 6 digits)
              </label>
              <input
                type="text"
                pattern="\d{4,6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 1234"
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent text-sm text-center font-mono tracking-widest"
                required
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Create Staff
            </Button>
          </div>
        </form>
      </Dialog>

      {/* RESET CREDENTIAL MODAL */}
      <Dialog
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={`Reset Credentials: ${selectedStaff?.name}`}
        description="Issue a new password or PIN. The new credential will be revealed once."
      >
        <div className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-caption flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-caption font-semibold text-content-secondary mb-1">
              Credential Type
            </label>
            <select
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value as 'password' | 'pin')}
              className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary text-sm"
            >
              <option value="pin">4–6 Digit PIN</option>
              <option value="password">Password</option>
            </select>
          </div>

          {credentialType === 'password' ? (
            <PasswordField
              label="New Password (leave empty to auto-generate)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty for auto-generated"
            />
          ) : (
            <div>
              <label className="block text-caption font-semibold text-content-secondary mb-1">
                New PIN (leave empty to auto-generate)
              </label>
              <input
                type="text"
                pattern="\d{4,6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Leave blank for 4-digit random"
                className="w-full h-10 px-3 rounded-lg border border-surface-border bg-surface-elevated text-content-primary text-sm text-center font-mono tracking-widest"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsResetModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={resetMutation.isPending}
              onClick={() => {
                if (selectedStaff) {
                  resetMutation.mutate({
                    id: selectedStaff.id,
                    credType: credentialType,
                    newVal:
                      credentialType === 'password' ? password || undefined : pin || undefined,
                  });
                }
              }}
            >
              Confirm Reset
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ONE-TIME CREDENTIAL REVEAL MODAL */}
      <Dialog
        isOpen={!!oneTimeCredential}
        onClose={() => setOneTimeCredential(null)}
        title="Staff Credential Generated"
        description="Please copy or share this credential now. It will NOT be shown again in plain text."
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Security policy: Passwords and PINs are argon2id-hashed immediately. This is the only
              opportunity to view or write down the initial credentials.
            </p>
          </div>

          <div className="bg-surface-elevated p-4 rounded-xl border border-surface-border space-y-3 font-mono text-sm">
            <div className="flex justify-between items-center">
              <span className="text-content-secondary text-xs">Username:</span>
              <span className="font-bold text-content-primary">@{oneTimeCredential?.username}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-content-secondary text-xs">
                {oneTimeCredential?.type.toUpperCase()}:
              </span>
              <span className="font-extrabold text-accent text-base tracking-wider bg-accent/10 px-2 py-0.5 rounded">
                {oneTimeCredential?.value}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              className="flex items-center gap-2"
              onClick={() =>
                copyToClipboard(
                  `Username: ${oneTimeCredential?.username}\nCredential: ${oneTimeCredential?.value}`,
                )
              }
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Credentials'}</span>
            </Button>

            <Button variant="primary" size="md" onClick={() => setOneTimeCredential(null)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default OwnerStaff;
