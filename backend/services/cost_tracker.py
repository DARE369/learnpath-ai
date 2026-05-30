"""
Simple per-feature daily-spend tracker.

Each feature (branching, remediation, expansion, ...) gets a budget in NGN.
`charge()` raises BudgetExceeded if the call would push the day over budget.
Counters reset at UTC midnight. In-memory only — values reset on redeploy,
which is acceptable for a soft cost fence (not a billing rail).
"""

import logging
import threading
from datetime import date
from typing import Dict

logger = logging.getLogger(__name__)


class BudgetExceeded(Exception):
    """Raised when a feature's daily NGN budget would be exceeded."""


class CostTracker:
    DEFAULT_BUDGETS_NGN: Dict[str, float] = {
        "branching": 0.50,
        "remediation": 0.50,
        "expansion": 0.50,
        "blacklist_reeval": 0.50,
    }

    def __init__(self, budgets: Dict[str, float] = None):
        self._budgets = dict(self.DEFAULT_BUDGETS_NGN)
        if budgets:
            self._budgets.update(budgets)
        self._spend: Dict[str, float] = {}
        self._day: date = date.today()
        self._lock = threading.Lock()

    def _rollover_if_new_day(self) -> None:
        today = date.today()
        if today != self._day:
            logger.info(f"Cost tracker: rolling over from {self._day} to {today}")
            self._day = today
            self._spend.clear()

    def budget(self, feature: str) -> float:
        return self._budgets.get(feature, 0.0)

    def remaining(self, feature: str) -> float:
        with self._lock:
            self._rollover_if_new_day()
            return max(0.0, self.budget(feature) - self._spend.get(feature, 0.0))

    def charge(self, feature: str, amount_ngn: float) -> float:
        """
        Record a spend. Raises BudgetExceeded if this charge would push the day
        over the feature's budget. Returns the new running total for the day.
        """
        with self._lock:
            self._rollover_if_new_day()
            current = self._spend.get(feature, 0.0)
            budget = self.budget(feature)
            if current + amount_ngn > budget:
                raise BudgetExceeded(
                    f"Daily budget for '{feature}' exceeded: "
                    f"₦{current:.2f} + ₦{amount_ngn:.2f} > ₦{budget:.2f}"
                )
            self._spend[feature] = current + amount_ngn
            logger.info(
                f"Cost charged: {feature} +₦{amount_ngn:.2f} → ₦{self._spend[feature]:.2f}/₦{budget:.2f}"
            )
            return self._spend[feature]

    def stats(self) -> Dict[str, Dict[str, float]]:
        with self._lock:
            self._rollover_if_new_day()
            return {
                feature: {
                    "budget_ngn": budget,
                    "spent_ngn": round(self._spend.get(feature, 0.0), 4),
                    "remaining_ngn": round(max(0.0, budget - self._spend.get(feature, 0.0)), 4),
                }
                for feature, budget in self._budgets.items()
            }


cost_tracker = CostTracker()
