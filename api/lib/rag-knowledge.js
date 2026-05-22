const KNOWLEDGE_INDEX_VERSION = "2026-05-22-rag-v1";

const STOP_WORDS = new Set([
  "a",
  "about",
  "all",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "can",
  "do",
  "does",
  "for",
  "from",
  "give",
  "has",
  "have",
  "he",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "please",
  "show",
  "tell",
  "that",
  "the",
  "this",
  "to",
  "want",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

const SYNONYMS = {
  ai: ["llm", "semantic", "retrieval", "assistant", "intelligence"],
  article: ["blog", "post", "writing"],
  articles: ["blogs", "posts", "writing"],
  async: ["asynchronous", "executor", "parallel", "thread"],
  backend: ["spring", "java", "api", "microservices", "distributed"],
  blog: ["article", "post", "writing"],
  blogs: ["articles", "posts", "writing"],
  bot: ["assistant", "chatbot", "guide"],
  cache: ["caching", "redis", "coherence"],
  chatbot: ["assistant", "bot", "guide"],
  contact: ["email", "linkedin", "work"],
  database: ["oracle", "sql", "plsql", "stored", "procedure"],
  db: ["database", "oracle", "sql"],
  education: ["college", "degree", "cgpa"],
  experience: ["role", "oracle", "career", "work"],
  llm: ["ai", "model", "prompt", "gemini", "rag"],
  project: ["work", "portfolio", "system", "build"],
  projects: ["works", "portfolio", "systems", "builds"],
  radar: ["news", "ai", "latest", "updates"],
  rag: ["retrieval", "augmented", "generation", "assistant", "knowledge"],
  search: ["opensearch", "oracle", "text", "semantic"],
  stack: ["skills", "tools", "technology", "tech"],
  subscribe: ["newsletter", "updates", "email"],
  tech: ["stack", "skills", "tools", "technology"],
};

const SITE_KNOWLEDGE = [
  {
    id: "profile-summary",
    category: "profile",
    contentType: "page",
    title: "About Sai Kumar Mediboina",
    summary:
      "Sai Kumar Mediboina is a Software Application Engineer at Oracle, focused on backend platform engineering, distributed systems, search, performance optimization, and AI-enabled workflows.",
    details: [
      "Core strengths include Java, Spring Boot, REST APIs, microservices, Oracle, OpenSearch, Oracle Text, OCI, Kubernetes, semantic search, and LLM workflow patterns.",
      "His work focuses on problems where latency, scale, correctness, and explainability all matter together.",
    ],
    tags: ["Profile", "Backend", "Oracle", "AI Workflows"],
    url: "/about",
    priority: 12,
    updatedAt: "2026-05-22",
  },
  {
    id: "current-role",
    category: "experience",
    contentType: "portfolio",
    title: "Current role",
    summary:
      "Sai currently works as a Software Application Engineer at Oracle, Bangalore. His current work focuses on backend platform engineering, search architecture, performance optimization, and AI-enabled workflow design.",
    details: [
      "Previous role: Application Developer from August 2023 to May 2026.",
      "Current role started in May 2026.",
      "Experience includes high-throughput screening, matching, transaction filtering, real-time APIs, batch workloads, and hybrid search/scoring systems.",
    ],
    tags: ["Experience", "Oracle", "Role"],
    url: "/portfolio#experience",
    priority: 12,
    updatedAt: "2026-05-22",
  },
  {
    id: "matching-scoring-engine",
    category: "project",
    contentType: "portfolio",
    title: "Matching and Scoring Engine",
    summary:
      "A compliance screening platform for customer screening and transaction filtering, built to process millions of transactions against billions of records with high-throughput search and scoring.",
    details: [
      "Stack: Java, Spring Boot, OpenSearch, Oracle Text, OCI, Kubernetes.",
      "Delivered 100+ TPS with sub-2.5 second average latency across 23,000-message runs.",
      "Supported screening across eight simultaneous watchlists with zero-error volume runs.",
    ],
    tags: ["Spring Boot", "Search", "Oracle Text", "OpenSearch", "Kubernetes"],
    url: "/portfolio#work",
    priority: 11,
    updatedAt: "2026-05-22",
  },
  {
    id: "batch-performance",
    category: "project",
    contentType: "portfolio",
    title: "High-volume batch processing",
    summary:
      "Reduced a 5K transaction screening run from 2 hours 5 minutes to 3 minutes by improving indexing, eliminating repeated query patterns, and using controlled parallel processing.",
    details: [
      "The optimization produced a 97% batch latency reduction.",
      "Key techniques: targeted database indexing, aggregated query design, transaction-safe parallel processing, and hot-path tuning.",
    ],
    tags: ["Performance", "Batch", "SQL", "Parallel Processing"],
    url: "/blog/batch-screening-latency-97-percent",
    priority: 11,
    updatedAt: "2026-05-22",
  },
  {
    id: "realtime-optimization",
    category: "project",
    contentType: "portfolio",
    title: "Real-time screening optimization",
    summary:
      "Reduced real-time screening latency from roughly 2 seconds to about 300 milliseconds by redesigning synchronous work into parallel database queries and incremental result streaming.",
    details: [
      "The optimization focused on safe parallel processing, thread management, and removing JSON aggregation bottlenecks.",
      "The result was an 85% latency reduction without weakening backend correctness.",
    ],
    tags: ["Realtime", "Latency", "Thread Management", "Oracle"],
    url: "/portfolio#work",
    priority: 10,
    updatedAt: "2026-05-22",
  },
  {
    id: "search-migration",
    category: "project",
    contentType: "blog",
    title: "OpenSearch to Oracle Text migration",
    summary:
      "Sai migrated search-heavy screening workloads from OpenSearch toward Oracle Text to move matching closer to the data layer, reduce infrastructure overhead, and preserve production throughput.",
    details: [
      "The migration supported 100+ TPS with sub-2.5 second average latency.",
      "The architecture reduced data movement and simplified the search-heavy production path.",
    ],
    tags: ["OpenSearch", "Oracle Text", "Search Migration", "Architecture"],
    url: "/blog/opensearch-to-oracle-text-migration",
    priority: 10,
    updatedAt: "2026-05-22",
  },
  {
    id: "ai-relevance-blog",
    category: "blog",
    contentType: "blog",
    title: "AI relevance, semantic search, and LLM workflow ideas",
    summary:
      "A practical article about using deterministic rules for trust, semantic retrieval for recall, and LLM-assisted workflows for productivity in enterprise backend systems.",
    details: [
      "The article explains why pure AI replacement is risky for controlled workflows.",
      "The recommended pattern is hybrid: rules for auditability, semantic search for relevance, and LLMs for assisted productivity.",
    ],
    tags: ["Semantic Search", "AI Relevance", "LLM Workflows", "Hybrid Matching"],
    url: "/blog/ai-relevance-semantic-search-llm-workflows",
    priority: 10,
    updatedAt: "2026-05-22",
  },
  {
    id: "throughput-blog",
    category: "blog",
    contentType: "blog",
    title: "Backend throughput with database, cache, and async patterns",
    summary:
      "A blog on improving backend throughput by moving repeated data-heavy work closer to the database, caching frequent reads, and using controlled asynchronous execution.",
    details: [
      "Key techniques: stored procedures, duplicate suppression, hot-path indexes, selective caching, cache serialization optimization, and non-blocking inserts.",
      "The article also notes a 320ms client pacing observation that helped separate backend latency from client-side timing.",
    ],
    tags: ["Async Processing", "Caching", "Stored Procedures", "Backend Throughput"],
    url: "/blog/backend-throughput-database-cache-async-optimization",
    priority: 10,
    updatedAt: "2026-05-22",
  },
  {
    id: "sai-assistant-build",
    category: "active-build",
    contentType: "page",
    title: "Sai's Assistant architecture",
    summary:
      "Sai's Assistant is a hybrid website assistant: website knowledge base plus LLM, smart routing, source chips, action links, and safe fallback behavior.",
    details: [
      "The production direction separates offline ingestion from online chat.",
      "Offline pipeline: read site/source content, chunk it, embed it, and store vectors plus metadata.",
      "Online pipeline: classify the question, retrieve relevant chunks, build a grounded prompt, call the LLM, and return citations/actions.",
    ],
    tags: ["RAG", "Assistant", "LLM", "Architecture", "Vercel API"],
    url: "/active-builds/sai-assistant",
    priority: 12,
    updatedAt: "2026-05-22",
  },
  {
    id: "ai-radar",
    category: "feature",
    contentType: "page",
    title: "AI Radar",
    summary:
      "AI Radar is a ranked board of AI updates from public official sources such as OpenAI, Anthropic, Google DeepMind, Hugging Face, NVIDIA, LangChain, and AWS ML.",
    details: [
      "The feature highlights recent articles, links to original sources, and supports saved posts for signed-in readers.",
      "Ranking favors current buzz, official sources, recency, and practical builder relevance.",
    ],
    tags: ["AI News", "RSS", "Sources", "Saved Posts"],
    url: "/ai-radar",
    priority: 9,
    updatedAt: "2026-05-22",
  },
  {
    id: "saved-posts",
    category: "feature",
    contentType: "page",
    title: "Saved Posts",
    summary:
      "Saved Posts is a signed-in reader feature for saving blog posts and AI Radar articles into a personal reading list with tags.",
    details: [
      "Saved items stay consistent across blog pages, AI Radar, and the Saved Posts page.",
      "Visitors who are not signed in are prompted to sign in before saving.",
    ],
    tags: ["Saved Posts", "Reader", "Sign In"],
    url: "/saved-posts",
    priority: 8,
    updatedAt: "2026-05-22",
  },
  {
    id: "newsletter",
    category: "feature",
    contentType: "page",
    title: "Newsletter and content updates",
    summary:
      "The newsletter lets readers subscribe to occasional engineering updates about backend performance, search systems, AI workflows, and selected portfolio updates.",
    details: [
      "Readers can unsubscribe anytime.",
      "The system uses subscribed email preferences instead of collecting passwords.",
    ],
    tags: ["Newsletter", "Email Updates", "Subscription"],
    url: "/signin",
    priority: 8,
    updatedAt: "2026-05-22",
  },
  {
    id: "work-with-me",
    category: "contact",
    contentType: "page",
    title: "Work With Me",
    summary:
      "The Work With Me page is the professional contact path for backend engineering, search systems, performance tuning, cloud-native engineering, and practical AI product ideas.",
    details: [
      "Sai can be contacted through email or LinkedIn.",
      "Best-fit topics include backend platforms, search/matching systems, performance optimization, and LLM-assisted workflow ideas.",
    ],
    tags: ["Contact", "Collaboration", "LinkedIn", "Email"],
    url: "/work-with-me",
    priority: 9,
    updatedAt: "2026-05-22",
  },
  {
    id: "springops-ai",
    category: "active-build",
    contentType: "roadmap",
    title: "SpringOps AI distributed job scheduler",
    summary:
      "SpringOps AI is the planned backend learning project: a distributed job scheduler and orchestration platform powered by Spring Boot and AI-assisted failure analysis.",
    details: [
      "The system will include job submission, worker processing, retries, queueing, monitoring, dashboard updates, and AI failure explanations.",
      "It is designed to revise Spring Boot, MVC, JPA, transactions, security, scheduling, async executors, events, caching, Actuator, Resilience4j, messaging, testing, Docker, and Kubernetes.",
    ],
    tags: ["Spring Boot", "Distributed Systems", "Job Scheduler", "AI Ops"],
    url: "/active-builds",
    priority: 9,
    updatedAt: "2026-05-22",
  },
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+.#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(value) {
  const tokens = new Set();

  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .forEach((token) => {
      tokens.add(token);
      SYNONYMS[token]?.forEach((synonym) => tokens.add(synonym));
    });

  return Array.from(tokens);
}

function getDocumentText(document) {
  return [
    document.title,
    document.summary,
    ...(document.details || []),
    ...(document.tags || []),
    document.category,
    document.contentType,
  ].join(" ");
}

function countOccurrences(text, token) {
  if (!token) {
    return 0;
  }

  if (token.length <= 3) {
    return text.split(" ").filter((word) => word === token).length;
  }

  return text.includes(token) ? 1 : 0;
}

function scoreKnowledgeDocument(document, query, tokens) {
  const normalizedQuery = normalizeText(query);
  const tokenSet = new Set(tokens);
  const title = normalizeText(document.title);
  const summary = normalizeText(document.summary);
  const tags = normalizeText((document.tags || []).join(" "));
  const body = normalizeText(getDocumentText(document));

  let score = document.priority || 1;
  const hasProjectIntent = ["project", "projects", "work", "portfolio", "system", "systems"].some(
    (token) => tokenSet.has(token),
  );
  const hasPastWorkIntent = ["worked", "built", "delivered", "experience", "portfolio"].some(
    (token) => tokenSet.has(token),
  );

  if (hasProjectIntent && document.category === "project") {
    score += 28;
  }

  if (hasProjectIntent && document.category !== "project" && document.contentType !== "blog") {
    score -= 8;
  }

  if (hasPastWorkIntent && document.contentType === "roadmap") {
    score -= 22;
  }

  if (
    ["experience", "role", "career", "oracle"].some((token) => tokenSet.has(token)) &&
    document.category === "experience"
  ) {
    score += 16;
  }

  if (
    ["blog", "blogs", "article", "articles", "post", "posts"].some((token) =>
      tokenSet.has(token),
    ) &&
    document.contentType === "blog"
  ) {
    score += 14;
  }

  if (
    ["contact", "email", "linkedin", "collaboration", "work"].some((token) =>
      tokenSet.has(token),
    ) &&
    document.category === "contact"
  ) {
    score += 16;
  }

  if (
    ["assistant", "rag", "llm", "chatbot", "bot"].some((token) => tokenSet.has(token)) &&
    document.id === "sai-assistant-build"
  ) {
    score += 16;
  }

  if (title && normalizedQuery.includes(title)) {
    score += 18;
  }

  tokens.forEach((token) => {
    score += countOccurrences(title, token) * 7;
    score += countOccurrences(tags, token) * 5;
    score += countOccurrences(summary, token) * 3;
    score += countOccurrences(body, token) * 1.5;
  });

  return score;
}

function toContextItem(document, score) {
  return {
    category: document.category,
    contentType: document.contentType,
    details: document.details,
    id: document.id,
    links: [{ href: document.url, label: document.title }],
    score: Number(score.toFixed(2)),
    summary: document.summary,
    tags: document.tags,
    title: document.title,
    updatedAt: document.updatedAt,
    url: document.url,
  };
}

export function getKnowledgeIndexVersion() {
  return KNOWLEDGE_INDEX_VERSION;
}

export function retrieveSiteContext(query, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 8;
  const tokens = getTokens(query);

  if (!tokens.length) {
    return [];
  }

  return SITE_KNOWLEDGE.map((document) => ({
    document,
    score: scoreKnowledgeDocument(document, query, tokens),
  }))
    .filter((result) => result.score > (result.document.priority || 1))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((result) => toContextItem(result.document, result.score));
}

export function mergeContextItems(...groups) {
  const seen = new Set();
  const merged = [];

  groups.flat().forEach((item) => {
    if (!item) {
      return;
    }

    const key = normalizeText(`${item.id || ""} ${item.title || ""} ${item.url || item.links?.[0]?.href || ""}`);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push(item);
  });

  return merged;
}

export function createSemanticCacheKey(question, mode, contextItems = []) {
  const tokens = getTokens(question).sort().slice(0, 12).join("-");
  const sources = contextItems
    .slice(0, 5)
    .map((item) => normalizeText(item.id || item.title))
    .filter(Boolean)
    .join("|");

  return `${KNOWLEDGE_INDEX_VERSION}:${mode}:${tokens}:${sources}`;
}

export function getIngestionSnapshot() {
  const documents = SITE_KNOWLEDGE.map((document) => ({
    category: document.category,
    contentType: document.contentType,
    id: document.id,
    tags: document.tags,
    title: document.title,
    updatedAt: document.updatedAt,
    url: document.url,
    wordCount: getDocumentText(document).split(/\s+/).filter(Boolean).length,
  }));

  return {
    chunkCount: documents.length,
    documents,
    indexVersion: KNOWLEDGE_INDEX_VERSION,
    pipeline: {
      offline: [
        "Read website/source content",
        "Normalize and chunk text",
        "Attach metadata",
        "Create embeddings when a vector store is configured",
        "Store chunks for online retrieval",
      ],
      online: [
        "Classify question",
        "Retrieve relevant chunks",
        "Build grounded prompt",
        "Call LLM",
        "Return answer with citations and actions",
      ],
    },
    vectorStore: {
      configured: Boolean(
        process.env.VECTOR_DATABASE_URL ||
          process.env.POSTGRES_URL ||
          process.env.ORACLE_VECTOR_CONNECTION_STRING,
      ),
      provider:
        process.env.VECTOR_DATABASE_PROVIDER ||
        (process.env.ORACLE_VECTOR_CONNECTION_STRING
          ? "oracle-23ai-vector-search"
          : process.env.POSTGRES_URL
            ? "pgvector-ready"
            : "local-hybrid-index"),
    },
  };
}
