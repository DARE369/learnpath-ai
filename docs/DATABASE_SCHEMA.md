# Database Schema

## Overview

LearnPath AI uses PostgreSQL (via Supabase) with 8 core tables.

```
users ──→ user_progress ←── topics ──→ learning_paths
  └──→ path_sessions ←──── videos ──→ video_scores
                                         concept_graphs ←── topics
```

## Tables

### 1. users
Stores user accounts and preferences.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, auto-generated |
| email | TEXT | Unique, login identifier |
| password_hash | TEXT | bcrypt hash |
| full_name | TEXT | Display name |
| country | TEXT | User location |
| age | INTEGER | COPPA compliance |
| email_verified | BOOLEAN | Confirmation status |
| tier | TEXT | free / premium / institution |
| created_at | TIMESTAMP | Account creation |
| last_login | TIMESTAMP | Last login time |
| preferences | JSONB | User settings |

### 2. topics
Learning topics (subjects, courses).

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | TEXT | Unique topic name |
| keywords | TEXT[] | Search keywords (GIN indexed) |
| category | TEXT | Biology, Chemistry, etc. |
| difficulty | TEXT | beginner / intermediate / advanced |
| curriculum_name | TEXT | WAEC Biology, JAMB Math, etc. |
| video_count | INTEGER | # of videos indexed |
| popularity_score | FLOAT | Usage-based ranking |

### 3. videos
YouTube videos indexed for learning.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| youtube_id | TEXT | YouTube video ID (unique) |
| title | TEXT | Video title |
| channel_name | TEXT | Creator's channel |
| duration_seconds | INTEGER | Video length |
| transcript | TEXT | Cached transcript |
| view_count | INTEGER | YouTube views |

### 4. video_scores
EQS (Educational Quality Score) per video per topic.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| video_id | UUID | FK → videos |
| topic_id | UUID | FK → topics |
| eqs_algorithm_version | TEXT | "v1", "v2" (versioned) |
| score | INTEGER | 0–100 (≥65 = include) |
| confidence | INTEGER | 0–100 |
| pedagogical_score | INTEGER | Structure/clarity (0–25) |
| credibility_score | INTEGER | Credentials (0–20) |
| length_score | INTEGER | Optimal length (0–10) |
| engagement_score | INTEGER | Visuals/pacing (0–30) |
| is_valid | BOOLEAN | FALSE = blacklisted |

### 5. user_progress
Learning progress per user per topic.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| topic_id | UUID | FK → topics |
| videos_watched | INTEGER | Completed count |
| completion_percentage | INTEGER | 0–100% |
| quiz_score | FLOAT | Average quiz % |
| status | TEXT | not_started / in_progress / completed / mastered |
| completed_at | TIMESTAMP | When finished |

### 6. path_sessions
Individual video-watching sessions.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| topic_id | UUID | FK → topics |
| video_id | UUID | FK → videos |
| session_number | INTEGER | Position in path (1st, 2nd…) |
| watch_percentage | INTEGER | 0–100% watched |
| post_video_question | TEXT | Active recall question |
| post_video_answer | TEXT | User's answer |
| answer_score | INTEGER | 0–100 evaluation |

### 7. concept_graphs
Prerequisite map of concepts within a topic.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| topic_id | UUID | FK → topics |
| concepts | TEXT[] | ["Atoms", "Molecules", "Reactions"] |
| prerequisites | JSONB | {"Molecules": ["Atoms"]} |
| concept_order | TEXT[] | Topological sort (learning order) |
| algorithm_version | TEXT | Versioned |

### 8. learning_paths
Complete ordered video sequence for a topic.

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| topic_id | UUID | FK → topics |
| video_sequence | UUID[] | Ordered array of video IDs |
| algorithm_version | TEXT | Versioned |
| average_eqs_score | FLOAT | Path quality metric |
| path_confidence | FLOAT | Confidence in ordering |
| is_active | BOOLEAN | Current active path |

## Key Relationships

```
users (1) ──→ (many) user_progress
users (1) ──→ (many) path_sessions
topics (1) ──→ (many) learning_paths
topics (1) ──→ (many) user_progress
topics (1) ──→ (1)    concept_graphs
videos (1) ──→ (many) video_scores
```

## Useful Queries

### Get learning path with video scores
```sql
SELECT v.title, v.duration_seconds, vs.score
FROM learning_paths lp
JOIN videos v ON v.id = ANY(lp.video_sequence)
LEFT JOIN video_scores vs ON vs.video_id = v.id
WHERE lp.topic_id = $1 AND lp.is_active = true
ORDER BY array_position(lp.video_sequence, v.id);
```

### Get user progress summary
```sql
SELECT up.*, t.name AS topic_name
FROM user_progress up
JOIN topics t ON t.id = up.topic_id
WHERE up.user_id = $1
ORDER BY up.last_activity_at DESC;
```

### Get high-quality videos for topic
```sql
SELECT v.*, vs.score
FROM videos v
JOIN video_scores vs ON vs.video_id = v.id
WHERE vs.topic_id = $1
  AND vs.score >= 65
  AND vs.is_valid = true
ORDER BY vs.score DESC
LIMIT 10;
```

## Security (RLS)

| Table | Public Read | User Write | Notes |
|---|---|---|---|
| users | No | Own row only | Login/profile |
| topics | Yes | Backend only | Public content |
| videos | Yes | Backend only | Public content |
| video_scores | Yes | Backend only | EQS engine writes |
| user_progress | Own only | Own only | Private data |
| path_sessions | Own only | Own only | Private data |
| concept_graphs | Yes | Backend only | Algorithm output |
| learning_paths | Yes | Backend only | Algorithm output |


## Payments - Packet 4.1

### subscriptions
One row per subscription period; at most one `active` row per user (enforced in
`SubscriptionService`, not the DB).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK users.id, indexed |
| plan_type | String | free / pro / premium |
| pending_plan_type | String | queued downgrade target |
| billing_cycle | String | monthly / yearly |
| start_date | DateTime | |
| renewal_date | DateTime | indexed |
| price_paid | Float | NGN |
| currency | String | default NGN |
| status | String | active / cancelled / expired, indexed |
| auto_renew | Boolean | |
| cancelled_at | DateTime | |

### transactions
One row per Flutterwave payment attempt. `reference` (our `tx_ref`) is the
idempotency key.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK users.id, indexed |
| subscription_id | UUID | FK subscriptions.id, nullable |
| plan_type | String | |
| amount | Float | NGN |
| currency | String | |
| payment_method | String | card / bank_transfer / ussd / mobile_money |
| reference | String | unique, indexed (our tx_ref) |
| flutterwave_id | String | Flutterwave's tx id, indexed |
| status | String | pending / successful / failed / refunded, indexed |

### billing_history
Immutable line items written on each successful charge / renewal, with a usage
snapshot at billing time.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK users.id, indexed |
| transaction_id | UUID | FK transactions.id, nullable |
| billing_date | DateTime | indexed |
| amount | Float | NGN |
| plan_used | String | |
| description | String | |
| videos_watched | Integer | snapshot |
| hours_learned | Float | snapshot |
