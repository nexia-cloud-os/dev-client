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
    || (Object.hasOwn(value.capabilities, 'repository_submissions') && typeof value.capabilities.repository_submissions !== 'boolean')
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
  const loopback = origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost') || origin.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(origin.hostname);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/'
    || !(origin.protocol === 'https:' || (origin.protocol === 'http:' && allowInsecureLoopback === true && loopback))) {
    throw new NexiaClientError('Use an HTTPS origin without credentials, path, query, or fragment. Local HTTP requires allowInsecureLoopback: true.', { code: 'INVALID_ENDPOINT' });
  }
  if (typeof fetchImplementation !== 'function') throw new NexiaClientError('A Fetch-compatible implementation is required.', { code: 'INVALID_FETCH' });
  const url = new URL(DISCOVERY_PATH, origin).href;
  const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
  async function authenticated(route, token, body) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new NexiaClientError('A project connection token is required.', { code: 'INVALID_TOKEN' });
    const target = new URL(`/developer-api/v2/${route}`, origin).href;
    let response;
    try {
      response = await fetchImplementation(target, { method: body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30_000) });
    } catch { throw new NexiaClientError('Submission connection failed. Check status before retrying with the same request ID.', { code: 'SUBMISSION_NETWORK' }); }
    if (response.redirected || (response.url && response.url !== target)) throw new NexiaClientError('Submission redirects are unsupported.', { code: 'SUBMISSION_REDIRECT' });
    if (!response.ok) throw new NexiaClientError(`Submission API failed with HTTP ${response.status}.`, { code: 'SUBMISSION_HTTP', status: response.status });
    return response.json();
  }
  return Object.freeze({
    repository(appId, token, { tags = false } = {}) {
      if (!uuid(appId)) throw new NexiaClientError('Invalid App ID.', { code: 'INVALID_REQUEST' });
      return authenticated(`apps/${appId}/repository${tags ? '?tags=1' : ''}`, token);
    },
    submit(input, token) {
      if (!uuid(input?.app_id) || !uuid(input?.request_id) || typeof input?.tag !== 'string' || input.tag.length > 101 || !input.tag.startsWith('v')) throw new NexiaClientError('Supply an App, version tag and request ID.', { code: 'INVALID_REQUEST' });
      return authenticated('submissions', token, { app_id: input.app_id, tag: input.tag, request_id: input.request_id });
    },
    submission(id, token, action) {
      if (!uuid(id) || (action !== undefined && !['cancel', 'retry'].includes(action))) throw new NexiaClientError('Invalid submission action.', { code: 'INVALID_REQUEST' });
      return authenticated(`submissions/${id}${action ? `/${action}` : ''}`, token, action ? {} : undefined);
    },
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
