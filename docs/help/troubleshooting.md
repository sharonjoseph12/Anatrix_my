# Help Center — Troubleshooting

This page covers the most common problems for every Antarix persona — students, recruiters, placement officers, and company admins. Items are grouped by topic, not by persona, so you can scan for the symptom that matches yours. If a word on this page is unfamiliar, see the [Glossary](glossary.md). For step-by-step "how to" content, see the persona pages: [Students](students.md), [Recruiters](recruiters.md), [Colleges](colleges.md), and [Companies](companies.md). <!-- TODO: confirm companies.md exists or link to Recruiters → Pricing and credits as a fallback -->

If your issue is not listed here, email `support@antarix.app` with your account email, what you clicked, what you saw, and the time it happened. <!-- TODO: confirm support@antarix.app inbox is monitored before launch -->

## Account & login

Ten sign-in problems and the fastest ways out of them. Most of these finish in under five minutes.

### **I forgot my password.**
You cannot remember the password you used to sign in.

1. Go to `https://antarix.app/login`. Click **Forgot password**.
2. Enter the email you signed up with. Click **Send reset link**.
3. Open the email. Click **Reset password** within 30 minutes — the link expires.
4. Choose a new password. It must be at least 12 characters and not match your last five passwords.
5. Sign in with the new password.

Still stuck? Email `mailto:support@antarix.app` with your account email.

### **My email verification link does not work.**
You clicked the link in the verification email and got an error or a blank page.

1. Check the URL in the address bar. It must start with `https://antarix.app/verify-email/`.
2. Use the most recent email. Old links expire after 24 hours.
3. Open a private or incognito window, paste the link there. Some browser extensions block the redirect.
4. If the link still fails, go to `https://antarix.app/settings/account` and click **Resend verification email**. <!-- TODO: confirm this URL exists after the marketing site ships -->

Still stuck? Email `mailto:support@antarix.app`.

### **My account is locked.**
You see a message that your account is locked after too many failed sign-in attempts.

1. Wait 15 minutes. The lock clears on its own.
2. Sign in again with the correct password.
3. If you do not remember the password, use the **Forgot password** flow above.
4. After you sign in, turn on two-factor authentication. Go to **Settings → Security → 2FA** to prevent future locks.

Still stuck? Email `mailto:support@antarix.app`.

### **I lost my 2FA device.**
You replaced your phone, factory-reset it, or never had it — and you cannot generate the time-based code.

1. Use one of your saved recovery codes. The codes were shown when you first turned on 2FA.
2. If you do not have any recovery codes, go to `https://antarix.app/settings/security/2fa-recovery`. Click **Start account recovery**. <!-- TODO: confirm the 2FA recovery flow ships in v1 -->
3. Upload a government-issued photo ID. Review takes 1–3 business days.
4. After recovery, re-enroll 2FA on your new device and save the new recovery codes somewhere safe, like a password manager.

Still stuck? Email `mailto:support@antarix.app`.

### **"Session expired" keeps appearing.**
You are signed in for a few minutes, then signed out with a "Session expired" error.

1. Open your browser cookie settings. Allow cookies for `antarix.app` and `*.supabase.co`.
2. Turn off any "cookie auto-delete" or strict-tracking extensions (Privacy Badger, uBlock with strict lists) for `antarix.app`.
3. Check the system clock on your device. If it is more than 5 minutes off, the session token fails validation.
4. Try a different browser. If the issue is browser-specific, reinstall the browser.

Still stuck? Email `mailto:support@antarix.app` with the browser name and version.

### **I cannot sign up with my college email.**
Your college email is rejected or the signup form blocks it.

1. Confirm the email domain is on the accepted list. Most `.edu`, `.ac.in`, `.ac.uk`, and similar academic domains are accepted.
2. Some colleges block outbound signups on their network. Try signing up on a phone hotspot.
3. If your college uses a custom domain, ask your placement officer to whitelist it. They can do this from the college dashboard under **Settings → Domains**.
4. As a workaround, sign up with a personal email first. Add the college email later under **Settings → Account → Add email**.

Still stuck? Email `mailto:support@antarix.app` with your college domain.

### **My magic link never arrived.**
You clicked **Sign in with magic link**, but the email never lands.

1. Wait two minutes. Magic links are sent within 30 seconds but can be delayed by your mail provider.
2. Check spam, promotions, and "other" folders.
3. Confirm the email address is correct. Go to `https://antarix.app/login` and start over — the address is pre-filled.
4. Add `noreply@antarix.app` to your contacts and try again.
5. If it still does not arrive, your domain's mail server may be blocking us. Use the password flow instead.

