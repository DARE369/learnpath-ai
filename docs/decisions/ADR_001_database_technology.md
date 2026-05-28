# ADR-001: Database Technology Choice

## Status
✅ Accepted

## Context
We need to choose a database technology for LearnPath AI MVP. Requirements:
- PostgreSQL support (for complex queries)
- Easy deployment (minimal DevOps)
- Built-in authentication (Supabase Auth)
- Real-time capabilities (future)
- Scalability to millions of users
- Cost-effective for MVP

## Options Considered

### Option 1: PostgreSQL (self-managed)
- **Pros:** Maximum control, powerful, mature
- **Cons:** DevOps overhead, backups, security, updates
- **Cost:** $20-50/month for AWS RDS

### Option 2: MongoDB (Atlas)
- **Pros:** Schema-less, good for rapid prototyping
- **Cons:** Less suitable for relational data (users → progress → topics), harder to query complex graphs
- **Cost:** $10-50/month

### Option 3: Firebase (Google)
- **Pros:** Serverless, real-time, easy auth
- **Cons:** Lock-in with Google, limited query flexibility, COPPA compliance harder
- **Cost:** $0-25/month (usage-based)

### Option 4: Supabase (PostgreSQL hosted)
- **Pros:** PostgreSQL power + Supabase hosting, built-in auth, open source, dashboard UI
- **Cons:** Younger company, relies on AWS underneath
- **Cost:** Free tier, $25+/month for production

## Decision
**Choose Supabase (PostgreSQL hosted)**

## Rationale

1. **Data Model:** LearnPath AI has complex relational data:
   - Users → progress → topics → concepts → videos
   - Supabase/PostgreSQL handles this better than MongoDB

2. **Cost:** Free tier is perfect for MVP, scales cleanly

3. **Developer Experience:** Supabase dashboard makes managing database easy (no SQL CLI needed)

4. **Built-in Auth:** Supabase Auth integrates with PostgreSQL, simplifying authentication

5. **Regional:** Supabase has Cape Town region option (Africa) for NDPA compliance

6. **Open Source:** Supabase uses PostgreSQL (portable, not locked in)

## Consequences

### Positive
- ✅ Structured data handled well
- ✅ Built-in RLS (Row Level Security) for user privacy
- ✅ Powerful SQL for analytics and reporting
- ✅ Easy to migrate later if needed (just export from PostgreSQL)

### Risks
- ⚠️ Supabase is a younger company
- ⚠️ Outages possible (mitigate with backups)

## Implementation Notes

- Use Supabase Africa region (Cape Town) when available
- Implement daily backups
- Use migrations for schema version control
- Test backup restoration monthly

## Alternatives for Future

- If performance becomes an issue: add Redis cache
- If scale demands: migrate to AWS RDS PostgreSQL (same database, different hosting)
