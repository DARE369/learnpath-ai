"""
FSRS-5 spaced-repetition scheduler (open-source algorithm, default weights).

Replaces the earlier "lite" heuristic with the real Free Spaced Repetition
Scheduler v5: stability/difficulty are updated from retrievability and a 4-level
rating, and the next interval targets the desired retention. Our reviews are
binary, so we map: correct -> Good (3), incorrect -> Again (1).

Reference: https://github.com/open-spaced-repetition/fsrs4anki (FSRS-5 weights).
"""

import math
from typing import Tuple

# FSRS-5 default parameters (19 weights).
W = [
    0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
    1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
    2.9898, 0.51655, 0.6621,
]

DECAY = -0.5
FACTOR = 19.0 / 81.0
REQUEST_RETENTION = 0.9
MIN_STABILITY = 0.01
MAX_INTERVAL = 365


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _init_stability(rating: int) -> float:
    return max(MIN_STABILITY, W[rating - 1])  # rating 1..4 -> W[0..3]


def _init_difficulty(rating: int) -> float:
    return _clamp(W[4] - math.exp(W[5] * (rating - 1)) + 1, 1.0, 10.0)


def _retrievability(elapsed_days: float, stability: float) -> float:
    return (1 + FACTOR * max(0.0, elapsed_days) / stability) ** DECAY


def _next_interval(stability: float) -> int:
    raw = stability / FACTOR * (REQUEST_RETENTION ** (1 / DECAY) - 1)
    return int(_clamp(round(raw), 1, MAX_INTERVAL))


def _next_difficulty(d: float, rating: int) -> float:
    delta = -W[6] * (rating - 3)
    damped = d + delta * (10 - d) / 9          # FSRS-5 linear damping
    reverted = W[7] * _init_difficulty(4) + (1 - W[7]) * damped  # mean reversion
    return _clamp(reverted, 1.0, 10.0)


def _stability_after_recall(d: float, s: float, r: float, rating: int) -> float:
    hard_penalty = W[15] if rating == 2 else 1.0
    easy_bonus = W[16] if rating == 4 else 1.0
    return s * (
        1
        + math.exp(W[8])
        * (11 - d)
        * (s ** -W[9])
        * (math.exp(W[10] * (1 - r)) - 1)
        * hard_penalty
        * easy_bonus
    )


def _stability_after_lapse(d: float, s: float, r: float) -> float:
    return W[11] * (d ** -W[12]) * ((s + 1) ** W[13] - 1) * math.exp(W[14] * (1 - r))


def schedule(stability: float, difficulty: float, elapsed_days: float,
             rating: int, is_new: bool) -> Tuple[float, float, int]:
    """
    Return (new_stability, new_difficulty, interval_days).
    rating: 1=Again, 2=Hard, 3=Good, 4=Easy. is_new: first review of the card.
    """
    rating = int(_clamp(rating, 1, 4))
    if is_new or not stability:
        s = _init_stability(rating)
        d = _init_difficulty(rating)
    else:
        r = _retrievability(elapsed_days, stability)
        d = _next_difficulty(difficulty, rating)
        if rating == 1:
            s = min(stability, _stability_after_lapse(difficulty, stability, r))
        else:
            s = _stability_after_recall(difficulty, stability, r, rating)
    s = max(MIN_STABILITY, s)
    return s, _clamp(d, 1.0, 10.0), _next_interval(s)
