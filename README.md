# LearnPath AI

**"Learn anything. Faster."**

AI-powered personalized learning platform that curates YouTube content, generates structured learning paths, and uses active recall for deeper understanding.

> 📖 **New here? Read [OVERVIEW.md](OVERVIEW.md)** — a complete, diagram-rich walkthrough
> of the entire system (architecture, every workflow, the algorithms behind each part,
> and a prioritized list of what to consider next). This README below is setup-focused.

## Project Overview

LearnPath AI helps students:
1. **Find the best YouTube videos** on any topic (using EQS - Educational Quality Score)
2. **Understand the concept structure** (prerequisite mapping, concept graphs)
3. **Learn effectively** (active recall prompts, spaced repetition)
4. **Prove mastery** (quizzes, certificates)

## Tech Stack

### Frontend
- **Framework:** Next.js 14+ (React)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

### Backend
- **Framework:** FastAPI (Python)
- **Database:** Supabase (PostgreSQL)
- **Authentication:** JWT + OAuth2
- **Background Jobs:** AWS Lambda (future)

### AI/ML
- **Language Model:** Claude (Anthropic) - EQS, summaries, concept graphs
- **Multi-model:** Gemini (Google) - fallback, flashcards
- **Transcription:** YouTube Transcript API + Whisper

### Infrastructure
- **Database:** Supabase (PostgreSQL + Auth)
- **Deployment:** Vercel (frontend) + AWS Lambda (backend)
- **Secrets:** GitHub Secrets + Environment Variables

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git
- GitHub account
- Supabase account

### Quick Setup (Local Development)

```bash
# 1. Clone repo
git clone https://github.com/yourusername/learnpath-ai.git
cd learnpath-ai

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Frontend setup
cd ../frontend
npm install

# 4. Environment setup
cp .env.example .env.local
# Edit .env.local with your API keys

# 5. Start development servers
# Terminal 1: Backend
cd backend
uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

## Project Structure

```
learnpath-ai/
├── frontend/          # Next.js app
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   ├── styles/
│   └── public/
├── backend/           # FastAPI app
│   ├── routers/
│   ├── services/
│   ├── models/
│   ├── schemas/
│   └── dependencies/
├── docs/              # Documentation
├── tests/             # Test suites
├── scripts/           # Utility scripts
└── .github/workflows/ # CI/CD
```

See `docs/ARCHITECTURE.md` for detailed system design.

## Build Stages

- **Stage 0:** Foundation (setup, infrastructure)
- **Stage 1:** Core Pipeline (YouTube search → EQS → summaries → paths)
- **Stage 2:** User Layer (auth, learning sessions, progress)
- **Stage 3:** Intelligence (branching, confidence, auto-remediation)
- **Stage 4:** Monetization (premium, payments, offline)
- **Stage 5:** B2B (institution dashboards, DPAs)
- **Stage 6:** Polish (performance, security, UX)
- **Stage 7:** Go-Live (deployment, launch)

## Documentation

- `docs/ARCHITECTURE.md` - System design
- `docs/GETTING_STARTED.md` - Development setup
- `docs/CONTRIBUTING.md` - Coding standards

## License

Proprietary - LearnPath AI

---

**Status:** In Development (Stage 0)

Last updated: 2026-05-27
