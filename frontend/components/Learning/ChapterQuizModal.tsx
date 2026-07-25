import React, { useState, useCallback, useEffect } from "react";
import type { QuizQuestion } from "./ChaptersList";
import { Modal, ModalTitle, Button, ThresholdRing } from "../../ui-v2/primitives";
import { Icon } from "../../ui-v2/icons";
import { color, font } from "../../ui-v2/tokens";

interface Props {
  chunkId: string;
  chapterTitle: string;
  questions: QuizQuestion[];
  accessToken: string | null;
  onClose: () => void;
  onComplete: (scorePercent: number) => void;
}

type AnswerState = "idle" | "correct" | "wrong";

export default function ChapterQuizModal({ chunkId, chapterTitle, questions, accessToken, onClose, onComplete }: Props) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const validQuestions = questions.filter((q) => q.question_text && q.options?.length > 0);
  const current = validQuestions[qIndex];
  const total = validQuestions.length;

  const authHeaders: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  const saveScore = useCallback(
    (score: number) => {
      fetch(`/api/chunks/detail/${chunkId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ watched_seconds: 0, quiz_score: score }),
      }).catch(() => {});
    },
    [chunkId, accessToken], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // No valid questions — skip straight through. Moved to an effect (was a
  // side effect during render) so onComplete never fires mid-render.
  useEffect(() => {
    if (!total) onComplete(100);
  }, [total, onComplete]);

  const handleSelect = (optIdx: number) => {
    if (answerState !== "idle") return;
    const opt = current.options[optIdx];
    const isCorrect = opt.correct;
    setSelected(optIdx);
    setAnswerState(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrectCount((n) => n + 1);
  };

  const handleNext = () => {
    if (qIndex < total - 1) {
      setQIndex((i) => i + 1);
      setSelected(null);
      setAnswerState("idle");
    } else {
      const finalPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      saveScore(finalPct);
      setDone(true);
    }
  };

  const finalPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  if (!total) return null;

  return (
    <Modal onClose={onClose} width={480} dark>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: color.textFainter, textTransform: "uppercase", letterSpacing: "0.05em" }}>Chapter quiz</div>
          <ModalTitle dark>{chapterTitle}</ModalTitle>
        </div>
        {!done && (
          <span style={{ fontSize: 11.5, color: color.textFainter, background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 100, flexShrink: 0 }}>
            {qIndex + 1} / {total}
          </span>
        )}
      </div>

      {!done && (
        <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 100, marginBottom: 18, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((qIndex + (answerState !== "idle" ? 1 : 0)) / total) * 100}%`, background: "#2B5FA8" }} />
        </div>
      )}

      {done ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "16px 0", textAlign: "center" }}>
          <ThresholdRing pct={finalPct} threshold={50} size={92} dark />
          <div>
            <div style={{ fontSize: 13.5, color: color.chromeTextMuted, marginTop: 4 }}>{correctCount} of {total} correct</div>
          </div>
          <p style={{ fontSize: 13.5, color: color.textFainter, margin: 0 }}>
            {finalPct >= 80 ? "Excellent work! Ready for the next chapter." : finalPct >= 50 ? "Good effort. Keep watching to solidify this." : "Review the chapter summary if anything is unclear."}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 8, width: "100%" }}>
            <Button variant="secondary" fullWidth onClick={onClose} style={{ background: "transparent", borderColor: color.chromeBorder, color: color.chromeTextMuted }}>Stay here</Button>
            <Button fullWidth onClick={() => onComplete(finalPct)} style={{ fontFamily: font.body }}>
              Next chapter <Icon name="chevronRight" size={16} className="" />
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: color.chromeText, lineHeight: 1.5, margin: 0 }}>{current.question_text}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {current.options.map((opt, i) => {
              const isSelected = selected === i;
              const reveal = answerState !== "idle";
              let border: string = color.chromeBorder;
              let bg = "rgba(255,255,255,0.03)";
              let fg: string = color.chromeTextMuted;
              if (reveal) {
                if (opt.correct) { border = "rgba(30,127,92,0.5)"; bg = "rgba(30,127,92,0.12)"; fg = "#5FCFA0"; }
                else if (isSelected) { border = "rgba(176,54,44,0.5)"; bg = "rgba(176,54,44,0.12)"; fg = "#E08579"; }
                else { border = "rgba(255,255,255,0.05)"; bg = "rgba(255,255,255,0.02)"; fg = color.textFainter; }
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(i)}
                  disabled={reveal}
                  style={{ width: "100%", textAlign: "left", borderRadius: 10, border: `1px solid ${border}`, background: bg, color: fg, padding: "12px 16px", fontSize: 13.5, cursor: reveal ? "default" : "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", border: "1px solid currentColor", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500 }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{opt.text}</span>
                    {reveal && opt.correct && <Icon name="checkCircle" size={16} className="" />}
                    {reveal && isSelected && !opt.correct && <Icon name="xCircle" size={16} className="" />}
                  </div>
                </button>
              );
            })}
          </div>

          {answerState !== "idle" && current.explanation && (
            <div style={{ borderRadius: 10, padding: "12px 16px", fontSize: 13.5, lineHeight: 1.55, background: answerState === "correct" ? "rgba(30,127,92,0.12)" : "rgba(176,54,44,0.12)", border: `1px solid ${answerState === "correct" ? "rgba(30,127,92,0.3)" : "rgba(176,54,44,0.3)"}`, color: answerState === "correct" ? "#8FD9BC" : "#F0A99E" }}>
              {current.explanation}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: color.textFainter }}>Skip quiz</button>
            {answerState !== "idle" && (
              <Button onClick={handleNext} style={{ fontFamily: font.body }}>
                {qIndex < total - 1 ? "Next" : "Finish"} <Icon name="chevronRight" size={16} className="" />
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
