from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"


class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str


class QueryRequest(BaseModel):
    question: str
    document_ids: list[str] = []  # empty = search all docs


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    source_chunks: Optional[list] = None
    created_at: str