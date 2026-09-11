export type Profile = {
  name: string;
  role: string;
  company: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  email: string;
  phone: string;
  linkedin: string;
  tagline: string;
  summary: string;
  focus: string;
};

export const profile: Profile = {
  name: "Sai Kumar Mediboina",
  role: "Software Application Engineer",
  company: "Oracle",
  location: "Rajahmundry, Andhra Pradesh, India",
  currentTitle: "Software Application Engineer",
  currentCompany: "Oracle, Bangalore",
  email: "msaikumar6789@gmail.com",
  phone: "+91 9133707661",
  linkedin: "https://www.linkedin.com/in/saikumar-mediboina-1b8258136/",
  tagline:
    "I build high-throughput screening systems, search platforms, and AI-assisted backend services that turn complex compliance workloads into dependable products.",
  summary:
    "Backend engineer specializing in distributed systems, search, performance optimization, and AI-driven product workflows. My work combines cloud-native architecture, data-heavy pipelines, semantic search, and emerging LLM-assisted automation across both real-time and batch processing.",
  focus:
    "I like solving problems where latency, scale, and correctness all matter at the same time. Most of my recent work blends deterministic rules, semantic search, AI scoring, and practical LLM workflow ideas to improve screening accuracy and delivery speed.",
};

export type Metric = {
  value: string;
  label: string;
  detail: string;
};

export const metrics: Metric[] = [
  {
    value: "97%",
    label: "Batch latency reduction",
    detail: "Reduced a 5K transaction screening run from 2 hours 5 minutes to 3 minutes.",
  },
  {
    value: "85%",
    label: "Real-time latency reduction",
    detail: "Brought synchronous screening down from 2 seconds to about 300 milliseconds.",
  },
  {
    value: "100+ TPS",
    label: "Runtime scale",
    detail: "Sustained throughput with sub-2.5 second average latency.",
  },
  {
    value: "7x",
    label: "Award-recognized improvement",
    detail: "Recognized at Oracle for migration and performance impact.",
  },
];

export type FocusArea = {
  title: string;
  caption: string;
  detail: string;
};

export const currentFocus: FocusArea[] = [
  {
    title: "Hybrid matching engine",
    caption: "Search + scoring",
    detail:
      "Combines rules, fuzzy scoring, and AI similarity to improve noisy watchlist matching.",
  },
  {
    title: "Semantic search and AI relevance",
    caption: "Smarter retrieval",
    detail:
      "Adds semantic retrieval and configurable scoring without losing explainable results.",
  },
  {
    title: "LLM-enabled workflows",
    caption: "Controlled AI workflows",
    detail:
      "Uses LLM assistance where review, correctness, and predictable behavior still matter.",
  },
  {
    title: "Batch reliability at scale",
    caption: "Reliable batch scale",
    detail:
      "Designs ingestion, cleansing, and indexing paths that stay stable as volume grows.",
  },
];

export type ExperienceEntry = {
  company: string;
  employmentType: string;
  location: string;
  roles: {
    title: string;
    period: string;
    detail: string;
  }[];
  summary: string;
  achievements: string[];
};

export const experience: ExperienceEntry[] = [
  {
    company: "Oracle",
    employmentType: "Full-time",
    location: "Bengaluru, Karnataka, India · Remote",
    roles: [
      {
        title: "Software Application Engineer",
        period: "May 2026 - Present",
        detail:
          "Current role focused on backend platform engineering, search architecture, performance optimization, and AI-enabled workflow design.",
      },
      {
        title: "Application Developer",
        period: "Aug 2023 - May 2026",
        detail:
          "Built and optimized high-throughput screening, matching, and transaction filtering capabilities across real-time and batch workloads.",
      },
    ],
    summary:
      "Architecting a scalable cloud-native compliance platform on OCI and Kubernetes for customer screening and transaction filtering. The platform combines OpenSearch, Oracle Text, AI-assisted search, and hybrid decision logic to support both real-time requests and high-volume nightly workloads.",
    achievements: [
      "Designed secure Spring APIs to ingest 100 concurrent real-time payloads alongside batch screening runs.",
      "Engineered a fault-tolerant PL/SQL pipeline to cleanse, denoise, and transliterate watchlist data before indexing.",
      "Led backend migration from OpenSearch to Oracle Text to improve scale and reduce infrastructure cost.",
      "Supported hybrid scoring approaches that blended deterministic logic with AI similarity and semantic retrieval.",
      "Explored practical LLM-assisted workflow ideas for enterprise operations and developer productivity.",
    ],
  },
];

