# ANTARIX COMPLETE WORKFLOW
## How It Actually Works: End-to-End Data Flow & User Journeys

---

# 1. SYSTEM OVERVIEW (The Complete Picture)

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ANTARIX ECOSYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   STUDENTS   │      │   COLLEGES   │      │  COMPANIES   │  │
│  │              │      │              │      │              │  │
│  │ • Onboard    │      │ • Admin      │      │ • Recruiter  │  │
│  │ • Track      │      │ • Dashboard  │      │ • Search     │  │
│  │   Activity   │      │ • Export     │      │ • Match      │  │
│  │ • Get        │      │   Profiles   │      │ • Hire       │  │
│  │   Insights   │      │              │      │              │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                      │           │
│         └─────────┬───────────┴──────────┬──────────┘           │
│                   │                      │                       │
│         ┌─────────▼──────────┐  ┌──────▼────────────┐           │
│         │   ANTARIX CORE     │  │   DATA LAYER      │           │
│         │                    │  │                    │           │
│         │ • Track Activity   │  │ • Student Data     │           │
│         │ • Generate Insights│  │ • Institution Data │           │
│         │ • Match Candidates │  │ • Company Data     │           │
│         │ • Create Network   │  │ • Skill Data       │           │
│         │   Effects          │  │ • Match Data       │           │
│         └────────────────────┘  └────────────────────┘           │
│                   ▲                      ▲                       │
│                   │                      │                       │
│         ┌─────────┴──────────────────────┴────────┐              │
│         │                                          │              │
│         │   ┌─── GitHub (Code Activity)           │              │
│         │   ├─── Chrome Extension (Session Track) │              │
│         │   ├─── Google Calendar (Schedule)       │              │
│         │   └─── Notion (Project Docs)            │              │
│         │                                          │              │
│         │        EXTERNAL INTEGRATIONS             │              │
│         └──────────────────────────────────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 2. STUDENT JOURNEY (Complete Workflow)

## Phase 1: Onboarding (Day 1)

### Step 1.1: Sign Up
```
Student visits: antarix.app

Screen:
┌────────────────────────────────────┐
│  Welcome to Antarix                │
│                                    │
│  The AI Coach for Your Learning    │
│                                    │
│  [Email Input]                     │
│  [Password Input]                  │
│  [Sign Up]                         │
│                                    │
│  Already have account?             │
│  [Log In]                          │
└────────────────────────────────────┘

Actions:
✓ User enters email + password
✓ System sends verification email
✓ User clicks link, confirms email
✓ User is now authenticated
✓ Redirect to onboarding step 1
```

**Database records:**
```sql
INSERT INTO users (id, email, password_hash, created_at)
VALUES ('user-123', 'sharon@example.com', 'hashed_password', NOW());
```

---

### Step 1.2: Profile Setup
```
Screen:
┌────────────────────────────────────┐
│  Tell Us About Yourself            │
│                                    │
│  Display Name:                     │
│  [Sharon Dave              ]       │
│                                    │
│  Are you a:                        │
│  ◉ Student  ○ Professional         │
│                                    │
│  What are your goals? (Select all) │
│  ☑ Placement                       │
│  ☑ DSA                             │
│  ☐ AI/ML                           │
│  ☐ Startup                         │
│  ☐ Research                        │
│  ☐ Freelancing                     │
│                                    │
│  Your skill level:                 │
│  ○ Beginner  ○ Intermediate  ◉ Advanced
│                                    │
│  When do you usually work?         │
│  From: [6 PM  ▼]  To: [11 PM ▼]   │
│                                    │
│  [Continue]                        │
└────────────────────────────────────┘

Actions:
✓ User fills form
✓ Click "Continue"
✓ Data is saved
✓ Redirect to GitHub connect
```

**Database records:**
```sql
UPDATE users 
SET 
  display_name = 'Sharon Dave',
  user_type = 'student',
  goals = '["Placement", "DSA", "AI/ML"]',
  skill_level = 'advanced',
  working_hours = '6 PM - 11 PM',
  onboarding_step = 'github_connect'
WHERE id = 'user-123';
```

---

### Step 1.3: GitHub Connection
```
Screen:
┌────────────────────────────────────┐
│  Connect Your GitHub               │
│                                    │
│  We'll track your code activity    │
│  to understand your patterns       │
│                                    │
│  [Connect with GitHub]             │
│                                    │
│  This helps us:                    │
│  ✓ See what you're building        │
│  ✓ Track your specialization       │
│  ✓ Verify your skills              │
│  ✓ Match with companies            │
│                                    │
│  [Skip for now]                    │
└────────────────────────────────────┘

Actions:
✓ User clicks "Connect with GitHub"
✓ Redirects to GitHub OAuth login
✓ User authorizes Antarix
✓ GitHub sends auth code back
✓ Antarix backend exchanges code for access token
✓ System fetches user's repos + recent commits
✓ Redirect to calendar step
```

**Data flow:**
```
1. User clicks → Antarix sends auth request to GitHub
2. GitHub → User authenticates
3. GitHub → Returns auth code to Antarix
4. Antarix backend → Exchanges code for access token
5. Antarix backend → Fetches user's repos
6. GitHub API response → Stored in github_accounts table
7. Background job → Syncs last 3 months of commits
```

**Database records:**
```sql
INSERT INTO github_accounts (user_id, github_id, username, access_token)
VALUES ('user-123', 456789, 'sharondav', 'gho_encrypted_token');

-- Background job fetches commits
INSERT INTO github_activity (user_id, commit_hash, repository_name, committed_at)
VALUES 
  ('user-123', 'abc123', 'sign-language-recognition', '2024-01-15 18:30:00'),
  ('user-123', 'def456', 'sign-language-recognition', '2024-01-15 14:22:00'),
  ...
```

---

### Step 1.4: Calendar Connection (Optional)
```
Screen:
┌────────────────────────────────────┐
│  Connect Google Calendar (Optional) │
│                                    │
│  See how your schedule affects     │
│  your productivity                 │
│                                    │
│  [Connect Google Calendar]         │
│                                    │
│  [Skip for now]                    │
└────────────────────────────────────┘

Actions:
✓ User clicks "Connect Google Calendar"
✓ Google OAuth flow
✓ User authorizes
✓ System fetches last 3 months of events
✓ Stored in calendar_events table
```

---

### Step 1.5: Onboarding Complete
```
Screen:
┌────────────────────────────────────┐
│  You're All Set!                   │
│                                    │
│  Antarix is learning your patterns │
│                                    │
│  📊 Check back in 7 days for       │
│     personalized insights          │
│                                    │
│  In the meantime:                  │
│  1. Install the Chrome extension   │
│  2. Start tracking your sessions   │
│  3. We'll analyze your data        │
│                                    │
│  [Install Extension]  [Go to Dash] │
└────────────────────────────────────┘

Actions:
✓ Redirect to dashboard
✓ Display extension download link
✓ Set onboarding_completed_at = NOW()
```

