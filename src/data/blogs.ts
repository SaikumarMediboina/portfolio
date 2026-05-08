export type BlogStat = {
  label: string;
  value: string;
};

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  readTime: string;
  summary: string;
  stats: BlogStat[];
  takeaways: string[];
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "batch-screening-latency-97-percent",
    title: "Cutting batch screening latency by 97 percent",
    category: "Performance",
    publishedAt: "April 2026",
    readTime: "5 min read",
    summary:
      "How indexing, batching, and parallel processing turned a slow compliance workflow into a much faster screening run.",
    stats: [
      { label: "Latency reduction", value: "97%" },
      { label: "Before", value: "2h 5m" },
      { label: "After", value: "3m" },
    ],
    takeaways: [
      "Targeted indexing on hot paths reduced repeated query costs.",
      "Aggregated queries replaced expensive N+1 access patterns.",
      "Parallel processing improved throughput without sacrificing correctness.",
    ],
    sections: [
      {
        heading: "The bottleneck",
        paragraphs: [
          "The batch screening path had to process a large number of transactions against heavy compliance data. The slowest parts were repeated database access, expensive query patterns, and processing that did not use parallel execution effectively.",
          "Instead of treating the problem as one large rewrite, I broke it into measurable bottlenecks: query count, index usage, batching behavior, and transaction isolation during concurrent processing.",
        ],
      },
      {
        heading: "What changed",
        paragraphs: [
          "I added targeted database indexes for the hottest query paths, replaced repeated calls with aggregated query flows, and redesigned the batch execution path to process work in parallel while keeping transaction boundaries clear.",
          "The biggest win came from removing N+1 style database access. A flow that previously issued hundreds of repeated calls was consolidated into a much smaller number of grouped queries.",
        ],
        bullets: [
          "Reduced repeated database calls through aggregated query design.",
          "Improved index coverage on expensive screening paths.",
          "Used parallel processing with transaction isolation for safer throughput.",
        ],
      },
      {
        heading: "Result",
        paragraphs: [
          "The 5K transaction screening run dropped from 2 hours 5 minutes to 3 minutes, a 97 percent latency reduction. The same design direction also helped scale toward 25K transaction volumes with stable average latency.",
        ],
      },
    ],
  },
  {
    slug: "opensearch-to-oracle-text-migration",
    title: "Migrating search-heavy screening from OpenSearch to Oracle Text",
    category: "Architecture",
    publishedAt: "April 2026",
    readTime: "6 min read",
    summary:
      "Why moving matching closer to the data layer improved scale, reduced infrastructure cost, and kept screening workflows reliable.",
    stats: [
      { label: "Search layer", value: "Oracle Text" },
      { label: "Throughput", value: "100+ TPS" },
      { label: "Watchlists", value: "8 active" },
    ],
    takeaways: [
      "Storage-level computation reduced operational overhead in the search path.",
      "Migration strategy preserved throughput while simplifying heavy screening workloads.",
      "The new approach supported enterprise volume without giving up reliability.",
    ],
    sections: [
      {
        heading: "Why migrate",
        paragraphs: [
          "The screening platform had search-heavy workloads that depended on fast matching, predictable latency, and operational simplicity. OpenSearch worked for search, but the architecture carried extra infrastructure cost and synchronization overhead.",
          "Moving more matching logic into Oracle Text allowed the platform to keep search closer to the data and reduce the amount of work that had to move across service boundaries.",
        ],
      },
      {
        heading: "Migration approach",
        paragraphs: [
          "The migration focused on preserving correctness first. Search behavior, scoring behavior, and volume characteristics had to stay stable while the backend moved from a separate search layer into database-backed text matching.",
          "I worked on the backend transition, query paths, indexing behavior, and production-scale validation so the system could handle real-time requests and nightly screening workloads without losing reliability.",
        ],
        bullets: [
          "Moved matching work closer to the storage layer.",
          "Kept high-volume screening paths measurable during migration.",
          "Reduced infrastructure dependency while preserving search quality.",
        ],
      },
      {
        heading: "Result",
        paragraphs: [
          "The migrated path supported 100+ TPS with sub-2.5 second average latency across large volume runs and helped reduce infrastructure cost while keeping screening behavior dependable.",
        ],
      },
    ],
  },
  {
    slug: "ai-relevance-semantic-search-llm-workflows",
    title: "Blending AI relevance, semantic search, and LLM workflow ideas",
    category: "AI and LLM",
    publishedAt: "March 2026",
    readTime: "4 min read",
    summary:
      "Notes on combining deterministic scoring, AI-assisted similarity, and practical LLM workflows in enterprise backend systems.",
    stats: [
      { label: "Focus", value: "AI relevance" },
      { label: "Search", value: "Semantic" },
      { label: "Workflow", value: "LLM-assisted" },
    ],
    takeaways: [
      "AI similarity helps where pure string matching becomes too brittle.",
      "Semantic retrieval improves recall when watchlist data is noisy or transliterated.",
      "LLM workflows are most useful when kept grounded in auditable backend controls.",
    ],
    sections: [
      {
        heading: "The practical goal",
        paragraphs: [
          "In enterprise screening, AI is useful only when it improves real workflows without making the system harder to explain. Matching behavior still needs clear controls, traceable decisions, and predictable operational behavior.",
          "That is why I think of AI relevance as an addition to deterministic scoring, not a replacement for it.",
        ],
      },
      {
        heading: "Where it fits",
        paragraphs: [
          "Semantic search and AI similarity can help with noisy names, transliteration differences, abbreviations, and fuzzy entity matches. LLM workflows can help around the edges: summarizing review context, assisting internal operations, and helping teams move faster while keeping human review in the loop.",
        ],
        bullets: [
          "Use deterministic rules for control and auditability.",
          "Use semantic retrieval to improve recall on noisy data.",
          "Use LLM workflows where the system can stay grounded and reviewable.",
        ],
      },
      {
        heading: "Result",
        paragraphs: [
          "The strongest pattern is hybrid: deterministic matching for trust, AI similarity for relevance, and LLM-assisted workflows for productivity where correctness and review still matter.",
        ],
      },
    ],
  },
  {
    slug: "backend-throughput-database-cache-async-optimization",
    title: "Improving backend throughput with database, cache, and async patterns",
    category: "Performance",
    publishedAt: "May 2026",
    readTime: "5 min read",
    summary:
      "How moving work closer to the database, reducing cache overhead, and using asynchronous execution improved request flow efficiency.",
    stats: [
      { label: "Client pacing", value: "~320ms" },
      { label: "Focus", value: "Throughput" },
      { label: "Pattern", value: "Async + Cache" },
    ],
    takeaways: [
      "Database-side processing reduced repeated application-to-database round-trips.",
      "Targeted indexes and query caching improved access to frequently used data.",
      "Asynchronous writes kept the main request path responsive under load.",
    ],
    sections: [
      {
        heading: "The performance problem",
        paragraphs: [
          "The request path had multiple areas where backend work was spending too much time on repeated data access, JSON handling, cache serialization, and blocking database operations. None of these issues looked dramatic in isolation, but together they added avoidable latency and server load.",
          "The goal was not to rewrite the system. The goal was to identify the parts of the flow that created repeated work and move each responsibility to the layer where it could be handled most efficiently.",
        ],
      },
      {
        heading: "Moving heavy data work closer to the database",
        paragraphs: [
          "One improvement was to move JSON processing and event preparation into database-side procedures. This reduced the amount of back-and-forth communication between the application layer and the database, especially for flows that previously required multiple calls to assemble or transform the same request context.",
          "I also introduced duplicate suppression logic closer to the data layer, so unnecessary event creation could be avoided earlier in the flow. Along with this, targeted indexes were added on frequently accessed paths to make lookups faster and more predictable.",
        ],
        bullets: [
          "Moved repeated JSON processing into stored procedures.",
          "Applied duplicate suppression before unnecessary downstream work was created.",
          "Added indexes on high-access query paths to reduce lookup cost.",
        ],
      },
      {
        heading: "Reducing cache and query overhead",
        paragraphs: [
          "Another part of the optimization focused on cache efficiency. Distributed cache interactions can become expensive when serialization and deserialization add repeated overhead around otherwise fast lookups. Improving those object conversion paths helped reduce the extra cost around cached data access.",
          "For read-heavy flows, frequently used select queries were cached strategically. This reduced database pressure and improved response consistency for data transformation and request-enrichment paths.",
        ],
        bullets: [
          "Optimized serialization and deserialization around cached objects.",
          "Cached frequently used read queries to reduce database load.",
          "Kept caching selective so the system avoided unnecessary stale or low-value cache entries.",
        ],
      },
      {
        heading: "Keeping writes off the critical request path",
        paragraphs: [
          "For operations where database inserts did not need to block the immediate response, I used asynchronous execution patterns. By delegating possible insert work through executor-based processing, the main service flow could continue without waiting on every database write.",
          "This improved throughput by separating user-facing response time from supporting persistence work, while still keeping the execution controlled and observable.",
        ],
        bullets: [
          "Moved non-critical writes into asynchronous execution paths.",
          "Reduced blocking work in the main request flow.",
          "Used controlled background execution rather than unbounded parallelism.",
        ],
      },
      {
        heading: "What the measurements showed",
        paragraphs: [
          "During performance analysis, I noticed a consistent pacing pattern in client-side request posting. When a client posted a sequence of requests, the average gap between receiving one response and sending the next request was around 320ms.",
          "That observation was important because it separated server-side optimization opportunities from client-side pacing behavior. It helped keep the tuning work focused on areas the backend could directly improve: round-trips, query cost, cache overhead, and blocking operations.",
        ],
      },
      {
        heading: "The broader pattern",
        paragraphs: [
          "The final optimization pattern combined several practical backend techniques: push suitable transformation work closer to the database, index the hot paths, cache only high-value reads, reduce cache conversion overhead, and keep non-critical writes out of the synchronous request path.",
          "This kind of performance work is effective because it does not depend on one large change. It improves the system by removing repeated friction across the request lifecycle.",
        ],
      },
    ],
  },
];
