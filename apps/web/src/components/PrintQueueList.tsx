import React, { useEffect, useState } from 'react';
import { Sheet } from './ui/Overlay.js';
import { Button } from './ui/Button.js';
import { localDb, type LocalPrintJob } from '../db/dexie.js';
import { printerService } from '../services/printer/printer-service.js';
import { PrintStatusBadge } from './PrintStatusBadge.js';
import { Printer, RefreshCw, Globe, AlertTriangle } from 'lucide-react';

interface PrintQueueListProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintQueueList: React.FC<PrintQueueListProps> = ({ isOpen, onClose }) => {
  const [jobs, setJobs] = useState<LocalPrintJob[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadJobs = async () => {
    const list = await localDb.printJobs.orderBy('createdAt').reverse().limit(30).toArray();
    setJobs(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadJobs();
      const interval = setInterval(loadJobs, 2000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isOpen]);

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    await printerService.retryJob(jobId);
    await loadJobs();
    setRetryingId(null);
  };

  const handleBrowserFallback = async (jobId: string) => {
    setRetryingId(jobId);
    await printerService.fallbackToBrowserPrint(jobId);
    await loadJobs();
    setRetryingId(null);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Print Queue & Problems"
      description="Monitor recent thermal and browser print jobs"
      position="right"
    >
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="py-12 text-center text-content-secondary">
            <Printer className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No print jobs recorded yet</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className={`p-4 rounded-xl border transition-all ${
                job.status === 'failed'
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : 'bg-surface-subtle border-surface-border'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-content-primary">
                      {job.billNumber || 'Bill'}
                    </span>
                    <span className="text-xs uppercase px-1.5 py-0.5 rounded bg-surface-card border border-surface-border font-mono text-content-secondary">
                      {job.type}
                    </span>
                  </div>
                  <p className="text-xs text-content-secondary mt-0.5">
                    Printer: {job.printerName || 'Default'} ({job.transport || 'browser'})
                  </p>
                </div>
                <PrintStatusBadge status={job.status} />
              </div>

              {job.error && (
                <div className="flex items-start gap-2 p-2.5 my-2 rounded-lg bg-rose-500/10 text-rose-300 text-xs border border-rose-500/20">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-snug">{job.error}</span>
                </div>
              )}

              {job.status === 'failed' && (
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-surface-border">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 text-xs"
                    isLoading={retryingId === job.id}
                    onClick={() => handleRetry(job.id)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500"
                    isLoading={retryingId === job.id}
                    onClick={() => handleBrowserFallback(job.id)}
                  >
                    <Globe className="w-3.5 h-3.5 mr-1" />
                    Browser Print
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
};
