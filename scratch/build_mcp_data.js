const fs = require("fs");
const path = require("path");

const mcpContentCode = `export type CalloutType =
  | "beginner-explanation"
  | "developer-deep-dive"
  | "important"
  | "security-note"
  | "common-mistake"
  | "try-it-yourself";

export type CalloutData = {
  type: CalloutType;
  title: string;
  content: string;
};

export type DiagramType =
  | "usb-c"
  | "host-client-server"
  | "github-flow"
  | "without-vs-with"
  | "brain-and-hands"
  | "json-rpc"
  | "scenario-1-github"
  | "scenario-2-docs"
  | "scenario-3-cms"
  | "sequence-diagram"
  | "failure-example";

export type DiagramData = {
  id: string;
  title: string;
  description: string;
  type: DiagramType;
  steps?: { label: string; sub?: string; desc: string }[];
  nodes?: { name: string; role: string; highlight?: boolean }[];
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type CodeSnippet = {
  language: string;
  filename?: string;
  code: string;
};

export type ArticleSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  callout?: CalloutData;
  diagram?: DiagramData;
  code?: CodeSnippet;
  table?: {
    headers: string[];
    rows: string[][];
  };
  quiz?: QuizQuestion;
  quizzes?: QuizQuestion[];
};

export type ArticleData = {
  slug: string;
  title: string;
  seoTitle: string;
  metaDescription: string;
  moduleName: string;
  moduleNumber: number;
  partLabel: string;
  difficulty: "Beginner" | "Beginner to Developer";
  readingTime: string;
  lastUpdated: string;
  openingSummary: string;
  whatYouWillLearn: string[];
  sections: ArticleSection[];
  keyTakeaways: string[];
  prevRoute?: { slug: string; title: string };
  nextRoute?: { slug: string; title: string };
};

export type CourseModule = {
  id: string;
  number: number;
  title: string;
  isLocked?: boolean;
  topics: {
    id: string;
    title: string;
    slug: string;
    isLocked?: boolean;
    readingTime?: string;
  }[];
};

export function calculateArticleWordCount(article: ArticleData): number {
  let count = 0;
  count += article.title.split(/\\s+/).filter(Boolean).length;
  count += article.openingSummary.split(/\\s+/).filter(Boolean).length;
  for (const item of article.whatYouWillLearn) {
    count += item.split(/\\s+/).filter(Boolean).length;
  }
  for (const sec of article.sections) {
    count += sec.heading.split(/\\s+/).filter(Boolean).length;
    for (const p of sec.paragraphs) {
      count += p.split(/\\s+/).filter(Boolean).length;
    }
    if (sec.bullets) {
      for (const b of sec.bullets) {
        count += b.split(/\\s+/).filter(Boolean).length;
      }
    }
    if (sec.callout) {
      count += sec.callout.title.split(/\\s+/).filter(Boolean).length;
      count += sec.callout.content.split(/\\s+/).filter(Boolean).length;
    }
    if (sec.quiz) {
      count += sec.quiz.question.split(/\\s+/).filter(Boolean).length;
      for (const o of sec.quiz.options) {
        count += o.split(/\\s+/).filter(Boolean).length;
      }
      count += sec.quiz.explanation.split(/\\s+/).filter(Boolean).length;
    }
    if (sec.quizzes) {
      for (const q of sec.quizzes) {
        count += q.question.split(/\\s+/).filter(Boolean).length;
        for (const o of q.options) {
          count += o.split(/\\s+/).filter(Boolean).length;
        }
        count += q.explanation.split(/\\s+/).filter(Boolean).length;
      }
    }
    if (sec.table) {
      for (const h of sec.table.headers) {
        count += h.split(/\\s+/).filter(Boolean).length;
      }
      for (const row of sec.table.rows) {
        for (const cell of row) {
          count += cell.split(/\\s+/).filter(Boolean).length;
        }
      }
    }
  }
  for (const kt of article.keyTakeaways) {
    count += kt.split(/\\s+/).filter(Boolean).length;
  }
  return count;
}

export function getCalculatedReadingTime(article: ArticleData): string {
  const words = calculateArticleWordCount(article);
  const minutes = Math.max(1, Math.round(words / 220));
  return \`\${minutes} min read\`;
}

export const courseModulesData: CourseModule[] = [
  {
    id: "module-1",
    number: 1,
    title: "MCP Fundamentals and Architecture",
    isLocked: false,
    topics: [
      {
        id: "topic-1-1",
        title: "Part 1: MCP Fundamentals (What Is MCP & Why AI Needs Tools)",
        slug: "/mcp/fundamentals",
        isLocked: false,
        readingTime: "13 min read",
      },
      {
        id: "topic-1-2",
        title: "Part 2: MCP Architecture (Host, Client, and Server Visually)",
        slug: "/mcp/architecture",
        isLocked: false,
        readingTime: "16 min read",
      },
    ],
  },
  {
    id: "module-2",
    number: 2,
    title: "Building MCP Servers in Python",
    isLocked: true,
    topics: [
      { id: "topic-2-1", title: "Setting Up FastMCP & Dependencies", slug: "#", isLocked: true },
      { id: "topic-2-2", title: "Defining Tools, Prompts & Resources", slug: "#", isLocked: true },
      { id: "topic-2-3", title: "Exposing Local Files & SQLite DBs", slug: "#", isLocked: true },
    ],
  },
  {
    id: "module-3",
    number: 3,
    title: "Connecting MCP Clients & Hosts",
    isLocked: true,
    topics: [
      { id: "topic-3-1", title: "Configuring Claude Desktop & Cursor", slug: "#", isLocked: true },
      { id: "topic-3-2", title: "Building a Custom TypeScript Client", slug: "#", isLocked: true },
      { id: "topic-3-3", title: "Managing Connections & Lifecycle", slug: "#", isLocked: true },
    ],
  },
  {
    id: "module-4",
    number: 4,
    title: "JSON-RPC Protocol Deep Dive",
    isLocked: true,
    topics: [
      { id: "topic-4-1", title: "Requests, Responses & Notifications", slug: "#", isLocked: true },
      { id: "topic-4-2", title: "Capability Negotiation & Handshake", slug: "#", isLocked: true },
      { id: "topic-4-3", title: "Error Codes & Exception Handling", slug: "#", isLocked: true },
    ],
  },
  {
    id: "module-5",
    number: 5,
    title: "Production Deployment & Security",
    isLocked: true,
    topics: [
      { id: "topic-5-1", title: "stdio vs Streamable HTTP SSE Transports", slug: "#", isLocked: true },
      { id: "topic-5-2", title: "OAuth 2.0 & Token Authentication", slug: "#", isLocked: true },
      { id: "topic-5-3", title: "Rate Limiting & Sandboxing Servers", slug: "#", isLocked: true },
    ],
  },
  {
    id: "module-6",
    number: 6,
    title: "Building Real-World AI Agents",
    isLocked: true,
    topics: [
      { id: "topic-6-1", title: "Multi-Server Workflows with Claude", slug: "#", isLocked: true },
      { id: "topic-6-2", title: "Human-in-the-Loop Approval Patterns", slug: "#", isLocked: true },
      { id: "topic-6-3", title: "Monitoring, Tracing & Debugging MCP", slug: "#", isLocked: true },
    ],
  },
];
`;

console.log("Writing base mcpContent module structure...");
