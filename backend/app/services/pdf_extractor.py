import tempfile
import os
import base64
import PyPDF2
from pdf2image import convert_from_path
from google import genai
from google.genai import types
from app.core.config import get_settings

settings = get_settings()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extracts text from PDF.
    1. Try PyPDF2 first (fast, for text-based PDFs)
    2. Fall back to Google Gemini Vision OCR (for scanned PDFs)
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        text = _extract_with_pypdf2(tmp_path)

        if len(text.strip()) < 100:
            print("PyPDF2 extracted little text, using Gemini Vision OCR...")
            text = _extract_with_gemini_vision(tmp_path)

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


def _extract_with_gemini_vision(pdf_path: str) -> str:
    """
    OCR using Google Gemini Vision.
    Converts each PDF page to image and extracts text.
    Better than pytesseract for tables, handwriting, complex layouts.
    """
    client = genai.Client(
        api_key=settings.google_api_key,
        http_options={"api_version": "v1"}
    )

    try:
        images = convert_from_path(pdf_path, dpi=200)
    except Exception as e:
        print(f"pdf2image failed: {e}, falling back to pytesseract")
        return _extract_with_pytesseract(pdf_path)

    full_text = ""

    for i, image in enumerate(images):
        # Save image to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as img_tmp:
            image.save(img_tmp.name, "JPEG")
            img_path = img_tmp.name

        try:
            with open(img_path, "rb") as f:
                img_bytes = f.read()

            # Send to Gemini Vision
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    types.Part.from_bytes(
                        data=img_bytes,
                        mime_type="image/jpeg"
                    ),
                    "Extract all text from this document page. Include all text exactly as it appears. Preserve formatting where possible."
                ]
            )

            page_text = response.text or ""
            full_text += f"\n{page_text}\n"
            print(f"✅ OCR page {i+1}/{len(images)}")

        except Exception as e:
            print(f"❌ Gemini Vision failed for page {i+1}: {e}")
        finally:
            os.unlink(img_path)

    return full_text


def _extract_with_pytesseract(pdf_path: str) -> str:
    """Fallback OCR using pytesseract."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
        text = ""
        images = convert_from_path(pdf_path, dpi=200)
        for image in images:
            text += pytesseract.image_to_string(image) + "\n"
        return text
    except Exception as e:
        print(f"pytesseract also failed: {e}")
        return ""