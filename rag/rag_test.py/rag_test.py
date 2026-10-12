from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import os


# ==========================================
# 1. PATH TO DOCUMENTS FOLDER
# ==========================================

documents_folder = r"C:\Users\vaibhavi.LAPTOP-954HL5HJ\Desktop\rag\documents"


# ==========================================
# 2. READ ALL PDF FILES FROM DOCUMENTS FOLDER
# ==========================================

all_documents = []

for filename in os.listdir(documents_folder):

    # Read only PDF files
    if filename.lower().endswith(".pdf"):

        pdf_path = os.path.join(documents_folder, filename)

        reader = PdfReader(pdf_path)

        document_text = ""

        # Extract text from every page
        for page in reader.pages:

            page_text = page.extract_text()

            if page_text:
                document_text += page_text + "\n"

        # Save text and source PDF name
        all_documents.append({
            "source": filename,
            "text": document_text
        })


# ==========================================
# 3. SPLIT DOCUMENTS INTO CHUNKS
# ==========================================

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

chunks = []
sources = []

for document in all_documents:

    document_chunks = text_splitter.split_text(
        document["text"]
    )

    for chunk in document_chunks:

        chunks.append(chunk)
        sources.append(document["source"])


# ==========================================
# 4. CREATE EMBEDDINGS
# ==========================================

model = SentenceTransformer("all-MiniLM-L6-v2")

embeddings = model.encode(chunks)

embeddings = np.array(embeddings).astype("float32")


# ==========================================
# 5. CREATE FAISS VECTOR DATABASE
# ==========================================

dimension = embeddings.shape[1]

index = faiss.IndexFlatL2(dimension)

index.add(embeddings)


# ==========================================
# 6. FUNCTION TO RETRIEVE RELEVANT CONTEXT
# ==========================================

def retrieve_context(question, k=3):

    # Convert the user's question into an embedding
    question_embedding = model.encode([question])

    question_embedding = np.array(
        question_embedding
    ).astype("float32")

    # Search for the most relevant chunks
    distances, indices = index.search(
        question_embedding,
        k=k
    )

    retrieved_results = []

    for i in indices[0]:

        retrieved_results.append({
            "source": sources[i],
            "text": chunks[i]
        })

    return retrieved_results


# ==========================================
# 7. USER QUESTION
# ==========================================

while True:

    question = input("\nAsk your financial question: ")

    # Exit the program
    if question.lower() == "exit":
        break

    # Retrieve relevant information
    results = retrieve_context(question)

    print("\nRelevant financial information:\n")

    for result in results:

        print(f"Source: {result['source']}")
        print(result["text"])
        print("\n" + "-" * 50)