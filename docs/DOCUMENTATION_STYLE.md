# Documentation Style Guide

## Principles
1. **Clarity:** Clear > clever. Write for beginners.
2. **Completeness:** Include examples and edge cases.
3. **Consistency:** Follow this guide for all documentation.
4. **Maintainability:** Documentation stays with code (same PR).

## Formatting

### Headings
```markdown
# H1: Page title (one per page)
## H2: Major section
### H3: Subsection
#### H4: Rarely used
```

### Code Blocks
````markdown
```python
# Python code
def hello():
    return "world"
```

```bash
# Bash commands
$ pip install fastapi
```

```json
{"key": "value"}
```
````

### Lists
```markdown
Unordered:
- Item 1
- Item 2
- Item 3

Ordered:
1. First
2. Second
3. Third
```

### Tables
```markdown
| Column 1 | Column 2 |
| --- | --- |
| Value 1 | Value 2 |
```

## Writing Style

### Tone
- Professional but approachable
- Active voice: "The API returns..." not "The return of..."
- Second person: "You can..." not "We can..."

### Examples
- Always include realistic examples
- Show both input and output
- Explain what the example does

### Warnings and Tips
```markdown
⚠️ **Warning:** This is important

💡 **Tip:** This is helpful

✅ **Good:** This is recommended

❌ **Bad:** Avoid this
```

## Templates

### Endpoint Documentation
```markdown
### POST /api/endpoint

Description of what this endpoint does.

**Request:**
(example)

**Response:** 200 OK
(example)

**Errors:**
- 400: Invalid input
- 401: Unauthorized
```

### Feature Documentation
```markdown
# Feature Name

## Overview
What the feature does in 1-2 sentences.

## Use Cases
- When to use this
- Real-world examples

## How It Works
Step-by-step explanation.

## Examples
Code examples showing usage.

## Troubleshooting
Common issues and solutions.
```

## Maintenance

- Update documentation when code changes
- Include documentation in same PR as code
- Review docs for accuracy in code review
- Archive old docs (don't delete)

## Auto-generation

Some documentation is auto-generated:
- API specs from OpenAPI (FastAPI `/openapi.json`)
- Schema from database migrations (SQL)
- Generate with: `bash scripts/generate_docs.sh`
