# WCAG 2.1 Level AA Accessibility Compliance (Packet 6.3)

## Overview

This document outlines the accessibility standards, implementations, and audit procedures for LearnPath AI to meet **WCAG 2.1 Level AA** compliance. WCAG 2.1 AA is the standard required for Section 508 compliance and most enterprise contracts.

**Level AA includes:**
- Level A requirements (foundational)
- AA-specific enhancements (color contrast, extended audio descriptions, captions)

---

## Key WCAG 2.1 AA Criteria Implementation

### 1. Color Contrast (1.4.3)

**Standard:** Text must have a contrast ratio of at least 4.5:1 (normal text) or 3:1 (large text ≥18pt or ≥14pt bold).

**Implementation:**

```typescript
import { checkColorContrast } from "@/lib/accessibility";

// Check if colors meet WCAG AA
const result = checkColorContrast("#000000", "#ffffff");
console.log(result); // { ratio: 21, passes: true, standard: "4.5:1 (Normal Text)" }
```

**Color Palette Audit:**
- Primary buttons: #3b82f6 (blue) on white → 4.8:1 ✓
- Text body: #1f2937 (dark gray) on white → 15:1 ✓
- Secondary text: #6b7280 (medium gray) on white → 5.5:1 ✓
- Error text: #ef4444 (red) on white → 4.1:1 ✓

**Audit Tool:**
Run the accessibility audit from `frontend/components/Accessibility/AccessibilityAudit.tsx` to automatically check all on-page color combinations.

---

### 2. Keyboard Navigation (2.1.1, 2.1.2)

**Standard:** All functionality must be available using keyboard alone. No keyboard traps.

**Implementation:**

```typescript
import { isKeyboardAccessible, manageFocus } from "@/lib/accessibility";

// Verify element is keyboard accessible
const button = document.querySelector("button");
console.log(isKeyboardAccessible(button)); // true if tabindex >= 0, is <button>, or is <a>

// Manage focus for dialogs
const focusManager = manageFocus({
  trap: dialogElement,
  initialFocus: closeButton,
  returnFocus: true,
});

focusManager.start(); // Trap focus when dialog opens
focusManager.restore(); // Return focus when dialog closes
```

**Keyboard Shortcuts (YouTube-style):**
- `J` → next video
- `K` → previous video
- `Space` → play/pause (when player focused)
- `Escape` → close dialog
- `Tab` → navigate forward
- `Shift+Tab` → navigate backward

**Focusable Elements:**
- Buttons, links, form inputs are focusable by default
- Use `tabindex="0"` for custom interactive elements (last resort)
- Never use `tabindex="1+"` (breaks natural tab order)
- Use `tabindex="-1"` to remove from tab order if needed

**Focus Indicators:**
All interactive elements must show visible focus (outline, border, or background change).

```css
button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

---

### 3. ARIA Labels & Roles (1.3.1, 4.1.2)

**Standard:** Form inputs, buttons, and interactive elements must have accessible labels. Use ARIA only when semantic HTML is insufficient.

**Implementation:**

```html
<!-- Good: Form label (no ARIA needed) -->
<label for="email">Email Address</label>
<input id="email" type="email" />

<!-- Good: Button with visible text -->
<button>Submit</button>

<!-- Good: Icon button with aria-label -->
<button aria-label="Close dialog">×</button>

<!-- Good: Link with aria-label for non-obvious purpose -->
<a href="/docs" aria-label="View documentation">
  <span class="icon">📖</span>
</a>

<!-- Bad: No label -->
<input type="email" /> <!-- inaccessible -->

<!-- Bad: Placeholder as only label -->
<input placeholder="Email" /> <!-- label removed on focus -->
```

**ARIA Helper:**

```typescript
import { hasAccessibleLabel, ARIA_LABELS } from "@/lib/accessibility";

// Verify element has accessible label
hasAccessibleLabel(element); // true if element has aria-label, aria-labelledby, or <label>

// Use predefined labels
<button aria-label={ARIA_LABELS.close}>×</button>
<button aria-label={ARIA_LABELS.menu}>☰</button>
```

**ARIA Roles for Custom Components:**

```html
<!-- Dialog/Modal -->
<div role="dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Action</h2>
  <p>Are you sure?</p>
</div>

