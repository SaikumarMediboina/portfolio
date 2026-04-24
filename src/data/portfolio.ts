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
  role: "Backend Engineer",
  company: "Oracle",
  location: "Rajahmundry, Andhra Pradesh, India",
  currentTitle: "Application Developer",
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
    label: "Real-time speedup",
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
    caption: "Search plus deterministic scoring",
    detail:
      "Combining deterministic matching rules with AI-assisted similarity signals to improve precision on noisy global watchlists.",
  },
  {
    title: "Semantic search and AI relevance",
    caption: "Intelligence on top of search systems",
    detail:
      "Using semantic retrieval patterns and configurable scoring to make screening results stronger without losing explainability.",
  },
  {
    title: "LLM-enabled workflows",
    caption: "Practical AI inside enterprise operations",
    detail:
      "Exploring prompt-driven workflows and LLM-assisted automation where human review, correctness, and controlled behavior still matter.",
  },
  {
    title: "Batch reliability at scale",
    caption: "Millions of records, zero-error runs",
    detail:
      "Designing ingestion, cleansing, and indexing flows that stay dependable while transaction volume and watchlist size grow.",
  },
];

export type ExperienceEntry = {
  role: string;
  company: string;
  period: string;
  location: string;
  summary: string;
  achievements: string[];
};

export const experience: ExperienceEntry[] = [
  {
    role: "Application Developer",
    company: "Oracle",
    period: "Aug 2023 - Present",
    location: "Bangalore, India",
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
  name: string;
  impact: string;
  summary: string;
  stack: string[];
  highlights: string[];
};

export const projects: Project[] = [
  {
    name: "Matching and Scoring Engine",
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
];

export type BlogPost = {
  title: string;
  category: string;
  publishedAt: string;
  readTime: string;
  summary: string;
  takeaways: string[];
};

export const blogPosts: BlogPost[] = [
  {
    title: "Cutting batch screening latency by 97 percent",
    category: "Performance",
    publishedAt: "April 2026",
    readTime: "5 min read",
    summary:
      "A breakdown of how indexing, batching, and parallel processing turned a slow compliance workflow into a much faster screening run.",
    takeaways: [
      "Targeted indexing on hot paths reduced repeated query costs.",
      "Aggregated queries replaced expensive N+1 access patterns.",
      "Parallel processing improved throughput without sacrificing correctness.",
    ],
  },
  {
    title: "Migrating search-heavy screening from OpenSearch to Oracle Text",
    category: "Architecture",
    publishedAt: "April 2026",
    readTime: "6 min read",
    summary:
      "Why moving the matching engine closer to the data layer improved scale, reduced infrastructure cost, and still kept the platform fast.",
    takeaways: [
      "Storage-level computation reduced operational overhead in the search path.",
      "Migration strategy preserved throughput while simplifying heavy screening workloads.",
      "The new approach supported enterprise volume without giving up reliability.",
    ],
  },
  {
    title: "Blending AI relevance, semantic search, and LLM workflow ideas",
    category: "AI and LLM",
    publishedAt: "March 2026",
    readTime: "4 min read",
    summary:
      "Notes on combining deterministic scoring, AI-assisted similarity, and practical LLM-based workflows in enterprise backend systems.",
    takeaways: [
      "AI similarity helps where pure string matching becomes too brittle.",
      "Semantic retrieval improves recall when watchlist data is noisy or transliterated.",
      "LLM workflows are most useful when kept grounded in auditable backend controls.",
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
    items: ["Oracle 19c", "Oracle Text", "OpenSearch", "MySQL"],
  },
  {
    title: "AI, Search, and Intelligence",
    items: ["Semantic Search", "AI Similarity", "LLM Workflows", "Prompt Design", "Fuzzy Matching"],
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

export type Certification = {
  title: string;
  issuer: string;
  year: string;
};

export const certifications: Certification[] = [
  {
    title: "Oracle Cloud Infrastructure AI Foundations",
    issuer: "Oracle",
    year: "2024",
  },
  {
    title: "Oracle Database 19c: PL/SQL Workshop",
    issuer: "Oracle",
    year: "2023",
  },
  {
    title: "Spring 6 with Spring Boot 3 and Java EE: Concurrency",
    issuer: "LinkedIn Learning",
    year: "2024",
  },
  {
    title: "Advanced Core Java and Spring Boot Architecture",
    issuer: "Udemy",
    year: "2026",
  },
  {
    title: "Low-Level Design",
    issuer: "takeUforward",
    year: "Mar 2026",
  },
];


