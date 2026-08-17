export interface CacheKeyParts {
  resource: string;
  userId?: string;
  role?: string;
  params?: Record<string, any>;
}

export interface CacheHealthStatus {
  enabled: boolean;
  healthy: boolean;
  latencyMs: number | null;
}