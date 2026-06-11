// ─── Dead-letter Slack Notifier ─────────────────────────────────────────────
// Sends Slack notification when a mirror queue row transitions to dead_letter

import { createClient } from '@supabase/supabase-js';

/**
 * Notify the ops Slack channel when a mirror queue row reaches dead_letter.
 * Uses the existing webhook from 041.
 */
export async function notifyDeadLetter(
  queueId: string,
  studentId: string,
  credentialId: string,
  lastError: string,
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[dead-letter-notifier] SLACK_WEBHOOK_URL not set, skipping');
    return;
  }

  const payload = {
    text: `🚨 *On-Chain Mirror Dead Letter*\n• Queue ID: \`${queueId}\`\n• Student: \`${studentId}\`\n• Credential: \`${credentialId}\`\n• Error: ${lastError}\n• Action: Check \`chain_mirror_queue\` and \`chain_mirror_audit\` tables`,
    channel: '#ops-alerts',
    username: 'Antarix Mirror Bot',
    icon_emoji: ':chains:',
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[dead-letter-notifier] Slack webhook failed: ${res.status}`);
    }
  } catch (err) {
    console.error('[dead-letter-notifier] Slack webhook error:', err);
  }
}
