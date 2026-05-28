# Documentation Checklist for Pull Requests

Use this checklist when submitting a PR that includes new features or changes.

## Code Documentation
- [ ] Function/method docstrings added
- [ ] Complex logic commented
- [ ] Type hints included

## Feature Documentation
- [ ] Feature documented in relevant `docs/`
- [ ] Examples added (code samples)
- [ ] Edge cases documented
- [ ] Error cases documented

## API Documentation
- [ ] New endpoints documented in `docs/API_SPEC.md`
- [ ] Request/response examples included
- [ ] Error responses documented

## Database Documentation
- [ ] New tables documented in `docs/DATABASE_SCHEMA.md`
- [ ] Schema changes reflected in migration
- [ ] Indexes documented

## User-Facing Documentation
- [ ] `GETTING_STARTED.md` updated if setup changed
- [ ] `README.md` updated if scope changed
- [ ] `CONTRIBUTING.md` updated if process changed

## Architecture Documentation
- [ ] `ARCHITECTURE.md` updated if architecture changed
- [ ] Decision log updated (new ADR if major decision made)
- [ ] Diagrams updated

## Before Submitting
- [ ] Docs are accurate (matches implementation)
- [ ] Examples are up-to-date
- [ ] Internal links are not broken
- [ ] Style follows `DOCUMENTATION_STYLE.md`
- [ ] Spellcheck passed
