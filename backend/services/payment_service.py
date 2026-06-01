"""
Flutterwave payment processing (Packet 4.1).

Thin async wrapper over Flutterwave REST API v3:
  - initialize a hosted checkout (returns a payment link)
  - verify a transaction by our tx_ref
  - refund a transaction
  - validate + parse webhook events

Safe by default: when FLUTTERWAVE_SECRET_KEY is unset (dev/CI), every network
method raises PaymentError instead of calling out, so tests never hit the wire.
HTTP calls go through httpx.AsyncClient (already a project dependency).
"""

import hashlib
import hmac
import logging
from typing import Any, Dict, Optional

# httpx is imported lazily inside the HTTP methods. Importing it at module load
# pulls in httpcore, which fails on some interpreters (e.g. Python 3.14) — and
# the pure helpers + webhook parsing must stay importable without it.

from config import settings

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 20.0


class PaymentError(Exception):
    """A payment operation failed (gateway error, misconfiguration, etc.)."""


class PaymentService:
    def __init__(self):
        self.base_url = settings.FLUTTERWAVE_BASE_URL.rstrip("/")
        self.secret_key = settings.FLUTTERWAVE_SECRET_KEY
        self.public_key = settings.FLUTTERWAVE_PUBLIC_KEY
        self.webhook_secret = settings.FLUTTERWAVE_WEBHOOK_SECRET
        self.currency = settings.PAYMENT_CURRENCY

    @property
    def is_configured(self) -> bool:
        return bool(self.secret_key)

    def _headers(self) -> Dict[str, str]:
        if not self.secret_key:
            raise PaymentError("Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY unset)")
        return {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def initialize_payment(
        self,
        amount: float,
        reference: str,
        email: str,
        plan_type: str,
        meta: Optional[Dict[str, Any]] = None,
        redirect_url: Optional[str] = None,
    ) -> Dict:
        """
        Create a Flutterwave Standard checkout. Returns
        {payment_link, reference, amount, status}.
        """
        payload = {
            "tx_ref": reference,
            "amount": amount,
            "currency": self.currency,
            "redirect_url": redirect_url or settings.PAYMENT_SUCCESS_URL,
            "payment_options": "card,banktransfer,ussd,mobilemoney",
            "customer": {"email": email},
            "meta": meta or {},
            "customizations": {
                "title": "LearnPath AI",
                "description": f"{plan_type.capitalize()} plan subscription",
            },
        }
        data = await self._post("/payments", payload)
        link = (data.get("data") or {}).get("link")
        if not link:
            raise PaymentError(f"Flutterwave returned no payment link: {data}")
        return {
            "payment_link": link,
            "reference": reference,
            "amount": amount,
            "status": "pending",
        }

    async def verify_payment(self, reference: str) -> Dict:
        """
        Verify a transaction by our tx_ref. Returns a normalised dict:
        {status, amount, reference, flutterwave_id, customer_email, currency}.
        status is one of successful | failed | pending.
        """
        data = await self._get(
            "/transactions/verify_by_reference", params={"tx_ref": reference}
        )
        tx = data.get("data") or {}
        fw_status = str(tx.get("status", "")).lower()
        status = "successful" if fw_status == "successful" else (
            "failed" if fw_status in ("failed", "cancelled") else "pending"
        )
        return {
            "status": status,
            "amount": tx.get("amount"),
            "reference": tx.get("tx_ref", reference),
            "flutterwave_id": tx.get("id"),
            "customer_email": (tx.get("customer") or {}).get("email"),
            "currency": tx.get("currency"),
        }

    async def refund_payment(self, flutterwave_id: str, amount: Optional[float] = None) -> Dict:
        """Refund a Flutterwave transaction by its id."""
        payload: Dict[str, Any] = {}
        if amount is not None:
            payload["amount"] = amount
        data = await self._post(f"/transactions/{flutterwave_id}/refund", payload)
        refund = data.get("data") or {}
        return {
            "status": str(refund.get("status", "pending")).lower(),
            "flutterwave_id": flutterwave_id,
            "amount": refund.get("amount_refunded", amount),
        }

    def verify_webhook_signature(self, signature: Optional[str], raw_body: bytes = b"") -> bool:
        """
        Flutterwave sends a `verif-hash` header equal to the configured secret
        hash. If a webhook secret is set, require an exact match. We also accept
        an HMAC-SHA256 of the body for forward-compatibility.
        """
        if not self.webhook_secret:
            # No secret configured — cannot verify; reject to be safe.
            return False
        if signature and hmac.compare_digest(signature, self.webhook_secret):
            return True
        if signature and raw_body:
            digest = hmac.new(
                self.webhook_secret.encode(), raw_body, hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(signature, digest)
        return False

    def parse_webhook_event(self, event: Dict) -> Dict:
        """
        Normalise a Flutterwave webhook body into
        {reference, status, flutterwave_id}. Raises PaymentError if the shape
        is unrecognised.
        """
        data = event.get("data") or {}
        reference = data.get("tx_ref")
        if not reference:
            raise PaymentError("Webhook missing tx_ref")
        fw_status = str(data.get("status", "")).lower()
        status = "successful" if fw_status == "successful" else (
            "failed" if fw_status in ("failed", "cancelled") else "pending"
        )
        return {
            "reference": reference,
            "status": status,
            "flutterwave_id": data.get("id"),
        }

    # ------------------------------------------------------------------
    # HTTP plumbing
    # ------------------------------------------------------------------

    async def _post(self, path: str, payload: Dict) -> Dict:
        import httpx  # lazy — see module-level note
        headers = self._headers()
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                resp = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as e:
            raise PaymentError(f"Flutterwave request failed: {e}") from e
        return self._handle_response(resp)

    async def _get(self, path: str, params: Optional[Dict] = None) -> Dict:
        import httpx  # lazy — see module-level note
        headers = self._headers()
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                resp = await client.get(url, params=params, headers=headers)
        except httpx.HTTPError as e:
            raise PaymentError(f"Flutterwave request failed: {e}") from e
        return self._handle_response(resp)

    @staticmethod
    def _handle_response(resp) -> Dict:
        if resp.status_code >= 400:
            raise PaymentError(
                f"Flutterwave error {resp.status_code}: {resp.text[:300]}"
            )
        try:
            body = resp.json()
        except ValueError as e:
            raise PaymentError(f"Flutterwave returned non-JSON: {resp.text[:200]}") from e
        if str(body.get("status", "success")).lower() == "error":
            raise PaymentError(f"Flutterwave: {body.get('message', 'unknown error')}")
        return body


payment_service = PaymentService()