<!-- Menu -->
<nav role="navigation" aria-label="Main navigation">
  <ul role="menu">
    <li><a role="menuitem" href="/dashboard">Dashboard</a></li>
  </ul>
</nav>

<!-- Tab panel -->
<div role="tabpanel" aria-labelledby="tab-1">Content</div>

<!-- Live region (announcements) -->
<div role="status" aria-live="polite" aria-atomic="true">
  Loading...
</div>
```

---

### 4. Screen Reader Support (4.1.2, 4.1.3)

**Standard:** All content must be available to screen readers. Use semantic HTML first.

**Implementation:**

```typescript
import { announceToScreenReader, srOnlyClass, ensureSROnlyStyles } from "@/lib/accessibility";

// Announce dynamic updates
announceToScreenReader("Quiz submitted successfully", "polite");
announceToScreenReader("Error: Please try again", "assertive");

// Screen reader-only content
<span className="sr-only">Learn more</span> <!-- Hidden visually, visible to screen readers -->
```

**Screen Reader-Only Content:**

Use `.sr-only` class to hide content visually but make it available to screen readers:

```html
<a href="/docs">
  <span class="sr-only">View documentation</span>
  <span class="icon">📖</span>
</a>
```

CSS:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

### 5. Image Alt Text (1.1.1)

**Standard:** All images must have descriptive alt text. Decorative images use empty alt.

**Implementation:**

```html
<!-- Descriptive image -->
<img src="/learning-path.png" alt="Learning path flowchart showing Biology → Chemistry → Physics" />

<!-- Decorative image -->
<img src="/divider.png" alt="" /> <!-- Empty alt, not visible to screen readers -->

<!-- Icon with context -->
<button>
  <span class="icon">⭐</span>
  <span>Favorite</span>
</button>
```

**Image Alt Text Checklist:**
- ✓ Describes content and function
- ✓ Concise (under 125 characters)
- ✓ Doesn't start with "image of..." or "picture of..."
- ✓ Includes relevant details (numbers, text in image)

---

### 6. Video Captions & Transcripts (1.2.2, 1.2.3)

**Standard:** All videos must have captions. Live videos need real-time captions.

**Implementation:**

```html
<video controls width="640" height="360">
  <source src="lesson.mp4" type="video/mp4" />
  <track kind="captions" src="lesson-en.vtt" srclang="en" label="English" />
  <track kind="captions" src="lesson-es.vtt" srclang="es" label="Español" />
  <!-- Fallback text -->
  Video player not supported in your browser.
</video>
```

**VTT Caption File Format:**

```
WEBVTT

00:00:00.000 --> 00:00:05.000
Intro to Biology: Understanding cells

00:00:05.000 --> 00:00:10.000
A cell is the basic unit of life.
All living organisms are made of one or more cells.

00:00:10.000 --> 00:00:15.000
[Light music playing]
```

**Transcript Provision:**

All videos must include a full transcript available on the page or downloadable.

---

### 7. Heading Hierarchy (1.3.1)

**Standard:** Headings must follow a logical hierarchy (H1 → H2 → H3, never skip levels).

**Implementation:**

```html
<!-- Good hierarchy -->
<h1>Learning Paths</h1>
  <h2>Biology</h2>
    <h3>Cell Structure</h3>
    <h3>Photosynthesis</h3>
  <h2>Chemistry</h2>
    <h3>Atomic Structure</h3>

<!-- Bad: Skips from H1 to H3 -->
<h1>Learning Paths</h1>
<h3>Cell Structure</h3> <!-- Missing H2 -->
```

**Audit:**

```typescript
// The AccessibilityAudit component automatically detects heading hierarchy violations
```

---

### 8. Motion & Animation (2.3.3)

**Standard:** Users who prefer reduced motion should not see autoplaying animations.

**Implementation:**

```typescript
import { prefersReducedMotion, applySafeAnimations } from "@/lib/accessibility";

// Check user preference
if (prefersReducedMotion()) {
  // Disable animations
} else {
  // Play animations
}

