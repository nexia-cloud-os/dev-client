import test from 'node:test';
import assert from 'node:assert/strict';
import { createNexiaClient } from '../src/index.js';

test('submission client sends immutable selectors and refuses redirects or unsafe actions', async () => {
  const calls = [];
  const id = '11111111-1111-4111-8111-111111111111';
  const client = createNexiaClient({ endpoint: 'https://example.test', fetch: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ submission: { id } }), { headers: { 'content-type': 'application/json' } });
  } });
  await client.submit({ app_id: id, tag: 'v1.0.0', request_id: id, source: 'must not be sent' }, 'a'.repeat(64));
  assert.deepEqual(JSON.parse(calls[0].options.body), { app_id: id, tag: 'v1.0.0', request_id: id });
  assert.equal(calls[0].options.redirect, 'error');
  await client.repository(id, 'a'.repeat(64), { tags: true });
  assert.match(calls[1].url, /repository\?tags=1$/);
  assert.throws(() => client.submission(id, 'a'.repeat(64), 'publish'), /Invalid submission/);
  const redirected = createNexiaClient({ endpoint: 'https://example.test', fetch: async () => ({ redirected: true, ok: true }) });
  await assert.rejects(redirected.submission(id, 'a'.repeat(64)), /redirects/);
});
