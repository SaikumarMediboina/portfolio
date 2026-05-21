const MAX_FEED_ITEMS = 6;
const DEFAULT_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 6500;
const HOT_TOPIC_WEIGHTS = [
  {
    keywords: ["agent", "agents", "agentic", "tool use", "mcp", "workflow", "workflows"],
    score: 30,
  },
  {
    keywords: ["reasoning", "benchmark", "benchmarks", "eval", "evaluation", "frontier"],
    score: 26,
  },
  {
    keywords: ["coding agent", "code assistant", "developer", "codex", "ide", "software engineering"],
    score: 24,
  },
  {
    keywords: ["multimodal", "voice", "audio", "video", "image", "vision", "realtime"],
    score: 20,
  },
  {
    keywords: ["inference", "latency", "serving", "throughput", "cost", "deployment"],
    score: 18,
  },
  {
    keywords: ["rag", "retrieval", "embedding", "embeddings", "vector", "semantic search"],
    score: 17,
  },
  {
    keywords: ["open source", "open-source", "model release", "fine-tuning", "fine tuning", "dataset"],
    score: 15,
  },
  {
    keywords: ["security", "governance", "enterprise", "safety", "privacy"],
    score: 13,
  },
  {
    keywords: ["gpu", "accelerated", "training", "cluster", "nvidia"],
    score: 12,
  },
];
const BUILDER_VALUE_KEYWORDS = [
  "api",
  "sdk",
  "framework",
  "guide",
  "build",
  "launch",
  "release",
  "model",
  "models",
  "platform",
  "production",
  "tool",
  "tools",
];
const MARKETING_HEAVY_KEYWORDS = [
  "award",
  "customer story",
  "partner",
  "partnership",
  "webinar",
  "event",
  "summit",
];

const FEEDS = [
  {
    category: "Models",
    feedUrl: "https://openai.com/news/rss.xml",
    homepage: "https://openai.com/news/",
    source: "OpenAI",
    weight: 22,
  },
  {
    category: "Agents",
    feedUrl: "https://www.anthropic.com/news/rss.xml",
    homepage: "https://www.anthropic.com/news",
    source: "Anthropic",
    weight: 21,
  },
  {
    category: "Open Source",
    feedUrl: "https://huggingface.co/blog/feed.xml",
    homepage: "https://huggingface.co/blog",
    source: "Hugging Face",
    weight: 16,
  },
  {
    category: "Research",
    feedUrl: "https://deepmind.google/discover/blog/rss.xml",
    homepage: "https://deepmind.google/discover/blog/",
    source: "Google/DeepMind",
    weight: 20,
  },
  {
    category: "Infrastructure",
    feedUrl: "https://blogs.nvidia.com/blog/category/artificial-intelligence/feed/",
    homepage: "https://blogs.nvidia.com/blog/category/artificial-intelligence/",
    source: "NVIDIA",
    weight: 15,
  },
  {
    category: "Agents",
    feedUrl: "https://blog.langchain.com/rss/",
    homepage: "https://blog.langchain.com/",
    source: "LangChain",
    weight: 14,
  },
  {
    category: "Cloud AI",
    feedUrl: "https://aws.amazon.com/blogs/machine-learning/feed/",
    homepage: "https://aws.amazon.com/blogs/machine-learning/",
    source: "AWS ML",
    weight: 12,
  },
];

function jsonResponse(response, status, payload) {
  response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
  response.status(status).json(payload);
}

function decodeHtmlEntities(value) {
  const text = String(value || "");
  const entityMap = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, entity) => entityMap[entity.toLowerCase()] || `&${entity};`);
}

function stripHtml(value) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(xml, tagName) {
  const escapedTag = tagName.replace(":", "\\:");
  const pattern = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, "i");
  const match = xml.match(pattern);

  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function getAttributeValue(xml, tagName, attributeName) {
  const escapedTag = tagName.replace(":", "\\:");
  const pattern = new RegExp(`<${escapedTag}[^>]*\\s${attributeName}=["']([^"']+)["'][^>]*>`, "i");
  const match = xml.match(pattern);

  return match ? decodeHtmlEntities(match[1]).trim() : "";
}

function getLinkValue(xml) {
  const atomHref = getAttributeValue(xml, "link", "href");

  if (atomHref) {
    return atomHref;
  }

  return getTagValue(xml, "link");
}

function getImageValue(xml) {
  const mediaThumbnail = getAttributeValue(xml, "media:thumbnail", "url");
  const mediaContent = getAttributeValue(xml, "media:content", "url");
  const enclosure = getAttributeValue(xml, "enclosure", "url");

  return mediaThumbnail || mediaContent || enclosure || "";
}

