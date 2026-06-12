import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const githubIdentity = user.identities?.find(i => i.provider === 'github');
  if (!githubIdentity) return NextResponse.json({ error: 'Not linked in Supabase' }, { status: 400 });

  const { error } = await supabase.from('github_accounts').upsert({
    user_id: user.id,
    github_id: githubIdentity.id,
    username: githubIdentity.identity_data?.preferred_username ?? githubIdentity.identity_data?.user_name ?? 'unknown',
    status: 'active'
  }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
