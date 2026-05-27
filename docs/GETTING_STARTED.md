# Getting Started - Local Development

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- Git
- VS Code (recommended)

## Backend Setup (FastAPI)

### 1. Create Python Virtual Environment

```bash
cd backend
python -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate

# Windows:
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Create .env File

```bash
cp ../.env.example .env
# Edit .env with your API keys
```

### 4. Run Backend Server

```bash
uvicorn main:app --reload
```

Server runs on: http://localhost:8000
API docs: http://localhost:8000/docs

### 5. Run Tests

```bash
pytest tests/ -v
```

## Frontend Setup (Next.js)

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Create Environment File

```bash
cp ../.env.example .env.local
# Edit .env.local with your API keys
```

### 3. Run Development Server

```bash
npm run dev
```

Frontend runs on: http://localhost:3000

### 4. Run Tests

```bash
npm test
```

## Database Setup (Supabase)

### 1. Create Supabase Account
- Go to supabase.com
- Sign in with GitHub
- Create new project
- Copy connection string to `.env` as `DATABASE_URL`

### 2. Apply Migrations

```bash
# Migrations are created in later stages
# Schema is applied via Supabase dashboard SQL editor
```

## Running Both Servers Simultaneously

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

- Backend API: http://localhost:8000
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## Development Workflow

1. Create branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test locally
4. Commit: `git commit -am "feat(scope): description"`
5. Push: `git push origin feature/my-feature`
6. Open Pull Request on GitHub

## Troubleshooting

**ModuleNotFoundError (Python)**
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt`

**Port 3000 already in use**
- Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`
- macOS/Linux: `lsof -ti:3000 | xargs kill -9`

**Database connection error**
- Check `DATABASE_URL` in `.env`
- Verify Supabase project is running
- Test: connect via Supabase dashboard SQL editor