**Database records:**
```sql
UPDATE users 
SET 
  onboarding_completed_at = NOW(),
  onboarding_step = 'complete'
WHERE id = 'user-123';
```

---

## Phase 2: Activity Tracking (Days 1-7)

### Step 2.1: Install Extension

**User downloads extension from Chrome Web Store**

Extension files installed:
```
~/.config/chrome/
  └── extensions/
      └── antarix/
          ├── manifest.json
          ├── popup.html
          ├── popup.js
          ├── background.js
          └── icons/
```

User opens browser → Sees Antarix icon in toolbar

---

### Step 2.2: First Session

```
User clicks Antarix extension icon

Popup opens:
┌────────────────────────────────────┐
│  Antarix                           │
│                                    │
│  👤 Sharon Dave                    │
│                                    │
│  What are you working on?          │
│                                    │
│  ○ DSA                             │
│  ○ Coding                          │
│  ○ Project                         │
│  ○ Learning                        │
│  ○ Research                        │
│                                    │
│  Project Name (optional):          │
│  [Sign Language Recognition]       │
│                                    │
│  [Start Session]                   │
└────────────────────────────────────┘

User:
1. Selects "Coding"
2. Types "Sign Language Recognition"
3. Clicks "Start Session"
```

**What happens in background:**

```typescript
// Extension background.js
const session = {
  userId: 'user-123',
  category: 'Coding',
  projectName: 'Sign Language Recognition',
  startedAt: Date.now(),
  
  // Capture open tabs
  openTabs: ['github.com', 'stackoverflow.com', 'localhost:3000'],
  
  // Track active window
  activeWindow: 'vscode'
};

// Store locally
chrome.storage.local.set({ currentSession: session });

// Start tracking focus
startFocusTracking();
startDomainTracking();
```

**Popup updates to show timer:**
```
┌────────────────────────────────────┐
│  Antarix                           │
│                                    │
│  Coding Session                    │
│  Sign Language Recognition         │
│                                    │
│  ⏱️  0:05:23                       │
│                                    │
│  Focus Level: HIGH                 │
│  ✓ VSCode active                   │
│  ✓ No distractions                 │
│                                    │
│  [End Session]                     │
└────────────────────────────────────┘
```

---

### Step 2.3: Session Tracking (Background)

While session is active, extension monitors:

```typescript
// Every 5 seconds
setInterval(() => {
  // 1. Track active window
  const activeWindow = getActiveWindow(); // VSCode
  
  // 2. Track tabs
  const openTabs = getOpenTabs();
  // ['github.com', 'stackoverflow.com', 'localhost:3000']
  
  // 3. Calculate focus quality
  const focusQuality = calculateFocus(activeWindow, openTabs);
  // If only 1-2 focused tabs = HIGH
  // If 5+ tabs = MEDIUM
  // If browsing Twitter = LOW
  
  // 4. Store locally
  updateSessionData({ focusQuality });
}, 5000);
```

---

### Step 2.4: Session Complete

```
After 1 hour 45 minutes, user clicks "End Session"

Popup shows:
┌────────────────────────────────────┐
│  Session Complete ✓                │
│                                    │
│  Duration: 1h 45m                  │
│  Category: Coding                  │
│  Project: Sign Language Recognition│
│                                    │
│  Focus Level: HIGH ✓               │
│  Quality: Excellent                │
│                                    │
│  How productive was this?          │
│  ○ Unproductive  ○ Productive  ●○  │
│                                    │
│  Any notes?                        │
│  [Implemented gesture detection...  ]
│                                    │
│  [Save & Close]                    │
└────────────────────────────────────┘

User:
1. Rates productivity
2. Adds notes
3. Clicks "Save & Close"
```

**Extension uploads to backend:**

```typescript
// Background worker (runs every hour or on demand)
async function syncSessions() {
  const pendingSessions = await chrome.storage.local.get('pendingSessions');
  
  for (const session of pendingSessions) {
    await fetch('https://api.antarix.app/api/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: session.userId,
        category: session.category,
        projectName: session.projectName,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.durationMinutes,
        focusLevel: session.focusLevel,
        extensionsUsed: session.openTabs,
        qualityRating: session.qualityRating,
        notes: session.notes
      })
    });
  }
}

// Runs hourly via chrome.alarms
chrome.alarms.create('syncSessions', { periodInMinutes: 60 });
```

**Database stores:**

```sql
INSERT INTO sessions (
  user_id, category, project_name, started_at, ended_at, 
  duration_minutes, focus_level, quality_rating, extensions_used, notes
)
VALUES (
  'user-123', 'Coding', 'Sign Language Recognition',
  '2024-01-15 18:30:00', '2024-01-15 20:15:00', 105,
  'high', 4, '["github.com", "stackoverflow.com"]', 
  'Implemented gesture detection'
);
```

---

### Step 2.5: GitHub Auto-Sync (Background)

While user is sleeping, a cron job syncs GitHub:

```typescript
// Daily at 2 AM
async function dailyGitHubSync() {
  const users = await db.query('SELECT * FROM github_accounts');
  
  for (const githubAccount of users) {
    // Fetch commits since last sync
    const commits = await githubApi.getCommits({
      username: githubAccount.username,
      since: githubAccount.lastSyncedAt
    });
    
    // Store in database
    for (const commit of commits) {
      await db.query(
        `INSERT INTO github_activity (...)
         VALUES (...)`,
        [githubAccount.user_id, commit.hash, ...]
      );
    }
    
    // Update sync time
    await db.query(
      `UPDATE github_accounts 
       SET last_synced_at = NOW() 
       WHERE id = $1`,
      [githubAccount.id]
    );
  }
}
```

---

## Phase 3: Insights Generation (Day 7)

### Step 3.1: Weekly Insight Generation (Sunday 10 AM)

```
Cron job runs: "Generate weekly insights for all users"

For user 'user-123':
```

**Algorithm executes:**

```typescript
async function generateWeeklyInsights(userId) {
  // Get all sessions from last 30 days
  const sessions = await db.query(
    `SELECT * FROM sessions 
     WHERE user_id = $1 AND started_at > NOW() - INTERVAL '30 days'`,
    [userId]
  );
  
  // Get all GitHub commits from last 30 days
  const githubActivity = await db.query(
    `SELECT * FROM github_activity 
     WHERE user_id = $1 AND committed_at > NOW() - INTERVAL '30 days'`,
    [userId]
  );
  
  // INSIGHT 1: Peak Window Detection
  const peakWindow = analyzePeakWindow(sessions);
  // Result: { startHour: 19, endHour: 22, multiplier: 2.3 }
  
  // INSIGHT 2: Workflow Patterns
  const workflow = analyzeWorkflow(sessions);
  // Result: { pattern: 'DSA → Coding → Docs', successRate: 0.84 }
  
  // INSIGHT 3: Skill Detection (from GitHub)
  const skills = analyzeGitHubCommits(githubActivity);
  // Result: { 
  //   'Python': { hours: 120, projects: 5 },
  //   'Machine Learning': { hours: 45, projects: 2 }
  // }
  
  // Store insights
  await storeInsights(userId, [peakWindow, workflow, skills]);
  
  // Trigger: Notify user via push notification
  await sendPushNotification(userId, {
    title: 'Your Weekly Insights Are Ready',
    body: 'You are 2.3x more productive 7-10 PM'
  });
}
```