export type Project = {
  slug: string;
  problem: string;
  contribution: string;
  architecture: string[];
  result: string;
  evidenceNote: string;
  name: string;
  impact: string;
  summary: string;
  stack: string[];
  highlights: string[];
};

export const projects: Project[] = [
  {
    name: "Matching and Scoring Engine",
    slug: "matching-and-scoring-engine",
    problem: "Customer and transaction screening had to support interactive requests and nightly batches against very large watchlists.",
    contribution: "Designed secure REST APIs and resilient ingestion for real-time and batch screening.",
    architecture: ["Input","Screening APIs","Watchlist matching","Results"],
    result: "100+ TPS with average latency below 2.5 seconds across 23,000-message runs.",
    evidenceNote: "Reported workload: 23,000 messages; eight simultaneous watchlists. These are existing portfolio figures, not independently audited benchmarks.",
    impact: "Scaled screening to millions of transactions against billions of records.",
    summary:
      "A compliance screening platform for customer screening and transaction filtering, built to handle both interactive lookups and high-volume nightly processing.",
    stack: ["Java", "Spring Boot", "OpenSearch", "Oracle Text", "OCI", "Kubernetes"],
    highlights: [
      "Designed secure REST APIs and resilient ingestion for both real-time and batch flows.",
      "Delivered 100+ TPS with sub-2.5 second average latency across 23,000-message runs.",
      "Enabled screening across eight simultaneous watchlists with zero-error volume runs.",
    ],
  },
  {
    name: "Core Search Engine Migration",
    slug: "core-search-engine-migration",
    problem: "Heavy search paths required a simpler architecture with matching closer to stored data.",
    contribution: "Led the backend transition from OpenSearch to Oracle Text and moved core matching toward storage-level computation.",
    architecture: ["Search requests","Backend matching","Oracle Text","Matches"],
    result: "Reduced infrastructure cost while maintaining production throughput.",
    evidenceNote: "Qualitative outcome from the existing project record; no cost percentage or benchmark dataset is published.",
    impact: "Reduced infrastructure cost while improving scale and search locality.",
    summary:
      "Spearheaded the backend transition from OpenSearch to Oracle Text to move more matching work closer to storage and simplify heavy search paths.",
    stack: ["Oracle Text", "OpenSearch", "OCI", "Kubernetes"],
    highlights: [
      "Shifted core matching behavior toward storage-level computation.",
      "Improved cost behavior without sacrificing production throughput.",
      "Helped earn Oracle recognition for the migration and measurable speedups.",
    ],
  },
  {
    name: "Advanced Hybrid Scoring Engine",
    slug: "advanced-hybrid-scoring-engine",
    problem: "Noisy global watchlist records could not be resolved reliably with string equality alone.",
    contribution: "Built a configurable scoring microservice combining AI similarity with exact, fuzzy and deterministic matching rules.",
    architecture: ["Candidate records","AI + rule signals","Combined scoring","Ranked matches"],
    result: "Improved entity resolution quality and reduced false positives.",
    evidenceNote: "Qualitative outcome from the existing project record; no precision/recall evaluation is published.",
    impact: "Improved entity resolution quality while reducing false positives.",
    summary:
      "Developed a configurable scoring microservice that blended AI similarity signals with deterministic matching rules for global watchlist data.",
    stack: ["Java", "AI Similarity", "Semantic Search", "Microservices"],
    highlights: [
      "Combined exact matching, fuzzy logic, and configurable scoring signals.",
      "Balanced explainability with stronger ranking quality for noisy records.",
      "Improved relevance for screening scenarios where raw string equality was not enough.",
    ],
  },
  {
    name: "High-Volume Batch Processing",
    slug: "high-volume-batch-processing",
    problem: "A 5,000-transaction screening batch took 2 hours 5 minutes, with bottlenecks in database access and processing.",
    contribution: "Removed N+1 access patterns, added targeted indexes and improved parallel processing.",
    architecture: ["Batch input","Aggregated queries","Indexed matching","Batch results"],
    result: "5,000-transaction batch: 2 hours 5 minutes → 3 minutes.",
    evidenceNote: "Existing portfolio measurement for a 5K batch; hardware, dataset and reproducible test report are not published.",
    impact: "Cut a 5K batch screening run from 2 hours 5 minutes to 3 minutes.",
    summary:
      "Improved batch screening by attacking the largest bottlenecks across indexing, query patterns, and multi-threaded processing.",
    stack: ["SQL", "PL/SQL", "Database Indexing", "Parallel Processing"],
    highlights: [
      "Eliminated N+1 access patterns with aggregated query flows.",
      "Added targeted indexing to the most expensive hot paths.",
      "Scaled the same direction toward 25K transactions with stable latency behavior.",
    ],
  },
  {
    name: "Real-Time Screening Optimization",
    slug: "real-time-screening-optimization",
    problem: "A synchronous screening path took roughly 2 seconds and needed better responsiveness under concurrent traffic.",
    contribution: "Parallelized database work using dedicated thread pools and replaced JSON aggregation bottlenecks with incremental result streaming.",
    architecture: ["Request","Parallel DB work","Incremental results","Response"],
    result: "Reported real-time latency: roughly 2 seconds → 300 milliseconds.",
    evidenceNote: "Existing portfolio measurement; the latency percentile and concurrency level are not published.",
    impact: "Reduced real-time latency from roughly 2 seconds to 300 milliseconds.",
    summary:
      "Redesigned a synchronous screening path into an asynchronous pipeline to improve responsiveness under concurrent production traffic.",
    stack: ["Java", "Parallel Processing", "Thread Management", "Oracle"],
    highlights: [
      "Parallelized database work across dedicated thread pools.",
      "Removed JSON aggregation bottlenecks through incremental result streaming.",
      "Improved user-visible response times without sacrificing backend correctness.",
    ],
  },
  {
    name: "Narrative Text Extraction Engine",
    slug: "narrative-text-extraction-engine",
    problem: "Unstructured narrative text needed candidate entities extracted before the main screening stage.",
    contribution: "Built a configurable parser and ranked candidate substrings using match quality, token length and gap penalties.",
    architecture: ["Narrative text","Tokenization","Candidate ranking","Screening input"],
    result: "Improved precision in candidate extraction from noisy text.",
    evidenceNote: "Qualitative outcome from the existing project record; no labelled evaluation dataset or accuracy score is published.",
    impact: "Improved precision when extracting candidate entities from noisy text.",
    summary:
      "Built an intelligent parser that tokenizes unstructured input and ranks candidate matches using configurable exact and fuzzy logic.",
    stack: ["Java", "PL/SQL", "LLM Models", "Scoring Algorithms"],
    highlights: [
      "Scored candidates using match quality, token length, and gap penalties.",
      "Extracted best-match substrings before the main screening stage.",
      "Made the matching behavior configurable so teams could tune it without rewriting the engine.",
    ],
  },
  {
    name: "Enterprise RAG Knowledge Assistant",
    slug: "enterprise-rag-knowledge-assistant",
    problem: "An enterprise knowledge assistant needed to answer questions from curated material and make its supporting sources visible.",
    contribution: "Built and deployed the React/TypeScript interface, Spring Boot WebFlux backend, and Oracle 23ai vector-ready retrieval layer with LLM integration.",
    architecture: ["Question and history", "Hybrid retrieval", "Evidence reranking", "Streamed answer + sources"],
    result: "Delivered a source-cited assistant using 7 curated knowledge sources and up to 5 evidence chunks per query.",
    evidenceNote: "Implementation details reported in my updated resume; these configuration values are not an accuracy or latency benchmark.",
    impact: "Built a deployed, source-cited assistant with hybrid retrieval and streaming responses.",
    summary: "A full-stack knowledge assistant combining curated ingestion, exact-text and vector retrieval, reranking, and source-cited LLM responses.",
    stack: ["React", "TypeScript", "Spring Boot 3", "WebFlux", "Oracle 23ai", "Vector Search", "Vercel", "Render"],
    highlights: [
      "Created admin-controlled ingestion for 7 curated sources, using 2,200-character chunks with 220-character overlap and metadata enrichment.",
      "Retrieved up to 5 evidence chunks and reranked them using vector similarity, source metadata, category, title, and keyword-intent signals.",
      "Added Server-Sent Events for token streaming, session-aware chat history, response caching, and a 24-second request timeout.",
      "Included source citations with generated responses so readers can inspect the supporting material.",
    ],
  },
];

