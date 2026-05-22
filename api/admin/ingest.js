import { getIngestionSnapshot } from "../lib/rag-knowledge.js";

function jsonResponse(response, status, payload) {
  response.status(status).json(payload);
}

function isAuthorized(request) {
  const secret = process.env.ASSISTANT_ADMIN_SECRET || process.env.ADMIN_INGEST_SECRET;

  if (!secret) {
    return {
      ok: false,
      status: 501,
      payload: {
        error: "Assistant admin ingestion is not configured.",
        hint: "Add ASSISTANT_ADMIN_SECRET in Vercel before enabling this endpoint.",
      },
    };
  }

  const authHeader = request.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerToken = request.headers["x-admin-secret"];

  if (bearerToken === secret || headerToken === secret) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    payload: { error: "Unauthorized ingestion request." },
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  const auth = isAuthorized(request);

  if (!auth.ok) {
    return jsonResponse(response, auth.status, auth.payload);
  }

  const snapshot = getIngestionSnapshot();

  return jsonResponse(response, 200, {
    message: "Assistant ingestion blueprint is ready.",
    mode: snapshot.vectorStore.configured ? "vector-store-ready" : "local-hybrid-index",
    nextStep: snapshot.vectorStore.configured
      ? "Connect the embedding upsert worker to this endpoint."
      : "Configure pgvector or Oracle 23ai Vector Search when you want persistent embeddings.",
    snapshot,
  });
}
