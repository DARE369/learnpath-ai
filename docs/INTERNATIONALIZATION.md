# Internationalization (i18n) - Packet 6.6

## Overview

LearnPath supports multiple languages: English, Yorùbá, and Français using next-i18next.

**Supported locales:**
- `en` - English (default)
- `yo` - Yorùbá
- `fr` - Français

---

## Setup

### 1. Configuration

File: `frontend/next-i18next.config.js`

```javascript
module.exports = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "yo", "fr"],
    localeDetection: true,
  },
  ns: ["common", "dashboard", "learning", "quiz", "auth"],
  defaultNS: "common",
  localePath: path.resolve("./public/locales"),
};
```

### 2. Translation Files Structure

```
frontend/public/locales/
├── en/
│   ├── common.json
│   ├── dashboard.json
│   ├── learning.json
│   └── quiz.json
├── yo/
│   ├── common.json
│   ├── dashboard.json
│   └── ...
└── fr/
    ├── common.json
    ├── dashboard.json
    └── ...
```

### 3. Install Dependencies

```bash
npm install next-i18next i18next
```

---

## Usage

### Using Translations in Components

```typescript
import { useTranslation } from "next-i18next";

export function Dashboard() {
  const { t } = useTranslation("dashboard");

  return (
    <div>
      <h1>{t("title")}</h1>
      <p>{t("welcome", { name: "John" })}</p>
    </div>
  );
}
```

### Using in Pages

```typescript
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common", "dashboard"])),
    },
  };
}
```

### URL Structure

Language is part of the URL:
- `/en/dashboard` - English
- `/yo/dashboard` - Yorùbá
- `/fr/dashboard` - Français

Next.js automatically handles routing based on locale.

---

## Language Switcher

Component: `frontend/components/i18n/LanguageSwitcher.tsx`

```typescript
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

export function Navbar() {
  return (
    <nav>
      <div>LearnPath</div>
      <LanguageSwitcher /> {/* Switches language on click */}
    </nav>
  );
}
```

**Features:**
- Detects browser language preference
- Stores preference in localStorage
- Smooth language switching without page reload
- Accessibility features (ARIA labels, keyboard navigation)

---

## Adding Translations

### 1. Create Translation File

File: `frontend/public/locales/en/myfeature.json`

```json
{
  "title": "My Feature",
  "description": "This is my feature",
  "button": "Click me",
  "greeting": "Hello {{name}}!"
}
```

### 2. Add to Configuration

Update `next-i18next.config.js`:

```javascript
ns: ["common", "myfeature"] // Add here
```

### 3. Use in Component

```typescript
const { t } = useTranslation("myfeature");

return <h1>{t("title")}</h1>;
```

---

## Translation Keys

### Common Keys (common.json)

```json
{
  "appName": "LearnPath AI",
  "loading": "Loading...",
  "error": "Error",
  "cancel": "Cancel",
  "save": "Save"
}
```

### Dashboard Keys (dashboard.json)

```json
{
  "title": "Dashboard",
  "stats": "Your Statistics",
  "paths": "Learning Paths",
  "progress": "Your Progress"
}
```

### Learning Keys (learning.json)

```json
{
  "title": "Learning Paths",
  "watchVideo": "Watch Video",
  "takeQuiz": "Take Quiz",
  "viewNotes": "View Notes"
}
```

---

## Interpolation

Replace variables in translations:

```json
{
  "greeting": "Hello {{name}}, you scored {{score}}%"
}
```

```typescript
t("greeting", { name: "John", score: 92 })
// Output: "Hello John, you scored 92%"
```

---

## Pluralization

Define singular and plural forms:

```json
{
  "item_one": "You have one item",
  "item_other": "You have {{count}} items"
}
```

```typescript
t("item", { count: 5 })
// Output: "You have 5 items"
```

---

## Backend Translations (Optional)

For API responses, store translations on backend:

```python
# backend/locales.py
TRANSLATIONS = {
    "en": {
        "quiz.submitted": "Quiz submitted successfully",
        "error.invalid_email": "Invalid email address"
    },
    "fr": {
        "quiz.submitted": "Quiz soumis avec succès",
        "error.invalid_email": "Adresse e-mail invalide"
    }
}

# In route
def submit_quiz(lang: str):
    message = TRANSLATIONS.get(lang, TRANSLATIONS["en"]).get("quiz.submitted")
    return {"message": message}
```

---

## Detecting Language

Language detection order (in `next-i18next.config.js`):

1. **URL path** - `/en/page`, `/fr/page`
2. **localStorage** - User's previous choice
3. **Browser navigator** - Browser language setting

---

## Best Practices

### 1. Translation Keys

- Use dot notation for nested keys: `dashboard.title`, `quiz.questions.instruction`
- Use camelCase: `submitButton`, not `submit_button`
- Be descriptive: `validateEmailError`, not `error1`

### 2. Organizing Translations

- One file per feature/page
- Group related translations
- Keep files focused and small

### 3. Handling Missing Translations

If a translation is missing, i18next returns the key:

```typescript
t("missing.key") // Returns "missing.key"
```

Enable warnings in development:

```javascript
import { ReactI18NextModule } from "react-i18next";

i18n.use(ReactI18NextModule).init({
  debug: process.env.NODE_ENV === "development"
});
```

### 4. Testing Translations

Test each language:

```bash
npm run dev
# Navigate to /en/page, /yo/page, /fr/page
```

---

## Adding a New Language

### 1. Update Configuration

```javascript
// next-i18next.config.js
locales: ["en", "yo", "fr", "es"] // Add "es"
```

### 2. Create Translation Files

```
frontend/public/locales/es/
├── common.json
├── dashboard.json
├── learning.json
├── quiz.json
└── ...
```

### 3. Update Language Switcher

The LanguageSwitcher component automatically picks up new languages from the config.

---

## Translation Progress Tracker

| Locale | Common | Dashboard | Learning | Quiz | Auth | Status |
|--------|--------|-----------|----------|------|------|--------|
| en     | ✅     | ✅        | ✅       | ✅   | ✅   | 100%   |
| yo     | ✅     | 🚧        | 🚧       | 🚧   | 🚧   | 20%    |
| fr     | ✅     | 🚧        | 🚧       | 🚧   | 🚧   | 20%    |

---

## Performance

### Bundle Size

i18next adds ~50KB to bundle (gzipped). Load translations on-demand per page.

### Caching

Translations are cached in localStorage for offline access:

```typescript
// Automatic with next-i18next
localStorage.setItem("i18nextLng", "fr");
```

---

## Troubleshooting

### Translations Not Loading

Check:
1. File exists at `public/locales/{locale}/{namespace}.json`
2. Namespace listed in `next-i18next.config.js`
3. Key exists in JSON file (case-sensitive)

### Language Not Switching

1. Clear localStorage: `localStorage.clear()`
2. Clear Next.js cache: `rm -rf .next`
3. Check browser console for i18next errors

### Special Characters Not Displaying

Ensure JSON files are UTF-8 encoded:

```bash
file -i public/locales/yo/common.json
# Should show: UTF-8
```

---

## Resources

- [next-i18next Documentation](https://next-i18next.com/)
- [i18next Documentation](https://www.i18next.com/)
- [Language Codes](https://www.iso.org/standard/39534.html)

---

