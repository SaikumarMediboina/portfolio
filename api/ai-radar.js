const MAX_FEED_ITEMS = 6;
const DEFAULT_LIMIT = 12;
const REQUEST_TIMEOUT_MS = 6500;
const AI_KEYWORDS = [
  "agent",
  "agents",
  "ai",
  "artificial intelligence",
  "benchmark",
  "developer",
  "eval",
  "evaluation",
  "gemini",
  "inference",
  "llm",
  "model",
  "models",
  "multimodal",
  "open source",
  "reasoning",
  "research",
  "safety",
  "tool",
  "tools",
];

const FEEDS = [
  {
    category: "Models",
    feedUrl: "https://openai.com/news/rss.xml",
    homepage: "https://openai.com/news/",
    source: "OpenAI",
    weight: 18,
  },
  {
    category: "Agents",
    feedUrl: "https://www.anthropic.com/news/rss.xml",
    homepage: "https://www.anthropic.com/news",
    source: "Anthropic",
    weight: 16,
  },
  {
    category: "Open Source",
    feedUrl: "https://huggingface.co/blog/feed.xml",
    homepage: "https://huggingface.co/blog",
    source: "Hugging Face",
    weight: 15,
  },
  {
    category: "Research",
    feedUrl: "https://deepmind.google/discover/blog/rss.xml",
    homepage: "https://deepmind.google/discover/blog/",
    source: "Google/DeepMind",
    weight: 13,
  },
  {
    category: "Infrastructure",
    feedUrl: "https://blogs.nvidia.com/blog/category/artificial-intelligence/feed/",
    homepage: "https://blogs.nvidia.com/blog/category/artificial-intelligence/",
    source: "NVIDIA",
    weight: 12,
  },
  {
    category: "Agents",
    feedUrl: "https://blog.langchain.com/rss/",
    homepage: "https://blog.langchain.com/",
    source: "LangChain",
    weight: 11,
  },
  {
    category: "Cloud AI",
    feedUrl: "https://aws.amazon.com/blogs/machine-learning/feed/",
    homepage: "https://aws.amazon.com/blogs/machine-learning/",
    source: "AWS ML",
    weight: 10,
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

function getKeywordScore(title, summary) {
  const haystack = `${title} ${summary}`.toLowerCase();

  return AI_KEYWORDS.reduce(
    (score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 4 : 0),
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
    getKeywordScore(item.title, item.summary) +
    (item.imageUrl ? 5 : 0)
  );
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
    const items = dedupeItems(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])))
      .map((item) => ({
        ...item,
        rank: scoreItem(item),
      }))
      .sort((left, right) => right.rank - left.rank)
      .slice(0, limit)
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
