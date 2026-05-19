import { createHash, createHmac, createSign } from "node:crypto";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SUBSCRIBERS_COLLECTION = "subscribers";

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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getEmailSubscriberId(email) {
  const digest = createHash("sha256").update(email).digest("hex").slice(0, 40);

  return `email_${digest}`;
}

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"),
    );
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const privateKey =
    process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ||
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
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: serviceAccount.client_email,
    scope: FIRESTORE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(serviceAccount.private_key);

  return `${unsignedJwt}.${base64Url(signature)}`;
}

async function getGoogleAccessToken(serviceAccount) {
  const assertion = createServiceAccountJwt(serviceAccount);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token request failed: ${detail}`);
  }

  const data = await response.json();
  return data.access_token;
}

function createUnsubscribeToken(email, serviceAccount) {
  const secret = process.env.NEWSLETTER_SECRET || process.env.ADMIN_SEND_SECRET || serviceAccount.private_key;

  return createHmac("sha256", secret).update(email).digest("hex");
}

async function getNewsletterSubscriber({ accessToken, email, projectId }) {
  const documentId = getEmailSubscriberId(email);
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${SUBSCRIBERS_COLLECTION}/${documentId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to check newsletter subscriber: ${detail}`);
  }

  return response.json();
}

async function upsertNewsletterSubscriber({ accessToken, email, projectId, token }) {
  const documentId = getEmailSubscriberId(email);
  const now = new Date().toISOString();
  const updateFields = [
    "uid",
    "email",
    "name",
    "subscribed",
    "source",
    "unsubscribeToken",
    "updatedAt",
    "unsubscribedAt",
  ];
  const updateMask = updateFields
    .map((fieldPath) => `updateMask.fieldPaths=${encodeURIComponent(fieldPath)}`)
    .join("&");
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${SUBSCRIBERS_COLLECTION}/${documentId}?${updateMask}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: documentId },
          email: { stringValue: email },
          name: { stringValue: "Newsletter reader" },
          subscribed: { booleanValue: true },
          source: { stringValue: "portfolio-newsletter" },
          unsubscribeToken: { stringValue: token },
          updatedAt: { timestampValue: now },
          unsubscribedAt: { nullValue: "NULL_VALUE" },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to save newsletter subscriber: ${detail}`);
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  try {
    const body =
      typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const email = normalizeEmail(body.email);

    if (!isValidEmail(email)) {
      return jsonResponse(response, 400, { error: "Please enter a valid email address." });
    }

    const serviceAccount = parseServiceAccount();
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const unsubscribeToken = createUnsubscribeToken(email, serviceAccount);
    const existingSubscriber = await getNewsletterSubscriber({
      accessToken,
      email,
      projectId: serviceAccount.project_id,
    });
    const alreadySubscribed = Boolean(
      existingSubscriber?.fields?.subscribed?.booleanValue === true,
    );

    await upsertNewsletterSubscriber({
      accessToken,
      email,
      projectId: serviceAccount.project_id,
      token: unsubscribeToken,
    });

    return jsonResponse(response, 200, {
      alreadySubscribed,
      message: alreadySubscribed
        ? "You are already subscribed. The good notes have your address safe and sound."
        : "You are subscribed. The good engineering notes now know where to land.",
    });
  } catch (error) {
    return jsonResponse(response, 500, {
      error: error instanceof Error ? error.message : "Unable to subscribe right now.",
    });
  }
}
