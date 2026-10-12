from pathlib import Path
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import json


# ==========================================
# 1. PROJECT PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

DOCUMENTS_DIR = BASE_DIR / "documents"
VECTOR_STORE_DIR = BASE_DIR / "vector_store"

FAISS_INDEX_PATH = VECTOR_STORE_DIR / "finance.index"
METADATA_PATH = VECTOR_STORE_DIR / "metadata.json"


# ==========================================
# 2. SETTINGS
# ==========================================

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


# ==========================================
# 3. FIND ALL PDF FILES
# ==========================================

pdf_files = list(DOCUMENTS_DIR.glob("*.pdf"))

if not pdf_files:
    raise FileNotFoundError(
        "No PDF files found inside the documents folder."
    )


# ==========================================
# 4. READ PDFs AND CREATE CHUNKS
# ==========================================

splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP
)

chunks = []

for pdf_path in pdf_files:

    print(f"Reading: {pdf_path.name}")

    reader = PdfReader(str(pdf_path))

    for page_number, page in enumerate(reader.pages, start=1):

        page_text = page.extract_text()

        if not page_text:
            continue

        page_chunks = splitter.split_text(page_text)

        for chunk in page_chunks:

            chunks.append({
                "text": chunk,
                "source": pdf_path.name,
                "page": page_number
            })


print(f"Total chunks created: {len(chunks)}")


# ==========================================
# 5. CREATE EMBEDDINGS
# ==========================================

print("Loading embedding model...")

model = SentenceTransformer(EMBEDDING_MODEL)

texts = [chunk["text"] for chunk in chunks]

print("Creating embeddings...")

embeddings = model.encode(texts)

embeddings = np.array(embeddings).astype("float32")


# ==========================================
# 6. CREATE FAISS INDEX
# ==========================================

dimension = embeddings.shape[1]

index = faiss.IndexFlatL2(dimension)

index.add(embeddings)


# ==========================================
# 7. CREATE VECTOR STORE FOLDER
# ==========================================

VECTOR_STORE_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ==========================================
# 8. SAVE FAISS INDEX
# ==========================================

faiss.write_index(
    index,
    str(FAISS_INDEX_PATH)
)


# ==========================================
# 9. SAVE METADATA
# ==========================================

with open(
    METADATA_PATH,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        chunks,
        file,
        ensure_ascii=False,
        indent=2
    )


# ==========================================
# 10. COMPLETE
# ==========================================

print("\nKnowledge base created successfully!")

print(f"Total vectors: {index.ntotal}")
print(f"FAISS index saved to: {FAISS_INDEX_PATH}")
print(f"Metadata saved to: {METADATA_PATH}")