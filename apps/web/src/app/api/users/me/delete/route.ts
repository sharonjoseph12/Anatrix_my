// ─── User Deletion Route ────────────────────────────────────────────────────
// POST: request account deletion → sets deletion_requested_at + bulk-unmirror

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { enqueueBulkUnmirrorForStudent } from '@/lib/onchain/dpdp-bulk-unmirror';

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Set deletion_requested_at
  const { error } = await supabase
    .from('users')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // 009: Enqueue bulk unmirror for all on-chain mirrors
  const cancelledIds = await enqueueBulkUnmirrorForStudent(user.id);

  return NextResponse.json({
    status: 'deletion_requested',
    mirrors_cancelled: cancelledIds.length,
  });
}
