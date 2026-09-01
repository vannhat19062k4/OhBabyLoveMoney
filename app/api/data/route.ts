import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';

const MAX_PAYLOAD_BYTES = 1_500_000;

async function identity() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get('oai-authenticated-user-id');
  const email = requestHeaders.get('oai-authenticated-user-email');
  return { userId, email };
}

export async function GET() {
  const { userId, email } = await identity();
  if (!userId) return Response.json({ error: 'authentication_required' }, { status: 401 });

  const row = await env.DB.prepare(
    'SELECT payload, version, updated_at AS updatedAt FROM user_app_state WHERE user_id = ?',
  ).bind(userId).first<{ payload: string; version: number; updatedAt: number }>();

  return Response.json({
    email,
    data: row ? JSON.parse(row.payload) : null,
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
  });
}

export async function PUT(request: Request) {
  const { userId, email } = await identity();
  if (!userId) return Response.json({ error: 'authentication_required' }, { status: 401 });

  const body = await request.json();
  const payload = JSON.stringify(body?.data ?? null);
  if (new TextEncoder().encode(payload).byteLength > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO user_app_state (user_id, email, payload, version, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       email = excluded.email,
       payload = excluded.payload,
       version = user_app_state.version + 1,
       updated_at = excluded.updated_at`,
  ).bind(userId, email, payload, now).run();

  return Response.json({ ok: true, updatedAt: now });
}
