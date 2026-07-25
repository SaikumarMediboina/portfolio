export type BlogStat = {
  label: string;
  value: string;
};

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogDiagramNode = {
  detail: string;
  label: string;
  tone?: "async" | "cache" | "database" | "input" | "outcome" | "service";
};

export type BlogDiagramLane = {
  nodes: BlogDiagramNode[];
  title: string;
};

export type BlogDiagram = {
  caption: string;
  highlights: BlogStat[];
  lanes: BlogDiagramLane[];
  subtitle: string;
  title: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  summary: string;
  tags: string[];
  stats: BlogStat[];
  diagram?: BlogDiagram;
  takeaways: string[];
  sections: BlogSection[];
};

export const blogPosts: BlogPost[] = [
  {
    slug: "what-you-can-build-with-mcp-expense-tracker",
    title: "What can you build with MCP? Learn through an Expense Tracker",
    category: "AI and LLM",
    publishedAt: "July 2026",
    summary:
      "A practical introduction to Model Context Protocol: how an AI application uses controlled tools, resources, and prompts to work safely with a real SQLite Expense Tracker.",
    tags: ["MCP", "Model Context Protocol", "AI Tools", "SQLite", "Python", "LLM Workflows"],
    stats: [
      { label: "MCP tools", value: "6" },
      { label: "Storage", value: "SQLite" },
      { label: "Money", value: "Integer paise" },
    ],
    diagram: {
      title: "How one expense moves through an MCP application",
      subtitle:
        "The AI decides which controlled action is useful; the server validates and performs that action.",
      caption:
        "MCP keeps responsibilities clear. The model understands a request, the client sends a structured tool call, the server applies business rules, and SQLite stores only validated data.",
      highlights: [
        { label: "Transport", value: "stdio" },
        { label: "Validation", value: "Server-side" },
        { label: "Storage", value: "Local SQLite" },
      ],
      lanes: [
        {
          title: "User and AI application",
          nodes: [
            {
              label: "Natural-language request",
              detail: "Add ₹350 for lunch under food.",
              tone: "input",
            },
            {
              label: "AI model selects add_expense",
              detail: "The model recognizes the user wants to create an expense.",
              tone: "service",
            },
          ],
        },
        {
          title: "MCP communication",
          nodes: [
            {
              label: "MCP client sends tools/call",
              detail: "A structured request carries typed arguments to the server.",
              tone: "async",
            },
            {
              label: "MCP server validates input",
              detail: "Amount, category, date, description, and payment method are checked.",
              tone: "service",
            },
          ],
        },
        {
          title: "Trusted local data layer",
          nodes: [
            {
              label: "Convert ₹350 to 35,000 paise",
              detail: "Integer paise avoids floating-point money errors.",
              tone: "database",
            },
            {
              label: "SQLite saves and returns the result",
              detail: "The server returns a confirmation the AI application can show to the user.",
              tone: "outcome",
            },
          ],
        },
      ],
    },
    takeaways: [
      "MCP lets an AI application use real capabilities through a standard, structured protocol instead of unrestricted system access.",
      "The Expense Tracker server owns validation and SQLite access; the AI model never writes SQL directly.",
      "The same MCP server works with an AI host or with a terminal client that sends real MCP tool calls over stdio.",
    ],
    sections: [
      {
        heading: "What can you build with MCP?",
        paragraphs: [
          "Before defining MCP, consider what an AI assistant could do when it can safely work with real applications. It could read project files, search a repository, run tests, create tasks, query an approved database, create support tickets, read internal documentation, generate reports, schedule meetings, or track expenses.",
          "An AI model can understand a request such as ‘Show this month's expenses and tell me where I spent the most.’ Understanding alone is not enough: the application still needs a safe and structured way to communicate with databases, files, GitHub, calendars, and other systems. That is what MCP provides.",
        ],
        bullets: [
          "Read files from a project or search an approved repository.",
          "Run tests and prepare a pull request through controlled tooling.",
          "Create tasks, support tickets, reports, calendar events, or personal expenses.",
        ],
      },
      {
        heading: "What is MCP?",
        paragraphs: [
          "MCP stands for Model Context Protocol. It is a standard way for an AI application to connect to external tools, data, and services. It does not make the model smarter; it gives the application a common communication method for accessing useful capabilities safely.",
          "In this project, the AI understands ‘Add ₹350 for lunch.’ MCP connects the application to add_expense, and the Expense Tracker server validates and saves the expense. MCP turns an AI application from something that only answers questions into something that can work with real tools and data.",
        ],
      },
      {
        heading: "The Expense Tracker architecture",
        paragraphs: [
          "The user interacts with an MCP Host, which contains the AI model and an MCP client. The model understands the goal, while the MCP client sends structured protocol messages to the Expense Tracker MCP server. The server contains trusted application logic and SQLite stores the records.",
          "The user does not need to know Python, SQL, or MCP message formats. The host can manage the model, MCP connections, approvals, and final response. SQLite is not MCP; it is the external local database used by the MCP server.",
        ],
        bullets: [
          "AI model: understands the request and selects an appropriate capability.",
          "MCP client: sends structured messages to the MCP server.",
          "MCP server: validates input and performs trusted application operations.",
          "SQLite: stores validated expense records locally.",
        ],
      },
      {
        heading: "Adding an expense end to end",
        paragraphs: [
          "Suppose the user says: ‘I spent ₹350 on lunch. Add it under food.’ The model extracts amount_rupees as 350, category as food, description as Lunch, and can use upi as the default payment method. At this point, no database operation has happened.",
          "The model selects the add_expense Tool. Its MCP client sends a tools/call request with those arguments. The server checks that the amount is positive and has no more than two decimal places, the category and payment method are supported, the description is non-empty, and the date is valid.",
          "The server converts ₹350.00 to 35,000 integer paise. It then executes a parameterized SQLite INSERT. The model never gets unrestricted SQL access. Finally, the server returns a structured confirmation including the record ID and formatted INR amount.",
        ],
      },
      {
        heading: "Why money uses integer paise",
        paragraphs: [
          "Money must not be stored as a floating-point value because binary floating-point numbers can represent common decimals inaccurately. The project accepts values such as ₹1,200.50, parses them with Decimal, and stores 120050 paise as an integer.",
          "This makes totals exact. SQLite calculates SUM(amount_paise) and GROUP BY category, while the application formats the final answer in Indian Rupees such as ₹1,550.00.",
        ],
      },
      {
        heading: "Real terminal demo using the actual MCP tools",
        paragraphs: [
          "The project includes a terminal client, terminal_app.py. It starts the local server, opens an MCP stdio session, and sends real MCP tool calls. It does not need an AI model, MCP Inspector, npm, a proxy, or an external service; it simply parses a small command format and uses the same MCP server an AI host would use.",
          "Start it from the project folder with uv run --no-sync python terminal_app.py. The --no-sync option uses the already-installed environment, avoiding unnecessary package downloads or rebuilds.",
        ],
        bullets: [
          "add 350 Lunch under food",
          "add ₹1,200 Electricity bill under bills via bank_transfer",
          "list, total 2026-07, and breakdown 2026-07",
          "delete 1, followed by delete 1 confirm after explicit confirmation",
        ],
      },
      {
        heading: "Demo result: adding expenses",
        paragraphs: [
          "The command add 350 Lunch under food created expense ID 1 with amount_paise 35000, category food, payment method upi, and formatted amount ₹350.00. The command add ₹1,200 Electricity bill under bills via bank_transfer created expense ID 2 with amount_paise 120000 and formatted amount ₹1,200.00.",
          "The list command returned both records newest first. Its result contained count 2, total_paise 155000, and total ₹1,550.00. This total is calculated by the database, not guessed by the client or AI model.",
        ],
      },
      {
        heading: "Demo result: reporting and safe deletion",
        paragraphs: [
          "The total 2026-07 command returned two expenses totaling ₹1,550.00. The category breakdown placed bills first at ₹1,200.00 or 77.42 percent, followed by food at ₹350.00 or 22.58 percent. The percentages are calculated from the exact monthly total.",
          "The delete 1 command was deliberately refused with a clear confirmation message. Only delete 1 confirm removes the record. This is a business rule enforced by the MCP server, not a suggestion that the AI model can ignore.",
        ],
      },
      {
        heading: "Tools, Resources, and Prompts",
        paragraphs: [
          "Tools perform operations. This server exposes add_expense, list_expenses, get_monthly_total, category_breakdown, update_expense, and delete_expense. A Tool can create data, retrieve data, run a calculation, or perform a controlled external action. Tools do something.",
          "Resources provide contextual information. The read-only expenses://current-month/summary resource returns current-month totals, category data, and the highest expense without modifying the database. Resources provide information.",
          "Prompts provide reusable workflow instructions. The analyze_monthly_spending prompt guides an AI to call reporting tools, identify large categories or expenses, suggest realistic savings opportunities, and never update or delete data. Prompts guide a workflow.",
        ],
      },
      {
        heading: "Why not give an AI direct database access?",
        paragraphs: [
          "Direct SQLite access would give an AI application far too much power. It could construct an unsafe query, delete the wrong expense, store an invalid amount, access unrelated records, or ignore confirmation rules.",
          "The MCP server exposes narrow, developer-controlled operations instead: add_expense, get_monthly_total, update_expense, and delete_expense(confirm=true). The developer controls accepted inputs, validation rules, parameterized database queries, and confirmation requirements.",
        ],
      },
      {
        heading: "What else can you build?",
        paragraphs: [
          "The same pattern works far beyond personal expenses. A GitHub assistant can search code, run tests, and prepare pull requests. A customer-support assistant can read approved order data and create tickets. A company-knowledge assistant can search permitted internal documents. A DevOps assistant can inspect logs or restart approved services.",
          "The external system changes, but the pattern stays the same: a user describes a goal, the model selects a controlled capability, the MCP client sends a structured request, the MCP server performs the operation, and the result returns to the application.",
        ],
      },
      {
        heading: "Final understanding",
        paragraphs: [
          "MCP separates responsibilities cleanly. The user describes a goal. The AI model understands the goal. The host coordinates the workflow. The MCP client sends structured messages. The MCP server validates and performs the operation. SQLite stores the data.",
          "The key idea is simple: the model decides what action is useful, while the MCP server safely performs the trusted operation.",
        ],
      },
    ],
  },
  {
    slug: "batch-screening-latency-97-percent",
    title: "Cutting batch screening latency by 97 percent",
    category: "Performance",
    publishedAt: "April 2026",
    summary:
      "A structured breakdown of how a slow batch screening workflow was diagnosed, optimized, and reduced from hours to minutes.",
    tags: ["Batch Processing", "Database Indexing", "N+1 Queries", "Parallel Processing"],
    stats: [
      { label: "Latency reduction", value: "97%" },
      { label: "Before", value: "2h 5m" },
      { label: "After", value: "3m" },
    ],
    takeaways: [
      "The issue surfaced during high-volume batch screening where repeated database access dominated runtime.",
      "Multiple solution paths were evaluated before selecting indexing, batching, and parallel execution.",
      "The final approach worked because it reduced repeated work while preserving transaction correctness.",
    ],
    sections: [
      {
        heading: "How the issue surfaced",
        paragraphs: [
          "The issue appeared during batch screening runs in a compliance workflow where thousands of transactions had to be matched against large reference datasets. A 5K transaction run was taking about 2 hours and 5 minutes, which was not acceptable for operational timelines.",
          "The delay was not caused by one single slow statement. The larger problem was a combination of repeated database calls, expensive query paths, insufficient indexing on hot access patterns, and sequential processing where the workload could safely be split.",
        ],
      },
      {
        heading: "Why it mattered",
        paragraphs: [
          "Batch screening is time-sensitive because downstream review, reporting, and operational decisions depend on its completion. Long-running jobs also increase infrastructure pressure and make failures more expensive to recover from.",
          "The objective was to reduce total execution time without weakening correctness, transaction isolation, or the quality of screening results.",
        ],
      },
      {
        heading: "Possible solutions considered",
        paragraphs: [
          "Several approaches were evaluated before changing the execution path. A full rewrite could have improved the architecture, but it carried unnecessary delivery risk. Increasing infrastructure capacity could have masked the symptoms, but it would not have removed the repeated work. Query-level tuning alone would have helped, but it would not solve the end-to-end runtime issue.",
        ],
        bullets: [
          "Scale infrastructure to add temporary capacity, with limited long-term efficiency gain.",
          "Rewrite the batch flow completely, with higher implementation and regression risk.",
          "Tune the existing flow by reducing query cost, removing N+1 access patterns, and parallelizing safe units of work.",
        ],
      },
      {
        heading: "Chosen solution",
        paragraphs: [
          "The selected approach focused on improving the existing flow in measurable steps. Targeted indexes were added to the hottest query paths, repeated database calls were replaced with aggregated query flows, and the batch workload was split into parallel execution units with clear transaction boundaries.",
          "The most important change was eliminating N+1 style access. A flow that previously created many repeated calls was redesigned to retrieve grouped data in fewer, more meaningful queries.",
        ],
        bullets: [
          "Added targeted database indexes for high-frequency screening lookups.",
          "Replaced repeated query calls with aggregated query design.",
          "Introduced parallel processing while keeping transaction boundaries controlled.",
        ],
      },
      {
        heading: "Why it worked",
        paragraphs: [
          "The solution worked because it addressed the real cost drivers instead of optimizing only the visible symptom. Indexing reduced lookup cost, batching reduced network and query overhead, and parallel processing improved throughput where the workload could be safely divided.",
          "This created an improvement across the full request lifecycle rather than relying on one isolated optimization.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "The 5K transaction screening run dropped from 2 hours 5 minutes to 3 minutes, resulting in a 97 percent latency reduction. The same design direction also supported larger transaction volumes with more stable latency behavior.",
        ],
      },
    ],
  },
  {
    slug: "opensearch-to-oracle-text-migration",
    title: "Migrating search-heavy screening from OpenSearch to Oracle Text",
    category: "Architecture",
    publishedAt: "April 2026",
    summary:
      "A case study on moving matching closer to the data layer to improve scale, reduce operational overhead, and preserve screening reliability.",
    tags: ["Oracle Text", "OpenSearch", "Search Migration", "Screening Systems"],
    stats: [
      { label: "Search layer", value: "Oracle Text" },
      { label: "Throughput", value: "100+ TPS" },
      { label: "Watchlists", value: "8 active" },
    ],
    takeaways: [
      "The migration need came from infrastructure cost, synchronization overhead, and search-heavy workload scale.",
      "Possible solutions included cluster scaling, dual-system tuning, or moving matching closer to storage.",
      "Oracle Text helped because it reduced data movement and kept matching work close to the database.",
    ],
    sections: [
      {
        heading: "How the issue surfaced",
        paragraphs: [
          "The screening platform handled search-heavy customer and transaction matching workloads. As volume increased, the architecture had to support predictable latency, high throughput, and reliable indexing across multiple active watchlists.",
          "The existing search path introduced additional infrastructure cost and synchronization overhead. Maintaining a separate search layer meant data had to be moved, indexed, validated, and kept aligned with database-backed workflows.",
        ],
      },
      {
        heading: "Why it mattered",
        paragraphs: [
          "Screening systems require reliability as much as speed. A search architecture that is fast but difficult to operate can create long-term risk in cost, consistency, and production support.",
          "The goal was to preserve matching quality and throughput while simplifying the operational model behind the search path.",
        ],
      },
      {
        heading: "Possible solutions considered",
        paragraphs: [
          "The main options were to scale the existing search infrastructure, optimize synchronization between systems, or move more matching work closer to the database. Scaling the existing layer could improve capacity, but it would not remove synchronization complexity. Synchronization tuning could reduce operational friction, but the platform would still depend on two heavy data paths.",
        ],
        bullets: [
          "Increase search cluster capacity to handle more throughput.",
          "Improve synchronization and indexing pipelines while retaining the separate search layer.",
          "Move suitable matching workloads into Oracle Text to reduce data movement and infrastructure dependency.",
        ],
      },
      {
        heading: "Chosen solution",
        paragraphs: [
          "The selected solution was a backend migration from OpenSearch-based matching to Oracle Text for the core screening path. This brought matching closer to the data layer and allowed more work to happen where the data already lived.",
          "The migration was handled with correctness as the primary constraint. Query behavior, scoring behavior, indexing behavior, and production-scale volume characteristics had to remain measurable throughout the transition.",
        ],
        bullets: [
          "Moved core matching behavior closer to storage-level computation.",
          "Validated search behavior against high-volume screening paths.",
          "Reduced dependency on a separate search infrastructure layer.",
        ],
      },
      {
        heading: "Why it worked",
        paragraphs: [
          "The solution worked because it reduced the amount of data movement across service boundaries. Keeping matching closer to the database simplified the architecture and reduced the operational cost of maintaining a separate search path.",
          "The approach also preserved reliability because the migration was validated through production-like volume runs instead of being treated as a purely technical replacement.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "The migrated path supported 100+ TPS with sub-2.5 second average latency across large volume runs. It also supported screening across eight simultaneous watchlists while improving infrastructure efficiency.",
        ],
      },
    ],
  },
  {
    slug: "ai-relevance-semantic-search-llm-workflows",
    title: "Blending AI relevance, semantic search, and LLM workflow ideas",
    category: "AI and LLM",
    publishedAt: "March 2026",
    summary:
      "A practical view of where AI relevance, semantic retrieval, and LLM-assisted workflows fit inside enterprise backend systems.",
    tags: ["Semantic Search", "AI Relevance", "LLM Workflows", "Hybrid Matching"],
    stats: [
      { label: "Focus", value: "AI relevance" },
      { label: "Search", value: "Semantic" },
      { label: "Workflow", value: "LLM-assisted" },
    ],
    takeaways: [
      "The issue came from brittle matching behavior when enterprise data contained noisy names, aliases, and transliteration differences.",
      "A pure AI replacement was not suitable because screening decisions still needed control, auditability, and predictable behavior.",
      "The strongest approach was hybrid: deterministic rules for trust, semantic retrieval for recall, and LLM workflows for assisted productivity.",
    ],
    sections: [
      {
        heading: "How the issue surfaced",
        paragraphs: [
          "In enterprise screening workflows, matching quality becomes difficult when input data is noisy. Names may be abbreviated, transliterated, reordered, misspelled, or represented differently across systems and watchlists.",
          "Traditional deterministic matching is strong for control and auditability, but it can become brittle when the same real-world entity appears in many textual variations. This created a need for relevance signals that could improve recall without turning the system into an opaque decision engine.",
        ],
      },
      {
        heading: "Why it mattered",
        paragraphs: [
          "Screening workflows must balance two competing needs: finding more relevant matches and keeping every decision explainable. A system that only improves recall can increase false positives, while a system that is too strict can miss important matches.",
          "AI and LLM capabilities are useful in this space only when they remain grounded in controlled backend workflows, measurable scoring behavior, and human-reviewable output.",
        ],
      },
      {
        heading: "Possible solutions considered",
        paragraphs: [
          "Several solution directions were possible. The first was to keep only deterministic rules and continue tuning thresholds. The second was to rely heavily on AI similarity as the primary matching layer. The third was to combine deterministic scoring, semantic retrieval, and LLM-assisted workflow patterns with clear boundaries.",
        ],
        bullets: [
          "Use only deterministic matching rules for maximum control, with limited flexibility on noisy text.",
          "Use AI similarity as the primary decision mechanism, with higher explainability and governance risk.",
          "Use a hybrid model where AI improves relevance while deterministic rules preserve control.",
        ],
      },
      {
        heading: "Chosen solution",
        paragraphs: [
          "The selected direction was a hybrid pattern. Deterministic rules remained responsible for control, scoring boundaries, and auditability. Semantic retrieval and AI similarity were used to improve relevance where string-based matching alone was not enough.",
          "LLM-assisted workflows were positioned around supporting tasks rather than final automated decisions. Suitable use cases included summarizing review context, assisting internal operations, and helping engineering teams work faster while keeping review and controls in place.",
        ],
        bullets: [
          "Preserve deterministic scoring for traceability and governance.",
          "Use semantic retrieval to improve recall on noisy or transliterated data.",
          "Use LLM workflows for assisted productivity where outputs remain reviewable.",
        ],
      },
      {
        heading: "Why it worked",
        paragraphs: [
          "The approach worked because it did not force AI into every part of the workflow. Each technique was used where it had the highest value: rules for trust, semantic search for relevance, and LLM-assisted workflows for operational productivity.",
          "This structure improved the system without sacrificing the explainability expected in enterprise environments.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "The result was a practical AI architecture pattern for backend systems: deterministic matching provides the foundation, AI relevance strengthens search quality, and LLM workflows improve productivity around controlled human-reviewable processes.",
        ],
      },
    ],
  },
  {
    slug: "backend-throughput-database-cache-async-optimization",
    title: "Improving backend throughput with database, cache, and async patterns",
    category: "Performance",
    publishedAt: "May 2026",
    summary:
      "A professional breakdown of how repeated data access, cache overhead, and blocking writes were reduced through database-side processing, selective caching, and asynchronous execution.",
    tags: ["Async Processing", "Caching", "Stored Procedures", "Backend Throughput"],
    stats: [
      { label: "Client pacing", value: "~320ms" },
      { label: "Focus", value: "Throughput" },
      { label: "Pattern", value: "Async + Cache" },
    ],
    diagram: {
      title: "Targeted throughput optimization pattern",
      subtitle:
        "A clean view of how repeated backend work moved closer to the right execution layer.",
      caption:
        "The optimization avoided a full rewrite. The request path stayed lean while database-heavy work, cache reads, and non-critical writes were handled where they created the least friction.",
      highlights: [
        { label: "Round-trips", value: "Reduced" },
        { label: "Writes", value: "Async" },
        { label: "Reads", value: "Cached" },
      ],
      lanes: [
        {
          title: "Client request flow",
          nodes: [
            {
              label: "Sequential requests",
              detail: "Observed ~320ms client pacing between response and next request.",
              tone: "input",
            },
            {
              label: "Synchronous boundary",
              detail: "Only user-visible work should remain on the critical path.",
              tone: "service",
            },
          ],
        },
        {
          title: "Lean service layer",
          nodes: [
            {
              label: "API orchestration",
              detail: "Coordinates validation, routing, and response shaping.",
              tone: "service",
            },
            {
              label: "Selective caching",
              detail: "Frequently used read queries avoid repeated database pressure.",
              tone: "cache",
            },
          ],
        },
        {
          title: "Database-side execution",
          nodes: [
            {
              label: "Stored procedures",
              detail: "JSON preparation and duplicate suppression move closer to data.",
              tone: "database",
            },
            {
              label: "Hot-path indexes",
              detail: "Frequently accessed lookups use targeted indexing.",
              tone: "database",
            },
          ],
        },
        {
          title: "Controlled background work",
          nodes: [
            {
              label: "Async inserts",
              detail: "Non-critical writes run through managed executor paths.",
              tone: "async",
            },
            {
              label: "Stable response path",
              detail: "The main flow returns faster without hiding reliability work.",
              tone: "outcome",
            },
          ],
        },
      ],
    },
    takeaways: [
      "The issue surfaced when request processing showed repeated data access, JSON handling, cache conversion overhead, and blocking write paths.",
      "Possible solutions included service rewrites, infrastructure scaling, or targeted optimization across database, cache, and asynchronous execution.",
      "The targeted approach worked because each bottleneck was moved to the layer best suited to handle it efficiently.",
    ],
    sections: [
      {
        heading: "How the issue surfaced",
        paragraphs: [
          "The performance issue appeared during backend throughput analysis of request flows that performed repeated data access, JSON processing, cache interactions, and database writes. Each individual operation looked manageable, but together they created avoidable latency and server load.",
          "A detailed observation also showed a consistent client-side pacing pattern. When clients posted a sequence of requests, the average gap between receiving one response and sending the next request was around 320ms. This helped separate backend optimization opportunities from client-side request timing.",
        ],
      },
      {
        heading: "Why it mattered",
        paragraphs: [
          "Backend throughput is affected not only by slow code but also by repeated friction across the request lifecycle. Extra round-trips, repeated serialization, frequently executed select queries, and blocking writes can reduce capacity even when no single component appears broken.",
          "The goal was to reduce backend work per request, improve response consistency, and keep the main request path free from operations that did not need to block the user-facing flow.",
        ],
      },
      {
        heading: "Possible solutions considered",
        paragraphs: [
          "Several options were available. A full service rewrite could redesign the flow, but it would introduce high delivery risk. Adding infrastructure could improve short-term capacity, but it would not remove repeated work. The most practical path was targeted optimization across the database layer, cache layer, and asynchronous execution path.",
        ],
        bullets: [
          "Rewrite the service flow completely, with higher regression and delivery risk.",
          "Scale infrastructure to absorb the overhead, with limited long-term efficiency improvement.",
          "Optimize the existing flow by reducing round-trips, caching high-value reads, improving cache conversion paths, and moving non-critical writes out of the synchronous path.",
        ],
      },
      {
        heading: "Chosen solution",
        paragraphs: [
          "The selected approach was to move suitable data-heavy work closer to the database, improve cache efficiency, and use asynchronous execution for operations that did not need to block the immediate response.",
          "JSON processing and event preparation were moved into database-side procedures to reduce application-to-database round-trips. Duplicate suppression was also handled earlier in the flow so unnecessary downstream work could be avoided. Targeted indexes were added to improve lookup performance on frequently accessed paths.",
        ],
        bullets: [
          "Moved repeated JSON processing into stored procedures.",
          "Applied duplicate suppression before unnecessary downstream processing was created.",
          "Added indexes on high-access query paths.",
          "Cached frequently used read queries to reduce database pressure.",
          "Moved non-critical inserts into controlled asynchronous execution paths.",
        ],
      },
      {
        heading: "Why it worked",
        paragraphs: [
          "The solution worked because it placed each responsibility where it could be handled most efficiently. Database-side procedures reduced repeated network round-trips, indexes improved hot-path access, selective caching reduced read pressure, and asynchronous execution prevented supporting writes from blocking the main request flow.",
          "The approach also avoided unbounded parallelism. Background work was controlled, which helped improve throughput without creating new reliability risks.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "The final pattern improved request flow efficiency by reducing repeated backend work across multiple layers. The optimization did not depend on one large change; it came from removing unnecessary friction across database access, cache usage, and synchronous execution.",
          "The 320ms client pacing observation also helped keep the analysis accurate by distinguishing backend latency from client-side request timing.",
        ],
      },
    ],
  },
];
