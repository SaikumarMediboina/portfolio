import { createHash, createSign, randomUUID } from "node:crypto";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANALYTICS_EVENTS_COLLECTION = "analytics_events";
const ANALYTICS_SUMMARY_COLLECTION = "analytics_summary";
const ANALYTICS_SUMMARY_DOCUMENT = "site";
const EVENT_TYPES = [
  "page_view",
  "blog_open",
  "saved_post",
  "unsaved_post",
  "ai_radar_open",
  "newsletter_subscribe",
  "assistant_question",
];
const EVENT_LABELS = {
  page_view: "Page view",
  blog_open: "Blog opened",
  saved_post: "Saved item",
  unsaved_post: "Unsaved item",
  ai_radar_open: "AI Radar opened",
  newsletter_subscribe: "Newsletter joined",
  assistant_question: "Assistant question",
};

function jsonResponse(response, status, payload) {
  response.status(status).json(payload);
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\
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

function getEmptyCounters() {
  return EVENT_TYPES.reduce(
    (counters, type) => ({
      ...counters,
      [type]: 0,
    }),
    {},
  );
}

function sanitizeText(value, limit = 180) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function sanitizeMetadata(metadata) {
  const source = metadata && typeof metadata === "object" ? metadata : {};

  return {
    category: sanitizeText(source.category, 80),
    path: sanitizeText(source.path || "/", 160),
    question: sanitizeText(source.question, 160),
    slug: sanitizeText(source.slug, 120),
    source: sanitizeText(source.source, 80),
    title: sanitizeText(source.title, 180),
  };
}

function getSessionHash(sessionId) {
  return createHash("sha256")
    .update(String(sessionId || "anonymous"))
    .digest("hex")
    .slice(0, 24);
}

function getStringField(value) {
  const cleanValue = sanitizeText(value);

  return cleanValue ? { stringValue: cleanValue } : { nullValue: "NULL_VALUE" };
}

function getEventFields(event) {
  return {
    category: getStringField(event.metadata.category),
    createdAt: { timestampValue: event.createdAt },
    label: { stringValue: EVENT_LABELS[event.type] },
    path: getStringField(event.metadata.path),
    question: getStringField(event.metadata.question),
    sessionHash: { stringValue: event.sessionHash },
    slug: getStringField(event.metadata.slug),
    source: getStringField(event.metadata.source),
    title: getStringField(event.metadata.title),
    type: { stringValue: event.type },
  };
}

function readFirestoreString(fields, name) {
  const field = fields?.[name];

  if (!field || field.nullValue) {
    return "";
  }

  return String(field.stringValue || field.timestampValue || "");
}

function readFirestoreInteger(fields, name) {
  const value = Number(fields?.[name]?.integerValue || fields?.[name]?.doubleValue || 0);

  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeFirestoreEvent(row) {
  const fields = row?.document?.fields;
  const type = readFirestoreString(fields, "type");

  if (!EVENT_TYPES.includes(type)) {
    return null;
  }

  return {
    createdAt: readFirestoreString(fields, "createdAt"),
    label: readFirestoreString(fields, "label") || EVENT_LABELS[type],
    path: readFirestoreString(fields, "path"),
    title: readFirestoreString(fields, "title") || readFirestoreString(fields, "question"),
    type,
  };
}

async function commitAnalyticsEvent({ accessToken, event, projectId }) {
  const eventId = `${Date.now()}_${randomUUID()}`;
  const now = new Date().toISOString();
  const summaryDocument = `projects/${projectId}/databases/(default)/documents/${ANALYTICS_SUMMARY_COLLECTION}/${ANALYTICS_SUMMARY_DOCUMENT}`;
  const eventDocument = `projects/${projectId}/databases/(default)/documents/${ANALYTICS_EVENTS_COLLECTION}/${eventId}`;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: eventDocument,
              fields: getEventFields(event),
            },
          },
          {
            update: {
              name: summaryDocument,
              fields: {
                lastEventLabel: { stringValue: EVENT_LABELS[event.type] },
                lastEventPath: getStringField(event.metadata.path),
                updatedAt: { timestampValue: now },
              },
            },
            updateMask: {
              fieldPaths: ["lastEventLabel", "lastEventPath", "updatedAt"],
            },
            updateTransforms: [
              {
                fieldPath: event.type,
                increment: { integerValue: "1" },
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore analytics write failed: ${detail}`);
  }
}

async function getAnalyticsSummary({ accessToken, projectId }) {
  const counters = getEmptyCounters();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${ANALYTICS_SUMMARY_COLLECTION}/${ANALYTICS_SUMMARY_DOCUMENT}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.status === 404) {
    return {
      counters,
      updatedAt: "",
    };
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore analytics summary failed: ${detail}`);
  }

  const summary = await response.json();
  EVENT_TYPES.forEach((type) => {
    counters[type] = readFirestoreInteger(summary.fields, type);
  });

  return {
    counters,
    updatedAt: readFirestoreString(summary.fields, "updatedAt"),
  };
}

async function getRecentAnalyticsEvents({ accessToken, projectId }) {
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
          from: [{ collectionId: ANALYTICS_EVENTS_COLLECTION }],
          limit: 12,
          orderBy: [
            {
              direction: "DESCENDING",
              field: { fieldPath: "createdAt" },
            },
          ],
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Firestore analytics events failed: ${detail}`);
  }

  const rows = await response.json();

  return rows
    .map(normalizeFirestoreEvent)
    .filter(Boolean);
}

async function handleGet(response) {
  try {
    const serviceAccount = parseServiceAccount();
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const [summary, events] = await Promise.all([
      getAnalyticsSummary({
        accessToken,
        projectId: serviceAccount.project_id,
      }),
      getRecentAnalyticsEvents({
        accessToken,
        projectId: serviceAccount.project_id,
      }),
    ]);

    return jsonResponse(response, 200, {
      configured: true,
      counters: summary.counters,
      events,
      updatedAt: summary.updatedAt,
    });
  } catch (error) {
    return jsonResponse(response, 200, {
      configured: false,
      counters: getEmptyCounters(),
      error: error instanceof Error ? error.message : "Analytics is unavailable.",
      events: [],
    });
  }
}

async function handlePost(request, response) {
  try {
    const body =
      typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const type = sanitizeText(body.type, 40);

    if (!EVENT_TYPES.includes(type)) {
      return jsonResponse(response, 400, { error: "Unsupported analytics event." });
    }

    const serviceAccount = parseServiceAccount();
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const event = {
      createdAt: new Date().toISOString(),
      metadata: sanitizeMetadata(body.metadata),
      sessionHash: getSessionHash(body.sessionId),
      type,
    };

    await commitAnalyticsEvent({
      accessToken,
      event,
      projectId: serviceAccount.project_id,
    });

    return jsonResponse(response, 202, { ok: true });
  } catch (error) {
    return jsonResponse(response, 202, {
      ok: false,
      error: error instanceof Error ? error.message : "Analytics event was not stored.",
    });
  }
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    return handleGet(response);
  }

  if (request.method === "POST") {
    return handlePost(request, response);
  }

  response.setHeader("Allow", "GET, POST");
  return jsonResponse(response, 405, { error: "Method not allowed." });
}
