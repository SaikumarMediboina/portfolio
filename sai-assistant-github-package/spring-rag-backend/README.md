# Sai's Assistant RAG Backend

Spring Boot backend for the portfolio assistant. The Vercel React site stays lightweight, while this service owns ingestion, retrieval, streaming chat, CORS, rate limiting, and the Oracle 23ai vector-ready persistence layer.

## How it runs without Oracle credentials

You cannot connect to Oracle without `ORACLE_JDBC_URL`, `ORACLE_USERNAME`, and `ORACLE_PASSWORD`.

So the backend starts in the `local` profile by default:

- Stores chunks in memory.
- Uses deterministic local placeholder embeddings.
- Lets us test `/api/admin/ingest`, `/api/chat`, and `/api/chat/stream`.
- Keeps the Oracle repository ready behind the `oracle` profile.

When Oracle 23ai Free is ready, set the env vars and run with `SPRING_PROFILES_ACTIVE=oracle`.

## Environment variables

```env
SPRING_PROFILES_ACTIVE=local
ASSISTANT_ADMIN_SECRET=local-dev-secret
ALLOWED_ORIGINS=http://localhost:5173,https://saikumarmediboina.com

ORACLE_JDBC_URL=
ORACLE_USERNAME=
ORACLE_PASSWORD=

OPENAI_API_KEY=
GEMINI_API_KEY=
LLM_PROVIDER=local
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GROQ_BASE_URL=https://api.groq.com/openai/v1
EMBEDDING_PROVIDER=local
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSION=1536
MIN_VECTOR_SIMILARITY=0.05
```

Use `LLM_PROVIDER=gemini` with `GEMINI_API_KEY` or `LLM_PROVIDER=groq` with `GROQ_API_KEY` for real grounded answer generation. Keep `EMBEDDING_PROVIDER=local` while you are validating deployment, then switch to `EMBEDDING_PROVIDER=gemini` and re-run ingestion when you want Gemini-generated vectors in Oracle.

Gemini embedding vectors are L2-normalized before storage/search. Oracle retrieval also returns cosine distance so reranking can combine vector similarity with title, category, source, and keyword intent boosts. `MIN_VECTOR_SIMILARITY` controls the no-answer cutoff for weak vector matches; set it to `0` to disable the cutoff while tuning.

## Local API flow

Start the backend:

```bash
mvn spring-boot:run
```

Ingest content:

```bash
curl -X POST http://localhost:8080/api/admin/ingest \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: local-dev-secret" \
  -d "{\"reset\":true}"
```

Ask a normal response:

```bash
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"local-1\",\"message\":\"What backend projects has Sai worked on?\"}"
```

Stream a response with SSE:

```bash
curl -N -X POST http://localhost:8080/api/chat/stream \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"local-1\",\"message\":\"Explain Sai's assistant architecture\"}"
```

## Oracle 23ai table

Run `src/main/resources/schema-oracle.sql` after creating your Oracle 23ai Free database user. The initial schema uses `VECTOR` without locking dimensions, so local placeholder embeddings and future 1536-dimensional OpenAI embeddings can both be supported while we are iterating.

## Production direction

1. `POST /api/admin/ingest` reads source pages and stores chunks.
2. `POST /api/chat/stream` embeds the question, retrieves nearest Oracle chunks, reranks by vector similarity plus metadata/category intent, builds a grounded prompt, and streams the answer.
3. CORS allows only the portfolio domains.
4. Rate limiting protects LLM credits.
5. Oracle profile stores chunks with `VECTOR` search.
