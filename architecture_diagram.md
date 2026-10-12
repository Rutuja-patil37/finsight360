# FinSight 360 - System Architecture Diagram

This diagram represents the actual system architecture of your **FinSight 360** application (Next.js frontend, FastAPI backend, SQLite database, FAISS vector search, and Gemini GenAI orchestrator).

```mermaid
graph TD
    %% Define Styles
    classDef user fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff;
    classDef frontend fill:#ec4899,stroke:#db2777,stroke-width:2px,color:#fff;
    classDef backend fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff;
    classDef db fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff;
    classDef engine fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff;
    classDef rag fill:#eab308,stroke:#ca8a04,stroke-width:2px,color:#fff;
    classDef genai fill:#a855f7,stroke:#9333ea,stroke-width:2px,color:#fff;
    
    %% Users & Frontend Layer
    subgraph Users_Frontend ["Users & Frontend Layer"]
        U["👤 USER"]:::user
        FE["⚛️ FRONTEND (Next.js / TypeScript)"]:::frontend
    end

    %% Backend & Database Layer
    subgraph Backend_DB ["Backend & Database Layer"]
        BE["⚡ BACKEND API (FastAPI)"]:::backend
        DB[("💾 DATABASE (SQLite - finsight360.db)")]:::db
    end

    %% Financial Core Engine (Deterministic)
    subgraph Core_Engine ["⚙️ FINANCIAL CORE ENGINE (Deterministic Modules)"]
        direction LR
        DA["📊 Data Analysis (Pandas)"]:::engine
        FC["🧮 Financial Calculator"]:::engine
        GFC["🔍 Goal Feasibility Checker"]:::engine
        GCE["⚠️ Goal Conflict Engine"]:::engine
        SS["🔄 Scenario Simulator"]:::engine
        PG["⚖️ Plan Generator (Optimization)"]:::engine
    end

    %% RAG Pipeline Layer
    subgraph RAG_Pipeline ["📚 RAG PIPELINE (Financial Knowledge)"]
        direction LR
        KS["📄 Knowledge Sources (SEBI, RBI booklets)"]:::rag
        DP["⚙️ Document Processing (Chunking)"]:::rag
        EMB["🧠 Embeddings Generator (HuggingFace)"]:::rag
        VDB[("🗂️ Vector DB (FAISS - faiss-cpu)")]:::rag
        RT["🔍 Context Retriever (Top-K)"]:::rag
    end

    %% GenAI Orchestration Layer
    subgraph GenAI_Orchestrator ["🔮 GENAI ORCHESTRATOR (Gemini 1.5 Flash)"]
        direction TB
        IP["📥 Input to Gemini<br/>- User Query<br/>- Core Engine Outputs<br/>- RAG Context Chunk<br/>- User Profile & Preferences"]:::genai
        LLM["🤖 Gemini LLM<br/>- Intent Classification<br/>- Causal Reasoning<br/>- Tone Adaption (Risk-based)"]:::genai
        OP["📤 Output from Gemini<br/>- Narrative Explanations<br/>- Recommendations<br/>- Actionable Next Steps"]:::genai
    end

    %% Relationships & Flow
    U <-->|Chat & Form Inputs| FE
    FE <-->|REST API JSON Requests| BE
    BE <-->|Read / Write Profiles, Goals, Plans & History| DB
    
    %% Engine Flow
    BE -->|Raw Profiles & Goals| DA
    DA --> FC --> GFC --> GCE --> SS --> PG
    PG -->|Calculations Summary, Gaps, Delayed Timelines, Cut Rates| IP
    
    %% RAG Flow
    KS --> DP --> EMB --> VDB
    VDB --> RT
    RT -->|Top-K Context Chunks| IP
    BE -->|Query Vector Search| RT
    
    %% GenAI Processing Flow
    IP --> LLM --> OP
    OP -->|Personalized Advisor Response| BE
    BE -->|Guardrail Verification checks numbers against Core Engine output| FE

    %% Link Legend
    style Users_Frontend fill:transparent,stroke:#8b5cf6,stroke-width:1px,stroke-dasharray: 5 5;
    style Backend_DB fill:transparent,stroke:#10b981,stroke-width:1px,stroke-dasharray: 5 5;
    style Core_Engine fill:transparent,stroke:#f59e0b,stroke-width:1px,stroke-dasharray: 5 5;
    style RAG_Pipeline fill:transparent,stroke:#eab308,stroke-width:1px,stroke-dasharray: 5 5;
    style GenAI_Orchestrator fill:transparent,stroke:#a855f7,stroke-width:1px,stroke-dasharray: 5 5;
```

---

## 3. Legend & Flow Explanation

*   **Pink Layer (Frontend)**: Next.js React interface replacing the initial Streamlit framework. It handles user inputs (Forms, Charts, stress sliders) and renders markdown response blocks.
*   **Green Layer (Backend)**: FastAPI server orchestrating database CRUD, triggering vector searches, and running numerical checks.
*   **Blue Database**: SQLite backend storage (`finsight360.db`) replacing PostgreSQL, storing session data locally.
*   **Orange Engine (Finance Core)**: Python mathematical pipeline using pandas to check goal feasibility, conflict severity, and compute Tri-Plan variations.
*   **Yellow Engine (RAG Pipeline)**: Local document ingestion (RBI emergency funds, SEBI guidelines) stored inside a `FAISS` index.
*   **Purple Engine (GenAI Orchestration)**: The Gemini 1.5 Flash model acting as the system brain, digesting retrieved context + core math output to write guardrailed explanations.
