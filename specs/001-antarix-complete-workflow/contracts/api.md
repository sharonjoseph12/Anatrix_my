# API Contracts: Antarix

**Branch**: `001-antarix-complete-workflow` | **Date**: 2026-06-04

All endpoints are served via Supabase Edge Functions or Next.js API routes.
Base URL: `https://api.antarix.app` (production), `http://localhost:54321/functions/v1` (local).

Authentication: Bearer token (Supabase JWT) in `Authorization` header.

---

## Student Endpoints

### POST /auth/signup
Create a new student account.

**Request**:
```json
{
  "email": "sharon@example.com",
  "password": "securePassword123"
}
```

**Response** (201):
```json
{
  "user": { "id": "uuid", "email": "sharon@example.com" },
  "session": { "access_token": "jwt...", "refresh_token": "..." }
}
```

---

### PUT /users/profile
Complete profile setup (requires auth).

**Request**:
```json
{
  "display_name": "Sharon Dave",
  "user_type": "student",
  "goals": ["Placement", "DSA", "AI/ML"],
  "skill_level": "advanced",
  "working_hours_start": 18,
  "working_hours_end": 23
}
```

**Response** (200): Updated user object.

---

### POST /auth/github
Initiate GitHub OAuth. Returns redirect URL.

**Response** (200):
```json
{ "url": "https://github.com/login/oauth/authorize?client_id=..." }
```

---

### POST /auth/github/callback
Exchange GitHub auth code for token, begin sync.

**Request**:
```json
{ "code": "github_auth_code" }
```

**Response** (200):
```json
{
  "github_account": { "username": "sharondav", "repos_count": 12 },
  "sync_status": "started"
}
```

---

### POST /sessions
Upload tracked session from extension (requires auth).

**Request**:
```json
{
  "category": "Coding",
  "project_name": "Sign Language Recognition",
  "started_at": "2024-01-15T18:30:00Z",
  "ended_at": "2024-01-15T20:15:00Z",
  "duration_minutes": 105,
  "focus_level": "high",
  "quality_rating": 4,
  "extensions_used": ["github.com", "stackoverflow.com"],
  "notes": "Implemented gesture detection"
}
```

**Response** (201): Created session object.

---

### POST /sessions/batch
Upload multiple sessions (extension sync).

**Request**:
```json
{ "sessions": [ /* array of session objects */ ] }
```

**Response** (201):
```json
{ "created": 3, "duplicates_skipped": 0 }
```

---

### GET /dashboard/brief
Student dashboard brief page (requires auth).

**Response** (200):
```json
{
  "greeting": "Good Evening Sharon",
  "performance_score": 82,
  "performance_context": "Today resembles one of your high-performance days",
  "recommended_action": "Complete 1 DSA problem before starting project work",
  "risk": {
    "type": "distraction",
    "description": "High distraction probability after 9:30 PM",
    "mitigation": "Set a timer for 9:15 PM"
  },
  "opportunity": {
    "project_name": "Sign Language Recognition",
    "completion_probability": 87,
    "suggested_next_step": "Train model on additional gestures"
  },
  "stats": {
    "sessions_this_week": 15,
    "hours_logged": 25,
    "github_commits": 34
  }
}
```

---

### GET /dashboard/peak-self
Peak Self insights (requires auth).

**Response** (200):
```json
{
  "peak_window": { "start_hour": 19, "end_hour": 22, "multiplier": 2.3 },
  "metrics": {
    "average_sleep": 7.8,
    "most_productive_location": "Home Desk",
    "best_workflow": ["DSA", "Coding", "Documentation"]
  },
  "success_rate": 0.83,
  "blueprint": [
    { "step": 1, "activity": "DSA", "duration_minutes": 20 },
    { "step": 2, "activity": "Coding", "duration_minutes": 90 },
    { "step": 3, "activity": "Break", "duration_minutes": 15 },
    { "step": 4, "activity": "Project", "duration_minutes": 60 }
  ]
}
```

---

### GET /insights
All insights for authenticated user.

**Query params**: `?type=peak_window&limit=10`

