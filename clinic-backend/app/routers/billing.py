"""
BL-001: Receipt printer — itemized bill with CDT codes, GST breakdown, PDF export,
        thermal (80 mm) and A4 print support.
BL-003: Email / SMS invoice delivery with payment link, status tracking, re-send.
"""
import uuid
import smtplib
import logging
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from io import BytesIO
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, PaymentMethod
from app.models.patient import Patient
from app.models.user import User
from app.auth.rbac import get_current_user, CurrentUser, require_any_staff
from app.schemas.billing import (
    InvoiceCreate, InvoiceUpdate, InvoiceOut,
    InvoiceItemIn, InvoiceItemOut, PaymentIn, SendInvoiceIn,
)
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _calc_item(item_in: InvoiceItemIn) -> dict:
    """Compute per-line GST amounts and line total."""
    base = round(item_in.unit_price * item_in.quantity, 2)
    cgst = round(base * item_in.cgst_rate / 100, 2)
    sgst = round(base * item_in.sgst_rate / 100, 2)
    igst = round(base * item_in.igst_rate / 100, 2)
    total = round(base + cgst + sgst + igst, 2)
    return dict(
        description=item_in.description,
        hsn_sac_code=item_in.hsn_sac_code,
        quantity=item_in.quantity,
        unit_price=item_in.unit_price,
        cgst_rate=item_in.cgst_rate,
        sgst_rate=item_in.sgst_rate,
        igst_rate=item_in.igst_rate,
        cgst_amount=cgst,
        sgst_amount=sgst,
        igst_amount=igst,
        line_total=total,
    )


def _recalculate_totals(invoice: Invoice) -> None:
    """Recompute header-level totals from line items + discount."""
    subtotal = sum(i.line_total for i in invoice.items)
    disc_amt = invoice.discount_amount or 0
    disc_pct = invoice.discount_percent or 0
    if disc_pct > 0:
        disc_amt = round(subtotal * disc_pct / 100, 2)
    cgst  = sum(i.cgst_amount for i in invoice.items)
    sgst  = sum(i.sgst_amount for i in invoice.items)
    igst  = sum(i.igst_amount for i in invoice.items)
    tax   = round(cgst + sgst + igst, 2)
    total = round(subtotal - disc_amt + tax, 2)

    invoice.subtotal        = subtotal
    invoice.discount_amount = disc_amt
    invoice.cgst_amount     = cgst
    invoice.sgst_amount     = sgst
    invoice.igst_amount     = igst
    invoice.total_tax_amount = tax
    invoice.total_amount    = total
    invoice.amount_due      = round(total - (invoice.amount_paid or 0), 2)


async def _next_invoice_number(db: AsyncSession, clinic_id: uuid.UUID) -> str:
    year = date.today().year
    prefix = f"INV-{year}-"
    result = await db.execute(
        select(func.max(Invoice.invoice_number))
        .where(Invoice.clinic_id == clinic_id, Invoice.invoice_number.like(f"{prefix}%"))
    )
    last = result.scalar()
    seq = 1
    if last:
        try:
            seq = int(last.split("-")[-1]) + 1
        except (ValueError, IndexError):
            pass
    return f"{prefix}{seq:04d}"


def _enrich_out(inv: Invoice) -> InvoiceOut:
    out = InvoiceOut.model_validate(inv)
    if inv.patient:
        out.patient_name  = f"{inv.patient.first_name} {inv.patient.last_name}"
        out.patient_phone = inv.patient.phone
        out.patient_email = str(inv.patient.email) if inv.patient.email else None
    if inv.doctor:
        out.doctor_name = inv.doctor.full_name
    return out


# ── CRUD ───────────────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def list_invoices(
    status_filter: InvoiceStatus | None = Query(None, alias="status"),
    patient_id:   uuid.UUID | None      = Query(None),
    date_from:    date | None            = Query(None),
    date_to:      date | None            = Query(None),
    q:            str | None             = Query(None),
    page:         int                    = Query(1, ge=1),
    page_size:    int                    = Query(25, ge=1, le=200),
    db:           AsyncSession           = Depends(get_db),
    user:         CurrentUser            = Depends(require_any_staff),
):
    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.patient), selectinload(Invoice.doctor), selectinload(Invoice.items))
        .where(Invoice.clinic_id == user.clinic_id)
        .order_by(Invoice.invoice_date.desc(), Invoice.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Invoice.status == status_filter)
    if patient_id:
        stmt = stmt.where(Invoice.patient_id == patient_id)
    if date_from:
        stmt = stmt.where(Invoice.invoice_date >= date_from)
    if date_to:
        stmt = stmt.where(Invoice.invoice_date <= date_to)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()

    offset = (page - 1) * page_size
    rows = (await db.execute(stmt.offset(offset).limit(page_size))).scalars().all()
    return {"total": total, "page": page, "page_size": page_size, "items": [_enrich_out(r) for r in rows]}


