# Database Backup & Recovery

## Automatic Backups (Supabase)

Supabase creates daily backups automatically.
- **Free tier:** 7-day point-in-time restore
- **Paid tier:** 30-day point-in-time restore

### Restore from Supabase Backup
1. Supabase Dashboard → Project Settings → Backups
2. Click "Restore" on desired date
3. Confirm (overwrites current data)
4. Wait ~10 minutes for restore

## Manual Backups

```bash
# Dump database
pg_dump postgresql://postgres:PASSWORD@db.uxlzoooxhaytosrlfszy.supabase.co:5432/postgres \
  --format=custom \
  --file=backup_$(date +%Y%m%d).dump

# Restore from dump
pg_restore --clean --if-exists --no-owner \
  postgresql://postgres:PASSWORD@db.uxlzoooxhaytosrlfszy.supabase.co:5432/postgres \
  backup_20260527.dump
```

## Disaster Recovery

1. **Stop writes** — take backend offline to prevent further data loss
2. **Assess** — check Supabase logs for what happened
3. **Restore** — use Supabase dashboard to pick last good backup
4. **Verify** — run `SELECT COUNT(*) FROM users;` to confirm data
5. **Restart** — bring backend back online
6. **Document** — log the incident and update this runbook

## Backup Schedule

| Frequency | Method | Retention |
|---|---|---|
| Daily | Supabase automatic | 7 days (free) |
| Weekly | Manual pg_dump | 4 weeks |
| Monthly | Archive | 12 months |

## Monthly Backup Test

First Sunday of each month:
1. Create test Supabase project
2. Restore from latest backup
3. Run: `SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM topics;`
4. Verify counts match production
5. Delete test project
