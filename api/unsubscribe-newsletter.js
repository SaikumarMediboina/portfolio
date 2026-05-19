import { createHash, createHmac, createSign } from "node:crypto";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SUBSCRIBERS_COLLECTION = "subscribers";

function htmlResponse(response, status, title, message) {
  response
    .status(status)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #111827;
              color: #f7f3ed;
              font-family: Arial, sans-serif;
            }

            main {
              width: min(520px, calc(100vw - 32px));
              padding: 28px;
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 24px;
              background: rgba(255, 255, 255, 0.06);
            }

            h1 {
              margin: 0 0 12px;
              font-size: 30px;
              line-height: 1.15;
            }

            p {
              margin: 0 0 22px;
              color: #c7d0dc;
              line-height: 1.7;
            }

            a {
              display: inline-flex;
              padding: 12px 16px;
              border-radius: 999px;
              background: #ff9966;
              color: #111827;
              font-weight: 700;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(message)}</p>
            <a href="/">Back to portfolio</a>
          </main>
        </body>
      </html>`);
}

function jsonResponse(response, status, payload) {
  response.status(status).json(payload);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function unsubscribeNewsletterSubscriber({ accessToken, email, projectId }) {
  const documentId = getEmailSubscriberId(email);
  const now = new Date().toISOString();
  const updateMask = ["subscribed", "updatedAt", "unsubscribedAt"]
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
          subscribed: { booleanValue: false },
          updatedAt: { timestampValue: now },
          unsubscribedAt: { timestampValue: now },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Unable to unsubscribe: ${detail}`);
  }
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method || "")) {
    response.setHeader("Allow", "GET, POST");
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  try {
    const requestBody =
      request.method === "POST"
        ? typeof request.body === "string"
          ? JSON.parse(request.body || "{}")
          : request.body || {}
        : {};
    const email = normalizeEmail(request.query.email || requestBody.email);
    const token = String(request.query.token || requestBody.token || "").trim();
    const serviceAccount = parseServiceAccount();
    const expectedToken = createUnsubscribeToken(email, serviceAccount);

    if (!email || !token || token !== expectedToken) {
      if (request.method === "GET") {
        return htmlResponse(
          response,
          400,
          "Unsubscribe link expired",
          "This unsubscribe link could not be verified. Please reply to the update email and I will help clean it up.",
        );
      }

      return jsonResponse(response, 400, { error: "Invalid unsubscribe request." });
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);
    await unsubscribeNewsletterSubscriber({
      accessToken,
      email,
      projectId: serviceAccount.project_id,
    });

    if (request.method === "GET") {
      return htmlResponse(
        response,
        200,
        "You are unsubscribed",
        "No more newsletter emails will be sent to this address. The portfolio is still here whenever curiosity wanders back.",
      );
    }

    return jsonResponse(response, 200, { message: "You are unsubscribed." });
  } catch (error) {
    if (request.method === "GET") {
      return htmlResponse(
        response,
        500,
        "Unable to unsubscribe",
        error instanceof Error ? error.message : "Something went wrong while unsubscribing.",
      );
    }

    return jsonResponse(response, 500, {
      error: error instanceof Error ? error.message : "Unable to unsubscribe right now.",
    });
  }
}
