import React, { useState, useEffect } from "react";
import {
  checkColorContrast,
  isKeyboardAccessible,
  hasAccessibleLabel,
  prefersReducedMotion,
} from "@/lib/accessibility";

interface AuditResult {
  category: string;
  status: "pass" | "fail" | "warning";
  message: string;
  element?: HTMLElement;
}

interface AuditReport {
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  results: AuditResult[];
  timestamp: Date;
}

export function AccessibilityAudit() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runAudit = () => {
    setIsRunning(true);
    const results: AuditResult[] = [];

    // 1. Check color contrast
    const textElements = document.querySelectorAll(
      "p, span, h1, h2, h3, h4, h5, h6, button, a, label"
    );
    textElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const color = computed.color;
      const bgColor = computed.backgroundColor;

      if (color !== "rgba(0, 0, 0, 0)" && bgColor !== "rgba(0, 0, 0, 0)") {
        const hexColor = rgbToHex(color);
        const hexBg = rgbToHex(bgColor);

        if (hexColor && hexBg) {
          const contrast = checkColorContrast(hexColor, hexBg);
          if (!contrast.passes) {
            results.push({
              category: "Color Contrast",
              status: "fail",
              message: `Contrast ratio ${contrast.ratio}:1 below ${contrast.standard}`,
              element: el as HTMLElement,
            });
          }
        }
      }
    });

    // 2. Check keyboard accessibility
    const interactiveElements = document.querySelectorAll(
      "button, a, input, select, textarea"
    );
    interactiveElements.forEach((el) => {
      if (!isKeyboardAccessible(el as HTMLElement)) {
        results.push({
          category: "Keyboard Navigation",
          status: "fail",
          message: "Element not keyboard accessible",
          element: el as HTMLElement,
        });
      }
    });

    // 3. Check ARIA labels
    interactiveElements.forEach((el) => {
      if (!hasAccessibleLabel(el as HTMLElement)) {
        results.push({
          category: "ARIA Labels",
          status: "fail",
          message: "Element missing accessible label",
          element: el as HTMLElement,
        });
      }
    });

    // 4. Check for images without alt text
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.getAttribute("alt") || img.getAttribute("alt")?.trim() === "") {
        results.push({
          category: "Image Alt Text",
          status: "fail",
          message: "Image missing alt text",
          element: img as HTMLElement,
        });
      }
    });

    // 5. Check form labels
    const formInputs = document.querySelectorAll("input, textarea, select");
    formInputs.forEach((input) => {
      const label = document.querySelector(`label[for="${input.id}"]`);
      const ariaLabel = input.getAttribute("aria-label");

      if (!label && !ariaLabel && !input.getAttribute("aria-labelledby")) {
        results.push({
          category: "Form Labels",
          status: "fail",
          message: "Form input missing associated label",
          element: input as HTMLElement,
        });
      }
    });

    // 6. Check heading hierarchy
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let previousLevel = 0;
    headings.forEach((heading) => {
      const level = parseInt(heading.tagName[1]);
      if (level > previousLevel + 1) {
        results.push({
          category: "Heading Hierarchy",
          status: "warning",
          message: `Heading hierarchy skipped from H${previousLevel} to H${level}`,
          element: heading as HTMLElement,
        });
      }
      previousLevel = level;
    });

    // 7. Check for motion preferences
    if (prefersReducedMotion()) {
      const animatedElements = document.querySelectorAll("[class*='animate']");
      if (animatedElements.length > 0) {
        results.push({
          category: "Reduced Motion",
          status: "warning",
          message: `${animatedElements.length} animated elements found (user prefers reduced motion)`,
        });
      }
    }

    // 8. Check for empty buttons
    document.querySelectorAll("button").forEach((btn) => {
      if (!btn.textContent?.trim() && !btn.getAttribute("aria-label")) {
        results.push({
          category: "Empty Buttons",
          status: "fail",
          message: "Button has no text or aria-label",
          element: btn as HTMLElement,
        });
      }
    });

    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const warnings = results.filter((r) => r.status === "warning").length;

    setReport({
      totalChecks: results.length,
      passed,
      failed,
      warnings,
      results,
      timestamp: new Date(),
    });

    setIsRunning(false);
  };

  return (
    <div className="accessibility-audit">
      <div className="audit-header">
        <h2>Accessibility Audit (WCAG 2.1 AA)</h2>
        <button onClick={runAudit} disabled={isRunning}>
          {isRunning ? "Running..." : "Run Audit"}
        </button>
      </div>

      {report && (
        <div className="audit-report">
          <div className="audit-summary">
            <div className="stat">
              <span className="label">Checks</span>
              <span className="value">{report.totalChecks}</span>
            </div>
            <div className={`stat passed`}>
              <span className="label">Passed</span>
              <span className="value">{report.passed}</span>
            </div>
            <div className={`stat ${report.failed > 0 ? "failed" : ""}`}>
              <span className="label">Failed</span>
              <span className="value">{report.failed}</span>
            </div>
            <div className={`stat ${report.warnings > 0 ? "warning" : ""}`}>
              <span className="label">Warnings</span>
              <span className="value">{report.warnings}</span>
            </div>
          </div>

          <div className="audit-results">
            {report.results.map((result, idx) => (
              <div key={idx} className={`result ${result.status}`}>
                <div className="result-header">
                  <span className={`badge ${result.status}`}>{result.status}</span>
                  <span className="category">{result.category}</span>
                </div>
                <p className="message">{result.message}</p>
                {result.element && (
                  <div className="element-info">
                    <code>{result.element.tagName.toLowerCase()}</code>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="audit-footer">
            <p className="timestamp">Audit run: {report.timestamp.toLocaleString()}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .accessibility-audit {
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .audit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .audit-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .audit-header button {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .audit-header button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .audit-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px;
          background: white;
          border-radius: 4px;
          border: 2px solid #e5e7eb;
        }

        .stat.passed {
          border-color: #10b981;
        }

        .stat.failed {
          border-color: #ef4444;
        }

        .stat.warning {
          border-color: #f59e0b;
        }

        .stat .label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .stat .value {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
        }

        .audit-results {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }

        .result {
          padding: 12px;
          background: white;
          border-left: 4px solid #e5e7eb;
          border-radius: 4px;
        }

        .result.fail {
          border-left-color: #ef4444;
          background: #fef2f2;
        }

        .result.warning {
          border-left-color: #f59e0b;
          background: #fffbeb;
        }

        .result.pass {
          border-left-color: #10b981;
          background: #f0fdf4;
        }

        .result-header {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .badge.fail {
          background: #fecaca;
          color: #991b1b;
        }

        .badge.warning {
          background: #fcd34d;
          color: #78350f;
        }

        .badge.pass {
          background: #bbf7d0;
          color: #065f46;
        }

        .category {
          font-weight: 600;
          color: #374151;
        }

        .message {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .element-info {
          margin-top: 8px;
        }

        .element-info code {
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          color: #1f2937;
        }

        .audit-footer {
          border-top: 1px solid #e5e7eb;
          padding-top: 12px;
        }

        .timestamp {
          margin: 0;
          font-size: 12px;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return null;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
