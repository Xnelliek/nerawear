"""Email + SMS notifications for orders."""
from __future__ import annotations

import logging

import requests
from django.conf import settings
import functools, logging, threading
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def in_background(fn):
    """Run the notification off the request thread; never raise to the caller."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        def runner():
            try:
                fn(*args, **kwargs)
            except Exception:
                logger.warning("Notification failed", exc_info=True)
            finally:
                from django.db import connections
                connections.close_all()
        threading.Thread(target=runner, daemon=True).start()
    return wrapper


def send_sms(phone: str, message: str) -> None:
    if not settings.SMS_ENABLED or not settings.AT_API_KEY or not phone:
        return
    try:
        requests.post(
            "https://api.africastalking.com/version1/messaging",
            headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"},
            data={
                "username": settings.AT_USERNAME,
                "to": phone if phone.startswith("+") else f"+254{phone.lstrip('0')}",
                "message": message,
                "from": settings.AT_SENDER_ID,
            },
            timeout=8,
        )
    except requests.RequestException:
        logger.warning("SMS delivery failed", exc_info=True)


def _mail(subject: str, body: str, recipients: list[str]) -> None:
    recipients = [r for r in recipients if r]
    if not recipients:
        return
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=True)
    except Exception:  # noqa: BLE001 - notifications must never break checkout
        logger.warning("Email delivery failed", exc_info=True)


def order_placed(order) -> None:
    lines = "\n".join(
        f"  - {item.quantity} x {item.product_name}"
        f"{f' (size {item.size})' if item.size else ''} — KES {item.unit_price_kes:,}"
        for item in order.items.all()
    )
    body = (
        f"Thank you for shopping with {settings.STORE_NAME}!\n\n"
        f"Order {order.order_number}\n{lines}\n\n"
        f"Subtotal: KES {order.subtotal_kes:,}\n"
        f"Discount: KES {order.discount_kes:,}\n"
        f"Delivery: KES {order.delivery_fee_kes:,}\n"
        f"Total: KES {order.total_kes:,}\n\n"
        f"Pay via M-Pesa {settings.MPESA_PAYBILL_NAME} to {settings.MPESA_PHONE}, "
        f"then paste the confirmation code on your order page.\n"
    )
    _mail(f"{settings.STORE_NAME} order {order.order_number}", body, [order.email or ""])
    _mail(
        f"New order {order.order_number} — KES {order.total_kes:,}",
        f"{order.first_name} {order.last_name} ({order.phone})\n{order.county}\n{order.address}\n\n{lines}",
        [settings.ADMIN_ORDER_EMAIL],
    )
    send_sms(order.phone, f"{settings.STORE_NAME}: order {order.order_number} received. Total KES {order.total_kes:,}.")


def payment_code_submitted(order) -> None:
    _mail(
        f"M-Pesa code for {order.order_number}",
        f"{order.first_name} {order.last_name} submitted code {order.payment_ref} "
        f"for KES {order.total_kes:,}. Verify and dispatch.",
        [settings.ADMIN_ORDER_EMAIL],
    )


def status_changed(order) -> None:
    label = dict(order.STATUS_CHOICES).get(order.status, order.status)
    _mail(
        f"{settings.STORE_NAME} order {order.order_number} is {label.lower()}",
        f"Your order {order.order_number} is now {label.lower()}.",
        [order.email or ""],
    )
    send_sms(order.phone, f"{settings.STORE_NAME}: order {order.order_number} is now {label.lower()}.")
