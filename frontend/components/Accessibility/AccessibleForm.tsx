import React, { useRef, useState } from "react";
import { announceToScreenReader } from "@/lib/accessibility";

interface FormField {
  name: string;
  label: string;
  type: "text" | "email" | "password" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  description?: string;
}

interface AccessibleFormProps {
  title: string;
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => Promise<void>;
  submitLabel?: string;
}

interface FormErrors {
  [key: string]: string;
}

export function AccessibleForm({
  title,
  fields,
  onSubmit,
  submitLabel = "Submit",
}: AccessibleFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    fields.forEach((field) => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }

      // Email validation
      if (
        field.type === "email" &&
        formData[field.name] &&
        !isValidEmail(formData[field.name])
      ) {
        newErrors[field.name] = `${field.label} must be a valid email`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target as any;
    const newValue = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear error on input
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      announceToScreenReader(
        `Form has ${Object.keys(errors).length} error(s)`,
        "assertive"
      );
      errorSummaryRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      announceToScreenReader("Form submitted successfully", "assertive");
      setFormData({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Form submission failed";
      announceToScreenReader(`Error: ${message}`, "assertive");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="accessible-form-wrapper">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="accessible-form"
        aria-labelledby="form-title"
        noValidate
      >
        <h1 id="form-title" className="form-title">
          {title}
        </h1>

        {hasErrors && (
          <div
            ref={errorSummaryRef}
            role="alert"
            aria-live="assertive"
            className="error-summary"
            tabIndex={-1}
          >
            <h2 className="error-summary-title">Please correct the following:</h2>
            <ul className="error-list">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>
                  <a
                    href={`#${field}-error`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(field)?.focus();
                    }}
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset className="form-fieldset">
          {fields.map((field) => (
            <div key={field.name} className="form-group">
              {field.type !== "checkbox" && (
                <label htmlFor={field.name} className="form-label">
                  {field.label}
                  {field.required && (
                    <span aria-label="required" className="required-indicator">
                      *
                    </span>
                  )}
                </label>
              )}

              {field.description && (
                <p id={`${field.name}-description`} className="field-description">
                  {field.description}
                </p>
              )}

              {field.type === "select" ? (
                <select
                  id={field.name}
                  name={field.name}
                  value={formData[field.name] || ""}
                  onChange={handleChange}
                  required={field.required}
                  aria-required={field.required}
                  aria-invalid={!!errors[field.name]}
                  aria-describedby={
                    errors[field.name]
                      ? `${field.name}-error`
                      : field.description
                      ? `${field.name}-description`
                      : undefined
                  }
                  className={`form-input ${errors[field.name] ? "error" : ""}`}
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  id={field.name}
                  name={field.name}
                  value={formData[field.name] || ""}
                  onChange={handleChange}
                  required={field.required}
                  aria-required={field.required}
                  aria-invalid={!!errors[field.name]}
                  aria-describedby={
                    errors[field.name]
                      ? `${field.name}-error`
                      : field.description
                      ? `${field.name}-description`
                      : undefined
                  }
                  placeholder={field.placeholder}
                  className={`form-input textarea ${errors[field.name] ? "error" : ""}`}
                  rows={4}
                />
              ) : field.type === "checkbox" ? (
                <div className="checkbox-wrapper">
                  <input
                    id={field.name}
                    name={field.name}
                    type="checkbox"
                    checked={formData[field.name] || false}
                    onChange={handleChange}
                    required={field.required}
                    aria-required={field.required}
                    aria-invalid={!!errors[field.name]}
                    className="checkbox-input"
                  />
                  <label htmlFor={field.name} className="checkbox-label">
                    {field.label}
                    {field.required && (
                      <span aria-label="required" className="required-indicator">
                        *
                      </span>
                    )}
                  </label>
                </div>
              ) : (
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  value={formData[field.name] || ""}
                  onChange={handleChange}
                  required={field.required}
                  aria-required={field.required}
                  aria-invalid={!!errors[field.name]}
                  aria-describedby={
                    errors[field.name]
                      ? `${field.name}-error`
                      : field.description
                      ? `${field.name}-description`
                      : undefined
                  }
                  placeholder={field.placeholder}
                  className={`form-input ${errors[field.name] ? "error" : ""}`}
                />
              )}

              {errors[field.name] && (
                <div
                  id={`${field.name}-error`}
                  className="field-error"
                  role="alert"
                >
                  {errors[field.name]}
                </div>
              )}
            </div>
          ))}
        </fieldset>

        <button
          type="submit"
          disabled={isSubmitting}
          className="form-button"
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : submitLabel}
        </button>
      </form>

      <style jsx>{`
        .accessible-form-wrapper {
          max-width: 500px;
          margin: 0 auto;
        }

        .accessible-form {
          background: white;
          padding: 32px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .form-title {
          margin: 0 0 24px 0;
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
        }

        .error-summary {
          padding: 16px;
          background: #fef2f2;
          border: 2px solid #fecaca;
          border-radius: 6px;
          margin-bottom: 24px;
          outline: none;
        }

        .error-summary:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .error-summary-title {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #991b1b;
        }

        .error-list {
          margin: 0;
          padding-left: 20px;
          list-style: disc;
        }

        .error-list li {
          color: #991b1b;
          margin-bottom: 8px;
        }

        .error-list a {
          color: #991b1b;
          text-decoration: underline;
        }

        .error-list a:focus {
          outline: 2px solid #3b82f6;
        }

        .form-fieldset {
          border: none;
          padding: 0;
          margin: 0 0 24px 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #1f2937;
          font-size: 14px;
        }

        .required-indicator {
          color: #ef4444;
          margin-left: 4px;
        }

        .field-description {
          margin: 4px 0 8px 0;
          font-size: 13px;
          color: #6b7280;
        }

        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-input.error {
          border-color: #ef4444;
        }

        .form-input.error:focus {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .textarea {
          resize: vertical;
          min-height: 100px;
        }

        .checkbox-wrapper {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .checkbox-input {
          margin-top: 4px;
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .checkbox-input:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 2px;
        }

        .checkbox-label {
          font-size: 14px;
          color: #1f2937;
          cursor: pointer;
        }

        .field-error {
          margin-top: 6px;
          font-size: 13px;
          color: #ef4444;
        }

        .form-button {
          width: 100%;
          padding: 12px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .form-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .form-button:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .form-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
