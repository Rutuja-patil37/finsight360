from pathlib import Path
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import json


# ==========================================
# 1. PROJECT PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

VECTOR_STORE_DIR = BASE_DIR / "vector_store"

FAISS_INDEX_PATH = VECTOR_STORE_DIR / "finance.index"

METADATA_PATH = VECTOR_STORE_DIR / "metadata.json"


# ==========================================
# 2. EMBEDDING MODEL
# ==========================================

EMBEDDING_MODEL = "all-MiniLM-L6-v2"


# ==========================================
# 3. LOAD SAVED FAISS DATABASE
# ==========================================

if not FAISS_INDEX_PATH.exists():
    raise FileNotFoundError(
        "FAISS database not found. "
        "Run build_knowledge_base.py first."
    )

if not METADATA_PATH.exists():
    raise FileNotFoundError(
        "Metadata file not found. "
        "Run build_knowledge_base.py first."
    )


index = faiss.read_index(
    str(FAISS_INDEX_PATH)
)


# ==========================================
# 4. LOAD METADATA
# ==========================================

with open(
    METADATA_PATH,
    "r",
    encoding="utf-8"
) as file:
    metadata = json.load(file)


# ==========================================
# 5. LOAD EMBEDDING MODEL
# ==========================================

model = SentenceTransformer(
    EMBEDDING_MODEL
)


# ==========================================
# 6. RETRIEVE RELEVANT CONTEXT
# ==========================================

def retrieve_context(question, top_k=3):

    # Convert ONLY the user's question
    # into an embedding

    query_embedding = model.encode(
        [question]
    )

    query_embedding = np.array(
        query_embedding
    ).astype("float32")


    # Search the already-created FAISS index

    distances, indices = index.search(
        query_embedding,
        top_k
    )


    results = []

    for distance, idx in zip(
        distances[0],
        indices[0]
    ):

        if idx == -1:
            continue

        results.append({
            "source": metadata[idx]["source"],
            "page": metadata[idx]["page"],
            "distance": float(distance),
            "text": metadata[idx]["text"]
        })


    return results


# ==========================================
# 7. ASK USER FOR QUESTION
# ==========================================

if __name__ == "__main__":

    while True:

        question = input(
            "\nAsk your financial question "
            "(type 'exit' to quit): "
        )


        if question.lower() == "exit":
            break


        results = retrieve_context(
            question,
            top_k=3
        )


        # ==================================
        # CREATE JSON OUTPUT
        # ==================================

        output = {
            "query": question,
            "results": results
        }


        # Print JSON

        print(
            json.dumps(
                output,
                indent=4,
                ensure_ascii=False
            )
        )


        # Save JSON output

        output_path = BASE_DIR / "rag_output.json"

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                output,
                file,
                indent=4,
                ensure_ascii=False
            )