import type { HealthResponse, VersionResponse } from '@restaurant-os/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function fetchHealth(): Promise<{ data: HealthResponse; latencyMs: number }> {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/health`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const latencyMs = Math.round(performance.now() - start);

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new Error(errorBody?.error?.message || `Health check failed with status ${res.status}`);
  }

  const data = (await res.json()) as HealthResponse;
  return { data, latencyMs };
}

export async function fetchVersion(): Promise<VersionResponse> {
  const res = await fetch(`${API_BASE}/version`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Version check failed with status ${res.status}`);
  }

  return (await res.json()) as VersionResponse;
}