---

### Step 3.2: User Opens App (Day 7)

```
Student logs in to antarix.app

Browser loads dashboard:
```

**Dashboard page loads:**

```
API call: GET /api/dashboard/brief

Response:
{
  "greeting": "Good Evening Sharon",
  "performanceScore": 82,
  "performanceContext": "Today resembles one of your high-performance days",
  "recommendedAction": "Complete 1 DSA problem before starting project work",
  "risk": {
    "type": "distraction",
    "description": "High distraction probability after 9:30 PM",
    "mitigation": "Set a timer for 9:15 PM"
  },
  "opportunity": {
    "projectName": "Sign Language Recognition",
    "completionProbability": 87,
    "suggestedNextStep": "Train model on additional gestures"
  }
}
```

**Screen displays:**

```
┌─────────────────────────────────────────────┐
│  Antarix                                    │
│                                             │
│  Good Evening Sharon                        │
│                                             │
│  Performance Score: 82%                     │
│  ████████░░ (8/10)                          │
│                                             │
│  Today resembles one of your                │
│  high-performance days                      │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 📋 Recommended Action                │   │
│  │                                     │   │
│  │ Complete 1 DSA problem before       │   │
│  │ starting project work               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ⚠️  Risk: High distraction after 9:30 PM  │
│  ✨ Opportunity: 87% chance to finish      │
│     Sign Language project                  │
│                                             │
│  [Start Session] [View Insights]            │
└─────────────────────────────────────────────┘
```

---

### Step 3.3: View Peak Self Page

```
User clicks "View Insights"

Navigates to /dashboard/peak-self

API call: GET /api/dashboard/peak-self

Response:
{
  "peakWindow": {
    "startHour": 19,
    "endHour": 22,
    "multiplier": 2.3
  },
  "metrics": {
    "averageSleep": 7.8,
    "mostProductiveLocation": "Home Desk",
    "bestWorkflow": ["DSA", "Coding", "Documentation"]
  },
  "successRate": 0.83,
  "blueprint": [
    { step: 1, activity: "DSA", duration: 20 },
    { step: 2, activity: "Coding", duration: 90 },
    { step: 3, activity: "Break", duration: 15 },
    { step: 4, activity: "Project", duration: 60 }
  ]
}
```

**Screen displays:**

```
┌─────────────────────────────────────────┐
│  Peak Self                              │
│                                         │
│  Your Peak Performance Window           │
│  7 PM - 10 PM                           │
│  2.3x more productive                   │
│                                         │
│  Your Best Metrics                      │
│  ├─ Average Sleep: 7.8 hours           │
│  ├─ Most Productive: Home Desk         │
│  └─ Best Workflow: DSA → Coding → Doc  │
│                                         │
│  Success Rate: 83%                      │
│                                         │
│  ┌─ Peak Day Blueprint ────────────┐   │
│  │ Follow these steps today:       │   │
│  │ 1. 🧠 DSA          20 min       │   │
│  │ 2. 💻 Coding       90 min       │   │
│  │ 3. ☕ Break         15 min       │   │
│  │ 4. 🚀 Project      60 min       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Enable Daily Reminders]               │
└─────────────────────────────────────────┘
```

---

### Step 3.4: View Insights Page

```
User clicks "View Insights"

API call: GET /api/insights

Response:
[
  {
    "type": "peak_window",
    "title": "Your Peak Performance Window",
    "description": "You are 2.3x more productive between 7 PM and 10 PM",
    "metricValue": 2.3,
    "dataPointsCount": 47,
    "confidenceScore": 0.87,
    "recommendedAction": "Schedule deep work during this window"
  },
  {
    "type": "workflow_pattern",
    "title": "DSA-First Workflow Success",
    "description": "You complete 72% more projects when DSA is done first",
    "metricValue": 72,
    "dataPointsCount": 12,
    "confidenceScore": 0.82,
    "recommendedAction": "Always start with 30 min DSA before project work"
  },
  {
    "type": "category_success",
    "title": "AI/ML Projects Expertise",
    "description": "You have 84% completion rate on AI/ML vs 60% average",
    "metricValue": 84,
    "dataPointsCount": 8,
    "confidenceScore": 0.78
  }
]
```

**Screen displays:**

```
┌──────────────────────────────────────────┐
│  Insights                                │
│                                          │
│  ┌─ Insight #1 ──────────────────────┐  │
│  │ Peak Performance Window            │  │
│  │                                    │  │
│  │ You are 2.3x more productive       │  │
│  │ between 7 PM and 10 PM             │  │
│  │                                    │  │
│  │ Based on 47 sessions               │  │
│  │ Confidence: 87%                    │  │
│  │                                    │  │
│  │ 💡 Try scheduling deep work during │  │
│  │    this window                     │  │
│  │                                    │  │
│  │ [Validate This Week] [More Details]│  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ Insight #2 ──────────────────────┐  │
│  │ DSA-First Workflow                 │  │
│  │                                    │  │
│  │ You complete 72% more projects     │  │
│  │ when DSA is done first             │  │
│  │                                    │  │
│  │ Based on 12 sessions               │  │
│  │ Confidence: 82%                    │  │
│  │                                    │  │
│  │ 💡 Always start with 30 min DSA    │  │
│  │    before project work             │  │
│  │                                    │  │
│  │ [Validate This Week] [More Details]│  │
│  └────────────────────────────────────┘  │
│                                          │
│  [See More Insights]                     │
└──────────────────────────────────────────┘
```

---

## Phase 4: Cohort & Community (Week 2)

### Step 4.1: Join Cohort

```
Student clicks "Join Cohort"

Sees:
┌─────────────────────────────────────┐
│  Cohorts                            │
│                                     │
│  Discover cohorts near you          │
│                                     │
│  ┌─ CSE 2024 @ St Joseph's ────┐   │
│  │                             │   │
│  │ 247 students tracked        │   │
│  │                             │   │
│  │ Peak Window: 7-10 PM        │   │
│  │ Avg Focus Quality: 78%      │   │
│  │                             │   │
│  │ [Join Cohort]               │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─ AI/ML Enthusiasts ────────┐    │
│  │                             │   │
│  │ 89 students tracked         │   │
│  │                             │   │
│  │ Specialization: ML Projects │   │
│  │ Avg Success Rate: 82%       │   │
│  │                             │   │
│  │ [Join Cohort]               │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Create New Cohort]                │
└─────────────────────────────────────┘

User clicks "Join Cohort" for CSE 2024
```

