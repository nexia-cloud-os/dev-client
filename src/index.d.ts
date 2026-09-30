import type { DeveloperDiscovery, TagSubmissionRequest, SubmissionResponse, RepositoryResponse } from '@nexia/dev-protocol';
export interface NexiaClientOptions {
  /** HTTPS origin; no credentials, query, fragment, or API path. */
  endpoint: string;
  fetch?: typeof globalThis.fetch;
  /** Permit HTTP only for localhost subdomains, 127.0.0.0/8, or ::1. */
  allowInsecureLoopback?: boolean;
}
export interface NexiaClient {
  discover(): Promise<DeveloperDiscovery>;
  repository(appId: string, token: string, options?: { tags?: boolean }): Promise<RepositoryResponse>;
  submit(input: TagSubmissionRequest, token: string): Promise<SubmissionResponse>;
  submission(id: string, token: string, action?: 'cancel' | 'retry'): Promise<SubmissionResponse>;
}
export declare function createNexiaClient(options: NexiaClientOptions): Readonly<NexiaClient>;
export declare class NexiaClientError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, options?: { code?: string; status?: number; cause?: unknown });
}
