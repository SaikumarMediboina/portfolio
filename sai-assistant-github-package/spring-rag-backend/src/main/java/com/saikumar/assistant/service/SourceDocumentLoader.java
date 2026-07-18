package com.saikumar.assistant.service;

import com.saikumar.assistant.model.SourceDocument;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Service
public class SourceDocumentLoader {

    private final WebClient webClient = WebClient.builder()
        .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(2 * 1024 * 1024))
        .build();

    public SourceDocument load(String url) {
        String html = webClient.get()
            .uri(url)
            .retrieve()
            .bodyToMono(String.class)
            .timeout(Duration.ofSeconds(10))
            .onErrorResume(error -> Mono.just(""))
            .block(Duration.ofSeconds(12));

        if (html == null || html.isBlank()) {
            return fallbackDocument(url);
        }

        Document document = Jsoup.parse(html, url);
        document.select("script,style,noscript,svg,nav,footer").remove();

        String title = document.title().isBlank() ? url : document.title();
        String text = document.body() == null ? "" : document.body().text();

        if (text.isBlank()) {
            return fallbackDocument(url);
        }

        return new SourceDocument(url, title, text, Map.of("loader", "jsoup"));
    }

    public List<SourceDocument> structuredSiteDocuments() {
        List<SourceDocument> documents = new ArrayList<>();

        documents.add(structured(
            "https://saikumarmediboina.com/about",
            "About Sai Kumar Mediboina",
            """
            Sai Kumar Mediboina is a Software Application Engineer at Oracle, Bangalore. He builds high-throughput screening systems, search platforms, and AI-assisted backend services that turn complex compliance workloads into dependable products.
            Profile summary: Backend engineer specializing in distributed systems, search, performance optimization, and AI-driven product workflows. His work combines cloud-native architecture, data-heavy pipelines, semantic search, and emerging LLM-assisted automation across both real-time and batch processing.
            Focus: Sai likes solving problems where latency, scale, and correctness matter at the same time. Recent work blends deterministic rules, semantic search, AI scoring, and practical LLM workflow ideas to improve screening accuracy and delivery speed.
            Location: Rajahmundry, Andhra Pradesh, India. Current company: Oracle, Bangalore.
            Current work location: Sai's current Oracle role is associated with Bengaluru, Karnataka, India, also commonly called Bangalore or BLR/BGLR. It is listed as remote. The portfolio context does not list Hyderabad or HYD as his current work location.
            """,
            "profile"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/work-with-me",
            "Contact and Work With Me",
            """
            Visitors can contact Sai Kumar Mediboina through the Work With Me page, by email, phone, or LinkedIn.
            Email: msaikumar6789@gmail.com.
            Phone: +91 9133707661.
            LinkedIn: https://www.linkedin.com/in/saikumar-mediboina-1b8258136/.
            Best-fit conversations include backend engineering, search systems, performance tuning, cloud-native engineering, scalable product engineering, and practical AI or LLM workflow ideas.
            """,
            "contact"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#metrics",
            "Portfolio impact metrics",
            """
            Sai's portfolio impact metrics:
            Batch latency reduction: 97 percent. A 5K transaction screening run was reduced from 2 hours 5 minutes to 3 minutes.
            Real-time speedup: 85 percent. Synchronous screening was brought down from roughly 2 seconds to about 300 milliseconds.
            Runtime scale: 100+ TPS with sub-2.5 second average latency.
            Award-recognized improvement: 7x performance gain recognized at Oracle for migration and performance impact.
            """,
            "metric"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#experience",
            "Oracle experience and current role",
            """
            Sai currently works full-time at Oracle in Bengaluru, Karnataka, India. Bengaluru is also referred to as Bangalore, BLR, or BGLR. Current role: Software Application Engineer, May 2026 to present. The role focuses on backend platform engineering, search architecture, performance optimization, and AI-enabled workflow design. The portfolio context does not list Hyderabad or HYD as his current work location.
            Previous role: Application Developer, August 2023 to May 2026. He built and optimized high-throughput screening, matching, and transaction filtering capabilities across real-time and batch workloads.
            Total professional work experience: about 3 years as of May 2026, based on Oracle experience from August 2023 to the present.
            Experience summary: Architecting a scalable cloud-native compliance platform on OCI and Kubernetes for customer screening and transaction filtering. The platform combines OpenSearch, Oracle Text, AI-assisted search, and hybrid decision logic to support both real-time requests and high-volume nightly workloads.
            Achievements include secure Spring APIs for 100 concurrent real-time payloads with batch screening runs, a fault-tolerant PL/SQL pipeline for cleansing and transliterating watchlist data before indexing, backend migration from OpenSearch to Oracle Text, hybrid scoring with deterministic logic and AI similarity, and practical LLM-assisted workflow ideas for enterprise operations and developer productivity.
            """,
            "experience"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#focus",
            "Current engineering focus areas",
            """
            Current focus area: Hybrid matching engine. It combines rules, fuzzy scoring, and AI similarity to improve noisy watchlist matching.
            Current focus area: Semantic search and AI relevance. It adds semantic retrieval and configurable scoring without losing explainable results.
            Current focus area: LLM-enabled workflows. It uses LLM assistance where review, correctness, and predictable behavior still matter.
            Current focus area: Batch reliability at scale. It designs ingestion, cleansing, and indexing paths that stay stable as volume grows.
            """,
            "profile"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#work",
            "Selected projects overview",
            """
            Sai's selected projects are Matching and Scoring Engine, Core Search Engine Migration, Advanced Hybrid Scoring Engine, High-Volume Batch Processing, Real-Time Screening Optimization, and Narrative Text Extraction Engine.
            The common thread across these projects is backend scale, search-heavy screening, AI-assisted relevance, reliable batch processing, and measurable performance improvement.
            """,
            "project"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#work",
            "Matching and Scoring Engine",
            """
            Project: Matching and Scoring Engine.
            Impact: Scaled screening to millions of transactions against billions of records.
            Summary: A compliance screening platform for customer screening and transaction filtering, built to handle both interactive lookups and high-volume nightly processing.
            Stack: Java, Spring Boot, OpenSearch, Oracle Text, OCI, Kubernetes.
            Highlights: Designed secure REST APIs and resilient ingestion for both real-time and batch flows. Delivered 100+ TPS with sub-2.5 second average latency across 23,000-message runs. Enabled screening across eight simultaneous watchlists with zero-error volume runs.
            """,
            "project"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#work",
            "Core Search Engine Migration",
            """
            Project: Core Search Engine Migration.
            Impact: Reduced infrastructure cost while improving scale and search locality.
            Summary: Sai spearheaded the backend transition from OpenSearch to Oracle Text to move more matching work closer to storage and simplify heavy search paths.
            Stack: Oracle Text, OpenSearch, OCI, Kubernetes.
            Highlights: Shifted core matching behavior toward storage-level computation. Improved cost behavior without sacrificing production throughput. Helped earn Oracle recognition for the migration and measurable speedups.
            """,
            "project"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#work",
            "Advanced Hybrid Scoring Engine",
            """
            Project: Advanced Hybrid Scoring Engine.
            Impact: Improved entity resolution quality while reducing false positives.
            Summary: A configurable scoring microservice that blended AI similarity signals with deterministic matching rules for global watchlist data.
            Stack: Java, AI Similarity, Semantic Search, Microservices.
            Highlights: Combined exact matching, fuzzy logic, and configurable scoring signals. Balanced explainability with stronger ranking quality for noisy records. Improved relevance for screening scenarios where raw string equality was not enough.
            """,
            "project"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#work",
            "High-Volume Batch Processing project",
            """
            Project: High-Volume Batch Processing.
            Impact: Cut a 5K batch screening run from 2 hours 5 minutes to 3 minutes.
            Summary: Improved batch screening by attacking the largest bottlenecks across indexing, query patterns, and multi-threaded processing.
            Stack: SQL, PL/SQL, Database Indexing, Parallel Processing.
            Highlights: Eliminated N+1 access patterns with aggregated query flows. Added targeted indexing to the most expensive hot paths. Scaled the same direction toward 25K transactions with stable latency behavior.
            """,
            "project"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#work",
            "Real-Time Screening Optimization",
            """
            Project: Real-Time Screening Optimization.
            Impact: Reduced real-time latency from roughly 2 seconds to 300 milliseconds.
            Summary: Redesigned a synchronous screening path into an asynchronous pipeline to improve responsiveness under concurrent production traffic.
            Stack: Java, Parallel Processing, Thread Management, Oracle.
            Highlights: Parallelized database work across dedicated thread pools. Removed JSON aggregation bottlenecks through incremental result streaming. Improved user-visible response times without sacrificing backend correctness.
            """,
            "project"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#work",
            "Narrative Text Extraction Engine",
            """
            Project: Narrative Text Extraction Engine.
            Impact: Improved precision when extracting candidate entities from noisy text.
            Summary: Built an intelligent parser that tokenizes unstructured input and ranks candidate matches using configurable exact and fuzzy logic.
            Stack: Java, PL/SQL, LLM Models, Scoring Algorithms.
            Highlights: Scored candidates using match quality, token length, and gap penalties. Extracted best-match substrings before the main screening stage. Made the matching behavior configurable so teams could tune it without rewriting the engine.
            """,
            "project"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#skills",
            "Tech stack and skills",
            """
            Sai's stack is backend-heavy: Java, Spring Boot, REST APIs, microservices, Oracle 19c, Oracle Text, OpenSearch, Oracle 23ai Vector Search, hybrid search, OCI, Kubernetes, semantic search, embeddings, RAG, AI similarity, hybrid retrieval, rule-based reranking, and LLM workflow patterns.
            Languages: Java, SQL, PL/SQL.
            Frameworks and Architecture: Spring, Spring Boot, Hibernate, REST APIs, Microservices, Apache Kafka.
            Databases and Search: Oracle 19c, Oracle Text, OpenSearch, MySQL, Oracle 23ai Vector Search, Hybrid Search.
            AI, Search, and Intelligence: Semantic Search, AI Similarity, Embeddings, RAG, Hybrid Retrieval, Rule-Based Reranking, LLM Workflows, Prompt Design, Fuzzy Matching.
            Cloud and Tooling: OCI, Kubernetes, Grafana, APM, Git, Maven.
            """,
            "skill"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#recognition",
            "Recognition and awards",
            """
            Recognition: Pace Setter by Oracle. Sai was recognized for achieving a 7x performance improvement by reducing latency from 5 seconds to 700 milliseconds and contributing to the migration from OpenSearch to Oracle Text. Highlight: 7x performance gain.
            Recognition: Oracle Agent IR Hackathon, Oracle, 2025. Sai built an enterprise application to automate daily IUT check-in activities and secured 5th place out of 200 teams. Highlight: 5th place out of 200 teams.
            """,
            "recognition"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/portfolio#credentials",
            "Education and certifications",
            """
            Education: M.Tech from NIT Karnataka, August 2021 to July 2023, CGPA 8.96.
            Education: B.Tech from JNTU Vizianagaram, June 2016 to September 2020, CGPA 8.36.
            Certification: Introduction to Generative AI for Software Development from DeepLearning.AI, 2026.
            Certification: Generative AI for Everyone from DeepLearning.AI, 2026.
            Certification: Generative AI with Large Language Models from DeepLearning.AI, 2026.
            Certification: Team Software Engineering with AI from DeepLearning.AI, 2026.
            Certification: AI-Powered Software and System Design from DeepLearning.AI, 2026.
            Certification: Oracle Cloud Infrastructure AI Foundations from Oracle, 2024.
            Certification: Oracle Database 19c: PL/SQL Workshop from Oracle, 2023.
            Certification: Spring 6 with Spring Boot 3 and Java EE: Concurrency from LinkedIn Learning, 2024.
            Certification: Advanced Core Java and Spring Boot Architecture from Udemy, 2026.
            Certification: Low-Level Design from takeUforward, 2026.
            Certification: Model Context Protocol: Introduction and Advanced Topics from Anthropic, 2026.
            """,
            "credential"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/blogs",
            "Blog catalog and article count",
            """
            Blog count: Sai Kumar Mediboina has published 4 engineering blog posts on the portfolio.
            Published blog posts: Cutting batch screening latency by 97 percent, published April 2026. Migrating search-heavy screening from OpenSearch to Oracle Text, published April 2026. Blending AI relevance, semantic search, and LLM workflow ideas, published March 2026. Improving backend throughput with database, cache, and async patterns, published May 2026.
            Blog categories include Performance, Architecture, and AI and LLM. The blog index is available at https://saikumarmediboina.com/blogs.
            """,
            "blog"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/blog/batch-screening-latency-97-percent",
            "Cutting batch screening latency by 97 percent",
            """
            Blog post: Cutting batch screening latency by 97 percent. Category: Performance. Published: April 2026.
            Summary: A structured breakdown of how a slow batch screening workflow was diagnosed, optimized, and reduced from hours to minutes.
            Tags: Batch Processing, Database Indexing, N+1 Queries, Parallel Processing.
            Stats: Latency reduction 97 percent. Before 2 hours 5 minutes. After 3 minutes.
            Takeaways: The issue surfaced during high-volume batch screening where repeated database access dominated runtime. Multiple solution paths were evaluated before selecting indexing, batching, and parallel execution. The final approach worked because it reduced repeated work while preserving transaction correctness.
            How the issue surfaced: The issue appeared during batch screening runs in a compliance workflow where thousands of transactions had to be matched against large reference datasets. A 5K transaction run was taking about 2 hours and 5 minutes, which was not acceptable for operational timelines. The delay was not caused by one single slow statement. The larger problem was repeated database calls, expensive query paths, insufficient indexing on hot access patterns, and sequential processing where the workload could safely be split.
            Why it mattered: Batch screening is time-sensitive because downstream review, reporting, and operational decisions depend on its completion. Long-running jobs also increase infrastructure pressure and make failures more expensive to recover from. The objective was to reduce total execution time without weakening correctness, transaction isolation, or screening result quality.
            Possible solutions considered: Scale infrastructure for temporary capacity, rewrite the batch flow completely with higher regression risk, or tune the existing flow by reducing query cost, removing N+1 access patterns, and parallelizing safe units of work.
            Chosen solution: The selected approach improved the existing flow in measurable steps. Targeted indexes were added to hot query paths, repeated database calls were replaced with aggregated query flows, and the batch workload was split into parallel execution units with clear transaction boundaries.
            Why it worked: Indexing reduced lookup cost, batching reduced network and query overhead, and parallel processing improved throughput where work could be safely divided.
            Outcome: The 5K transaction screening run dropped from 2 hours 5 minutes to 3 minutes, resulting in a 97 percent latency reduction. The same design direction supported larger transaction volumes with more stable latency behavior.
            """,
            "blog"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/blog/opensearch-to-oracle-text-migration",
            "Migrating search-heavy screening from OpenSearch to Oracle Text",
            """
            Blog post: Migrating search-heavy screening from OpenSearch to Oracle Text. Category: Architecture. Published: April 2026.
            Summary: A case study on moving matching closer to the data layer to improve scale, reduce operational overhead, and preserve screening reliability.
            Tags: Oracle Text, OpenSearch, Search Migration, Screening Systems.
            Stats: Search layer Oracle Text. Throughput 100+ TPS. Watchlists 8 active.
            Takeaways: The migration need came from infrastructure cost, synchronization overhead, and search-heavy workload scale. Possible solutions included cluster scaling, dual-system tuning, or moving matching closer to storage. Oracle Text helped because it reduced data movement and kept matching work close to the database.
            How the issue surfaced: The screening platform handled search-heavy customer and transaction matching workloads. As volume increased, the architecture had to support predictable latency, high throughput, and reliable indexing across multiple active watchlists. The existing search path introduced additional infrastructure cost and synchronization overhead because a separate search layer required data movement, indexing, validation, and alignment with database-backed workflows.
            Why it mattered: Screening systems require reliability as much as speed. A search architecture that is fast but difficult to operate can create long-term risk in cost, consistency, and production support.
            Possible solutions considered: Increase search cluster capacity, improve synchronization and indexing while retaining a separate search layer, or move suitable matching workloads into Oracle Text to reduce data movement and infrastructure dependency.
            Chosen solution: The selected solution was a backend migration from OpenSearch-based matching to Oracle Text for the core screening path. Query behavior, scoring behavior, indexing behavior, and production-scale volume characteristics had to remain measurable throughout the transition.
            Why it worked: Keeping matching closer to the database reduced service-boundary data movement, simplified architecture, and reduced operational cost while preserving reliability through production-like volume validation.
            Outcome: The migrated path supported 100+ TPS with sub-2.5 second average latency across large volume runs. It also supported screening across eight simultaneous watchlists while improving infrastructure efficiency.
            """,
            "blog"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/blog/ai-relevance-semantic-search-llm-workflows",
            "Blending AI relevance, semantic search, and LLM workflow ideas",
            """
            Blog post: Blending AI relevance, semantic search, and LLM workflow ideas. Category: AI and LLM. Published: March 2026.
            Summary: A practical view of where AI relevance, semantic retrieval, and LLM-assisted workflows fit inside enterprise backend systems.
            Tags: Semantic Search, AI Relevance, LLM Workflows, Hybrid Matching.
            Stats: Focus AI relevance. Search semantic. Workflow LLM-assisted.
            Takeaways: The issue came from brittle matching behavior when enterprise data contained noisy names, aliases, and transliteration differences. A pure AI replacement was not suitable because screening decisions still needed control, auditability, and predictable behavior. The strongest approach was hybrid: deterministic rules for trust, semantic retrieval for recall, and LLM workflows for assisted productivity.
            How the issue surfaced: In enterprise screening workflows, matching quality becomes difficult when input data is noisy. Names may be abbreviated, transliterated, reordered, misspelled, or represented differently across systems and watchlists. Traditional deterministic matching is strong for control and auditability, but it can become brittle when the same real-world entity appears in many textual variations.
            Why it mattered: Screening workflows must balance finding more relevant matches with keeping every decision explainable. A system that only improves recall can increase false positives, while a system that is too strict can miss important matches. AI and LLM capabilities are useful only when grounded in controlled backend workflows, measurable scoring behavior, and human-reviewable output.
            Possible solutions considered: Keep only deterministic rules and tune thresholds, rely heavily on AI similarity as the primary matching layer, or combine deterministic scoring, semantic retrieval, and LLM-assisted workflow patterns with clear boundaries.
            Chosen solution: The selected direction was hybrid. Deterministic rules remained responsible for control, scoring boundaries, and auditability. Semantic retrieval and AI similarity improved relevance where string-based matching alone was not enough. LLM-assisted workflows supported tasks like summarizing review context, assisting operations, and helping engineering teams work faster while keeping outputs reviewable.
            Why it worked: Rules were used for trust, semantic search for relevance, and LLM-assisted workflows for operational productivity.
            Outcome: The result was a practical AI architecture pattern for backend systems: deterministic matching provides the foundation, AI relevance strengthens search quality, and LLM workflows improve productivity around controlled human-reviewable processes.
            """,
            "blog"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/blog/backend-throughput-database-cache-async-optimization",
            "Improving backend throughput with database, cache, and async patterns",
            """
            Blog post: Improving backend throughput with database, cache, and async patterns. Category: Performance. Published: May 2026.
            Summary: A professional breakdown of how repeated data access, cache overhead, and blocking writes were reduced through database-side processing, selective caching, and asynchronous execution.
            Tags: Async Processing, Caching, Stored Procedures, Backend Throughput.
            Stats: Client pacing about 320ms. Focus throughput. Pattern async plus cache.
            Takeaways: The issue surfaced when request processing showed repeated data access, JSON handling, cache conversion overhead, and blocking write paths. Possible solutions included service rewrites, infrastructure scaling, or targeted optimization across database, cache, and asynchronous execution. The targeted approach worked because each bottleneck was moved to the layer best suited to handle it efficiently.
            How the issue surfaced: The performance issue appeared during backend throughput analysis of request flows that performed repeated data access, JSON processing, cache interactions, and database writes. Each individual operation looked manageable, but together they created avoidable latency and server load. A consistent client-side pacing pattern showed an average gap of around 320ms between receiving one response and sending the next request.
            Why it mattered: Backend throughput is affected by repeated friction across the request lifecycle. Extra round-trips, repeated serialization, frequently executed select queries, and blocking writes can reduce capacity even when no single component appears broken.
            Possible solutions considered: Rewrite the service flow completely with higher regression risk, scale infrastructure to absorb overhead, or optimize the existing flow by reducing round-trips, caching high-value reads, improving cache conversion paths, and moving non-critical writes out of the synchronous path.
            Chosen solution: Suitable data-heavy work moved closer to the database, cache efficiency improved, and asynchronous execution handled work that did not need to block immediate response. JSON processing and event preparation moved into database-side procedures. Duplicate suppression happened earlier in the flow. Targeted indexes improved lookup performance on frequently accessed paths.
            Why it worked: Database-side procedures reduced repeated network round-trips, indexes improved hot-path access, selective caching reduced read pressure, and asynchronous execution kept supporting writes off the main request flow.
            Outcome: The final pattern improved request flow efficiency by reducing repeated backend work across database access, cache usage, and synchronous execution. The 320ms client pacing observation helped distinguish backend latency from client-side request timing.
            """,
            "blog"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/active-builds/sai-assistant",
            "Sai's Assistant architecture",
            """
            Active build: Sai's Assistant. Sai's Assistant is a hybrid website assistant: curated website knowledge base plus LLM, smart routing, source chips, action links, and safe fallback behavior.
            Scope: The assistant answers from portfolio sections, selected projects, blogs, AI Radar, latest updates, dashboard notes, credentials, sign-in access, saved posts, and work-with-me links. If a question is outside that scope, it should say so instead of guessing.
            Production architecture: the React portfolio hosts the floating chat UI. Deployment configuration routes chat requests to the managed Spring Boot RAG backend. Spring sanitizes the request, checks fast paths and cache, embeds the question, retrieves semantic vector candidates from Oracle 23ai, retrieves exact lexical candidates from titles, URLs, metadata, and chunk text, merges both candidate sets, applies rule-based reranking with vector distance plus metadata, builds a grounded prompt, calls Groq or Gemini, and returns answer text with citations.
            Offline ingestion: the protected admin refresh loads structured portfolio knowledge and configured site pages, normalizes the text, splits it into roughly 2.2K-character chunks with overlap, and builds embedding text from title, source URL, category, section, and chunk text.
            Embeddings: Gemini embedding mode creates retrieval-document vectors during ingestion and retrieval-query vectors during chat. The service normalizes reduced 1536-dimension Gemini vectors before storage so cosine distance stays consistent. The local provider remains useful for development fallback.
            Vector store: Oracle 23ai stores chunk text, source metadata, category, section, priority, source kind, loader, and vector embeddings in a native VECTOR column. Search orders candidates with cosine VECTOR_DISTANCE and returns distance values before Spring applies hybrid reranking.
            Retrieval scoring: Spring uses hybrid search plus rule-based reranking. Exact lexical search catches literal names, abbreviations, URLs, and section terms, while semantic vector search catches meaning. The reranker combines vector similarity, exact match strength, source metadata, category, title, body keyword matches, and page-aware intent. If the strongest match falls below the configured similarity threshold, the service returns a controlled no-context answer instead of forcing weak evidence into the model prompt.
            Chat UI contract: the frontend sends sessionId, message, current page context, and optional recent history. The backend returns sessionId, answer, citations, retrieved chunk count, timing, and follow-up prompts. The UI renders the answer plus source chips, response timing, stage progress, and next questions.
            Design principles: grounded by default, third-person identity boundary, visible citations, guarded admin ingest, graceful fallback, streaming progress, metadata-aware retrieval, and useful direction.
            """,
            "active-build"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/active-builds",
            "Active Builds and SpringOps AI roadmap",
            """
            Active Builds documents Sai's current product and learning builds. The current product build is Sai's Assistant, a website-aware AI guide powered by curated site knowledge, LLM routing, source/action chips, and safe fallback behavior.
            SpringOps AI is the planned backend learning project: a distributed job scheduler and orchestration platform powered by Spring Boot and AI-assisted failure analysis. It will include job submission, worker processing, retries, queueing, monitoring, dashboard updates, and AI failure explanations.
            SpringOps AI is designed to revise Spring Boot, MVC, JPA, transactions, security, scheduling, async executors, events, caching, Actuator, Resilience4j, messaging, testing, Docker, and Kubernetes.
            """,
            "active-build"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/ai-radar",
            "AI Radar",
            """
            AI Radar is a live ranked board for official and free AI sources. It refreshes from RSS or Atom feeds, uses source thumbnails when provided, renders generated cover art otherwise, and links readers to original articles.
            Sources include public official sources such as OpenAI, Anthropic, Google DeepMind, Hugging Face, NVIDIA, LangChain, AWS ML, and arXiv-style AI research sources.
            Ranking favors current buzz, official sources, recency, and practical builder relevance. The feature highlights recent articles, links to original sources, and supports saved posts for signed-in readers.
            """,
            "page"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/saved-posts",
            "Saved Posts",
            """
            Saved Posts is a signed-in reader feature for saving blog posts and AI Radar articles into a personal reading list with tags.
            Saved items stay consistent across blog pages, AI Radar, and the Saved Posts page. Visitors who are not signed in are prompted to sign in before saving.
            """,
            "page"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/signin",
            "Newsletter and reader access",
            """
            The footer newsletter form lets visitors subscribe with only an email address. Sign in is used for protected blog posts and saved posts.
            The newsletter sends occasional engineering updates about backend performance, search systems, AI workflows, and selected portfolio updates. Readers can unsubscribe anytime.
            The system uses subscribed email preferences instead of collecting passwords for newsletter access.
            """,
            "subscription"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/start",
            "Start Here guide",
            """
            Start Here is the guided first-visit path. It explains what the website contains, what to read first, where to explore projects, and how to follow new updates.
            The guide points visitors toward the portfolio, engineering notes, AI Radar, active builds, saved resources, and latest updates.
            """,
            "page"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/whats-new",
            "What's New and site updates",
            """
            What's New collects recent site updates from the last 30 days so visitors can scan fresh pages, blog additions, and feature changes quickly.
            Recent updates include: Learn With Me is now password protected on 2026-05-20; main navigation cleaned up for desktop and mobile on 2026-05-20; left side menu simplified on 2026-05-20; Sai's Assistant active build added on 2026-05-20; AI Radar page added on 2026-05-19; Start Here guide added on 2026-05-19; What's New page added on 2026-05-19; Sai's Shelf opened on 2026-05-19; Improving backend throughput with database, cache, and async patterns published on 2026-05-15; Work With Me page added on 2026-05-14.
            """,
            "update"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/shelf",
            "Sai's Shelf",
            """
            Sai's Shelf is planned as a useful resource area for CS fundamentals, AI notes, engineering references, and practical learning material.
            It is a future home for useful engineering references, CS fundamentals, AI notes, and practical learning material.
            """,
            "page"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/learn-with-me",
            "Learn With Me",
            """
            Learn With Me is a protected learning room for simple, practical explanations of CS fundamentals, backend systems, search architecture, and AI workflows.
            It is designed to move from concept, to real scenario, to system-design connection, to a small build.
            Tracks include Back to Basics, Backend Performance, Search Systems, and Practical AI.
            The page is password protected because it can contain early drafts, selected learning notes, scripts, and experiments.
            """,
            "page"
        ));

        documents.add(structured(
            "https://saikumarmediboina.com/dashboard",
            "Creator dashboard",
            """
            The Creator Dashboard summarizes portfolio momentum: blog coverage, topic distribution, publishing rhythm, top content, and recent site signals.
            Dashboard summary includes total blogs, topic lanes, projects, and average read time. It tracks page views, article opens, saved posts, AI Radar reads, newsletter joins, and assistant questions when analytics are configured.
            The dashboard is designed for editorial clarity, not inflated vanity metrics.
            """,
            "dashboard"
        ));

        return List.copyOf(documents);
    }

    public List<SourceDocument> fallbackSeedDocuments() {
        return structuredSiteDocuments();
    }

    private SourceDocument structured(String sourceUrl, String title, String text, String category) {
        return new SourceDocument(
            sourceUrl,
            title,
            text.strip(),
            Map.of(
                "loader", "structured-site",
                "category", category
            )
        );
    }

    private SourceDocument fallbackDocument(String url) {
        return new SourceDocument(
            url,
            "Fallback source for " + url,
            "This source could not be fetched right now. Keep the URL in the ingestion plan and retry when network access is available.",
            Map.of("loader", "fallback")
        );
    }
}
