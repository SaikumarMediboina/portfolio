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
        error: "Assistant webhook is not configured.",
        hint: "Add ASSISTANT_ADMIN_SECRET in Vercel before accepting webhook refreshes.",
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
    payload: { error: "Unauthorized webhook request." },
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

  const body =
    typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  const changedPath = typeof body.path === "string" ? body.path : "";
  const eventType = typeof body.event === "string" ? body.event : "content.updated";
  const snapshot = getIngestionSnapshot();

  return jsonResponse(response, 202, {
    accepted: true,
    event: eventType,
    indexVersion: snapshot.indexVersion,
    message: "Webhook accepted. The next ingestion run can refresh changed assistant chunks.",
    refreshScope: changedPath ? [changedPath] : ["site-content"],
  });
}
