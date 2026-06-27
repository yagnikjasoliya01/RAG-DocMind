from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from app.services.embeddings import embed_query
from app.services.vector_store import search_chunks
from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """You are a helpful AI assistant that answers questions based on the user's uploaded documents.

Use ONLY the context provided below to answer the question. 
If the answer is not in the context, say "I couldn't find information about that in your documents."
Be concise, accurate, and helpful.

Context from documents:
{context}"""


def get_llm():
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=settings.groq_api_key,
        temperature=0,
        streaming=True
    )


def format_chat_history(messages: list[dict]) -> list:
    """Converts DB messages to LangChain message objects."""
    history = []
    for msg in messages:
        if msg["role"] == "human":
            history.append(HumanMessage(content=msg["content"]))
        else:
            history.append(AIMessage(content=msg["content"]))
    return history


def format_context(chunks: list[dict]) -> str:
    """Formats retrieved chunks into a context string."""
    if not chunks:
        return "No relevant documents found."

    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        doc_name = chunk["metadata"].get("document_name", "Unknown")
        content = chunk["content"]
        context_parts.append(f"[Source {i} - {doc_name}]\n{content}")

    return "\n\n---\n\n".join(context_parts)


async def get_rag_response(
    question: str,
    user_id: str,
    chat_history: list[dict],
    document_ids: list[str] = []
):
    """
    Full RAG pipeline:
    1. Embed question
    2. Search ChromaDB (filtered by user_id)
    3. Build prompt with context + history
    4. Stream response from Groq
    """
    # ── Step 1: Embed the question ────────────────────────────
    query_embedding = embed_query(question)

    # ── Step 2: Search ChromaDB ───────────────────────────────
    chunks = search_chunks(
        query_embedding=query_embedding,
        user_id=user_id,
        n_results=5,
        document_ids=document_ids
    )

    # ── Step 3: Format context ────────────────────────────────
    context = format_context(chunks)

    # ── Step 4: Build prompt ──────────────────────────────────
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder("chat_history"),
        ("human", "{question}"),
    ])

    # ── Step 5: Create chain ──────────────────────────────────
    llm = get_llm()
    chain = prompt | llm | StrOutputParser()

    history = format_chat_history(chat_history)

    # ── Step 6: Stream response ───────────────────────────────
    full_response = ""
    async for token in chain.astream({
        "context": context,
        "chat_history": history,
        "question": question,
    }):
        full_response += token
        yield token, chunks, full_response