export type Recognition = {
  title: string;
  issuer: string;
  detail: string;
  highlight: string;
};

export const recognitions: Recognition[] = [
  {
    title: "Pace Setter by Oracle",
    issuer: "Oracle",
    detail:
      "Recognized for achieving a 7x performance improvement by reducing latency from 5 seconds to 700 milliseconds and contributing to the migration from OpenSearch to Oracle Text.",
    highlight: "7x performance gain",
  },
  {
    title: "Oracle Agent IR Hackathon",
    issuer: "Oracle | 2025",
    detail:
      "Built an enterprise application to automate daily IUT check-in activities and secured 5th place out of 200 teams.",
    highlight: "5th place out of 200 teams",
  },
];

export type SkillGroup = {
  title: string;
  items: string[];
};

export const skills: SkillGroup[] = [
  {
    title: "Languages",
    items: ["Java", "SQL", "PL/SQL"],
  },
  {
    title: "Frameworks and Architecture",
    items: ["Spring", "Spring Boot", "Hibernate", "REST APIs", "Microservices", "Apache Kafka"],
  },
  {
    title: "Databases and Search",
    items: ["Oracle 19c", "Oracle Text", "OpenSearch", "MySQL", "Oracle 23ai Vector Search", "Hybrid Search"],
  },
  {
    title: "AI, Search, and Intelligence",
    items: [
      "Semantic Search",
      "AI Similarity",
      "Embeddings",
      "RAG",
      "Hybrid Retrieval",
      "Rule-Based Reranking",
      "LLM Workflows",
      "Prompt Design",
      "Fuzzy Matching",
    ],
  },
  {
    title: "Cloud and Tooling",
    items: ["OCI", "Kubernetes", "Grafana", "APM", "Git", "Maven"],
  },
];

