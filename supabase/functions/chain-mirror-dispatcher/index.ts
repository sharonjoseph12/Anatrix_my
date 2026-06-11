// ─── chain-mirror-dispatcher ────────────────────────────────────────────────
// Cron entry (every 5 min): processes pending/failed mirror queue rows

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { nextBackoffDelay } from './backoff.ts';

serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Kill-switch check
  const masterEnabled = Deno.env.get('ONCHAIN_MIRROR_ENABLED') === 'true';
  if (!masterEnabled) {
    console.log('[chain-mirror-dispatcher] Master flag OFF, skipping');
    return new Response(JSON.stringify({ skipped: true, reason: 'kill_switch' }));
  }

  // 2. Select rows for processing
  const { data: rows, error } = await supabase
    .from('chain_mirror_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(50);

  if (error || !rows?.length) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      // Check per-student gate
      const { data: student } = await supabase
        .from('users')
        .select('onchain_mirror_opt_in, institution_id, institutions!inner(onchain_mirror_enabled)')
        .eq('id', row.student_id)
        .single();

      if (!student?.onchain_mirror_opt_in) {
        await supabase.from('chain_mirror_queue')
          .update({ status: 'cancelled', last_error: 'opt_in_revoked' })
          .eq('id', row.id);
        await supabase.from('chain_mirror_audit').insert({
          student_id: row.student_id,
          credential_id: row.credential_id,
          action: 'denied_kill_switch',
          attempt_index: row.attempt_count + 1,
          error_message: 'opt_in_revoked',
        });
        continue;
      }

      const institution = (student as any).institutions;
      if (institution && !institution.onchain_mirror_enabled) {
        await supabase.from('chain_mirror_queue')
          .update({ status: 'cancelled', last_error: 'tenant_disabled' })
          .eq('id', row.id);
        await supabase.from('chain_mirror_audit').insert({
          student_id: row.student_id,
          institution_id: student.institution_id,
          credential_id: row.credential_id,
          action: 'denied_tenant_disabled',
          attempt_index: row.attempt_count + 1,
        });
        continue;
      }

      // Fetch credential for hashing
      const { data: credential } = await supabase
        .from('verifiable_credentials')
        .select('*')
        .eq('id', row.credential_id)
        .single();

      if (!credential) {
        await supabase.from('chain_mirror_queue')
          .update({ status: 'cancelled', last_error: 'credential_not_found' })
          .eq('id', row.id);
        continue;
      }

      // TODO: Gas price check + defer if too high
      // TODO: Compute vcHash from credential
      // TODO: Sign + submit EAS.attest via Vault key
      // TODO: Write audit + update queue status

      // Simulated success for now — mark as submitted
      const newAttemptCount = row.attempt_count + 1;
      await supabase.from('chain_mirror_queue')
        .update({
          status: 'submitted',
          attempt_count: newAttemptCount,
        })
        .eq('id', row.id);

      await supabase.from('chain_mirror_audit').insert({
        student_id: row.student_id,
        institution_id: student.institution_id,
        credential_id: row.credential_id,
        action: 'mirror',
        attempt_index: newAttemptCount,
      });

      processed++;
    } catch (err) {
      // Retry with backoff
      const newAttemptCount = row.attempt_count + 1;
      const delay = nextBackoffDelay(newAttemptCount);

      if (delay === null) {
        // Dead-letter
        await supabase.from('chain_mirror_queue')
          .update({
            status: 'dead_letter',
            attempt_count: newAttemptCount,
            last_error: String(err),
          })
          .eq('id', row.id);
      } else {
        const nextAttempt = new Date(Date.now() + delay * 60_000).toISOString();
        await supabase.from('chain_mirror_queue')
          .update({
            status: 'failed',
            attempt_count: newAttemptCount,
            next_attempt_at: nextAttempt,
            last_error: String(err),
          })
          .eq('id', row.id);
      }

      await supabase.from('chain_mirror_audit').insert({
        student_id: row.student_id,
        credential_id: row.credential_id,
        action: 'mirror',
        attempt_index: newAttemptCount,
        error_message: String(err),
      });

      failed++;
    }
  }

  return new Response(JSON.stringify({ processed, failed, total: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