**Database records:**

```sql
INSERT INTO cohort_members (cohort_id, user_id, joined_at)
VALUES ('cohort-cse-2024', 'user-123', NOW());

-- Cohort now has 248 members (was 247)
UPDATE cohorts SET member_count = 248 WHERE id = 'cohort-cse-2024';
```

---

### Step 4.2: View Cohort Comparison

```
API call: GET /api/cohorts/cohort-cse-2024/comparison?user_id=user-123

Response:
{
  "cohortName": "CSE 2024 @ St Joseph's",
  "yourMetrics": {
    "peakWindow": { start: 19, end: 22 },
    "productivity": 2.3,
    "focusQuality": 0.92
  },
  "cohortMetrics": {
    "peakWindow": { start: 19, end: 22 },
    "productivity": 2.1,
    "focusQuality": 0.78
  },
  "comparison": {
    "productivity": { yours: 2.3, cohort: 2.1, advantage: "+9%" },
    "focusQuality": { yours: 0.92, cohort: 0.78, advantage: "+18%" },
    "workflow": { yours: "DSA→Coding", cohort: "Coding→DSA", advantage: "+23%" }
  }
}
```

**Screen displays:**

```
┌────────────────────────────────────────────┐
│  Cohort: CSE 2024 (247 students)           │
│                                            │
│  YOU vs. COHORT                            │
│                                            │
│  Peak Window:                              │
│    You:    7-10 PM (2.3x)                 │
│    Cohort: 7-10 PM (2.1x)                 │
│  ✨ Your advantage: +9%                    │
│                                            │
│  Focus Quality:                            │
│    You:    92%                             │
│    Cohort: 78%                             │
│  ✨ Your advantage: +18%                   │
│                                            │
│  Best Workflow:                            │
│    You:    DSA → Coding (84% success)    │
│    Cohort: Coding → DSA (61% success)    │
│  ✨ Your advantage: +23%                   │
│                                            │
│  [Join Study Group] [View More Details]    │
└────────────────────────────────────────────┘
```

---

# 3. COLLEGE WORKFLOW

## How a College Uses Antarix

### Step 1: Institutional Onboarding

```
Placement Officer at St. Joseph's goes to: college.antarix.app

Sees login page:
┌────────────────────────────────┐
│  Antarix for Colleges          │
│                                │
│  Placement Intelligence        │
│  For Your Engineering College  │
│                                │
│  College Email:                │
│  [placements@sjec.ac.in     ]  │
│                                │
│  [Sign Up]                     │
└────────────────────────────────┘

Placement Officer signs up
```

**Database records:**

```sql
INSERT INTO institutions (
  name, type, location, city, country,
  subscription_tier, subscription_start_date, annual_cost
)
VALUES (
  'St. Joseph''s Engineering College',
  'college',
  'Belagavi, Karnataka',
  'Belagavi',
  'India',
  'starter',
  '2024-01-15',
  50000
);
```

---

### Step 2: Add Students

```
Placement Officer dashboard shows:

┌────────────────────────────────────────┐
│  College Dashboard                     │
│  St. Joseph's Engineering College      │
│                                        │
│  Students Tracked: 0 / 500             │
│                                        │
│  [Import Students]                     │
│  [Manual Add]                          │
│  [Sync from SIS]                       │
│                                        │
│  Placement Overview:                   │
│  Readiness Score: --                   │
│  Students Analyzed: 0                  │
└────────────────────────────────────────┘

Clicks "Import Students"

Uploads CSV:
student_email,student_name,batch_year,specialization
sharon@example.com,Sharon Dave,2024,CSE
priya@example.com,Priya Sharma,2024,CSE
arjun@example.com,Arjun Patel,2024,CSE
...
```

**Database records:**

```sql
INSERT INTO institution_members (
  institution_id, user_id, role, batch_year, specialization
)
VALUES 
  ('inst-sjec', 'user-123', 'student', 2024, 'CSE'),
  ('inst-sjec', 'user-456', 'student', 2024, 'CSE'),
  ('inst-sjec', 'user-789', 'student', 2024, 'CSE');

-- System sends invitations to each student
-- "Your college has added you to Antarix. Link your account."
```

---

### Step 3: View Placement Dashboard

```
After 2 weeks, placement officer opens dashboard again

API call: GET /api/institutions/:id/dashboard

Response:
{
  "institution": "St. Joseph's Engineering College",
  "totalStudents": 247,
  "trackedStudents": 187,
  "placementReady": {
    "count": 64,
    "percentage": 27,
    "students": [
      {
        "name": "Sharon Dave",
        "skillProof": 95,
        "specialization": ["ML", "DevOps"],
        "projectsCompleted": 42,
        "focusQuality": 0.92,
        "peakWindow": "7-10 PM",
        "readyToPlace": true
      },
      ...
    ]
  },
  "developmentPath": {
    "count": 98,
    "percentage": 42,
    "action": "Needs 3-6 more months"
  },
  "earlyStage": {
    "count": 25,
    "percentage": 11,
    "action": "Mentor mentorship required"
  },
  "skillGaps": [
    {
      "skill": "DevOps",
      "demand": 8,
      "studentCount": 8,
      "gap": 34,
      "recommendation": "Add DevOps course to curriculum"
    },
    {
      "skill": "Cloud",
      "demand": 8,
      "studentCount": 12,
      "gap": 28,
      "recommendation": "Increase AWS training"
    }
  ]
}
```

**Screen displays:**

```
┌──────────────────────────────────────────────┐
│  College Dashboard: St. Joseph's             │
│                                              │
│  Class of 2024 Placement Status              │
│  Total Students: 247                         │
│  Tracked: 187 (76%)                          │
│                                              │
│  ┌─ PLACEMENT READY ─────────────────────┐  │
│  │ 64 students (34%)                     │  │
│  │                                       │  │
│  │ Top Performer:                        │  │
│  │ Sharon Dave (Skill Proof: 95/100)    │  │
│  │ ├─ Specialization: ML (87%), DevOps  │  │
│  │ ├─ Projects: 42                       │  │
│  │ ├─ Focus Quality: 92%                 │  │
│  │ ├─ Peak: 7-10 PM                      │  │
│  │ └─ Ready to Place ✓                   │  │
│  │                                       │  │
│  │ [View All Ready Students]             │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌─ DEVELOPMENT PATH ────────────────────┐  │
│  │ 98 students (42%)                     │  │
│  │ Likely ready in 3-6 months            │  │
│  │ Action: Encourage projects            │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  ┌─ EARLY STAGE ─────────────────────────┐  │
│  │ 25 students (11%)                     │  │
│  │ Need mentorship + guidance            │  │
│  │ Action: 1:1 coaching                  │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  CURRICULUM GAPS IDENTIFIED:                 │
│  │                                          │
│  │ ❌ DevOps: Only 8 students tracked     │  │
│  │    Industry Demand: 8/10                │  │
│  │    Gap: 34 students needed             │  │
│  │    → Recommendation: Add DevOps course │  │
│  │                                          │
│  │ ❌ Cloud: 12 students tracked          │  │
│  │    Industry Demand: 8/10                │  │
│  │    Gap: 28 students needed             │  │
│  │    → Recommendation: Increase AWS      │  │
│  │                                          │
│  [Export Student Profiles]  [View Companies] │
└──────────────────────────────────────────────┘
```