function splitFeedItems(xml) {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const atomEntries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];

  return rssItems.length ? rssItems : atomEntries;
}

function truncateText(value, maxLength) {
  const text = stripHtml(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function normalizeDate(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getTextHaystack(title, summary) {
  return `${title} ${summary}`.toLowerCase();
}

function getWeightedKeywordScore(title, summary, weightedGroups) {
  const haystack = getTextHaystack(title, summary);

  return weightedGroups.reduce((score, group) => {
    const matches = group.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));

    if (!matches.length) {
      return score;
    }

    return score + group.score + Math.min(matches.length - 1, 3) * 3;
  }, 0);
}

function getBuilderValueScore(title, summary) {
  const haystack = getTextHaystack(title, summary);

  return BUILDER_VALUE_KEYWORDS.reduce(
    (score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 4 : 0),
    0,
  );
}

function getMarketingPenalty(title, summary) {
  const haystack = `${title} ${summary}`.toLowerCase();

  return MARKETING_HEAVY_KEYWORDS.reduce(
    (penalty, keyword) => penalty + (haystack.includes(keyword.toLowerCase()) ? 6 : 0),
    0,
  );
}

function getRecencyScore(publishedAt) {
  const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 36e5);

  if (ageHours <= 24) {
    return 30;
  }

  if (ageHours <= 72) {
    return 22;
  }

  if (ageHours <= 168) {
    return 14;
  }

  if (ageHours <= 720) {
    return 7;
  }

  return 2;
}

function scoreItem(item) {
  return (
    item.sourceWeight +
    getRecencyScore(item.publishedAt) +
    getWeightedKeywordScore(item.title, item.summary, HOT_TOPIC_WEIGHTS) +
    getBuilderValueScore(item.title, item.summary) +
    (item.imageUrl ? 2 : 0) -
    getMarketingPenalty(item.title, item.summary)
  );
}

function applySourceDiversity(items, limit) {
  const selected = [];
  const remaining = [...items];
  const sourceCounts = new Map();

  while (selected.length < limit && remaining.length) {
    const selectedIndex = remaining.findIndex((item) => {
      const currentCount = sourceCounts.get(item.source) || 0;
      const topFiveLimit = selected.length < 5 ? 1 : 2;

      return currentCount < topFiveLimit;
    });
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const [nextItem] = remaining.splice(nextIndex, 1);

    selected.push(nextItem);
    sourceCounts.set(nextItem.source, (sourceCounts.get(nextItem.source) || 0) + 1);
  }

  return selected;
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(feed.feedUrl, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "User-Agent": "SaiKumarPortfolioAIRadar/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${feed.source} returned ${response.status}`);
    }

    const xml = await response.text();

    return splitFeedItems(xml)
      .slice(0, MAX_FEED_ITEMS)
      .map((itemXml) => {
        const title = truncateText(getTagValue(itemXml, "title"), 140);
        const summary = truncateText(
          getTagValue(itemXml, "description") ||
            getTagValue(itemXml, "summary") ||
            getTagValue(itemXml, "content:encoded"),
          170,
        );
        const href = getLinkValue(itemXml) || feed.homepage;
        const publishedAt = normalizeDate(
          getTagValue(itemXml, "pubDate") ||
            getTagValue(itemXml, "published") ||
            getTagValue(itemXml, "updated"),
        );
        const imageUrl = getImageValue(itemXml);

        return {
          category: feed.category,
          cadence: "Live source feed",
          href,
          imageUrl,
          isLive: true,
          publishedAt,
          source: feed.source,
          sourceWeight: feed.weight,
          summary,
          title,
          whyItMatters:
            summary ||
            "Fresh signal from a trusted AI source. Open the original article for the full context.",
        };
      })
      .filter((item) => item.title && item.href);
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeItems(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = `${item.source}-${item.href}`.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  const limit = Math.min(
    Math.max(Number.parseInt(request.query?.limit || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT, 1),
    18,
  );

  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const rankedItems = dedupeItems(
      results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    )
      .map((item) => ({
        ...item,
        rank: scoreItem(item),
      }))
      .sort((left, right) => right.rank - left.rank);
    const items = applySourceDiversity(rankedItems, limit)
      .map(({ sourceWeight, ...item }) => item);

    return jsonResponse(response, 200, {
      generatedAt: new Date().toISOString(),
      items,
      sourceCount: FEEDS.length,
    });
  } catch (error) {
    return jsonResponse(response, 500, {
      error: error instanceof Error ? error.message : "Unable to refresh AI Radar.",
      generatedAt: new Date().toISOString(),
      items: [],
      sourceCount: FEEDS.length,
    });
  }
}