**Response** (200):
```json
[
  {
    "id": "uuid",
    "type": "peak_window",
    "title": "Your Peak Performance Window",
    "description": "You are 2.3x more productive between 7 PM and 10 PM",
    "metric_value": 2.3,
    "data_points_count": 47,
    "confidence_score": 0.87,
    "recommended_action": "Schedule deep work during this window",
    "generated_for_week": "2024-01-14"
  }
]
```

---

### GET /cohorts
List available cohorts.

**Response** (200): Array of cohort objects with member_count.

### POST /cohorts/:id/join
Join a cohort (requires auth).

### GET /cohorts/:id/comparison
Compare user metrics against cohort.

**Response** (200):
```json
{
  "cohort_name": "CSE 2024 @ St Joseph's",
  "your_metrics": { "productivity": 2.3, "focus_quality": 0.92 },
  "cohort_metrics": { "productivity": 2.1, "focus_quality": 0.78 },
  "comparison": {
    "productivity": { "yours": 2.3, "cohort": 2.1, "advantage": "+9%" },
    "focus_quality": { "yours": 0.92, "cohort": 0.78, "advantage": "+18%" }
  }
}
```

---

## Institution Endpoints

### GET /institutions/:id/dashboard
Placement dashboard (requires placement_officer role).

**Response** (200):
```json
{
  "institution": "St. Joseph's Engineering College",
  "total_students": 247,
  "tracked_students": 187,
  "placement_ready": { "count": 64, "percentage": 27, "students": [...] },
  "development_path": { "count": 98, "percentage": 42 },
  "early_stage": { "count": 25, "percentage": 11 },
  "skill_gaps": [
    { "skill": "DevOps", "demand": 8, "student_count": 8, "gap": 34, "recommendation": "Add DevOps course" }
  ]
}
```

### POST /institutions/:id/students/import
CSV upload for student import.

**Request**: multipart/form-data with CSV file.

**Response** (200):
```json
{ "imported": 245, "skipped": 2, "errors": ["row 15: invalid email"] }
```

### POST /institutions/:id/auto-match
Auto-match students to a company.

**Request**:
```json
{ "company_id": "uuid" }
```

**Response** (200):
```json
{ "matched_students": 12, "profiles_sent": true }
```

---

## Company Endpoints

### POST /recruiter/search
Search candidates (requires recruiter role).

**Request**:
```json
{
  "skills": ["Machine Learning", "Python"],
  "min_skill_proof_score": 80,
  "batch_years": [2024, 2023],
  "locations": ["Bangalore", "Hyderabad"]
}
```

**Response** (200):
```json
{
  "candidates_found": 127,
  "candidates": [
    {
      "id": "uuid",
      "name": "Sharon Dave",
      "skill_proof_score": 95,
      "specialization": { "ML": 87, "Python": 89 },
      "projects_completed": 42,
      "focus_quality": 0.92,
      "peak_window": { "start": 19, "end": 22 },
      "college": "St. Joseph's",
      "batch_year": 2024,
      "match_score": 94,
      "recommendation": "Excellent fit. Schedule ASAP."
    }
  ]
}
```

### POST /recruiter/search/:id/schedule-interview
Schedule interview with candidate.

**Request**:
```json
{
  "candidate_id": "uuid",
  "scheduled_at": "2024-01-16T21:00:00Z",
  "format": "in_person",
  "location": "Bangalore"
}
```

### PUT /job-matches/:id/status
Update hiring pipeline status.

**Request**:
```json
{
  "status": "hired",
  "role": "ML Engineer",
  "salary": "₹25 lakhs/year"
}
```

### GET /recruiter/analytics
Hiring analytics for company.

**Response** (200):
```json
{
  "positions_filled": 6,
  "total_positions": 8,
  "candidates_searched": 127,
  "candidates_reached": 25,
  "interviews_scheduled": 10,
  "hires": 6,
  "retention_rate_3mo": 1.0,
  "avg_skill_proof_of_hires": 92,
  "time_to_hire_days": 14,
  "roi": "40:1"
}
```
