import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseGmailTransaction, type GmailMessage } from '@/lib/gmail-parser';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Supabase chưa được cấu hình.' }, { status: 503 });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => undefined,
    },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Phiên đăng nhập đã hết hạn.' }, { status: 401 });

  const providerToken = cookieStore.get('ohbaby-google-token')?.value;
  if (!providerToken) return NextResponse.json({ error: 'Hãy đăng xuất rồi đăng nhập lại để cấp quyền Gmail chỉ đọc.' }, { status: 401 });

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('maxResults', '40');
  listUrl.searchParams.set('q', 'newer_than:30d');
  const headers = { Authorization: `Bearer ${providerToken}` };
  const listResponse = await fetch(listUrl, { headers, cache: 'no-store' });
  if (!listResponse.ok) {
    const status = listResponse.status;
    return NextResponse.json({ error: status === 403 ? 'Google chưa cấp quyền Gmail. Hãy bật Gmail API và đăng nhập lại.' : 'Quyền Gmail đã hết hạn. Hãy đăng nhập lại.' }, { status });
  }

  const list = await listResponse.json() as { messages?: Array<{ id: string }> };
  const messages = await Promise.all((list.messages ?? []).map(async ({ id }) => {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers, cache: 'no-store' });
    return response.ok ? await response.json() as GmailMessage : null;
  }));
  const drafts = messages.flatMap((message) => {
    const draft = message ? parseGmailTransaction(message) : null;
    return draft ? [draft] : [];
  });
  return NextResponse.json({ drafts });
}