---

### Step 4: Export Profiles to Companies

```
Placement officer sees "View Companies"

Screen shows companies hiring:
┌────────────────────────────────────────┐
│  Companies Recruiting                  │
│                                        │
│  🔴 Google                             │
│  Hiring: 8 positions                  │
│  Skills: ML, Python, Cloud            │
│  Match from St. Joseph's: 12 students │
│  [Auto-Match Students]                │
│                                        │
│  🔴 Microsoft                          │
│  Hiring: 5 positions                  │
│  Skills: Cloud, DevOps                │
│  Match from St. Joseph's: 3 students  │
│  [Auto-Match Students]                │
│                                        │
│  🔴 Amazon                             │
│  Hiring: 15 positions                 │
│  Skills: Python, DevOps, Cloud        │
│  Match from St. Joseph's: 20 students │
│  [Auto-Match Students]                │
│                                        │
└────────────────────────────────────────┘

Clicks [Auto-Match Students] for Google

System matches:
- Filters students with ML specialization (80%+)
- Filters skill proof score (80+)
- Filters project completion rate (80%+)
- Returns 12 matching students
- Auto-sends their profiles to Google
- Notifies students: "Google is interested in you"
```

**Database records:**

```sql
INSERT INTO job_matches (recruiter_search_id, candidate_id, match_score, reached_out_at)
VALUES 
  ('search-google-001', 'cand-123', 94, NOW()),
  ('search-google-001', 'cand-456', 89, NOW()),
  ...

-- Push notification sent to each matched student:
-- "Google is recruiting. You match their requirements. 
--  Your college submitted your profile. Check your Antarix dashboard."
```

---

# 4. COMPANY RECRUITING WORKFLOW

## How a Company Uses Antarix

### Step 1: Company Onboarding

```
Recruiter from Google goes to: recruiting.antarix.app

Sees:
┌────────────────────────────────────┐
│  Antarix Recruiting                │
│                                    │
│  Find Verified Engineers Fast      │
│                                    │
│  Company Name:                     │
│  [Google India                  ]  │
│                                    │
│  Email:                            │
│  [recruiting@google.com         ]  │
│                                    │
│  Number of positions:              │
│  [8                             ]  │
│                                    │
│  [Sign Up]                         │
└────────────────────────────────────┘

Signs up → Subscribes to Growth tier ($2,000/month)
```

---

### Step 2: Create Job Search

```
Recruiter opens dashboard:

┌────────────────────────────────────────┐
│  Google Recruiting Dashboard           │
│                                        │
│  [Create New Search]                   │
│                                        │
│  Active Searches:                      │
│  • ML Engineers (8 positions) - 3 days │
│  • Backend Engineers - 1 day           │
└────────────────────────────────────────┘

Clicks [Create New Search]

Form:
┌────────────────────────────────────────┐
│  Create Job Search                     │
│                                        │
│  Search Title:                         │
│  [ML Engineers - Q1 2024            ]  │
│                                        │
│  Positions:                            │
│  [8                                 ]  │
│                                        │
│  Required Skills (select multiple):    │
│  ☑ Machine Learning                    │
│  ☑ Python                              │
│  ☑ Deep Learning                       │
│  ☐ Cloud                               │
│  ☐ DevOps                              │
│                                        │
│  Min Skill Proof Score:                │
│  [80                                ]  │
│                                        │
│  Preferred Batch Years:                │
│  ☑ 2024  ☑ 2023  ☐ 2022              │
│                                        │
│  Preferred Locations:                  │
│  ☑ Bangalore  ☑ Hyderabad  ☑ Pune    │
│                                        │
│  [Search Candidates]                   │
└────────────────────────────────────────┘

Clicks "Search Candidates"
```

---

### Step 3: View Candidate Results

```
API call: POST /api/recruiter/search

Request:
{
  "skills": ["Machine Learning", "Python", "Deep Learning"],
  "minSkillProofScore": 80,
  "batchYears": [2024, 2023],
  "locations": ["Bangalore", "Hyderabad", "Pune"]
}

Response:
{
  "candidatesFound": 127,
  "candidates": [
    {
      "id": "cand-123",
      "name": "Sharon Dave",
      "skillProofScore": 95,
      "specialization": {
        "ML": 87,
        "Python": 89,
        "DeepLearning": 84
      },
      "projectsCompleted": 42,
      "focusQuality": 0.92,
      "peakWindow": { start: 19, end: 22 },
      "college": "St. Joseph's Engineering College",
      "batchYear": 2024,
      "skillMatch": {
        "score": 94,
        "matchedSkills": ["ML", "Python", "DeepLearning"],
        "strengths": ["Strong ML background", "Consistent project completion"]
      },
      "matchScore": 94,
      "recommendation": "Excellent fit. Schedule ASAP."
    },
    {
      "id": "cand-456",
      "name": "Priya Sharma",
      "skillProofScore": 92,
      "specialization": { "ML": 84, "Python": 88 },
      "matchScore": 89
    },
    ...
  ]
}
```

**Screen displays:**

```
┌──────────────────────────────────────────────────┐
│  ML Engineers Search Results: 127 Candidates     │
│                                                  │
│  ┌─ Sharon Dave ───────────────────────────┐    │
│  │ Skill Proof: 95/100                     │    │
│  │ Match Score: 94%                        │    │
│  │                                         │    │
│  │ Specialization:                         │    │
│  │ ├─ Machine Learning: 87%               │    │
│  │ ├─ Python: 89%                         │    │
│  │ └─ Deep Learning: 84%                  │    │
│  │                                         │    │
│  │ Work Profile:                           │    │
│  │ ├─ 42 projects completed                │    │
│  │ ├─ 92% focus quality                    │    │
│  │ ├─ Peak: 7-10 PM (very productive)      │    │
│  │ ├─ College: St. Joseph's               │    │
│  │ └─ Batch: 2024                         │    │
│  │                                         │    │
│  │ 💡 EXCELLENT FIT                       │    │
│  │ "Strong ML background, consistent      │    │
│  │  project completion. Schedule ASAP."   │    │
│  │                                         │    │
│  │ [View Full Profile] [Schedule Interview] │   │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─ Priya Sharma ──────────────────────────┐    │
│  │ Skill Proof: 92/100                     │    │
│  │ Match Score: 89%                        │    │
│  │ [View Profile]                          │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─ Arjun Patel ───────────────────────────┐    │
│  │ Skill Proof: 88/100                     │    │
│  │ Match Score: 87%                        │    │
│  │ [View Profile]                          │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  [Show More] [Save Search] [Export List]        │
└──────────────────────────────────────────────────┘
```

