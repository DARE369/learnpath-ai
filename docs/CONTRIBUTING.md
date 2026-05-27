# Contributing Guidelines

## Code Standards

### Python (Backend)
- Format: Black (`black .`)
- Linting: Flake8 (`flake8 .`)
- Type checking: MyPy (`mypy .`)
- Style: PEP 8

### JavaScript/TypeScript (Frontend)
- Format: Prettier
- Linting: ESLint
- Style: Airbnb style guide

### Commit Messages

Format: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(auth): add login endpoint`
- `fix(eqs): correct scoring formula`
- `docs(api): update endpoint spec`

## Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes with tests
3. Run linting and tests
4. Commit with clear messages
5. Push and create PR against `develop`
6. Wait for CI/CD to pass
7. Code review approval
8. Merge

## Testing Requirements

- All new code must include tests
- Backend: pytest coverage > 80%
- Frontend: Jest coverage > 70%
- Run before committing: `pytest` (backend) and `npm test` (frontend)