export type EducationEntry = {
  degree: string;
  school: string;
  period: string;
  score: string;
};

export const education: EducationEntry[] = [
  {
    degree: "M.Tech",
    school: "NIT Karnataka",
    period: "Aug 2021 - Jul 2023",
    score: "CGPA: 8.96",
  },
  {
    degree: "B.Tech",
    school: "JNTU Vizianagaram",
    period: "Jun 2016 - Sep 2020",
    score: "CGPA: 8.36",
  },
];

export type CertificationCategory = "AI & LLMs" | "Backend & Architecture" | "Oracle & Database";

export type Certification = {
  title: string;
  issuer: string;
  year: string;
  category: CertificationCategory;
  credentialId?: string;
};

export const certifications: Certification[] = [
  {
    title: "Model Context Protocol: Introduction and Advanced Topics",
    issuer: "Anthropic",
    year: "2026",
    category: "AI & LLMs",
  },
  {
    title: "Generative AI with Large Language Models",
    issuer: "DeepLearning.AI",
    year: "2026",
    category: "AI & LLMs",
  },
  {
    title: "Introduction to Generative AI for Software Development",
    issuer: "DeepLearning.AI",
    year: "2026",
    category: "AI & LLMs",
  },
  {
    title: "Generative AI for Everyone",
    issuer: "DeepLearning.AI",
    year: "2026",
    category: "AI & LLMs",
  },
  {
    title: "Team Software Engineering with AI",
    issuer: "DeepLearning.AI",
    year: "2026",
    category: "AI & LLMs",
  },
  {
    title: "AI-Powered Software and System Design",
    issuer: "DeepLearning.AI",
    year: "2026",
    category: "AI & LLMs",
  },
  {
    title: "Advanced Core Java and Spring Boot Architecture",
    issuer: "Udemy",
    year: "2026",
    category: "Backend & Architecture",
  },
  {
    title: "Low-Level Design",
    issuer: "takeUforward",
    year: "2026",
    category: "Backend & Architecture",
  },
  {
    title: "Spring 6 with Spring Boot 3 and Java EE: Concurrency",
    issuer: "LinkedIn Learning",
    year: "2024",
    category: "Backend & Architecture",
  },
  {
    title: "Oracle Cloud Infrastructure AI Foundations",
    issuer: "Oracle",
    year: "2024",
    category: "Oracle & Database",
  },
  {
    title: "Oracle Database 19c: PL/SQL Workshop",
    issuer: "Oracle",
    year: "2023",
    category: "Oracle & Database",
  },
];


