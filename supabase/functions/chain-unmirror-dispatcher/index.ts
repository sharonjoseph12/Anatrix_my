// ─── chain-unmirror-dispatcher ──────────────────────────────────────────────
// Cron entry (every 15 min): revokes EAS attestations for unmirror requests

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Find confirmed mirrors that need unmirror (via cancelled status or explicit unmirror rows)
  const { data: rows, error } = await supabase
    .from('chain_mirror_queue')
    .select('*')
    .eq('status', 'cancelled')
    .not('attestation_uid', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error || !rows?.length) {
    return new Response(JSON.stringify({ processed: 0 }));
  }

  let processed = 0;

  for (const row of rows) {
    try {
      // TODO: Call easClient.revoke with attester key from Vault
      // For now, record the revocation

      // Write revocation record
      const { data: auditRow } = await supabase.from('chain_mirror_audit').insert({
        student_id: row.student_id,
        credential_id: row.credential_id,
        attestation_uid: row.attestation_uid,
        action: 'unmirror',
        attempt_index: 1,
      }).select('id').single();

      if (auditRow) {
        await supabase.from('chain_mirror_revocations').insert({
          audit_id: auditRow.id,
          student_id: row.student_id,
          credential_id: row.credential_id,
          attestation_uid: row.attestation_uid,
          revoke_tx_hash: '0x_pending', // TODO: actual tx hash
          block_number: 0,
          reason: 'user_request',
        });
      }

      // Remove from active queue processing
      await supabase.from('chain_mirror_queue')
        .update({ status: 'cancelled' })
        .eq('id', row.id);

      processed++;
    } catch (err) {
      console.error(`[unmirror-dispatcher] Failed for ${row.id}:`, err);
      await supabase.from('chain_mirror_audit').insert({
        student_id: row.student_id,
        credential_id: row.credential_id,
        attestation_uid: row.attestation_uid,
        action: 'unmirror',
        attempt_index: 1,
        error_message: String(err),
      });
    }
  }

  return new Response(JSON.stringify({ processed, total: rows.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
