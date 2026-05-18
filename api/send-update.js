import { createSign } from "node:crypto";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const DEFAULT_SITE_URL = "https://saikumarmediboina.com";

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

function getFieldValue(fields, fieldName) {
  const field = fields?.[fieldName];

  if (!field) {
    return "";
  }

  return field.stringValue || field.booleanValue || field.integerValue || "";
}

async function getSubscribedRecipients({ accessToken, projectId }) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "subscribers" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "subscribed" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore subscriber query failed: ${detail}`);
  }

  const rows = await response.json();
  const recipients = rows
    .map((row) => row.document?.fields)
    .filter(Boolean)
    .map((fields) => ({
      email: String(getFieldValue(fields, "email")).trim(),
      name: String(getFieldValue(fields, "name") || "Subscriber").trim(),
    }))
    .filter((recipient) => recipient.email);

  return Array.from(new Map(recipients.map((recipient) => [recipient.email, recipient])).values());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml({ title, summary, link, siteUrl }) {
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary).replace(/\n/g, "<br />");
  const safeLink = escapeHtml(link);
  const signInUrl = `${siteUrl.replace(/\/$/, "")}/signin`;

  return `
    <div style="margin:0;padding:0;background:#0f1724;color:#f7f3ed;font-family:Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:32px 22px;">
        <p style="margin:0 0 14px;color:#ff9966;font-size:12px;font-weight:700;letter-spacing:4px;text-transform:uppercase;">Portfolio Update</p>
        <h1 style="margin:0 0 18px;color:#ffffff;font-size:32px;line-height:1.15;">${safeTitle}</h1>
        <p style="margin:0 0 24px;color:#c7d0dc;font-size:16px;line-height:1.75;">${safeSummary}</p>
        ${
          safeLink
            ? `<a href="${safeLink}" style="display:inline-block;margin:0 0 28px;padding:13px 18px;border-radius:999px;background:#ff9966;color:#111827;font-weight:700;text-decoration:none;">Read the update</a>`
            : ""
        }
        <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.12);">
          <p style="margin:0;color:#98a6b8;font-size:13px;line-height:1.6;">
            You are receiving this because you subscribed to Sai Kumar Mediboina portfolio updates.
            You can unsubscribe anytime from <a href="${signInUrl}" style="color:#ffb06b;">subscriber preferences</a>.
          </p>
        </div>
      </div>
    </div>
  `;
}

function buildEmailText({ title, summary, link, siteUrl }) {
  const signInUrl = `${siteUrl.replace(/\/$/, "")}/signin`;

  return [
    title,
    "",
    summary,
    "",
    link ? `Read the update: ${link}` : "",
    "",
    `You can unsubscribe anytime from subscriber preferences: ${signInUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendEmail({ to, subject, html, text }) {
  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      reply_to: process.env.EMAIL_REPLY_TO || undefined,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail);
  }

  return response.json();
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  const adminSecret = process.env.ADMIN_SEND_SECRET;

  if (!adminSecret || request.headers["x-admin-secret"] !== adminSecret) {
    return jsonResponse(response, 401, { error: "Unauthorized." });
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return jsonResponse(response, 500, { error: "Email provider is not configured." });
  }

  try {
    const body =
      typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const title = String(body.title || "").trim();
    const summary = String(body.summary || "").trim();
    const link = String(body.link || "").trim();
    const testEmail = String(body.testEmail || "").trim();
    const siteUrl = String(process.env.SITE_URL || DEFAULT_SITE_URL).trim();

    if (!title || !summary) {
      return jsonResponse(response, 400, { error: "Title and message are required." });
    }

    const recipients = testEmail
      ? [{ email: testEmail, name: "Test recipient" }]
      : await (async () => {
          const serviceAccount = parseServiceAccount();
          const accessToken = await getGoogleAccessToken(serviceAccount);
          return getSubscribedRecipients({
            accessToken,
            projectId: serviceAccount.project_id,
          });
        })();

    if (!recipients.length) {
      return jsonResponse(response, 400, { error: "No subscribed recipients found." });
    }

    const subject = `New portfolio update: ${title}`;
    const html = buildEmailHtml({ title, summary, link, siteUrl });
    const text = buildEmailText({ title, summary, link, siteUrl });
    const results = [];

    for (const recipient of recipients) {
      try {
        const providerResponse = await sendEmail({
          to: recipient.email,
          subject,
          html,
          text,
        });

        results.push({
          email: recipient.email,
          ok: true,
          id: providerResponse.id,
        });
      } catch (error) {
        results.push({
          email: recipient.email,
          ok: false,
          error: error instanceof Error ? error.message : "Email send failed.",
        });
      }
    }

    const sent = results.filter((result) => result.ok).length;
    const failed = results.length - sent;

    return jsonResponse(response, 200, {
      mode: testEmail ? "test" : "subscribers",
      sent,
      failed,
      total: results.length,
      results,
    });
  } catch (error) {
    return jsonResponse(response, 500, {
      error: error instanceof Error ? error.message : "Unable to send update.",
    });
  }
}