Still stuck? Email `mailto:support@antarix.app`.

### **My browser keeps logging me out.**
You sign in, leave the tab for an hour, and you are signed out.

1. Do not use private or incognito mode. The session cookie is cleared when the window closes.
2. On iOS Safari, go to **Settings → Safari → Advanced** and turn off any "Block All Cookies" toggle.
3. Some ad-blockers (1Blocker, AdGuard) clear cookies aggressively. Whitelist `antarix.app` and `*.supabase.co`.
4. Make sure you are not signed in to a different Antarix account in another tab — the most recent login wins.

Still stuck? Email `mailto:support@antarix.app`.

### **I cannot change my account email.**
You go to **Settings → Account → Email** but the change is rejected or never saves.

1. Verify you own the new email. Antarix sends a confirmation link to the new address. The change only applies after you click it.
2. If the new email is already linked to another Antarix account, the change is rejected. Remove it from the other account first.
3. Some college emails cannot be the primary email if they are managed by your institution. Use a personal email as primary.
4. If the change is stuck in "pending" for more than an hour, sign out and sign back in.

Still stuck? Email `mailto:support@antarix.app`.

### **"Email already in use" but I never signed up.**
You try to sign up with an email and get "Email already in use" — but you do not remember signing up.

1. Try signing in with **Continue with Google** or **Continue with GitHub** using the same email. You may have used single sign-on.
2. If that fails, click **Forgot password** and reset. This works if the account is yours.
3. If neither works, the account may have been created by your college's bulk invite. Sign in with the magic link from the invite email.
4. If you believe the account is fraudulent, email `mailto:support@antarix.app` with the email and proof of ownership.

Still stuck? Email `mailto:support@antarix.app`.

## Integration issues

Ten integration problems, mostly OAuth and calendar. These almost always end with "reconnect from the dashboard."

### **GitHub keeps saying "401 Unauthorized".**
You connected GitHub, but the next sync fails with a 401 error.

1. Go to `https://github.com/settings/applications` and find the Antarix OAuth app.
2. Confirm the app is not suspended or revoked. If it is, click **Revoke** and reconnect from the Antarix dashboard.
3. Re-authorize the requested scopes (`read:user`, `public_repo`). GitHub sometimes tightens scopes between sessions.
4. If you have a GitHub organization that enforces SSO, click **Grant** next to the Antarix app on the organization's SSO page.
5. Re-trigger the sync from the Antarix dashboard: **Settings → Sources → GitHub → Sync now**.

Still stuck? Email `mailto:support@antarix.app` with the 401 timestamp.

### **I connected my personal GitHub but my college work is in a GitHub org.**
The dashboard only shows your personal repos, not the org's repos.

1. Go to `https://github.com/settings/applications` and find the Antarix app.
2. Click the app. In the **Organization access** section, click **Grant** next to the org.
3. Accept the SSO request on the org's side. Some orgs require admin approval.
4. If the org is private and not on your plan, ask the org admin to whitelist Antarix.

Still stuck? Email `mailto:support@antarix.app`.

### **Two GitHub accounts are getting mixed up.**
You have a personal GitHub and a work GitHub — only one of them is syncing.

1. Sign out of GitHub in your browser, then sign back in with the account you want to use.
2. From the Antarix dashboard, click **Settings → Sources → GitHub → Disconnect**, then **Connect GitHub** again.
3. When you are redirected to GitHub, double-check the avatar in the top-right. It must be the right account.
4. To permanently separate, use a different browser profile for each account.

Still stuck? Email `mailto:support@antarix.app`.

### **Google Calendar says "403 Forbidden" when I try to connect.**
You click **Connect Google Calendar** and Google's consent screen returns a 403.

1. Confirm you are signed in to the right Google account. The 403 sometimes means Google blocked the OAuth request from an unverified publisher.
2. If your Google Workspace admin has restricted third-party apps, ask them to allowlist `antarix.app`.
3. Try again from a normal Chrome window, not a managed or kiosk browser.
4. If the issue persists, revoke any prior Antarix grant at `https://myaccount.google.com/permissions` and try again.

Still stuck? Email `mailto:support@antarix.app`.

### **"We couldn't read your calendar" error.**
You connected Google Calendar, but the dashboard says we cannot read it.

