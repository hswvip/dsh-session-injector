import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export const inject = ['typertGateway', 'connection'];

const PORT = 8799;
const HOST = '127.0.0.1';

function timeZoneFields() {
  try { return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }; }
  catch { return {}; }
}

export function apply(ctx) {
  const gateway = ctx?.typertGateway;
  if (!gateway || typeof gateway.invoke !== 'function') {
    throw new TypeError('session-injector requires ctx.typertGateway with invoke()');
  }

  const peer = ctx?.connection?.createPeer?.({
    principal: { kind: 'owner' },
    interactions: 'none',
  });
  ctx?.effect?.(
    () => () => { try { peer?.dispose?.(); } catch { /* noop */ } },
    'session-injector: owner peer',
  );

  async function prompt(sessionId, text) {
    const requestId = randomUUID();
    const args = {
      request: {
        requestId,
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text }],
        ...timeZoneFields(),
      },
    };
    const invokeArgs = peer === undefined
      ? { namespace: 'session', method: 'prompt', args }
      : { namespace: 'session', method: 'prompt', args, peer };
    await gateway.invoke(invokeArgs);
    return requestId;
  }

  const server = createServer((req, res) => {
    const done = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && req.url.startsWith('/models')) {
      gateway.invoke({ namespace: 'llm', method: 'models', args: {} })
        .then((r) => done(200, r))
        .catch((e) => done(500, { ok: false, error: String(e?.message ?? e) }));
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      return done(200, { ok: true, service: 'session-injector' });
    }
    if (req.method !== 'POST' || !req.url.startsWith('/inject')) {
      return done(404, { ok: false, error: 'POST /inject only' });
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', async () => {
      let body;
      try { body = JSON.parse(raw); } catch { return done(400, { ok: false, error: 'invalid JSON' }); }
      const sessionId = body.sessionId ?? body.session;
      const text = body.text ?? body.message;
      if (typeof sessionId !== 'string' || !sessionId) {
        return done(400, { ok: false, error: 'sessionId required' });
      }
      if (typeof text !== 'string' || !text.trim()) {
        return done(400, { ok: false, error: 'text required' });
      }
      try {
        const requestId = await prompt(sessionId, text);
        done(200, { ok: true, requestId, sessionId, mode: 'queue' });
      } catch (error) {
        done(500, { ok: false, error: String(error?.message ?? error) });
      }
    });
  });

  server.on('error', (error) => {
    console.error('[session-injector] server error:', error?.message ?? error);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[session-injector] listening on http://${HOST}:${PORT}/inject`);
  });

  return () => new Promise((resolve) => server.close(() => resolve()));
}
