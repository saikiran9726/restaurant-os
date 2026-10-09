import React from 'react';
import { useConnectionStore } from '../stores/useConnectionStore.js';
import { Server, Cloud, WifiOff } from 'lucide-react';

export const ConnectionBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { activeConnection, isProbing } = useConnectionStore();

  if (activeConnection === 'hub') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
        title="Connected to restaurant Local Hub on local Wi-Fi"
      >
        <Server className="w-3.5 h-3.5" />
        <span>Local Hub</span>
        {isProbing && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />}
      </div>
    );
  }

  if (activeConnection === 'cloud') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 ${className}`}
        title="Connected directly to Cloud server"
      >
        <Cloud className="w-3.5 h-3.5" />
        <span>Cloud Online</span>
        {isProbing && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 ${className}`}
      title="Disconnected from Hub and Cloud. Working offline."
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode</span>
    </div>
  );
};
