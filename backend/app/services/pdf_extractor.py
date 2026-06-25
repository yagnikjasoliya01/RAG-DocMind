import tempfile
import os
from pathlib import Path

import PyPDF2
from PIL import Image
import pytesseract
from pdf2image import convert_from_path


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts text from PDF.
    Tries PyPDF2 first (fast).
    Falls back to OCR if no text found (scanned PDFs).
    """
    # Write bytes to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        text = _extract_with_pypdf2(tmp_path)

        # If less than 100 chars extracted, probably scanned — use OCR
        if len(text.strip()) < 100:
            text = _extract_with_ocr(tmp_path)

        return text.strip()

    finally:
        os.unlink(tmp_path)


def _extract_with_pypdf2(pdf_path: str) -> str:
    """Fast text extraction for text-based PDFs."""
    text = ""
    with open(pdf_path, "rb") as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def _extract_with_ocr(pdf_path: str) -> str:
    """OCR extraction for scanned PDFs using pytesseract."""
    text = ""
    images = convert_from_path(pdf_path, dpi=200)
    for image in images:
        page_text = pytesseract.image_to_string(image)
        text += page_text + "\n"
    return text