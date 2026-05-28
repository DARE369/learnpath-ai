# Authentication — LearnPath AI

Packet 2.1 — JWT-based auth with HTTP-only refresh token cookie.

---

## Overview

LearnPath AI uses a two-token authentication system:

| Token | Storage | Expiry | Purpose |
|---|---|---|---|
| **Access token** | Client memory / localStorage | 15 minutes | Authorise API requests |
| **Refresh token** | HTTP-only cookie | 7 days | Obtain new access tokens |

The access token is a signed JWT. The refresh token is also a JWT but stored in an HTTP-only, Secure, SameSite=Lax cookie to prevent XSS theft.

---

## Token Flow

```
Signup / Login
  └─ POST /api/auth/signup or /api/auth/login
       └─ Returns: { access_token, refresh_token, user }
            └─ refresh_token is also set as HTTP-only cookie

API Request
  └─ Authorization: Bearer {access_token}

Access token expires (15 min)
  └─ POST /api/auth/refresh (cookie sent automatically)
       └─ Returns: { access_token }  (new 15-min token)

Logout
  └─ POST /api/auth/logout
       └─ Clears refresh_token cookie
```

---

## Endpoints

### POST /api/auth/signup
Create a new account and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Secure@123",
  "full_name": "Alex Johnson"
}
```

**Response 201:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Alex Johnson",
    "tier": "free",
    "email_verified": false,
    "created_at": "...",
    "updated_at": "..."
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:**
- `400` — Email already registered, or password fails requirements
- `422` — Missing/invalid fields

---

### POST /api/auth/login
Authenticate and receive tokens.

**Request:**
```json
{ "email": "user@example.com", "password": "Secure@123" }
```

**Response 200:**
```json
{
  "user": { ... },
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```
Refresh token set in `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax`

**Errors:**
- `401` — Invalid email or password
- `403` — Account deactivated

---

### POST /api/auth/refresh
Get a new access token using the refresh token cookie.

**No body required** — cookie is sent automatically by the browser.

**Response 200:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

**Errors:**
- `401` — No cookie, or cookie token is invalid/expired

---

### POST /api/auth/logout
Clear the refresh token cookie.

**Response 200:**
```json
{ "message": "Logged out successfully" }
```

---

### GET /api/auth/me
Return the current authenticated user.

**Headers:** `Authorization: Bearer {access_token}`

**Response 200:** `UserResponse` (see schemas.py)

**Errors:**
- `401` — No token, or token invalid/expired
- `403` — Account deactivated

---

## Password Requirements

Passwords must contain all of:
- At least 8 characters
- At least one uppercase letter (A–Z)
- At least one lowercase letter (a–z)
- At least one number (0–9)
- At least one special character (`!@#$%^&*`, etc.)

The frontend enforces these rules live with a strength meter and checklist before form submission.

---

## Using the Access Token

Include it in the `Authorization` header for all authenticated routes:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `get_current_user` dependency in `routers/auth.py` handles extraction and validation.

---

## Implementation Details

| Concern | Choice | Details |
|---|---|---|
| Password hashing | bcrypt via passlib | `CryptContext(schemes=["bcrypt"])` |
| JWT library | python-jose | `from jose import jwt, JWTError` |
| JWT algorithm | HS256 | `settings.JWT_ALGORITHM` |
| JWT secret | env `JWT_SECRET` | min 32 chars, validated at startup |
| Access expiry | 15 minutes | `ACCESS_TOKEN_EXPIRE_MINUTES = 15` |
| Refresh expiry | 7 days | `REFRESH_TOKEN_EXPIRE_DAYS = 7` |
| Token type claim | `"access"` / `"refresh"` | prevents cross-use of tokens |
| JTI claim | UUID per token | enables future revocation |

---

## Frontend Auth Pages

| Route | Component | Purpose |
|---|---|---|
| `/auth/login` | `pages/auth/login.tsx` | Sign-in page |
| `/auth/signup` | `pages/auth/signup.tsx` | Registration page |

Both pages use a split-panel layout: branding left, form right on desktop; centered single-column on mobile.

Components:
- `components/Auth/LoginForm.tsx` — email/password form, error states, loading
- `components/Auth/SignupForm.tsx` — + full name, confirm password, strength meter, requirements checklist

---

## Security Notes

- Refresh tokens are stored in HTTP-only cookies (not accessible to JavaScript)
- Access tokens are short-lived (15 min) to limit exposure if leaked
- The `type` claim (`"access"` vs `"refresh"`) prevents refresh tokens from being used as access tokens
- Each token has a unique `jti` (JWT ID) for future revocation support
- Passwords are hashed with bcrypt (cost factor ≥ 12 by default)
- Email is normalised to lowercase before storage

---

## Stage 2 Roadmap

- [ ] Email verification flow (send link, verify endpoint)
- [ ] Password reset (forgot-password flow)
- [ ] Refresh token rotation (issue new refresh on each use)
- [ ] Revocation list (Redis-backed JTI blacklist)
- [ ] OAuth providers (Google, GitHub) via Supabase Auth
