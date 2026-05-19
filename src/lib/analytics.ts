export type AnalyticsEventType =
  | "page_view"
  | "blog_open"
  | "saved_post"
  | "unsaved_post"
  | "ai_radar_open"
  | "newsletter_subscribe"
  | "assistant_question";

export type AnalyticsEventMetadata = {
  category?: string;
  path?: string;
  question?: string;
  slug?: string;
  source?: string;
  title?: string;
};

export type AnalyticsDashboardEvent = {
  createdAt?: string;
  label: string;
  path?: string;
  title?: string;
  type: AnalyticsEventType;
};

export type AnalyticsSnapshot = {
  configured: boolean;
  counters: Record<AnalyticsEventType, number>;
  events: AnalyticsDashboardEvent[];
  source: "api" | "local";
  updatedAt?: string;
};

export const ANALYTICS_EVENT_LABELS: Record<AnalyticsEventType, string> = {
  page_view: "Page views",
  blog_open: "Blog opens",
  saved_post: "Saved items",
  unsaved_post: "Unsaved items",
  ai_radar_open: "AI Radar opens",
  newsletter_subscribe: "Newsletter joins",
  assistant_question: "Assistant questions",
};

const ANALYTICS_ENDPOINT = "/api/analytics";
const ANALYTICS_SESSION_KEY = "portfolio_analytics_session_id";
const ANALYTICS_CACHE_KEY = "portfolio_analytics_snapshot";
const ANALYTICS_EVENT_TYPES = Object.keys(ANALYTICS_EVENT_LABELS) as AnalyticsEventType[];

function getEmptyCounters() {
  return ANALYTICS_EVENT_TYPES.reduce(
    (counters, type) => ({
      ...counters,
      [type]: 0,
    }),
    {} as Record<AnalyticsEventType, number>,
  );
}

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getAnalyticsSessionId() {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existingSessionId = window.localStorage.getItem(ANALYTICS_SESSION_KEY);

    if (existingSessionId) {
      return existingSessionId;
    }

    const nextSessionId = createSessionId();
    window.localStorage.setItem(ANALYTICS_SESSION_KEY, nextSessionId);

    return nextSessionId;
  } catch {
    return createSessionId();
  }
}

function getCurrentPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.hash}`;
}

function sanitizeMetadata(metadata: AnalyticsEventMetadata = {}) {
  const trimmedMetadata: AnalyticsEventMetadata = {};

  Object.entries(metadata).forEach(([key, value]) => {
    if (typeof value !== "string") {
      return;
    }

    const cleanValue = value.trim().slice(0, 180);

    if (cleanValue) {
      trimmedMetadata[key as keyof AnalyticsEventMetadata] = cleanValue;
    }
  });

  return trimmedMetadata;
}

function normalizeCounters(value: unknown) {
  const sourceCounters = value && typeof value === "object" ? value : {};
  const counters = getEmptyCounters();

  ANALYTICS_EVENT_TYPES.forEach((type) => {
    const count = Number((sourceCounters as Record<string, unknown>)[type]);
    counters[type] = Number.isFinite(count) && count > 0 ? count : 0;
  });

  return counters;
}

function normalizeEvents(value: unknown): AnalyticsDashboardEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((event): AnalyticsDashboardEvent | null => {
      if (!event || typeof event !== "object") {
        return null;
      }

      const eventRecord = event as Record<string, unknown>;
      const type = eventRecord.type;

      if (!ANALYTICS_EVENT_TYPES.includes(type as AnalyticsEventType)) {
        return null;
      }

      return {
        createdAt: typeof eventRecord.createdAt === "string" ? eventRecord.createdAt : undefined,
        label:
          typeof eventRecord.label === "string"
            ? eventRecord.label
            : ANALYTICS_EVENT_LABELS[type as AnalyticsEventType],
        path: typeof eventRecord.path === "string" ? eventRecord.path : undefined,
        title: typeof eventRecord.title === "string" ? eventRecord.title : undefined,
        type: type as AnalyticsEventType,
      };
    })
    .filter((event): event is AnalyticsDashboardEvent => Boolean(event))
    .slice(0, 12);
}

function cacheAnalyticsSnapshot(snapshot: AnalyticsSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ANALYTICS_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Analytics must never block the site experience.
  }
}

export function getCachedAnalyticsSnapshot(): AnalyticsSnapshot {
  if (typeof window === "undefined") {
    return {
      configured: false,
      counters: getEmptyCounters(),
      events: [],
      source: "local",
    };
  }

  try {
    const cachedSnapshot = window.localStorage.getItem(ANALYTICS_CACHE_KEY);

    if (!cachedSnapshot) {
      throw new Error("No cached analytics snapshot.");
    }

    const parsedSnapshot = JSON.parse(cachedSnapshot) as Partial<AnalyticsSnapshot>;

    return {
      configured: Boolean(parsedSnapshot.configured),
      counters: normalizeCounters(parsedSnapshot.counters),
      events: normalizeEvents(parsedSnapshot.events),
      source: parsedSnapshot.source === "api" ? "api" : "local",
      updatedAt:
        typeof parsedSnapshot.updatedAt === "string" ? parsedSnapshot.updatedAt : undefined,
    };
  } catch {
    return {
      configured: false,
      counters: getEmptyCounters(),
      events: [],
      source: "local",
    };
  }
}

function rememberLocalAnalyticsEvent(type: AnalyticsEventType, metadata: AnalyticsEventMetadata) {
  const currentSnapshot = getCachedAnalyticsSnapshot();
  const nextSnapshot: AnalyticsSnapshot = {
    configured: currentSnapshot.configured,
    counters: {
      ...currentSnapshot.counters,
      [type]: currentSnapshot.counters[type] + 1,
    },
    events: [
      {
        createdAt: new Date().toISOString(),
        label: ANALYTICS_EVENT_LABELS[type],
        path: metadata.path || getCurrentPath(),
        title: metadata.title,
        type,
      },
      ...currentSnapshot.events,
    ].slice(0, 12),
    source: currentSnapshot.source,
    updatedAt: new Date().toISOString(),
  };

  cacheAnalyticsSnapshot(nextSnapshot);
}

export function trackAnalyticsEvent(type: AnalyticsEventType, metadata: AnalyticsEventMetadata = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const cleanMetadata = {
    ...sanitizeMetadata(metadata),
    path: metadata.path?.trim() || getCurrentPath(),
  };
  const payload = JSON.stringify({
    metadata: cleanMetadata,
    sessionId: getAnalyticsSessionId(),
    type,
  });

  rememberLocalAnalyticsEvent(type, cleanMetadata);

  try {
    if ("sendBeacon" in navigator) {
      const sent = navigator.sendBeacon(
        ANALYTICS_ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      );

      if (sent) {
        return;
      }
    }

    void fetch(ANALYTICS_ENDPOINT, {
      body: payload,
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // The local cache already captured the interaction.
  }
}

export async function loadAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const fallbackSnapshot = getCachedAnalyticsSnapshot();

  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Analytics endpoint unavailable.");
    }

    const data = (await response.json()) as Partial<AnalyticsSnapshot>;
    const snapshot: AnalyticsSnapshot = {
      configured: Boolean(data.configured),
      counters: normalizeCounters(data.counters),
      events: normalizeEvents(data.events),
      source: data.configured ? "api" : "local",
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : fallbackSnapshot.updatedAt,
    };

    if (!data.configured && fallbackSnapshot.events.length) {
      snapshot.counters = fallbackSnapshot.counters;
      snapshot.events = fallbackSnapshot.events;
    }

    cacheAnalyticsSnapshot(snapshot);

    return snapshot;
  } catch {
    return fallbackSnapshot;
  }
}