1. Go to `https://myaccount.google.com/permissions` and confirm Antarix still has calendar read access.
2. Re-grant the read-only calendar scope from the Antarix dashboard: **Settings → Sources → Google Calendar → Reconnect**.
3. Check that your calendar is not on a Workspace account with API restrictions. Ask your Workspace admin.
4. Free Google accounts have a per-app API quota. If you have a very large calendar (over 10,000 events), wait 6 hours for the next sync window.

Still stuck? Email `mailto:support@antarix.app`.

### **Some calendar events are missing from the dashboard.**
Your classes show up but meetings, deadlines, or recurring events do not.

1. Recurring events without an instance override count as one event, not many. Check the original event.
2. All-day events are tracked separately. They appear under "All-day" in the dashboard.
3. Events marked "Free" (as opposed to "Busy") may be excluded from your schedule signal. Set them to "Busy" in Google Calendar.
4. Cancelled events are removed within an hour. Wait one full sync cycle.

Still stuck? Email `mailto:support@antarix.app`.

### **My time zone is wrong on the dashboard.**
Your streak breaks at midnight in the wrong time zone, or the AI Coach fires at the wrong hour.

1. Go to `https://antarix.app/settings/profile` and set the time zone to your current city.
2. Confirm the device you are reading Antarix on also has the right time zone. We trust the device clock for peak-window calculation.
3. If you travel, the time zone updates on the next sign-in.

Still stuck? Email `mailto:support@antarix.app`.

### **Web push notifications never arrive.**
You opted in to web push, but no notifications show up.