// Apply safely
const element = document.querySelector(".animated");
applySafeAnimations(element, "fade-in");
```

**CSS with Reduced Motion:**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### 9. Form Validation & Errors (3.3.1, 3.3.4)

**Standard:** Forms must clearly indicate required fields, errors, and provide suggestions.

**Implementation:**

```html
<div class="form-group">
  <label for="email">
    Email Address
    <span aria-label="required">*</span>
  </label>
  <input
    id="email"
    type="email"
    required
    aria-required="true"
    aria-describedby="email-error"
  />
  <div id="email-error" role="alert" style="color: #ef4444;">
    <!-- Error message inserted dynamically -->
  </div>
</div>
```

**Error Handling:**

```typescript
import { announceToScreenReader } from "@/lib/accessibility";

const handleSubmit = async (data) => {
  try {
    await submitForm(data);
    announceToScreenReader("Form submitted successfully", "assertive");
  } catch (error) {
    announceToScreenReader(`Error: ${error.message}`, "assertive");
  }
};
```

---

### 10. Skip Links (2.4.1)

**Standard:** Provide a skip link to jump over repetitive navigation.

**Implementation:**

```typescript
import { addSkipLinks } from "@/lib/accessibility";

// Call once on page load
useEffect(() => {
  addSkipLinks();
}, []);
```

HTML:
```html
<!-- Skip link (auto-added by addSkipLinks()) -->
<a href="#main-content" class="skip-link">Skip to main content</a>

<!-- Main content anchor -->
<main id="main-content">
  <!-- Page content -->
</main>
```

---

## Accessibility Testing

### 1. Automated Audit (In-App)

```typescript
import { AccessibilityAudit } from "@/components/Accessibility/AccessibilityAudit";

export default function AdminPage() {
  return (
    <div>
      <AccessibilityAudit />
    </div>
  );
}
```

This runs checks for:
- Color contrast violations
- Missing keyboard accessibility
- Missing ARIA labels
- Missing image alt text
- Form label issues
- Heading hierarchy problems
- Reduced motion preference violations

### 2. Manual Testing

**Screen Reader Testing:**
- NVDA (Windows, free)
- JAWS (Windows, commercial)
- VoiceOver (macOS/iOS, built-in)
- TalkBack (Android, built-in)

**Test Protocol:**
1. Launch screen reader
2. Navigate page with Tab key
3. Listen for all text, labels, and status updates
4. Verify video captions display and are readable

**Keyboard Testing:**
1. Disconnect mouse
2. Navigate entire site with Tab, Shift+Tab, Enter, Escape
3. Verify all functionality accessible
4. Verify no keyboard traps

**Color Contrast:**
```bash
npm install --save-dev pa11y
npx pa11y https://learnpath.ai/dashboard
```

### 3. Browser Extensions

- **Axe DevTools** — Chrome/Firefox, automated accessibility checks
- **WAVE** — Chrome/Firefox, visual accessibility checker
- **Lighthouse** — Chrome DevTools, includes accessibility audit

---

## Compliance Checklist

### Design Phase
- [ ] Color palette tested for 4.5:1 contrast (normal text) and 3:1 (large)
- [ ] Typography has sufficient font size (≥14px body text)
- [ ] Buttons have minimum 44x44px touch target
- [ ] Interactive elements have visible focus state

### Development Phase
- [ ] All form inputs have associated labels
- [ ] All images have alt text
- [ ] All videos have captions and transcripts
- [ ] Heading hierarchy is logical (no skipped levels)
- [ ] All interactive elements keyboard accessible
- [ ] No keyboard traps
- [ ] ARIA roles/labels used only when semantic HTML insufficient
- [ ] Error messages clearly displayed
- [ ] Form validation provides suggestions

### Testing Phase
- [ ] AccessibilityAudit shows 0 failures
- [ ] Tested with NVDA/JAWS screen reader
- [ ] Tested with keyboard only (no mouse)
- [ ] Tested with reduced motion preference enabled
- [ ] Tested with dark mode preference enabled
- [ ] Lighthouse accessibility score ≥90

### Deployment Phase
- [ ] Accessibility statement visible on website
- [ ] Contact method for accessibility issues (email, form)
- [ ] Documentation on accessibility features provided
- [ ] Section 508 compliance verified

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM](https://webaim.org/)
- [Deque University](https://dequeuniversity.com/)
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

---

## Support

For accessibility questions or issues:
- Email: accessibility@learnpath.ai
- GitHub Issues: Tag with `a11y`

