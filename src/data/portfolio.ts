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
    title: "Model Context Protocol: Introduction and Advanced Topics",
    issuer: "Anthropic",
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