1. Confirm VAPID is working by going to `https://antarix.app/settings/notifications` and clicking **Send test push**.
2. If the test push fails, your browser is blocking service workers. Allow service workers for `antarix.app`.
3. macOS users: open **System Settings → Notifications → Chrome** and turn on notifications.
4. Windows users: open **Settings → System → Notifications** and make sure Chrome is on the allowed list.
5. iOS Safari does not support web push in v1. Use the WhatsApp channel instead. See [Students → The AI Coach and WhatsApp](students.md#the-ai-coach-and-whatsapp).

Still stuck? Email `mailto:support@antarix.app`.

### **OAuth scope errors when connecting a new source.**
A source asks for a scope you do not want to grant, and the connection fails.

1. Read the scope list. Antarix only requests read-only access to your data. We never ask for write access.
2. If a scope is optional, decline it on the consent screen. The connection will still succeed with reduced functionality.
3. If the consent screen does not let you decline, revoke the existing grant at the source and try again.
4. For organization-managed accounts, your admin may have pre-approved or blocked the scope. Ask them.

Still stuck? Email `mailto:support@antarix.app`.

### **My GitHub token was revoked somewhere else and I cannot tell where.**
You signed in to GitHub, used Antarix, and now Antarix says the token is invalid.

1. Go to `https://github.com/settings/applications` and find Antarix. Confirm the grant is still active.
2. If it is, click **Refresh permissions** in the Antarix dashboard: **Settings → Sources → GitHub → Reconnect**.
3. If the grant was revoked, Antarix will not auto-reconnect. Click **Connect GitHub** again.
4. Some GitHub org admins can revoke org-scoped grants. Ask your org admin.

Still stuck? Email `mailto:support@antarix.app`.

## Score & credential issues

Ten problems with the score, the credential, and the chrome extension. Most are fixed by waiting for the next sync cycle.

### **My Skill Proof Score did not update overnight.**
Your score stayed the same after a day of activity.

1. Confirm a sync ran. Go to `https://antarix.app/dashboard` and check the "Last synced" timestamp.
2. If the timestamp is more than 24 hours old, click **Sync now**.
3. Scores recompute nightly at 02:00 UTC. Edits made before that time appear in the next morning's score.
4. If you installed Power Mode less than 24 hours ago, the first re-weight happens after one full sync cycle.

Still stuck? Email `mailto:support@antarix.app`.

### **My credential will not issue.**
You click **Generate credential** and get an error or a spinner that never ends.

1. Confirm your Skill Proof Score is above zero. Credentials require at least one verified data source.
2. Confirm your email is verified. Unverified accounts cannot issue credentials.
3. If your account is under 18, the credential flow is blocked. See [DPDP Act Notice](../legal/dpdp-act-notice.md).
4. Wait five minutes and try again. A server-side lock may still be held from a previous attempt.
5. Check the status page at `https://antarix.app/status.html` for any open incident. <!-- TODO: confirm this URL exists after the marketing site ships -->

Still stuck? Email `mailto:support@antarix.app`.

### **My credential share link returns 404.**
You shared a URL like `https://antarix.app/verify/your-slug` and the recipient sees a 404.

1. Confirm the slug is correct. Slugs are case-sensitive.
2. Confirm the credential was not deleted. Go to `https://antarix.app/dashboard/credentials` and check the list.
3. The public verifier at `https://antarix.app/verify` accepts both URLs and DIDs. <!-- TODO: confirm this URL exists after the marketing site ships -->
4. If the credential was revoked (account deletion, manual revoke), the URL returns 404 by design.

Still stuck? Email `mailto:support@antarix.app`.

### **"Your credential is no longer valid" message.**
The verifier shows a red **Revoked** banner.

1. The credential was revoked. The most common reasons are account deletion, manual revoke from the dashboard, or an admin action.
2. If you did not revoke it, check the revocation reason in your dashboard: **Settings → Credentials → History**.
3. To re-issue, go to `https://antarix.app/dashboard/credentials` and click **Generate new**. The new credential gets a new DID and a new slug.

Still stuck? Email `mailto:support@antarix.app`.

### **My score changed retroactively.**
A score you saw yesterday is different today.

1. Scores are recomputed nightly. Edits to historical data (a deleted commit, a corrected calendar event) flow into the next score.
2. If a verifier or recruiter saw a different number, ask them to refresh. The cryptographic envelope is timestamped.
3. For a full audit log of your score changes, export your data from **Settings → Privacy → Export my data**.

Still stuck? Email `mailto:support@antarix.app`.

### **My score dropped after a streak break.**
Your score fell because your consistency signal went to zero.

1. Confirm the streak is actually broken. Streaks reset at midnight in your time zone.
2. The consistency weight is about 15% of your total score. A broken streak does not wipe the rest of the score.
3. To rebuild, log at least one signal (a commit, a session, a study block) on each of the next seven days. The streak counter restarts.
4. If the streak break is correct and you want to dispute it, email `mailto:support@antarix.app` with a screenshot.

Still stuck? Email `mailto:support@antarix.app`.

### **My DSA submission is not counting toward my score.**
You solved a problem on the platform and the score did not move.

1. The DSA engine rates "accepted" submissions only. Wrong-answer and time-limit-exceeded submissions do not count.
2. The submission must come from the platform's built-in editor. Submissions from third-party judges do not sync.
3. Anti-cheat rules disqualify a submission if the focus samples show no real engagement. See the [Security Threat Model](../security/threat-model.md).
4. New submissions are picked up on the next score recompute at 02:00 UTC.

Still stuck? Email `mailto:support@antarix.app`.

### **My credential public page shows the wrong name.**
The verifier shows a name that is not yours.

1. The credential uses the name from your profile at the time of issuance. Edit your name at `https://antarix.app/settings/profile`.
2. Re-issue the credential from **Dashboard → Credentials → Generate new**. The new envelope has the new name.
3. If your name contains special characters, contact `mailto:support@antarix.app` — some fonts misrender certain scripts.

Still stuck? Email `mailto:support@antarix.app`.

### **"Share to LinkedIn" does nothing.**
You click **Share to LinkedIn** and nothing happens, or the pre-fill is empty.

1. Pop-up blockers can intercept the LinkedIn share window. Allow pop-ups for `antarix.app`.
2. Make sure you are signed in to LinkedIn in the same browser session.
3. The pre-filled URL is your public credential. If the credential has been revoked, LinkedIn will reject the share.
4. As a workaround, copy the URL from **Dashboard → Credentials** and paste it into a LinkedIn post manually.

Still stuck? Email `mailto:support@antarix.app`.

### **Power Mode did not activate.**
You installed the extension but no badge appeared on your profile.

1. The badge appears within 24 hours of the first heartbeat. Wait one full cycle.
2. Confirm the extension is enabled at `chrome://extensions`. The toggle must be on.
3. Confirm the extension has the right permissions. Click **Details → Site settings** and allow the extension on `antarix.app`.
4. If the extension was installed in a different Chrome profile, install it in the profile you use for Antarix.

Still stuck? Email `mailto:support@antarix.app`.

## Payment & billing

Eight billing problems. Almost all of them need a screenshot and a 5-minute response from the team.

### **My card was declined.**
You tried to upgrade or add a seat, and the payment failed.

1. Confirm the card details are correct: number, expiry, CVV, billing ZIP or postal code.
2. Try a different card. Some banks block international or large-amount transactions by default.
3. Contact your bank. They may be flagging the charge as suspicious.
4. If the issue persists, pay via UPI or bank transfer. The instructions are in the upgrade confirmation email.

Still stuck? Email `mailto:support@antarix.app` with the last 4 digits of the card and the time of the attempt.

### **I need an invoice.**
You need a tax invoice (GST, VAT, or sales tax) for accounting.

1. Go to `https://antarix.app/settings/billing` and click **Download invoice**. All past invoices are available as PDFs.
2. If your company needs the invoice in a specific format, add a billing note under **Settings → Billing → Billing details** (for example, "PO number ABC-12345" or "GSTIN 27AAACR1234A1Z5").
3. Indian customers: a GST invoice is auto-generated. CGST/SGST or IGST is computed at the time of payment.
4. To change the legal entity name on the invoice, contact `mailto:support@antarix.app` from your billing email.

Still stuck? Email `mailto:support@antarix.app`.

### **I want a refund.**
You were charged but did not use the service, or you were charged twice.

1. Refunds are issued within 7 days of a request for the unused portion of a monthly plan. Annual plans follow the same rule, prorated by month.
2. Go to `https://antarix.app/settings/billing` and click **Request refund**.
3. Provide the reason and any supporting screenshot. The team reviews within 2 business days.
4. Refunds are returned to the original payment method.

Still stuck? Email `mailto:support@antarix.app`.

### **I want to change my plan mid-cycle.**
You are on the Starter plan and want to upgrade to Pro.

1. Go to `https://antarix.app/settings/billing` and click **Change plan**.
2. The new plan is pro-rated for the rest of the current cycle. The next full charge happens on the next renewal date.
3. Downgrades take effect at the end of the current cycle. You keep the higher plan features until then.
4. Plan changes are confirmed by email. Save the confirmation for your records.

Still stuck? Email `mailto:support@antarix.app`.

### **I added a recruiter seat but the new recruiter cannot see anything.**
You added a seat, the recruiter signed in, but the dashboard is empty.

1. Confirm the invite was accepted. Pending invites show "Awaiting acceptance" in **Settings → Team**.
2. The new recruiter must complete their profile and turn on 2FA before they can search.
3. The seat inherits the company-level search credits. If the company is on a per-seat plan, the new seat may not have credits yet — wait one cycle.
4. Confirm the recruiter's role in **Settings → Team → Roles**. A "Read-only" role cannot search.

Still stuck? Email `mailto:support@antarix.app`.

### **My monthly credit allocation did not reset.**
It is the first of the month and your credit balance is the same as yesterday.

1. Credits reset at 00:00 UTC on the first of each month. If you are in a different time zone, the reset may appear "late".
2. Go to **Settings → Billing → Usage history** and confirm the reset timestamp.
3. If the reset is more than 24 hours late, email `mailto:support@antarix.app` with your company ID.

Still stuck? Email `mailto:support@antarix.app`.

### **"We charged you twice".**
You see two identical charges for the same plan.

1. Open your bank statement. Sometimes the same charge appears as "pending" and then "posted" — only one counts.
2. If both are posted, take a screenshot of both lines and email `mailto:support@antarix.app`.
3. Refunds for duplicate charges are issued within 5 business days. The team confirms before processing.
4. To prevent future duplicates, do not click **Pay** twice in a row. The first click is final.

Still stuck? Email `mailto:support@antarix.app`.

### **My coupon code is not working.**
You have a code (for example, `EARLYBIRD50`) and the system rejects it.

1. Confirm the code is entered exactly as issued. Codes are case-sensitive.
2. Check the expiry date. Most codes expire 30 to 90 days after issue.
3. Some codes are plan-specific. A code for "Pro" does not work on "Starter".
4. First-time customers only: some codes cannot be applied to renewals.
5. If the code is still rejected, contact the person who issued it (sales, partnership, or event staff) for a fresh code.

Still stuck? Email `mailto:support@antarix.app`.

## Privacy & data

Eight privacy and data problems. Read the linked legal notices before you act — they explain the underlying rules.

### **How do I export my data?**
You want a copy of everything Antarix holds on you.

1. Go to `https://antarix.app/settings/privacy` and click **Export my data**.
2. Confirm the request from your email. The export is built in the background.
3. You will receive an email with a download link within 30 days. The link is valid for 7 days.
4. The export is a JSON archive of your account, profile, connections, score history, and credentials.
5. For a human-readable PDF summary, click **Export PDF summary** instead.

Still stuck? Email `mailto:support@antarix.app`. <!-- TODO: confirm the export link exists after the marketing site ships -->

### **How do I delete my account?**
You want to permanently remove your Antarix account.

1. Go to `https://antarix.app/settings/privacy` and click **Delete my account**.
2. Read the warnings. The action is irreversible. All credentials, scores, and connections are removed.
3. Confirm with your password and a 2FA code.
4. Personal data is purged within 30 days. Any verifiable credential is invalidated within 24 hours.
5. Aggregated, non-identifying metrics may persist. See [Privacy Notice §6](../legal/privacy-notice.md).

Still stuck? Email `mailto:support@antarix.app`.

### **"I see someone else's data."**
You signed in and the dashboard shows another person's name, score, or connections.

1. Sign out immediately. Click your avatar → **Sign out**.
2. Sign in again with your own account. Do not save the password in a shared browser.
3. If the data still does not match, change your password and rotate your 2FA.
4. Report this to `security@antarix.app` with a screenshot. Include the time and the URL you saw. <!-- TODO: confirm security@antarix.app inbox is monitored -->

Still stuck? Email `mailto:support@antarix.app`.

### **Parental consent flow for under-18 students.**
A student under 18 needs a parent or guardian to consent.

1. Antarix is an 18+ service in v1. Under-18 accounts are not supported.
2. If your college is on a Pro plan and needs under-18 support, contact `partnerships@antarix.app` to enable the verifiable parental consent flow. <!-- TODO: confirm the parental consent flow exists after the feature ships -->
3. Until the flow ships, do not invite under-18 students to Antarix.
4. Existing under-18 accounts are deleted within 7 days of discovery. See [DPDP Act Notice §3](../legal/dpdp-act-notice.md).

Still stuck? Email `mailto:support@antarix.app`.

### **How do I hide my profile from recruiter search?**
You want to opt out of the company-search index.

1. Go to `https://antarix.app/settings/privacy` and find **Search visibility**.
2. Toggle **Visible in company search** off.
3. The change takes effect within an hour. You will not appear in any recruiter search result.
4. Your credential public page, if shared by link, is still visible. Revoke the credential from **Dashboard → Credentials** to fully hide it.
5. See [Privacy Notice §FR-016](../legal/privacy-notice.md).

Still stuck? Email `mailto:support@antarix.app`.

### **How do I opt out of the placement prediction?**
You do not want the AI to predict your placement probability.

1. Go to `https://antarix.app/settings/privacy` and find **Placement prediction**.
2. Toggle **Show placement prediction** off.
3. The card disappears from the dashboard. The underlying score is unaffected.
4. The rest of the product — Skill Proof Score, credential, AI Coach — keeps working.
5. See the [Privacy Notice](../legal/privacy-notice.md) and the [AI Act Disclosure](../legal/ai-act-disclosure.md).

Still stuck? Email `mailto:support@antarix.app`.

### **"How do I see what recruiters see?"**
You want to preview your public profile from a recruiter's point of view.

1. Go to `https://antarix.app/profile/preview`. The page renders exactly what a recruiter sees in search. <!-- TODO: confirm this URL exists after the marketing site ships -->
2. To see what a recruiter sees when you are unverified, click **View as unverified** at the top.
3. To see the recruiter-only fields (the per-skill proficiency bands), click **View as Pro recruiter**. This is only available on paid plans.
4. To see the public credential page, click **Public credential** in the same panel.

Still stuck? Email `mailto:support@antarix.app`.

### **DPDP Act grievance.**
You are an Indian data principal and you want to file a grievance.

1. Email `grievance@antarix.app` with your name, the email on your account, the issue, and the date. <!-- TODO: confirm grievance@antarix.app inbox is monitored -->
2. Antarix will acknowledge within 7 days and resolve within 30 days, per the DPDP Act 2023.
3. If you are unsatisfied with the response, you may escalate to the Data Protection Board of India at `https://www.meity.gov.in/content/data-protection-board`. <!-- TODO: confirm this URL exists after the marketing site ships -->
4. The full grievance procedure is in [DPDP Act Notice §8](../legal/dpdp-act-notice.md).

Still stuck? Email `mailto:support@antarix.app`.

## Still not on this page?

If none of the items above match what you saw, send `mailto:support@antarix.app` the following four things, and you will get a reply within one business day:

1. The URL of the page where the problem happened.
2. The exact error message, copied verbatim, or a screenshot of it.
3. The browser and device you were using (for example, "Chrome 124 on Windows 11" or "Safari 17 on iPhone 15").
4. The time it happened, with your time zone.
