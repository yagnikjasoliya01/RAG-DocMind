from groq import Groq
from app.core.config import get_settings

settings = get_settings()

CONTEXT_PROMPT = """Here is a document:
<document>
{document}
</document>

Here is a chunk from this document:
<chunk>
{chunk}
</chunk>

Give a short 1-2 sentence context that situates this chunk within the document.
This context will be prepended to the chunk for better search retrieval.
Answer ONLY with the context, nothing else."""


def add_context_to_chunks(
    chunks: list[str],
    full_text: str,
    document_name: str
) -> list[str]:
    """
    Adds contextual information to each chunk.
    Falls back to original chunk if context generation fails.
    """
    client = Groq(api_key=settings.groq_api_key)

    # Truncate full text to fit context window
    truncated_doc = full_text[:8000] if len(full_text) > 8000 else full_text

    contextualized = []

    for i, chunk in enumerate(chunks):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "user",
                        "content": CONTEXT_PROMPT.format(
                            document=truncated_doc,
                            chunk=chunk
                        )
                    }
                ],
                max_tokens=100,
                temperature=0.1
            )

            context = response.choices[0].message.content.strip()
            contextualized_chunk = f"{context}\n\n{chunk}"
            contextualized.append(contextualized_chunk)

            print(f"✅ Contextualized chunk {i+1}/{len(chunks)}")

        except Exception as e:
            print(f"⚠️ Context generation failed for chunk {i+1}: {e}")
            contextualized.append(chunk)

    return contextualized