@router.post("", response_model=InvoiceOut, status_code=201)
async def create_invoice(
    body: InvoiceCreate,
    db:   AsyncSession = Depends(get_db),
    user: CurrentUser  = Depends(require_any_staff),
):
    # Validate patient and doctor belong to the clinic
    patient = (await db.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == user.clinic_id)
    )).scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Patient not found")

    doctor = (await db.execute(
        select(User).where(User.id == body.doctor_id, User.clinic_id == user.clinic_id)
    )).scalar_one_or_none()
    if not doctor:
        raise HTTPException(404, "Doctor not found")

    inv_num = await _next_invoice_number(db, user.clinic_id)
    invoice = Invoice(
        clinic_id=user.clinic_id,
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        invoice_number=inv_num,
        invoice_date=body.invoice_date,
        due_date=body.due_date,
        discount_amount=body.discount_amount,
        discount_percent=body.discount_percent,
        payment_method=body.payment_method,
        payment_reference=body.payment_reference,
        notes=body.notes,
        status=InvoiceStatus.DRAFT,
        amount_paid=0,
    )
    db.add(invoice)
    await db.flush()  # get invoice.id

    for item_in in body.items:
        vals = _calc_item(item_in)
        db.add(InvoiceItem(invoice_id=invoice.id, **vals))

    await db.flush()
    await db.refresh(invoice, ["items"])
    _recalculate_totals(invoice)

    await db.commit()
    await db.refresh(invoice, ["items", "patient", "doctor"])
    return _enrich_out(invoice)


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: uuid.UUID,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_any_staff),
):
    inv = await _get_or_404(db, invoice_id, user)
    return _enrich_out(inv)


@router.patch("/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: uuid.UUID,
    body:       InvoiceUpdate,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_any_staff),
):
    inv = await _get_or_404(db, invoice_id, user)
    if inv.status not in (InvoiceStatus.DRAFT, InvoiceStatus.SENT):
        raise HTTPException(400, "Only draft or sent invoices can be edited")

    for field, val in body.model_dump(exclude_none=True, exclude={"items"}).items():
        setattr(inv, field, val)

    if body.items is not None:
        # Replace all line items
        for old in list(inv.items):
            await db.delete(old)
        await db.flush()
        for item_in in body.items:
            vals = _calc_item(item_in)
            db.add(InvoiceItem(invoice_id=inv.id, **vals))
        await db.flush()
        await db.refresh(inv, ["items"])

    _recalculate_totals(inv)
    await db.commit()
    await db.refresh(inv, ["items", "patient", "doctor"])
    return _enrich_out(inv)


@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: uuid.UUID,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_any_staff),
):
    inv = await _get_or_404(db, invoice_id, user)
    if inv.status != InvoiceStatus.DRAFT:
        raise HTTPException(400, "Only draft invoices can be deleted")
    await db.delete(inv)
    await db.commit()


@router.patch("/{invoice_id}/payment", response_model=InvoiceOut)
async def record_payment(
    invoice_id: uuid.UUID,
    body:       PaymentIn,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_any_staff),
):
    inv = await _get_or_404(db, invoice_id, user)
    if inv.status == InvoiceStatus.CANCELLED:
        raise HTTPException(400, "Cannot record payment on cancelled invoice")

    inv.amount_paid       = round((inv.amount_paid or 0) + body.amount_paid, 2)
    inv.payment_method    = body.payment_method
    inv.payment_reference = body.payment_reference or inv.payment_reference
    inv.amount_due        = round(inv.total_amount - inv.amount_paid, 2)

    if inv.amount_due <= 0:
        inv.status = InvoiceStatus.PAID
    else:
        inv.status = InvoiceStatus.PARTIALLY_PAID

    await db.commit()
    await db.refresh(inv, ["items", "patient", "doctor"])
    return _enrich_out(inv)


# ── PDF ────────────────────────────────────────────────────────────────────────

@router.get("/{invoice_id}/pdf")
async def download_pdf(
    invoice_id: uuid.UUID,
    format:     str        = Query("a4", pattern="^(a4|thermal)$"),
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_any_staff),
):
    inv = await _get_or_404(db, invoice_id, user)
    enriched = _enrich_out(inv)
    pdf_bytes = _generate_pdf(enriched, inv, format=format)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv.invoice_number}.pdf"'},
    )


