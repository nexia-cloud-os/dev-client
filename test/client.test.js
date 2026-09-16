import test from 'node:test';
import assert from 'node:assert/strict';
import { createNexiaClient } from '../src/index.js';
const discovery = () => ({ protocol_version: '1', status: 'experimental', capabilities: { manifest_validation: false, project_management: false, remote_development: false, deployments: false, functions: false }, authentication: { methods: [] } });
const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('uses public discovery without cookies or following redirects', async () => {
  const client = createNexiaClient({ endpoint: 'https://nexia.example', fetch: async (url, options) => {
    assert.equal(url, 'https://nexia.example/.well-known/nexia-developer-platform');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    return json(discovery());
  } });
  assert.deepEqual(await client.discover(), discovery());
});
test('rejects unsafe endpoint forms at construction', () => {
  for (const endpoint of ['http://nexia.example', 'http://localhost:8000', 'https://user:secret@nexia.example', 'https://nexia.example/api', 'https://nexia.example?token=x', 'https://nexia.example#x', 'file:///etc/passwd']) {
    assert.throws(() => createNexiaClient({ endpoint }), { code: 'INVALID_ENDPOINT' });
  }
  assert.throws(() => createNexiaClient({ endpoint: 'http://localhost.attacker.example', allowInsecureLoopback: true }), { code: 'INVALID_ENDPOINT' });
});
test('loopback HTTP requires deliberate opt-in', async () => {
  for (const endpoint of ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://[::1]:8000']) {
    const client = createNexiaClient({ endpoint, allowInsecureLoopback: true, fetch: async () => json(discovery()) });
    assert.deepEqual(await client.discover(), discovery());
  }
});
test('rejects incompatible or incomplete discovery documents', async () => {
  for (const value of [null, {}, { ...discovery(), protocol_version: '2' }, { ...discovery(), capabilities: {} }, { ...discovery(), authentication: { methods: [42] } }]) {
    const client = createNexiaClient({ endpoint: 'https://nexia.example', fetch: async () => json(value) });
    await assert.rejects(client.discover(), { code: 'INVALID_DISCOVERY' });
  }
});
test('reports HTTP errors without accepting error pages as capabilities', async () => {
  const client = createNexiaClient({ endpoint: 'https://nexia.example', fetch: async () => new Response('Unavailable', { status: 503 }) });
  await assert.rejects(client.discover(), { code: 'DISCOVERY_HTTP', status: 503 });
});
test('rejects redirects from an injected transport and non-JSON responses', async () => {
  const client = createNexiaClient({ endpoint: 'https://nexia.example', fetch: async () => ({ redirected: true }) });
  await assert.rejects(client.discover(), { code: 'DISCOVERY_REDIRECT' });
  const html = createNexiaClient({ endpoint: 'https://nexia.example', fetch: async () => new Response('<html>Login</html>') });
  await assert.rejects(html.discover(), { code: 'INVALID_DISCOVERY' });
});
test('wraps transport failure without hiding its cause', async () => {
  const cause = new Error('offline');
  const client = createNexiaClient({ endpoint: 'https://nexia.example', fetch: async () => { throw cause; } });
  await assert.rejects(client.discover(), (error) => error.code === 'DISCOVERY_NETWORK' && error.cause === cause);
});
