import type { DeveloperDiscovery } from '@amuzcorp/nexia-dev-protocol';
export interface NexiaClientOptions {
  /** HTTPS origin; no credentials, query, fragment, or API path. */
  endpoint: string;
  fetch?: typeof globalThis.fetch;
  /** Permit HTTP only for localhost, 127.0.0.0/8, or ::1. */
  allowInsecureLoopback?: boolean;
}
export interface NexiaClient { discover(): Promise<DeveloperDiscovery> }
export declare function createNexiaClient(options: NexiaClientOptions): Readonly<NexiaClient>;
export declare class NexiaClientError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, options?: { code?: string; status?: number; cause?: unknown });
}
