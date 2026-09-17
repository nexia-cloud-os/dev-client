import { DISCOVERY_PATH, PROTOCOL_VERSION } from '@nexia/dev-protocol';

const capabilityKeys = ['manifest_validation', 'project_management', 'remote_development', 'deployments', 'functions'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export class NexiaClientError extends Error {
  constructor(message, { code, status, cause } = {}) {
    super(message, { cause });
    this.name = 'NexiaClientError';
    this.code = code;
    this.status = status;
  }
}

function validateDiscovery(value) {
  if (!isObject(value) || value.protocol_version !== PROTOCOL_VERSION || value.status !== 'experimental'
    || !isObject(value.capabilities) || capabilityKeys.some((key) => typeof value.capabilities[key] !== 'boolean')
    || !isObject(value.authentication) || !Array.isArray(value.authentication.methods)
    || value.authentication.methods.some((method) => typeof method !== 'string' || !method.trim())) {
    throw new NexiaClientError('The endpoint returned an unsupported developer discovery document.', { code: 'INVALID_DISCOVERY' });
  }
  return value;
}

/** Construct a public discovery client. Endpoint must be an origin, not an API path. */
export function createNexiaClient({ endpoint, fetch: fetchImplementation = globalThis.fetch, allowInsecureLoopback = false } = {}) {
  let origin;
  try { origin = new URL(endpoint); }
  catch (cause) { throw new NexiaClientError('Provide an absolute Nexia HTTPS origin.', { code: 'INVALID_ENDPOINT', cause }); }
  const loopback = origin.hostname === 'localhost' || origin.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(origin.hostname);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/'
    || !(origin.protocol === 'https:' || (origin.protocol === 'http:' && allowInsecureLoopback === true && loopback))) {
    throw new NexiaClientError('Use an HTTPS origin without credentials, path, query, or fragment. Local HTTP requires allowInsecureLoopback: true.', { code: 'INVALID_ENDPOINT' });
  }
  if (typeof fetchImplementation !== 'function') throw new NexiaClientError('A Fetch-compatible implementation is required.', { code: 'INVALID_FETCH' });
  const url = new URL(DISCOVERY_PATH, origin).href;
  return Object.freeze({
    async discover() {
      let response;
      try {
        response = await fetchImplementation(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
        });
      } catch (cause) {
        throw new NexiaClientError('Unable to read Nexia developer discovery. Check the endpoint and connection.', { code: 'DISCOVERY_NETWORK', cause });
      }
      // Reject redirects even when an injected fetch implementation follows them.
      if (response.redirected || (response.url && response.url !== url)) {
        throw new NexiaClientError('Developer discovery redirects are not supported.', { code: 'DISCOVERY_REDIRECT' });
      }
      if (!response.ok) throw new NexiaClientError(`Developer discovery failed with HTTP ${response.status}.`, { code: 'DISCOVERY_HTTP', status: response.status });
      if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
        throw new NexiaClientError('Developer discovery must return JSON.', { code: 'INVALID_DISCOVERY' });
      }
      let value;
      try { value = await response.json(); }
      catch (cause) { throw new NexiaClientError('Developer discovery returned malformed JSON.', { code: 'INVALID_DISCOVERY', cause }); }
      return validateDiscovery(value);
    },
  });
}
