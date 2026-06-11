// ─── chain-mirror-attest ────────────────────────────────────────────────────
// Ad-hoc mirror submission edge function

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { credential_id, student_id, wallet_address } = await req.json();

    // 1. Kill-switch check
    const masterEnabled = Deno.env.get('ONCHAIN_MIRROR_ENABLED') === 'true';
    if (!masterEnabled) {
      await supabase.from('chain_mirror_audit').insert({
        student_id,
        action: 'denied_kill_switch',
        attempt_index: 1,
      });
      return new Response(JSON.stringify({ error: 'kill_switch_active' }), { status: 503 });
    }

    // 2. Check tenant flag
    const { data: student } = await supabase
      .from('users')
      .select('onchain_mirror_opt_in, institution_id, institutions!inner(onchain_mirror_enabled)')
      .eq('id', student_id)
      .single();

    if (!student?.onchain_mirror_opt_in) {
      await supabase.from('chain_mirror_audit').insert({
        student_id,
        action: 'denied_kill_switch',
        attempt_index: 1,
        error_message: 'opt_in_required',
      });
      return new Response(JSON.stringify({ error: 'opt_in_required' }), { status: 403 });
    }

    const institution = (student as any).institutions;
    if (institution && !institution.onchain_mirror_enabled) {
      await supabase.from('chain_mirror_audit').insert({
        student_id,
        institution_id: student.institution_id,
        action: 'denied_tenant_disabled',
        attempt_index: 1,
      });
      return new Response(JSON.stringify({ error: 'tenant_disabled' }), { status: 403 });
    }

    // 3. Enqueue for dispatcher
    const { data: queueRow, error: queueError } = await supabase
      .from('chain_mirror_queue')
      .insert({
        student_id,
        credential_id,
        status: 'pending',
      })
      .select()
      .single();

    if (queueError) {
      return new Response(JSON.stringify({ error: queueError.message }), { status: 400 });
    }

    // 4. Audit
    await supabase.from('chain_mirror_audit').insert({
      student_id,
      institution_id: student.institution_id,
      credential_id,
      action: 'mirror',
      attempt_index: 1,
    });

    return new Response(JSON.stringify({ queue_id: queueRow.id, status: 'pending' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
