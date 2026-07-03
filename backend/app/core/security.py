import re
from fastapi import HTTPException

# Prompt injection patterns
INJECTION_PATTERNS = [
    r"ignore (previous|prior|above|all) instructions",
    r"forget (everything|all|previous)",
    r"you are now",
    r"act as (a |an )?(different|new|other)",
    r"system prompt",
    r"jailbreak",
    r"dan mode",
    r"pretend (you are|to be)",
    r"new personality",
    r"disregard (your|all|previous)",
]

# PII patterns to mask
PII_PATTERNS = {
    "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    "phone": r'\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
    "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
    "credit_card": r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
}


def check_prompt_injection(text: str) -> None:
    """
    Raises 400 if prompt injection detected.
    """
    text_lower = text.lower()

    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower):
            raise HTTPException(
                status_code=400,
                detail="Invalid input detected."
            )


def mask_pii(text: str) -> str:
    """
    Masks PII in text before logging.
    Does NOT mask in actual responses — only for logging.
    """
    masked = text
    for pii_type, pattern in PII_PATTERNS.items():
        masked = re.sub(pattern, f"[{pii_type.upper()}]", masked)
    return masked


def sanitize_input(text: str) -> str:
    """
    Sanitizes user input:
    - Strips leading/trailing whitespace
    - Limits length
    - Checks for injection
    """
    if not text or not text.strip():
        raise HTTPException(400, "Input cannot be empty")

    text = text.strip()

    if len(text) > 2000:
        raise HTTPException(400, "Input too long. Max 2000 characters.")

    check_prompt_injection(text)

    return text