import { createSign } from "node:crypto";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const BUG_REPORTS_COLLECTION = "bugReports";

function jsonResponse(response, status, payload) {
  response.status(status).json(payload);
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ||
    (process.env.FIREBASE_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8")
      : "");

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: privateKey,
    };
  }

  throw new Error("Firebase service account credentials are not configured.");
}

function createServiceAccountJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const unsignedJwt = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: FIRESTORE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  }))}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(serviceAccount.private_key);

  return `${unsignedJwt}.${base64Url(signature)}`;
}

async function getGoogleAccessToken(serviceAccount) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: createServiceAccountJwt(serviceAccount),
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${await response.text()}`);
  }

  return (await response.json()).access_token;
}

function normalizePagePath(value) {
  const path = String(value || "").trim();
  return path.startsWith("/") && path.length <= 300 ? path : "/";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const description = String(body.description || "").trim();

    if (description.length < 10 || description.length > 3000) {
      return jsonResponse(response, 400, { error: "Please describe the issue in 10 to 3,000 characters." });
    }

    const serviceAccount = parseServiceAccount();
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const reportResponse = await fetch(
      `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents/${BUG_REPORTS_COLLECTION}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            description: { stringValue: description },
            pagePath: { stringValue: normalizePagePath(body.pagePath) },
            status: { stringValue: "new" },
            createdAt: { timestampValue: new Date().toISOString() },
          },
        }),
      },
    );

    if (!reportResponse.ok) {
      throw new Error(`Unable to save bug report: ${await reportResponse.text()}`);
    }

    return jsonResponse(response, 201, { ok: true });
  } catch (error) {
    return jsonResponse(response, 500, {
      error: error instanceof Error ? error.message : "Unable to save the bug report.",
    });
  }
}
