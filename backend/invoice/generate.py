import os
import uuid
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from core.supabase_client import supabase

TEMPLATE_DIR = Path(__file__).parent
INVOICE_BUCKET = os.getenv("INVOICE_BUCKET", "invoices")

env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def _duration_label(days):
    if not days:
        return ""
    mapping = {30: "1 Month", 60: "2 Months", 90: "3 Months", 180: "6 Months", 365: "1 Year"}
    return mapping.get(days, f"{days} Days")


def _fmt(amount):
    """Format a numeric amount as a two-decimal string, e.g. 1179 -> '1,179.00'."""
    try:
        value = float(amount or 0)
    except (TypeError, ValueError):
        value = 0.0
    return f"{value:,.2f}"


def fetch_payment_bundle(payment_id):
    """
    Pulls everything needed to render an invoice: payment, member,
    organization, and membership plan (via subscription).
    Raises ValueError if the payment or required relations are missing.
    """
    payment_res = (
        supabase.table("payments")
        .select("*")
        .eq("id", payment_id)
        .single()
        .execute()
    )
    payment = payment_res.data
    if not payment:
        raise ValueError(f"Payment {payment_id} not found")

    member_res = (
        supabase.table("members")
        .select("id, full_name, phone, email")
        .eq("id", payment["member_id"])
        .single()
        .execute()
    )
    member = member_res.data
    if not member:
        raise ValueError(f"Member for payment {payment_id} not found")

    org_res = (
        supabase.table("organizations")
        .select("id, name, address, city, state, pincode, phone, email, gst_number")
        .eq("id", payment["organization_id"])
        .single()
        .execute()
    )
    gym = org_res.data
    if not gym:
        raise ValueError(f"Organization for payment {payment_id} not found")

    plan_name = "Membership"
    duration_days = None
    subscription_period = None

    if payment.get("subscription_id"):
        sub_res = (
            supabase.table("member_subscriptions")
            .select("start_date, end_date, plan_id, membership_plans(name, duration_days)")
            .eq("id", payment["subscription_id"])
            .maybe_single()
            .execute()
        )
        sub = sub_res.data
        if sub:
            plan = sub.get("membership_plans") or {}
            plan_name = plan.get("name", plan_name)
            duration_days = plan.get("duration_days")
            if sub.get("start_date") and sub.get("end_date"):
                start = datetime.fromisoformat(sub["start_date"]).strftime("%d %b %Y")
                end = datetime.fromisoformat(sub["end_date"]).strftime("%d %b %Y")
                subscription_period = f"{start} {chr(8211)} {end}"

    return {
        "payment": payment,
        "member": member,
        "gym": gym,
        "plan_name": plan_name,
        "duration_days": duration_days,
        "subscription_period": subscription_period,
    }


def render_invoice_pdf(bundle):
    payment = bundle["payment"]
    member = bundle["member"]
    gym = bundle["gym"]

    amount = payment.get("amount") or 0
    gst_amount = payment.get("gst_amount") or 0
    discount_amount = payment.get("discount_amount") or 0
    total_amount = payment.get("total_amount") or (float(amount) + float(gst_amount) - float(discount_amount))

    gst_rate = 0
    try:
        if amount and float(amount) > 0:
            gst_rate = round((float(gst_amount) / float(amount)) * 100)
    except (TypeError, ZeroDivisionError, ValueError):
        gst_rate = 18  # sensible default if computation fails

    paid_at = payment.get("paid_at") or payment.get("created_at")
    invoice_date = (
        datetime.fromisoformat(paid_at.replace("Z", "+00:00")).strftime("%d %b %Y")
        if paid_at else datetime.utcnow().strftime("%d %b %Y")
    )

    payment_method_label = {
        "cash": "Cash", "upi": "UPI", "card": "Card", "razorpay": "Online",
    }.get(payment.get("payment_method", ""), str(payment.get("payment_method", "—")).title())

    template = env.get_template("template.html")
    html_str = template.render(
        gym=gym,
        member=member,
        invoice_number=payment.get("invoice_number") or f"INV-{payment['id'][:8].upper()}",
        invoice_date=invoice_date,
        payment_method=payment_method_label,
        plan_name=bundle["plan_name"],
        duration_label=_duration_label(bundle["duration_days"]),
        subscription_period=bundle["subscription_period"],
        base_amount=_fmt(amount),
        gst_rate=gst_rate,
        gst_amount=_fmt(gst_amount),
        discount_amount=_fmt(discount_amount),
        total_amount=_fmt(total_amount),
    )

    pdf_bytes = HTML(string=html_str, base_url=str(TEMPLATE_DIR)).write_pdf()
    return pdf_bytes


def upload_invoice_pdf(org_id, invoice_number, pdf_bytes):
    """
    Uploads the PDF to Supabase Storage and returns a signed URL.
    Path: {org_id}/{invoice_number}.pdf
    """
    safe_invoice_number = invoice_number.replace("/", "-")
    storage_path = f"{org_id}/{safe_invoice_number}.pdf"

    supabase.storage.from_(INVOICE_BUCKET).upload(
        path=storage_path,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )

    # Signed URL valid for 30 days — refreshed each time invoice is regenerated
    signed = supabase.storage.from_(INVOICE_BUCKET).create_signed_url(
        path=storage_path, expires_in=60 * 60 * 24 * 30
    )
    return signed["signedURL"]


def generate_invoice_for_payment(payment_id):
    """
    Full pipeline: fetch data -> render PDF -> upload -> update payments row.
    Returns { invoice_number, invoice_pdf_url }.
    """
    bundle = fetch_payment_bundle(payment_id)
    payment = bundle["payment"]
    gym = bundle["gym"]

    invoice_number = payment.get("invoice_number")
    if not invoice_number:
        # Fallback — should rarely happen since Next.js assigns this on payment creation
        invoice_number = f"INV-{datetime.utcnow().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

    pdf_bytes = render_invoice_pdf(bundle)
    pdf_url = upload_invoice_pdf(gym["id"], invoice_number, pdf_bytes)

    supabase.table("payments").update({
        "invoice_number": invoice_number,
        "invoice_pdf_url": pdf_url,
    }).eq("id", payment_id).execute()

    return {"invoice_number": invoice_number, "invoice_pdf_url": pdf_url}