def _generate_pdf(out: InvoiceOut, inv: Invoice, format: str = "a4") -> bytes:
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    except ImportError:
        raise HTTPException(500, "PDF generation requires reportlab. Run: pip install reportlab")

    buf = BytesIO()
    if format == "thermal":
        page_size = (80 * mm, 297 * mm)  # 80 mm wide thermal roll
    else:
        page_size = A4

    doc = SimpleDocTemplate(buf, pagesize=page_size,
                            rightMargin=10*mm, leftMargin=10*mm,
                            topMargin=10*mm, bottomMargin=10*mm)
    styles = getSampleStyleSheet()
    normal = styles["Normal"]
    bold   = ParagraphStyle("bold", parent=normal, fontName="Helvetica-Bold")
    right  = ParagraphStyle("right", parent=normal, alignment=TA_RIGHT)
    center = ParagraphStyle("center", parent=normal, alignment=TA_CENTER)

    story = []

    # Header
    story.append(Paragraph("DENTAL ARCHIVE", ParagraphStyle("clinic", parent=bold, fontSize=14, alignment=TA_CENTER)))
    story.append(Paragraph("TAX INVOICE", ParagraphStyle("title", parent=normal, fontSize=9, alignment=TA_CENTER)))
    story.append(Spacer(1, 4*mm))

    # Invoice meta
    meta = [
        ["Invoice No:", out.invoice_number, "Date:", str(out.invoice_date)],
        ["Patient:",    out.patient_name or "—", "Doctor:", out.doctor_name or "—"],
    ]
    if out.patient_phone:
        meta.append(["Phone:", out.patient_phone, "", ""])
    t_meta = Table(meta, colWidths=["20%", "30%", "20%", "30%"])
    t_meta.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 4*mm))

    # Line items
    item_data = [["#", "Description", "HSN/SAC", "Qty", "Rate (₹)", "GST", "Total (₹)"]]
    for i, item in enumerate(out.items, 1):
        gst_pct = item.cgst_rate + item.sgst_rate + item.igst_rate
        item_data.append([
            str(i),
            item.description,
            item.hsn_sac_code or "—",
            str(item.quantity),
            f"{item.unit_price:,.2f}",
            f"{gst_pct:.0f}%",
            f"{item.line_total:,.2f}",
        ])

    t_items = Table(item_data, colWidths=["5%", "35%", "10%", "7%", "15%", "10%", "18%"])
    t_items.setStyle(TableStyle([
        ("FONTSIZE",   (0, 0), (-1, -1), 8),
        ("FONTNAME",   (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, 0),  colors.black),
        ("TEXTCOLOR",  (0, 0), (-1, 0),  colors.white),
        ("ALIGN",      (3, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("LINEBELOW",  (0, 0), (-1, 0),  0.5, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(t_items)
    story.append(Spacer(1, 4*mm))

    # Totals
    totals = []
    if out.discount_amount > 0:
        totals.append(["Subtotal:", f"₹{out.subtotal:,.2f}"])
        totals.append(["Discount:", f"- ₹{out.discount_amount:,.2f}"])
    if out.cgst_amount > 0:
        totals.append([f"CGST:", f"₹{out.cgst_amount:,.2f}"])
    if out.sgst_amount > 0:
        totals.append([f"SGST:", f"₹{out.sgst_amount:,.2f}"])
    if out.igst_amount > 0:
        totals.append([f"IGST:", f"₹{out.igst_amount:,.2f}"])
    totals.append(["TOTAL:", f"₹{out.total_amount:,.2f}"])
    totals.append(["Amount Paid:", f"₹{out.amount_paid:,.2f}"])
    totals.append(["BALANCE DUE:", f"₹{out.amount_due:,.2f}"])

    t_totals = Table(totals, colWidths=["60%", "40%"])
    t_totals.setStyle(TableStyle([
        ("FONTSIZE",   (0, 0), (-1, -1), 9),
        ("ALIGN",      (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME",   (0, -3), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE",  (0, -3), (-1, -3), 0.5, colors.black),
        ("LINEABOVE",  (0, -1), (-1, -1), 0.5, colors.black),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(t_totals)

    if out.notes:
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph(f"Notes: {out.notes}", ParagraphStyle("notes", parent=normal, fontSize=7, textColor=colors.gray)))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("Thank you for choosing PDC.", ParagraphStyle("footer", parent=normal, fontSize=7, alignment=TA_CENTER, textColor=colors.gray)))

    doc.build(story)
    return buf.getvalue()


# ── Send email / SMS ───────────────────────────────────────────────────────────

@router.post("/{invoice_id}/send", response_model=InvoiceOut)
async def send_invoice(
    invoice_id: uuid.UUID,
    body:       SendInvoiceIn,
    db:         AsyncSession = Depends(get_db),
    user:       CurrentUser  = Depends(require_any_staff),
):
    inv = await _get_or_404(db, invoice_id, user)
    enriched = _enrich_out(inv)

    payment_link = f"{settings.FRONTEND_URL}/pay/{inv.invoice_number}"
    errors = []

    if body.channel in ("email", "both"):
        email_addr = body.email or enriched.patient_email
        if email_addr and settings.SMTP_USER:
            try:
                _send_email(email_addr, enriched, payment_link, inv)
            except Exception as e:
                logger.warning(f"Email send failed: {e}")
                errors.append(f"Email failed: {e}")
        elif not settings.SMTP_USER:
            errors.append("SMTP not configured (set SMTP_USER / SMTP_PASSWORD in .env)")

    if body.channel in ("sms", "both"):
        phone = body.phone or enriched.patient_phone
        if phone and settings.MSG91_AUTH_KEY:
            try:
                await _send_sms(phone, enriched, payment_link)
            except Exception as e:
                logger.warning(f"SMS send failed: {e}")
                errors.append(f"SMS failed: {e}")
        elif not settings.MSG91_AUTH_KEY:
            errors.append("SMS not configured (set MSG91_AUTH_KEY in .env)")

    # Mark as sent regardless (or raise if both channels failed)
    if inv.status == InvoiceStatus.DRAFT:
        inv.status = InvoiceStatus.SENT
        await db.commit()
        await db.refresh(inv, ["items", "patient", "doctor"])

    if errors and body.channel != "both":
        raise HTTPException(502, "; ".join(errors))

    return _enrich_out(inv)


def _send_email(to: str, out: InvoiceOut, payment_link: str, inv: Invoice) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Invoice {out.invoice_number} from PDC — ₹{out.total_amount:,.0f}"
    msg["From"]    = settings.EMAIL_FROM
    msg["To"]      = to

    body_html = f"""
    <html><body style="font-family:Arial,sans-serif;color:#333">
      <h2 style="color:#000">Your Invoice</h2>
      <p>Dear {out.patient_name},</p>
      <p>Please find your invoice details below:</p>
      <table style="border-collapse:collapse;width:100%;max-width:500px">
        <tr><td style="padding:6px 0;border-bottom:1px solid #eee"><b>Invoice No</b></td><td style="padding:6px 0;border-bottom:1px solid #eee">{out.invoice_number}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #eee"><b>Date</b></td><td style="padding:6px 0;border-bottom:1px solid #eee">{out.invoice_date}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #eee"><b>Doctor</b></td><td style="padding:6px 0;border-bottom:1px solid #eee">{out.doctor_name}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #eee"><b>Total</b></td><td style="padding:6px 0;border-bottom:1px solid #eee">₹{out.total_amount:,.2f}</td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #eee"><b>Amount Paid</b></td><td style="padding:6px 0;border-bottom:1px solid #eee">₹{out.amount_paid:,.2f}</td></tr>
        <tr><td style="padding:6px 0"><b>Balance Due</b></td><td style="padding:6px 0;font-weight:bold;color:#c00">₹{out.amount_due:,.2f}</td></tr>
      </table>
      {"" if out.amount_due <= 0 else f'<p style="margin-top:20px"><a href="{payment_link}" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;display:inline-block">Pay Online</a></p>'}
      <p style="margin-top:24px;color:#888;font-size:12px">PDC · Thank you for your trust.</p>
    </body></html>"""

    msg.attach(MIMEText(body_html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.sendmail(settings.EMAIL_FROM, [to], msg.as_string())


async def _send_sms(phone: str, out: InvoiceOut, payment_link: str) -> None:
    """Send SMS via MSG91 API (Indian SMS gateway)."""
    # Normalize to E.164 for India
    ph = phone.strip().lstrip("+")
    if not ph.startswith("91") and len(ph) == 10:
        ph = "91" + ph

    message = (
        f"Dear {out.patient_name}, your invoice {out.invoice_number} "
        f"from PDC is ₹{out.total_amount:,.0f}. "
        f"Balance due: ₹{out.amount_due:,.0f}. "
        f"Pay: {payment_link}"
    )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.msg91.com/api/v5/flow/",
            json={
                "template_id": settings.MSG91_TEMPLATE_ID,
                "sender": settings.MSG91_SENDER_ID,
                "short_url": "1",
                "mobiles": ph,
                "VAR1": out.patient_name,
                "VAR2": out.invoice_number,
                "VAR3": str(int(out.amount_due)),
                "VAR4": payment_link,
            },
            headers={"authkey": settings.MSG91_AUTH_KEY, "Content-Type": "application/json"},
            timeout=10,
        )
        if resp.status_code != 200:
            raise RuntimeError(f"MSG91 error {resp.status_code}: {resp.text}")


# ── Internal helper ────────────────────────────────────────────────────────────

async def _get_or_404(db: AsyncSession, invoice_id: uuid.UUID, user: CurrentUser) -> Invoice:
    inv = (await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.items), selectinload(Invoice.patient), selectinload(Invoice.doctor))
        .where(Invoice.id == invoice_id, Invoice.clinic_id == user.clinic_id)
    )).scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv
