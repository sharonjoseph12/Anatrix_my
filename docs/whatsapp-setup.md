# docs/whatsapp-setup.md
# T011 mitigation guide — what the team needs to do to bring the AI Coach
# WhatsApp channel online. Required reading before deploying US3.

## Why this matters
`supabase/functions/whatsapp-send` short-circuits with `t011_template_not_registered` until the four required templates are approved by Meta. The function logs the hint and falls back to web-push for the affected nudge type.

## Steps

### 1. Create a Meta Business Manager account
- https://business.facebook.com/overview
- Use a corporate domain, not a personal email.
- Two-factor authentication is mandatory for the admin account.

### 2. Register the WhatsApp Business phone number
- In Meta Business Manager, navigate to **WhatsApp Manager → Phone Numbers → Add**.
- The number you choose becomes the WA Business number; it can't be a personal WhatsApp account.
- Set `WHATSAPP_BUSINESS_NUMBER` in `.env.local` and in your deployment secrets to this exact number (E.164, no `+`).

### 3. Create the WhatsApp Business App
- Developers → Create App → Business → WhatsApp.
- Copy the **Phone Number ID** and **WhatsApp Business Account ID** into:
  - `WHATSAPP_META_PHONE_NUMBER_ID`
  - `WHATSAPP_META_BUSINESS_ACCOUNT_ID`
- Generate a permanent system user token with the `whatsapp_business_management` and `whatsapp_business_messaging` permissions, save it as `WHATSAPP_META_PERMANENT_TOKEN`.

### 4. Submit the 4 templates for approval
| Template name (matches env var) | Variable 1 | Variable 2 | Category |
| --- | --- | --- | --- |
| `antarix_daily_morning_v1` | First name | Skill Proof Score | MARKETING |
| `antarix_peak_window_v1` | First name | Peak window hours | UTILITY |
| `antarix_streak_risk_v1` | First name | Hours since last session | UTILITY |
| `antarix_weekly_summary_v1` | First name | Week's commit count | MARKETING |

Set one env var per template:
- `WHATSAPP_META_TEMPLATE_DAILY_MORNING=antarix_daily_morning_v1`
- `WHATSAPP_META_TEMPLATE_REAL_TIME_PEAK=antarix_peak_window_v1`
- `WHATSAPP_META_TEMPLATE_STREAK_RISK=antarix_streak_risk_v1`
- `WHATSAPP_META_TEMPLATE_WEEKLY_SUMMARY=antarix_weekly_summary_v1`

Approval typically takes minutes to a few hours for UTILITY templates, longer for MARKETING.

### 5. Configure the webhook
- In the app's WhatsApp → Configuration panel, set the **Webhook URL** to:
  `https://<your-supabase-project>.supabase.co/functions/v1/whatsapp-webhook`
- Set the **Verify Token** to the value of `WHATSAPP_META_VERIFY_TOKEN` in your env.
- Subscribe to the `messages` field.

### 6. Test the end-to-end flow
- Connect a test student's WhatsApp: `POST /functions/v1/whatsapp-connect` and follow the `wa.me` deep link.
- Reply with `STATS` — webhook receives it, applies the command, and a `reply_stats` nudge is enqueued.
- Trigger a daily morning nudge: `POST /functions/v1/nudge-trigger` with `{ "mode": "scheduled" }`.

## Cost guard
- The default weekly cap is 20 messages per student (`WHATSAPP_COST_GUARD_WEEKLY_MESSAGES_PER_STUDENT`).
- Above the cap, dispatch falls back to web-push and writes `last_error = "cost_guard_weekly_cap_hit"` to `whatsapp_connections`.
- See `apps/web/src/lib/whatsapp-cost-guard.ts` for the in-process helper.

## Switching to Twilio
- Set `WHATSAPP_PROVIDER=twilio` and the four `WHATSAPP_TWILIO_*` env vars.
- Templates stay the same; the provider abstraction in `supabase/functions/_shared/whatsapp-provider.ts` handles the difference.
