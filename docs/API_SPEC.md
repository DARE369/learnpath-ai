# LearnPath AI API Specification

## Base URL
- Development: `http://localhost:8000`
- Production: `https://api.learnpath.ai` (future)

## Authentication
- Method: Bearer token (JWT)
- Location: Authorization header
- Format: `Authorization: Bearer {token}`

## Rate Limiting
- General endpoints: 100 requests/minute
- Auth endpoints: 5 requests/minute
- Response header: `X-RateLimit-Remaining`

---

## Health Check

### GET /health
Health check endpoint for monitoring.

**Response:** 200 OK
```json
{
  "status": "ok",
  "timestamp": "2026-05-27T10:30:45.123456",
  "app": "LearnPath AI",
  "version": "0.1.0"
}
```

---

## Authentication Endpoints (Coming Stage 2)

### POST /api/auth/signup
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe"
}
```

**Response:** 201 Created
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "tier": "free",
  "created_at": "2026-05-27T10:30:45"
}
```

### POST /api/auth/login
Login an existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** 200 OK
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

---

## Search Endpoints (Coming Stage 1)

### GET /api/search?topic={topic}
Search for a learning path on a given topic.

**Query Parameters:**
- `topic` (string, required): Topic to search (e.g., "photosynthesis")

**Response:** 200 OK
```json
{
  "topic": "photosynthesis",
  "videos": [
    {
      "id": "uuid",
      "youtube_id": "dQw4w9WgXcQ",
      "title": "Photosynthesis Explained",
      "duration_seconds": 480,
      "score": 92,
      "summary": "Photosynthesis is the process..."
    }
  ],
  "concepts": ["Chlorophyll", "Photosynthesis", "Energy"],
  "path_order": ["Chlorophyll", "Light Reactions", "Photosynthesis"]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad request",
  "detail": "Invalid topic parameter"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "detail": "Token invalid or expired"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "detail": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "detail": "An unexpected error occurred"
}
```

---

## Complete API Docs

Swagger UI: `GET /docs`  
ReDoc: `GET /redoc`  
Full OpenAPI specification: `GET /openapi.json`