---

### Step 4: Schedule Interviews

```
Recruiter clicks [Schedule Interview] for Sharon Dave

Popup shows:
┌──────────────────────────────┐
│  Schedule Interview          │
│                              │
│  Sharon Dave                 │
│  Skill Proof: 95/100         │
│                              │
│  Your availability:          │
│  [Date Picker] [Time Picker] │
│                              │
│  Interview format:           │
│  ○ Video Call ○ Phone        │
│  ◉ In-Person (Bangalore)    │
│                              │
│  [Suggest Times]             │
│                              │
│  [Schedule]                  │
└──────────────────────────────┘

Clicks "Suggest Times"

System checks:
- Sharon's calendar (via integration)
- Sharon's peak productivity window (7-10 PM)
- Google's team availability
- Suggests: "Tomorrow 9 PM would work"

Recruiter selects time and clicks "Schedule"
```

**Database records:**

```sql
INSERT INTO job_matches (recruiter_search_id, candidate_id, match_score, interview_scheduled_at)
VALUES ('search-google-001', 'cand-123', 94, '2024-01-16 21:00:00');

-- Email sent to Sharon:
-- "Google scheduled an interview with you for tomorrow at 9 PM (your peak productivity time!)"

-- Calendar event created in Google's system
-- Calendar event created in Sharon's Antarix account
```

---

### Step 5: Hiring Complete

```
After interview, recruiter updates status:

API call: POST /api/job_matches/cand-123/hired

Payload:
{
  "hired": true,
  "role": "ML Engineer",
  "salary": "₹25 lakhs/year"
}

Database updates:
```

```sql
UPDATE job_matches 
SET hired = true, hired_at = NOW() 
WHERE candidate_id = 'cand-123';

-- Email to Sharon:
-- "Congratulations! Google offered you a position: ML Engineer, ₹25L/year"

-- Email to College:
-- "Sharon Dave from your college was hired by Google. 
--  Skill Proof Score: 95/100 predicted this outcome."

-- Email to Google Analytics:
-- "Hire tracked. Sharon Dave (Skill Proof: 95) hired as ML Engineer"
```

---

### Step 6: Analytics

```
After 3 months, Google sees analytics:

Recruiter opens: recruiting.antarix.app/analytics

Shows:
┌────────────────────────────────────────┐
│  Google Hiring Analytics               │
│                                        │
│  Q1 2024 Recruiting Campaign           │
│                                        │
│  Positions Filled: 6 / 8               │
│  Candidates Searched: 127              │
│  Candidates Reached: 25                │
│  Interviews Scheduled: 10              │
│  Hires: 6                              │
│                                        │
│  Retention Rate (3 months):            │
│  Google ML hires: 100% (6/6 still employed)
│                                        │
│  Average Skill Proof Score of Hires:   │
│  92/100 (vs 85 for typical hires)     │
│                                        │
│  Hiring via Antarix Advantages:        │
│  • 25% faster hiring (3 weeks vs 4)    │
│  • 15% better retention                │
│  • 40% lower interview no-shows        │
│                                        │
│  Cost Analysis:                        │
│  Traditional recruiting: $50K per hire │
│  Antarix recruiting: $2K/month = 1.2K │
│                                        │
│  ROI: 40:1                             │
│                                        │
│  → Google upgrades to Enterprise tier  │
└────────────────────────────────────────┘
```

---

# 5. DATA FLOW DIAGRAM (Complete System)

## Complete Data Journey

```
                    START: STUDENT SIGNS UP
                             │
                             ▼
              ┌──────────────────────────────┐
              │  User Creates Account        │
              │  Email + Password            │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │  Profile Setup               │
              │  Goals, Skill Level, Hours   │
              └──────────────────┬───────────┘
                                 │
        ┌────────────┬───────────┴──────────┬─────────────┐
        │            │                      │             │
        ▼            ▼                      ▼             ▼
    GitHub OAuth  Calendar OAuth      Notion (opt)   Extension Download
        │            │                      │             │
        ▼            ▼                      ▼             ▼
    Access Token  Access Token         Access Token   Local Storage
        │            │                      │             │
        └────────────┴──────────┬───────────┴─────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    DATA COLLECTION STARTS    │
              └──────────────────┬───────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
  Extension Tracks         GitHub Syncs             Calendar Syncs
  • Sessions               • Commits                • Events
  • Focus Quality          • Repos                  • Schedule
  • Domains Visited        • Languages              • Availability
        │                        │                        │
        ▼                        ▼                        ▼
  Chrome Storage           GitHub API               Google API
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 │
                        Hourly Sync (Background Job)
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    POSTGRESQL DATABASE       │
              │                              │
              │ • sessions                   │
              │ • github_activity            │
              │ • calendar_events            │
              │ • user_skills                │
              └──────────────────┬───────────┘
                                 │
                    Days 1-7: Data Accumulates
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    DAY 7: INSIGHT GEN        │
              │    (Weekly Cron Job)         │
              └──────────────────┬───────────┘
                                 │
        ┌────────────┬───────────┴───────────┬────────────┐
        │            │                       │            │
        ▼            ▼                       ▼            ▼
    Peak Window  Workflow Pattern     Skill Detection  Category Success
    Analysis     Detection            (from GitHub)    Rates
        │            │                       │            │
        └────────────┴───────────┬───────────┴────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    INSIGHTS TABLE            │
              │    • peak_window             │
              │    • workflow_pattern        │
              │    • skill_proof             │
              │    • category_success        │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    PUSH NOTIFICATION         │
              │    "Your insights are ready" │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    STUDENT OPENS ANTARIX     │
              │                              │
              │  Dashboard loads insights    │
              │  from database               │
              └──────────────────┬───────────┘
                                 │
        ┌────────────┬───────────┴───────────┬────────────┐
        │            │                       │            │
        ▼            ▼                       ▼            ▼
   Brief Page  Peak Self Page      Insights Page    Cohort Page
        │            │                       │            │
        └────────────┴───────────┬───────────┴────────────┘
                                 │
                    STUDENT ACTS ON INSIGHTS
                                 │
                    Updates sessions/projects
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    STUDENT JOINS COHORT      │
              │                              │
              │  System calculates           │
              │  cohort insights             │
              │  (aggregates data)           │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    COHORT INSIGHTS           │
              │    Generated                 │
              │    (Anonymous stats)         │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    STUDENT INVITED FRIENDS   │
              │                              │
              │  More students join cohort   │
              │  Cohort data improves        │
              └──────────────────┬───────────┘
                                 │
                NETWORK EFFECTS ACTIVATE
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    COLLEGE ADDS ANTARIX      │
              │                              │
              │  Imports 500 students        │
              │  Pays ₹150K/year             │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    INSTITUTION DASHBOARD     │
              │    Analyzes 500 students     │
              │    • Placement readiness     │
              │    • Skill gaps              │
              │    • Alumni success          │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    COMPANY JOINS ANTARIX     │
              │                              │
              │  Pays $2K/month              │
              │  Searches candidates         │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    COMPANY RECRUITER VIEWS   │
              │    127 ML Engineers          │
              │    Filters by skill, proof   │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    FINDS SHARON (Top Match)  │
              │    Skill Proof: 95/100       │
              │    Match Score: 94%          │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    SCHEDULES INTERVIEW       │
              │    • Email to Sharon         │
              │    • Calendar sync           │
              │    • Notification            │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    INTERVIEW HAPPENS         │
              │    (Sharon succeeds)         │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    HIRED ✓                   │
              │                              │
              │  • Email to Sharon           │
              │  • Email to College          │
              │  • Email to Company          │
              │  • Analytics updated         │
              └──────────────────┬───────────┘
                                 │
                                 ▼
              ┌──────────────────────────────┐
              │    ECOSYSTEM BENEFITS        │
              │                              │
              │  Sharon: Got job             │
              │  College: Placement success  │
              │  Company: Great hire         │
              │  Antarix: Data moat grows    │
              └──────────────────────────────┘
                                 │
                                 ▼
                    FLYWHEEL CONTINUES
                    (Repeat at scale)
```

