import { createHash, timingSafeEqual } from "node:crypto";

function jsonResponse(response, status, payload) {
  response.status(status).json(payload);
}

function hashValue(value) {
  return createHash("sha256").update(String(value)).digest();
}

function normalizePassword(value) {
  return String(value || "").trim();
}

function verifyPassword(password) {
  const configuredHash = process.env.LEARN_WITH_ME_PASSWORD_SHA256;
  const configuredPassword = process.env.LEARN_WITH_ME_PASSWORD;

  if (!configuredHash && !configuredPassword) {
    return { configured: false, valid: false };
  }

  const expected = configuredHash
    ? Buffer.from(configuredHash.trim().toLowerCase(), "hex")
    : hashValue(configuredPassword);
  const received = hashValue(password);

  if (expected.length !== received.length) {
    return { configured: true, valid: false };
  }

  return { configured: true, valid: timingSafeEqual(expected, received) };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  try {
    const body =
      typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
    const password = normalizePassword(body.password);

    if (!password) {
      return jsonResponse(response, 400, { error: "Please enter the access password." });
    }

    const result = verifyPassword(password);

    if (!result.configured) {
      return jsonResponse(response, 503, {
        error: "Learn With Me access is not configured yet.",
      });
    }

    if (!result.valid) {
      return jsonResponse(response, 401, {
        error: "That password did not open the room. Please try again.",
      });
    }

    return jsonResponse(response, 200, { ok: true });
  } catch {
    return jsonResponse(response, 400, {
      error: "Unable to verify the password right now.",
    });
  }
}
