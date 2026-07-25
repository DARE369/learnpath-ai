"use client";
import React, { useState } from "react";
import FeedbackCard from "./FeedbackCard";
import { Card, Button, Badge, Textarea, type BadgeTone } from "../../ui-v2/primitives";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

interface FeedbackState {
  score: number;
  isCorrect: boolean;
  explanation: string;
  feedback: string;
  keyInsight: string;
}

interface QuestionCardProps {
  sessionId: string | null;
  question: string;
  questionType: "free_text" | "multiple_choice";
  options?: string[];
  correctAnswer: string;
  difficulty: string;
  estimatedTime?: number;
  conceptName?: string;
  topicId?: string;
  onAnswerSubmit: (score: number, feedback: string) => void;
  onSkip?: () => void;
}

const CONFIDENCE_LABELS = ["Not sure", "Slight idea", "Fairly sure", "Confident", "Very sure"];
const DIFFICULTY_TONE: Record<string, BadgeTone> = { easy: "success", hard: "danger", medium: "warning" };

function ConfidenceStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {CONFIDENCE_LABELS.map((label, i) => {
        const filled = i < value;
        return (
          <button
            key={i}
            onClick={() => onChange(i + 1)}
            title={label}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: filled ? "#C8792A" : color.textFainter, display: "flex" }}
          >
            <Icon name="star" size={16} className="" />
          </button>
        );
      })}
      {value > 0 && <span style={{ marginLeft: 4, fontSize: 11.5, color: color.textFainter }}>{CONFIDENCE_LABELS[value - 1]}</span>}
    </div>
  );
}

export default function QuestionCard({
  question,
  questionType,
  options,
  correctAnswer,
  difficulty,
  estimatedTime,
  conceptName,
  topicId,
  onAnswerSubmit,
  onSkip,
}: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackState | null>(null);

  const studentAnswer = questionType === "multiple_choice" && selectedOption !== null ? options?.[selectedOption] ?? "" : answer;
  const canSubmit = studentAnswer.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/questions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          correct_answer: correctAnswer,
          student_answer: studentAnswer.trim(),
          difficulty,
          ...(conceptName ? { concept_name: conceptName } : {}),
          ...(topicId ? { topic_id: topicId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Evaluation failed");
      const data = await res.json();
      setFeedbackState({
        score: data.score ?? 0,
        isCorrect: data.is_correct ?? false,
        explanation: data.explanation ?? "",
        feedback: data.feedback ?? "",
        keyInsight: data.key_insight ?? "",
      });
    } catch {
      setError("Couldn't evaluate your answer. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (feedbackState) {
    return (
      <FeedbackCard
        score={feedbackState.score}
        isCorrect={feedbackState.isCorrect}
        explanation={feedbackState.explanation}
        feedback={feedbackState.feedback}
        keyInsight={feedbackState.keyInsight}
        onContinue={() => onAnswerSubmit(feedbackState.score, feedbackState.feedback)}
      />
    );
  }

  return (
    <Card dark padding="sm" style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(43,95,168,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${color.chromeBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(43,95,168,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="sparkles" size={13} className="" />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#6FA0E0", textTransform: "uppercase", letterSpacing: "0.05em" }}>Comprehension Check</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {estimatedTime && <span style={{ fontSize: 11.5, color: color.textFainter }}>{Math.ceil(estimatedTime / 60)} min</span>}
          <Badge tone={DIFFICULTY_TONE[difficulty] ?? "warning"}>{difficulty}</Badge>
        </div>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 15, color: color.chromeText, lineHeight: 1.55, fontWeight: 500, margin: 0 }}>{question}</p>

        {questionType === "multiple_choice" && options ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((opt, i) => {
              const selected = selectedOption === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedOption(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                    padding: "12px 16px", borderRadius: 10, fontSize: 13.5, cursor: "pointer",
                    border: `1px solid ${selected ? "#3A5A8F" : color.chromeBorder}`,
                    background: selected ? "rgba(43,95,168,0.12)" : "rgba(255,255,255,0.02)",
                    color: selected ? color.chromeText : color.chromeTextMuted,
                  }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selected ? "#6FA0E0" : "rgba(255,255,255,0.3)"}`, background: selected ? "#6FA0E0" : "transparent", flexShrink: 0 }} />
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here…"
            rows={4}
            style={{ background: "rgba(0,0,0,0.3)", borderColor: color.chromeBorder, color: color.chromeText }}
          />
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11.5, color: color.textFainter, whiteSpace: "nowrap" }}>Confidence:</span>
          <ConfidenceStars value={confidence} onChange={setConfidence} />
        </div>

        {error && (
          <p style={{ fontSize: 11.5, color: color.danger.fg, background: "rgba(176,54,44,0.12)", border: "1px solid rgba(176,54,44,0.3)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button onClick={handleSubmit} disabled={!canSubmit} style={{ fontFamily: font.body }}>
            {loading ? "Evaluating…" : "Submit Answer"}
          </Button>
          {onSkip && (
            <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: color.textFainter }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