---

# 6. REAL-TIME EXAMPLE (Hour by Hour)

## Day 1 Hour by Hour

```
10:00 AM
├─ Sharon signs up on antarix.app
├─ Creates password + email
├─ Database: INSERT INTO users
└─ Receives verification email

10:15 AM
├─ Sharon clicks verification link
├─ Email confirmed
├─ Redirected to profile setup
└─ Sees form for goals/skill level

10:30 AM
├─ Sharon fills profile form
├─ Selects: Placement, DSA, AI/ML
├─ Skill level: Advanced
├─ Working hours: 6 PM - 11 PM
├─ Database: UPDATE users
└─ Redirected to GitHub connect

10:45 AM
├─ Sharon clicks "Connect GitHub"
├─ Redirects to GitHub OAuth
├─ Sharon logs in to GitHub
├─ Approves Antarix access
├─ GitHub sends auth code to Antarix
├─ Antarix backend exchanges for token
├─ GitHub API fetches repos
├─ Database: INSERT INTO github_accounts
├─ Background job starts: Sync last 90 days of commits
└─ Redirected to calendar step

11:00 AM
├─ Sharon connects Google Calendar (optional)
├─ Google OAuth flow
├─ Database: INSERT INTO calendar_events
└─ Onboarding complete

11:15 AM
├─ Sharon sees congratulations screen
├─ Shown Chrome extension download link
├─ "Check back in 7 days for insights"
└─ Redirected to /dashboard

11:30 AM
├─ Background job: GitHub sync
├─ Fetches Sharon's last 90 days of commits
├─ Commits found: 245 commits across 12 repos
├─ Database: INSERT INTO github_activity (245 rows)
├─ Analyzes languages: Python (67%), JavaScript (23%), SQL (10%)
└─ Completes

12:00 PM
├─ Sharon downloads Chrome extension
├─ Installs locally
├─ Extension icon appears in toolbar
├─ Local storage initialized
└─ Extension ready to track

1:00 PM
├─ Sharon clicks extension icon
├─ Popup opens: "What are you working on?"
├─ Selects "Coding"
├─ Types: "Sign Language Recognition"
├─ Clicks "Start Session"
├─ Database: currentSession stored locally
├─ Timer starts: 0:00:00
└─ Focus tracking begins

2:00 PM
├─ Session still active: 1:05:00 elapsed
├─ Extension monitors:
│  ├─ Active window: VSCode (focused)
│  ├─ Open tabs: github.com, stackoverflow.com, localhost:3000
│  ├─ Focus quality: HIGH (only 2 tabs, VSCode in focus)
│  └─ No distractions detected
└─ Continues tracking

3:45 PM
├─ Sharon closes VS Code
├─ Session continues (user still focused)
├─ Extension detects: Switch to browser
├─ Open tabs now: 5 tabs (focus decreases to MEDIUM)
└─ Tracking continues

4:00 PM
├─ Session ends: 2:50:00 elapsed
├─ Sharon clicks "End Session"
├─ Popup shows: "Session Complete"
├─ Asks: "How productive was this?"
├─ Sharon rates: 4/5 (Productive)
├─ Adds notes: "Implemented gesture detection"
├─ Clicks "Save & Close"
├─ Extension uploads to backend (hourly sync job)
└─ Local storage cleared

4:05 PM
├─ Sync job (background)
├─ Uploads session to API
├─ POST /api/sessions
│  ├─ userId: 'user-123'
│  ├─ category: 'Coding'
│  ├─ projectName: 'Sign Language Recognition'
│  ├─ durationMinutes: 170
│  ├─ focusLevel: 'high'
│  ├─ qualityRating: 4
│  └─ notes: 'Implemented gesture detection'
├─ Database: INSERT INTO sessions
├─ Success response: 201 Created
└─ Session recorded

6:00 PM
├─ GitHub sync job (runs every 2 hours)
├─ Fetches new commits since last sync
├─ Commits found: 2 new commits
├─ Database: INSERT INTO github_activity (2 rows)
│  ├─ "Add gesture detection model" (45 files changed, 1200 additions)
│  └─ "Fix gesture edge cases" (3 files changed, 50 additions, 20 deletions)
└─ Updates last_synced_at

9:00 PM (Sharon's peak window begins)
├─ Sharon opens Antarix
├─ Sees dashboard
├─ API call: GET /api/dashboard/brief
├─ Response (no insights yet): 
│  ├─ greeting: "Good Evening Sharon"
│  ├─ performanceScore: "Not available yet"
│  ├─ message: "Keep tracking. We'll have insights in 6 days."
│  └─ dailyStats: "1 session today (2h 50m), 2 commits"
├─ Dashboard displays:
│  ├─ Activity tracking indicator (green)
│  ├─ Days until insights (6 remaining)
│  └─ [Continue Tracking]
└─ Sharon is engaged

MIDNIGHT
└─ Day 1 complete: 
   ├─ 1 session tracked
   ├─ 2 new commits recorded
   ├─ 247 historical commits synced
   └─ All data in database, ready for next phase
```

