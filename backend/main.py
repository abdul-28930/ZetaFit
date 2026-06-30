import os
import logging

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

from invoice.generate import generate_invoice_for_payment

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zetafit-backend")

FASTAPI_SECRET = os.getenv("FASTAPI_SECRET")

app = FastAPI(title="ZetaFit Backend Services")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_secret(authorization: Optional[str]):
    if not FASTAPI_SECRET:
        logger.warning("FASTAPI_SECRET not set - skipping auth check (DEV ONLY)")
        return
    expected = "Bearer " + FASTAPI_SECRET
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class GenerateInvoiceRequest(BaseModel):
    payment_id: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "zetafit-backend"}


@app.post("/api/invoice/generate")
def generate_invoice(body: GenerateInvoiceRequest, authorization: Optional[str] = Header(default=None)):
    verify_secret(authorization)
    try:
        result = generate_invoice_for_payment(body.payment_id)
        logger.info("Invoice generated for payment " + body.payment_id + ": " + result["invoice_number"])
        return {"success": True, **result}
    except ValueError as e:
        logger.error("Invoice generation failed for " + body.payment_id + ": " + str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Unexpected error generating invoice for " + body.payment_id)
        raise HTTPException(status_code=500, detail="Invoice generation failed: " + str(e))
