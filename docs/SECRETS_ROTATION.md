# Secrets Rotation Schedule

## Rotation Schedule

| Secret | Frequency | Last Rotated | Next Rotation |
|---|---|---|---|
| `CLAUDE_API_KEY` | 90 days | — | — |
| `YOUTUBE_API_KEY` | 90 days | — | — |
| `JWT_SECRET` | 90 days | — | — |
| `DATABASE_URL` | On password change | — | — |

## How to Rotate a Secret

```bash
# 1. Generate new secret (for JWT_SECRET)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 2. Update in GitHub Secrets
#    Repo → Settings → Secrets → edit → paste new value

# 3. Update local .env
#    Edit backend/.env with new value

# 4. Test staging deployment before updating production
```

## Emergency Rotation (Secret Exposed)

1. Rotate immediately in GitHub Secrets
2. Update backend/.env locally
3. Audit recent logs for unauthorized use
4. Document the incident date and scope