---

# 7. WEEK 1 AGGREGATED VIEW

```
Monday-Sunday: 7 Sessions Tracked

Monday:
├─ Session 1: Coding (2h, focus: HIGH, projects: Sign Language)
├─ Session 2: DSA (45m, focus: MEDIUM, projects: LeetCode)
├─ GitHub: 3 commits
└─ Calendar: 3 class events, 1 deadline

Tuesday:
├─ Session 1: Coding (3h, focus: HIGH)
├─ Session 2: Learning (1h, focus: MEDIUM)
├─ GitHub: 5 commits
└─ Calendar: 2 class events

Wednesday-Sunday:
├─ Similar pattern...
└─ Total by Sunday:
   ├─ Sessions: 15 total (≈25 hours tracked)
   ├─ GitHub: 34 commits
   ├─ Focus quality: 68 high, 32 medium, 0 low
   ├─ Categories: 8 Coding, 4 DSA, 2 Learning, 1 Project
   └─ Completed projects: 0 (not enough data yet)

SUNDAY 10 AM: INSIGHT GENERATION

System runs: generateWeeklyInsights('user-123')

Analysis:
├─ Peak window calculation:
│  ├─ Hours tracked: 7 PM (7 sessions), 8 PM (6 sessions), 9 PM (5 sessions)
│  ├─ 10 PM (3 sessions), other hours (low)
│  ├─ Productivity: 7-10 PM window shows consistent engagement
│  ├─ Average session length: 7-10 PM = 2h, other = 1h
│  ├─ Multiplier: 2 ÷ 1 = 2.0x
│  └─ Confidence: 7 days = medium confidence (needs 30 days for high)
│
├─ Workflow pattern:
│  ├─ Sessions show: Coding followed by DSA (2 instances)
│  ├─ Sessions show: DSA followed by Coding (3 instances)
│  ├─ Sessions show: DSA followed by Learning (1 instance)
│  ├─ Most common: DSA → Coding (3 times)
│  ├─ Average project completion: 2/3 for DSA→Coding
│  └─ Insight: "DSA→Coding shows promise, but need more data"
│
├─ Skills detected (from GitHub commits):
│  ├─ Python: 24 commits = 71% of activity
│  ├─ JavaScript: 8 commits = 24%
│  ├─ SQL: 2 commits = 5%
│  ├─ Primary language: Python (strong signal)
│  ├─ Focus area: Deep Learning (based on commit messages + files)
│  └─ Insight: "You're specializing in ML (Python focus)"
│
└─ Result: 3 insights generated
   ├─ "You have focused activity 7-10 PM" (confidence: 65%)
   ├─ "Python is your primary language" (confidence: 90%)
   └─ "Early data suggests DSA→Coding works better" (confidence: 40%)

Database: INSERT INTO insights (3 rows)

Sunday 10:15 AM: Notification Sent

Push notification to student:
├─ Title: "Your first week complete! ✓"
├─ Body: "Initial patterns detected. Open Antarix to see."
└─ Action: "View Insights" → Opens /dashboard/insights

Sunday 11:00 AM: Student Opens App

Sharon opens Antarix

GET /api/dashboard/brief

Response:
```

```json
{
  "greeting": "Good Evening Sharon",
  "performanceScore": 72,
  "context": "You've been consistent this week",
  "stats": {
    "sessionsThisWeek": 15,
    "hoursLogged": 25,
    "gitHubCommits": 34
  },
  "nextInsight": "Come back next week for stronger insights"
}
```

**Screen shows:**
```
┌────────────────────────────────────┐
│ Antarix                            │
│                                    │
│ Good Evening Sharon                │
│                                    │
│ Week 1 Summary                     │
│                                    │
│ Sessions: 15                       │
│ Hours: 25h                         │
│ Commits: 34                        │
│ Focus Quality: 68% High            │
│                                    │
│ 🎯 Pattern Detected:               │
│ You consistently work 7-10 PM      │
│                                    │
│ Keep tracking! Next week we'll     │
│ have stronger insights.            │
│                                    │
│ [View This Week] [Insights]        │
└────────────────────────────────────┘
```
```

---

# 8. COLLEGE RECRUITER FLOW (Instant View)

```
Placement officer logs in Monday 10 AM

GET /api/institutions/inst-sjec/dashboard

System immediately returns:

{
  "institution": "St. Joseph's Engineering College",
  "batch": 2024,
  "totalStudents": 247,
  "trackedStudents": 187,  // 76% have signed up in first month
  "averageSkillProof": 58,  // Early stage
  
  "placementReady": {
    "count": 4,
    "students": [
      {
        "name": "Sharon Dave",
        "skillProof": 95,
        "specializations": ["ML", "Python"],
        "projectsCompleted": 42,
        "focusQuality": 0.92,
        "readyNow": true,
        "companies": ["Google", "Microsoft", "Amazon"]  // Companies actively recruiting this profile
      }
    ]
  },
  
  "skillGaps": [
    {
      "skill": "DevOps",
      "students": 8,
      "industryDemand": 9,
      "gap": 34,
      "recommendation": "Add DevOps to curriculum"
    }
  ]
}
```

**Placement officer sees:**
```
"Sharon Dave is ready for placement NOW. 
3 companies are actively recruiting her profile.
Auto-match her? [YES]"

Clicks YES
```

**System automatically:**
1. Exports Sharon's profile to 3 companies
2. Sends email to Sharon: "3 companies are recruiting your profile"
3. Sends email to companies: "St. Joseph's matched a top candidate"
4. Creates job match records
5. Schedules interviews

Result: **Interview in 48 hours**

---

# 9. COMPANY HIRING FLOW (Results)

```
Google recruiter: "How many candidates should I interview?"

System shows:
├─ Traditional recruiting: 50 candidates
│  ├─ 20% interview rate = 10 interviews
│  ├─ 50% interview success = 5 offers
│  ├─ 60% acceptance = 3 hires
│  └─ Time: 8 weeks
│
└─ Via Antarix: 
   ├─ 127 verified candidates
   ├─ 94% match average
   ├─ Schedule 10 interviews (same as traditional)
   ├─ Interview success: 80% (Skill Proof Score is accurate)
   ├─ 8 offers, 7 acceptances = 7 hires
   └─ Time: 2 weeks

Benefit: 2x hires in 1/4 the time with same effort.
Cost: $2,000/month vs $50K per traditional hire (26:1 ROI)
```

---

**END OF COMPLETE WORKFLOW**

This shows exactly how every piece connects. From student onboarding → weeks of data collection → insight generation → college discovery → company recruiting → hiring success.

**The entire ecosystem is data-driven and automated.**
