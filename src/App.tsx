import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { blogPosts, type BlogPost } from "./data/blogs";
import {
  certifications,
  currentFocus,
  education,
  experience,
  metrics,
  profile,
  projects,
  recognitions,
  skills,
} from "./data/portfolio";
import { auth, googleProvider, isFirebaseConfigured } from "./lib/firebase";
import {
  ensureSubscriberProfile,
  getSavedPostSlugs,
  saveReaderPost,
  saveSubscriber,
  subscribeToSavedPostSlugs,
  unsaveReaderPost,
  unsubscribeSubscriber,
} from "./lib/subscribers";

const portfolioNavLinks = [
  { href: "/", label: "Home" },
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "work", label: "Work" },
  { id: "skills", label: "Skills" },
  { id: "recognition", label: "Recognition" },
  { id: "credentials", label: "Credentials" },
] as const;

const mainNavLinks = [
  { href: "/start", label: "Start Here" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/blogs", label: "Blogs" },
  { href: "/ai-radar", label: "AI Radar" },
  { href: "/whats-new", label: "What's New" },
  { href: "/shelf", label: "Sai's Shelf" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/work-with-me", label: "Work With Me" },
  { href: "#about", id: "about", label: "About" },
] as const;

type SiteUpdate = {
  category: string;
  date: string;
  href: string;
  summary: string;
  title: string;
};

const siteUpdates: SiteUpdate[] = [
  {
    category: "AI Radar",
    date: "2026-05-19",
    href: "/ai-radar",
    title: "AI Radar page added",
    summary:
      "A curated board of official AI sources, original short notes, and safe link-out reading paths.",
  },
  {
    category: "Guide",
    date: "2026-05-19",
    href: "/start",
    title: "Start Here guide added",
    summary:
      "A first-visit path that explains what to read, where to explore projects, and how to follow new updates.",
  },
  {
    category: "Updates",
    date: "2026-05-19",
    href: "/whats-new",
    title: "What's New page added",
    summary:
      "A simple place to scan recent content headlines from the last 30 days without hunting through the site.",
  },
  {
    category: "Shelf",
    date: "2026-05-19",
    href: "/shelf",
    title: "Sai's Shelf opened",
    summary:
      "A future home for useful engineering references, CS fundamentals, AI notes, and practical learning material.",
  },
  {
    category: "Blog",
    date: "2026-05-15",
    href: "/blog/backend-throughput-database-cache-async-optimization",
    title: "Improving backend throughput with database, cache, and async patterns",
    summary:
      "A technical story about reducing repeated backend work across database access, cache usage, and async execution.",
  },
  {
    category: "Portfolio",
    date: "2026-05-14",
    href: "/work-with-me",
    title: "Work With Me page added",
    summary:
      "A dedicated page for professional conversations around backend performance, search systems, and practical AI workflows.",
  },
];

type Theme = "light" | "dark";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

type AssistantLink = {
  href: string;
  label: string;
  external?: boolean;
};

type AssistantMessage = {
  id: number;
  links?: AssistantLink[];
  role: "assistant" | "visitor";
  text: string;
};

function getInitialAssistantMessages(): AssistantMessage[] {
  return [
    {
      id: 1,
      role: "assistant",
      text: "Hey, I am Sai's website assistant. I answer from the portfolio, blogs, updates, and reader features on this site. If something is outside my notebook, I will say that clearly instead of guessing.",
      links: [
        { href: "/portfolio#work", label: "Projects" },
        { href: "/blogs", label: "Blogs" },
        { href: "/ai-radar", label: "AI Radar" },
      ],
    },
  ];
}

type SubscriberViewState =
  | "guest"
  | "newSignedIn"
  | "newSubscribed"
  | "newUnsubscribed"
  | "newSignedOutSubscribed"
  | "newSignedOutUnsubscribed"
  | "returningSubscribed"
  | "returningUnsubscribed"
  | "returningResubscribed"
  | "returningSignedOutSubscribed"
  | "returningSignedOutUnsubscribed";

const THEME_STORAGE_KEY = "portfolio-theme";
const SAVED_POSTS_STORAGE_KEY_PREFIX = "portfolio-saved-posts:";
const ALL_BLOG_CATEGORIES = "All";
const ALL_AI_RADAR_CATEGORIES = "All signals";
const PUBLIC_BLOG_SLUG = "backend-throughput-database-cache-async-optimization";
const LOCKED_BLOG_CAPTION =
  "This one is in the members-only lab. Sign in and the doors open.";

type AiRadarSignal = {
  category: string;
  cadence: string;
  href: string;
  imageUrl?: string;
  isLive?: boolean;
  publishedAt?: string;
  rank?: number;
  source: string;
  summary: string;
  title: string;
  whyItMatters: string;
};

type AiRadarApiItem = Partial<AiRadarSignal>;

type AiRadarApiResponse = {
  generatedAt?: string;
  items?: AiRadarApiItem[];
};

const aiRadarSignals: AiRadarSignal[] = [
  {
    category: "Models",
    cadence: "Official release notes",
    href: "https://openai.com/news/",
    source: "OpenAI News",
    title: "Model and product release signal",
    summary:
      "Official updates on new models, product changes, developer capabilities, and safety notes.",
    whyItMatters:
      "Useful for tracking what is actually shipping, not just what is trending on social feeds.",
  },
  {
    category: "Agents",
    cadence: "Research and company updates",
    href: "https://www.anthropic.com/news",
    source: "Anthropic News",
    title: "Agentic workflows and model behavior",
    summary:
      "A good source for model capability notes, safety framing, and practical AI workflow direction.",
    whyItMatters:
      "Helpful when thinking about assistants, tool use, MCP-style integrations, and enterprise adoption.",
  },
  {
    category: "Research",
    cadence: "Recent papers",
    href: "https://arxiv.org/list/cs.AI/recent",
    source: "arXiv CS.AI",
    title: "Fresh AI research feed",
    summary:
      "A free research stream for AI papers, ideas, techniques, and early signals before they become products.",
    whyItMatters:
      "Best used as a source of direction. We link to papers instead of republishing paper text.",
  },
  {
    category: "Open Source",
    cadence: "Community engineering notes",
    href: "https://huggingface.co/blog",
    source: "Hugging Face Blog",
    title: "Open-source models and developer tooling",
    summary:
      "Practical posts around models, datasets, evaluation, inference, and the open-source AI ecosystem.",
    whyItMatters:
      "Strong place to watch what builders can actually try, fine-tune, host, and integrate.",
  },
  {
    category: "Industry",
    cadence: "AI product and research updates",
    href: "https://blog.google/technology/ai/",
    source: "Google AI Blog",
    title: "AI product and research movement",
    summary:
      "Official updates across search, Gemini, research, AI products, responsible AI, and developer tooling.",
    whyItMatters:
      "A useful view into how AI capabilities are moving into large-scale consumer and cloud products.",
  },
  {
    category: "Enterprise",
    cadence: "Cloud and platform updates",
    href: "https://blogs.nvidia.com/blog/category/artificial-intelligence/",
    source: "NVIDIA AI Blog",
    title: "AI infrastructure and enterprise adoption",
    summary:
      "Updates around GPUs, inference, enterprise AI systems, robotics, healthcare, and industrial AI.",
    whyItMatters:
      "Good signal for the infrastructure side of AI, especially when models move from demos to production.",
  },
];

function normalizeSavedPostSlugs(savedPostSlugs: unknown) {
  return Array.isArray(savedPostSlugs)
    ? Array.from(new Set(savedPostSlugs.filter((slug): slug is string => typeof slug === "string")))
    : [];
}

function getSavedPostsStorageKey(uid: string) {
  return `${SAVED_POSTS_STORAGE_KEY_PREFIX}${uid}`;
}

function readCachedSavedPostSlugs(uid: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return normalizeSavedPostSlugs(
      JSON.parse(window.localStorage.getItem(getSavedPostsStorageKey(uid)) ?? "[]"),
    );
  } catch {
    return [];
  }
}

function cacheSavedPostSlugs(uid: string, savedPostSlugs: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getSavedPostsStorageKey(uid),
      JSON.stringify(normalizeSavedPostSlugs(savedPostSlugs)),
    );
  } catch {
    // Saved posts still sync through Firestore if browser storage is restricted.
  }
}

function canReadBlogPost(post: BlogPost | undefined, user: User | null) {
  return Boolean(post && (post.slug === PUBLIC_BLOG_SLUG || user));
}

function orderBlogPostsForAccess(posts: BlogPost[]) {
  const publicPost = posts.find((post) => post.slug === PUBLIC_BLOG_SLUG);

  if (!publicPost) {
    return posts;
  }

  return [publicPost, ...posts.filter((post) => post.slug !== PUBLIC_BLOG_SLUG)];
}

function getBlogSlugFromPathname() {
  if (typeof window === "undefined") {
    return "";
  }

  const match = window.location.pathname.match(/^\/blog\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function isSignInPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/signin";
}

function isSavedPostsPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/saved-posts";
}

function isStartPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/start";
}

function isWhatsNewPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/whats-new";
}

function isAiRadarPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/ai-radar";
}

function isShelfPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/shelf";
}

function isDashboardPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/dashboard";
}

function isBlogsPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/blogs";
}

function isContactPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["/contact", "/work-with-me"].includes(window.location.pathname.replace(/\/$/, ""));
}

function isPortfolioPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/portfolio";
}

function getSignInReturnBlogSlug() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("blog") ?? "";
}

function getSignInReturnTarget() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("return") ?? "";
}

function isAdminUpdatePathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/admin-update";
}

function getBlogArticleHref(slug: string) {
  return `/blog/${encodeURIComponent(slug)}`;
}

function getSignInHref(slug?: string) {
  return slug ? `/signin?blog=${encodeURIComponent(slug)}` : "/signin";
}

function getSavedPostsSignInHref() {
  return "/signin?return=saved-posts";
}

function getReturnTargetConfig(target: string) {
  const returnTargets: Record<string, { href: string; label: string }> = {
    blogs: { href: "/blogs", label: "Back to blogs" },
    contact: { href: "/work-with-me", label: "Back to work with me" },
    dashboard: { href: "/dashboard", label: "Back to dashboard" },
    home: { href: "/", label: "Back home" },
    "ai-radar": { href: "/ai-radar", label: "Back to AI Radar" },
    portfolio: { href: "/portfolio", label: "Back to portfolio" },
    "saved-posts": { href: "/saved-posts", label: "Back to saved posts" },
    shelf: { href: "/shelf", label: "Back to shelf" },
    start: { href: "/start", label: "Back to start" },
    "whats-new": { href: "/whats-new", label: "Back to what's new" },
    "work-with-me": { href: "/work-with-me", label: "Back to work with me" },
  };

  return returnTargets[target] ?? null;
}

function getRecentSiteUpdates(updates: SiteUpdate[], days = 30) {
  const now = new Date();
  const maxAge = days * 24 * 60 * 60 * 1000;

  return [...updates]
    .filter((update) => {
      const age = now.getTime() - new Date(`${update.date}T00:00:00`).getTime();

      return age >= 0 && age <= maxAge;
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}

function formatUpdateDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function getDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getDashboardActivityBars(updates: SiteUpdate[], days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const updateCounts = new Map<string, number>();

  updates.forEach((update) => {
    const updateDate = new Date(`${update.date}T00:00:00`);
    updateDate.setHours(0, 0, 0, 0);

    const ageInDays = Math.round((today.getTime() - updateDate.getTime()) / (24 * 60 * 60 * 1000));

    if (ageInDays >= 0 && ageInDays < days) {
      const dateKey = getDateKey(updateDate);
      updateCounts.set(dateKey, (updateCounts.get(dateKey) ?? 0) + 1);
    }
  });

  const maxCount = Math.max(...Array.from(updateCounts.values()), 1);

  return Array.from({ length: days }, (_, index) => {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - (days - 1 - index));

    const dateKey = getDateKey(currentDate);
    const updateCount = updateCounts.get(dateKey) ?? 0;
    const isPublishedDay = updateCount > 0;

    return {
      date: dateKey,
      height: isPublishedDay ? Math.max((updateCount / maxCount) * 100, 36) : 8,
      isPublishedDay,
      label: `${formatUpdateDate(dateKey)}: ${
        isPublishedDay ? `${updateCount} update${updateCount === 1 ? "" : "s"}` : "quiet day"
      }`,
      updateCount,
    };
  });
}

function getReadMinutes(readTime: string) {
  return Number.parseInt(readTime, 10) || 0;
}

const dashboardTopicColors = ["#e85b3f", "#f28443", "#1fb58f", "#e2b43c", "#7c3fe0", "#5f7ce5"];

function getDashboardTopics(posts: BlogPost[]) {
  const topicMap = new Map<string, { category: string; posts: number; readMinutes: number }>();

  posts.forEach((post) => {
    const current = topicMap.get(post.category) ?? {
      category: post.category,
      posts: 0,
      readMinutes: 0,
    };

    topicMap.set(post.category, {
      ...current,
      posts: current.posts + 1,
      readMinutes: current.readMinutes + getReadMinutes(post.readTime),
    });
  });

  return Array.from(topicMap.values())
    .sort((left, right) => right.posts - left.posts || right.readMinutes - left.readMinutes)
    .map((topic, index) => ({
      ...topic,
      color: dashboardTopicColors[index % dashboardTopicColors.length],
      score: topic.posts * 18 + topic.readMinutes,
    }));
}

function getDashboardDonutGradient(topics: ReturnType<typeof getDashboardTopics>) {
  const totalPosts = topics.reduce((total, topic) => total + topic.posts, 0);
  let cursor = 0;

  if (!totalPosts) {
    return "conic-gradient(#2d2a26 0deg 360deg)";
  }

  const segments = topics.map((topic) => {
    const nextCursor = cursor + (topic.posts / totalPosts) * 360;
    const segment = `${topic.color} ${cursor}deg ${nextCursor}deg`;
    cursor = nextCursor;
    return segment;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function getBlogAnchorId(slug: string) {
  return `blog-${slug}`;
}

function getPortfolioBlogHref(slug?: string) {
  return slug ? `/blogs#${getBlogAnchorId(slug)}` : "/blogs";
}

function getSubscriptionErrorMessage(error: unknown) {
  const code = getFirebaseErrorCode(error);

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before it completed.";
  }

  if (code === "auth/popup-blocked") {
    return "The browser blocked the Google sign-in popup. Please use the redirect sign-in flow.";
  }

  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized in Firebase yet. Add it in Firebase Authentication settings.";
  }

  if (code === "permission-denied") {
    return "Firestore blocked this subscription update. Please check the subscriber security rules.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong while updating the subscription. Please try again.";
}

function getFirebaseErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

function shouldUseRedirectSignIn(error: unknown) {
  return ["auth/popup-blocked", "auth/cancelled-popup-request"].includes(getFirebaseErrorCode(error));
}

function getSignedInSubscriberView(subscriber: { exists: boolean; subscribed: boolean }) {
  if (!subscriber.exists) {
    return "newSignedIn" as const;
  }

  return subscriber.subscribed ? ("returningSubscribed" as const) : ("returningUnsubscribed" as const);
}

function getSubscribedSubscriberView(currentView: SubscriberViewState) {
  return currentView.startsWith("new") ? "newSubscribed" : "returningResubscribed";
}

function getUnsubscribedSubscriberView(currentView: SubscriberViewState) {
  return currentView.startsWith("new") ? "newUnsubscribed" : "returningUnsubscribed";
}

function getSignedOutSubscriberView(currentView: SubscriberViewState, wasSubscribed: boolean) {
  const isNewJourney = currentView.startsWith("new");

  if (isNewJourney) {
    return wasSubscribed ? "newSignedOutSubscribed" : "newSignedOutUnsubscribed";
  }

  return wasSubscribed ? "returningSignedOutSubscribed" : "returningSignedOutUnsubscribed";
}

function returnToPortfolioBlog(slug?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const portfolioHref = getPortfolioBlogHref(slug);

  try {
    const portfolioWindow = window.opener as Window | null;

    if (portfolioWindow && !portfolioWindow.closed) {
      portfolioWindow.location.href = portfolioHref;
      portfolioWindow.focus();
      window.close();

      window.setTimeout(() => {
        window.location.href = portfolioHref;
      }, 150);

      return;
    }
  } catch {
    // If the browser blocks opener access, use the same-tab fallback below.
  }

  window.close();

  window.setTimeout(() => {
    window.location.href = portfolioHref;
  }, 150);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
  } catch {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function ThemeToggleIcon({ theme }: { theme: Theme }) {
  if (theme === "light") {
    return (
      <svg
        className="theme-toggle-icon"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M20.2 15.7A8.2 8.2 0 0 1 8.3 3.8 8.7 8.7 0 1 0 20.2 15.7Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="theme-toggle-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

type PageBackButtonProps = {
  fallbackHref: string;
  label?: string;
};

function PageBackButton({ fallbackHref, label = "Back" }: PageBackButtonProps) {
  const handleBack = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const referrerUrl = document.referrer ? new URL(document.referrer) : null;
      const hasSameSiteReferrer = referrerUrl?.origin === window.location.origin;

      if (hasSameSiteReferrer && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch {
      // Fall through to the explicit page fallback.
    }

    window.location.href = fallbackHref;
  };

  return (
    <button className="button button-secondary" type="button" onClick={handleBack}>
      {label}
    </button>
  );
}

function BlogLockIcon() {
  return (
    <svg className="blog-lock-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="5.5"
        y="10"
        width="13"
        height="9.5"
        rx="2.4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 10V7.7C8.5 5.8 10.1 4.3 12 4.3s3.5 1.5 3.5 3.4V10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 14.1v1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AssistantChatIcon() {
  return (
    <svg className="assistant-chat-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.2 18.4 4 20l1-3.2A7.3 7.3 0 0 1 4 13.1C4 8.7 7.7 5.2 12.2 5.2s8.2 3.5 8.2 7.9-3.7 7.9-8.2 7.9a8.7 8.7 0 0 1-5-1.6Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M8.9 12.9h.1M12.2 12.9h.1M15.5 12.9h.1"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AssistantSendIcon() {
  return (
    <svg className="assistant-send-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12 14-7-5 14-2.6-5.4L5 12Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="m11.4 13.6 3.2-3.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function AccountCircleIcon() {
  return (
    <svg className="nav-account-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.8 19.2c.9-3 3.1-4.7 6.2-4.7s5.3 1.7 6.2 4.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

type ReaderMenuGlyphType =
  | "about"
  | "bookmark"
  | "briefcase"
  | "home"
  | "mail"
  | "menu"
  | "news"
  | "pen"
  | "radar"
  | "shelf"
  | "spark";

function ReaderMenuGlyph({ type }: { type: ReaderMenuGlyphType }) {
  const paths = {
    about: (
      <>
        <circle cx="12" cy="7.2" r="3.1" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M5.8 19.5c.9-3.2 3.1-5 6.2-5s5.3 1.8 6.2 5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      </>
    ),
    bookmark: (
      <path
        d="M7 4.8h10v15l-5-3.3-5 3.3v-15Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
    briefcase: (
      <>
        <path
          d="M4.8 8.2h14.4v10H4.8v-10Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="M9 8.2V6h6v2.2M4.8 12h14.4" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    home: (
      <>
        <path
          d="m4.8 11.2 7.2-6 7.2 6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M7 10.2v8.2h10v-8.2"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </>
    ),
    mail: (
      <>
        <path
          d="M4.8 7h14.4v10H4.8V7Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path d="m5.4 7.6 6.6 5 6.6-5" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
    menu: (
      <>
        <path
          d="M5 7h14M5 12h14M5 17h14"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.9"
        />
      </>
    ),
    news: (
      <>
        <path
          d="M6.2 5.4h11.6v13.2H6.2V5.4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M8.8 8.4h6.4M8.8 11.2h6.4M8.8 14h3.4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <path
          d="M15.2 14h.9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.3"
        />
      </>
    ),
    pen: (
      <path
        d="M5.2 18.8 6.4 14 15 5.4a2.2 2.2 0 0 1 3.1 3.1L9.5 17.1l-4.3 1.7Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
    radar: (
      <>
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 12 17.2 8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <circle cx="16.7" cy="8.3" r="1.4" fill="currentColor" />
      </>
    ),
    shelf: (
      <>
        <path
          d="M6.2 5.5h11.6v13H6.2v-13Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M9 5.5v13M6.2 10h11.6M6.2 14.2h11.6"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </>
    ),
    spark: (
      <>
        <path
          d="M12 3.8 13.7 9l5.2 1.7-5.2 1.7L12 17.6l-1.7-5.2-5.2-1.7L10.3 9 12 3.8Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
        <path
          d="M18.2 16.2 19 18.5l2.2.7-2.2.8-.8 2.2-.7-2.2-2.3-.8 2.3-.7.7-2.3Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </>
    ),
  };

  return (
    <svg className="reader-menu-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

function BlogLockNote() {
  return (
    <p className="blog-lock-note">
      <span className="blog-lock-icon" aria-hidden="true">
        <BlogLockIcon />
      </span>
      <span>{LOCKED_BLOG_CAPTION}</span>
    </p>
  );
}

type AssistantKnowledgeCategory =
  | "blog"
  | "certification"
  | "contact"
  | "dashboard"
  | "education"
  | "experience"
  | "metric"
  | "page"
  | "profile"
  | "project"
  | "recognition"
  | "skill"
  | "subscription"
  | "update";

type AssistantKnowledgeEntry = {
  category: AssistantKnowledgeCategory;
  details?: string[];
  keywords: string[];
  links?: AssistantLink[];
  priority?: number;
  summary: string;
  title: string;
};

type AssistantPromptEntry = Pick<
  AssistantKnowledgeEntry,
  "category" | "details" | "summary" | "title"
>;

type GenericAssistantResponse = {
  keywords: string[];
  text: string;
};

const assistantStopWords = new Set([
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
  "did",
  "do",
  "does",
  "for",
  "from",
  "give",
  "has",
  "have",
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
  "your",
  "you",
]);

const assistantSynonyms: Record<string, string[]> = {
  ai: ["artificial", "intelligence", "llm", "semantic", "relevance", "similarity"],
  article: ["blog", "post", "writeup", "writing"],
  articles: ["blog", "blogs", "posts", "writeups", "writing"],
  async: ["asynchronous", "executor", "parallel", "thread"],
  backend: ["java", "spring", "microservices", "api", "performance"],
  blog: ["article", "post", "writeup", "writing"],
  blogs: ["article", "articles", "posts", "writeups", "writing"],
  bot: ["assistant", "chatbot", "website", "guide"],
  cache: ["caching", "coherence"],
  chatbot: ["assistant", "bot", "website", "guide"],
  contact: ["email", "linkedin", "connect"],
  current: ["role", "experience", "oracle"],
  dashboard: ["analytics", "metrics", "content"],
  database: ["oracle", "sql", "plsql", "stored", "procedure"],
  db: ["database", "oracle", "sql", "plsql"],
  education: ["college", "degree", "cgpa", "mtech", "btech"],
  email: ["contact", "mail", "connect"],
  experience: ["role", "oracle", "work", "career"],
  llm: ["ai", "semantic", "prompt", "mcp", "model"],
  mail: ["email", "contact"],
  mcp: ["model", "context", "protocol", "anthropic", "certification"],
  name: ["profile", "sai", "kumar", "mediboina"],
  news: ["latest", "updates", "radar", "ai"],
  performance: ["latency", "throughput", "optimization", "scale", "speed"],
  project: ["work", "portfolio", "system", "engine"],
  projects: ["work", "portfolio", "systems", "engines"],
  radar: ["news", "latest", "updates", "ai", "sources"],
  resume: ["experience", "projects", "skills", "education"],
  search: ["opensearch", "oracle", "text", "semantic"],
  signin: ["sign", "login", "subscribe", "unlock"],
  stack: ["skills", "technology", "tools", "tech"],
  subscribe: ["updates", "newsletter", "email", "signin"],
  tech: ["stack", "skills", "technology", "tools"],
};

const siteSpecificQuestionWords = new Set([
  "blog",
  "blogs",
  "news",
  "certificate",
  "certification",
  "certifications",
  "contact",
  "dashboard",
  "education",
  "experience",
  "portfolio",
  "project",
  "projects",
  "radar",
  "resume",
  "role",
  "sai",
  "saved",
  "shelf",
  "site",
  "stack",
  "tech",
  "update",
  "updates",
  "website",
  "work",
  "your",
]);

const genericLearningPhrases = [
  "compare",
  "define",
  "difference between",
  "explain",
  "how do",
  "how does",
  "meaning of",
  "what are",
  "what is",
  "why do",
  "why does",
];

const genericAssistantResponses: GenericAssistantResponse[] = [
  {
    keywords: ["cap", "theorem", "consistency", "availability", "partition"],
    text:
      "CAP theorem says a distributed system can strongly guarantee only two of three during a network partition: consistency, availability, and partition tolerance. Since partitions can happen in real networks, systems usually choose between stronger consistency or higher availability. Tiny mental model: when two data centers cannot talk, do you reject some requests to stay correct, or keep serving and reconcile later?",
  },
  {
    keywords: ["llm", "large", "language", "model"],
    text:
      "An LLM is a model trained to understand and generate text by predicting useful language patterns from large datasets. In products, it is strongest for summarizing, explaining, drafting, extracting, and assisting workflows. The trick is grounding it with context, because an ungrounded LLM can sound confident even when it is wrong.",
  },
  {
    keywords: ["ai", "artificial", "intelligence"],
    text:
      "AI is the broader field of making software perform tasks that usually need human-like intelligence, such as classification, recommendation, search relevance, or text understanding. LLMs are one branch of AI focused on language. In real systems, AI works best when paired with rules, data validation, and human review where accuracy matters.",
  },
  {
    keywords: ["rest", "api", "http", "endpoint"],
    text:
      "A REST API exposes resources over HTTP using methods like GET, POST, PUT, PATCH, and DELETE. Good REST design keeps URLs resource-focused, uses status codes clearly, and avoids hiding too much behavior behind one giant endpoint. Think of it as a clean contract between frontend, services, and external clients.",
  },
  {
    keywords: ["microservice", "microservices"],
    text:
      "Microservices split an application into smaller independently deployable services, each owning a focused business capability. They help teams scale and release separately, but they add network calls, observability needs, and data consistency tradeoffs. They are powerful, but not a free lunch.",
  },
  {
    keywords: ["database", "index", "indexing"],
    text:
      "A database index is a data structure that helps the database find rows faster without scanning the whole table. It improves read performance on common filters and joins, but it costs storage and slows writes because the index must be maintained. The best indexes match real query patterns, not guesswork.",
  },
  {
    keywords: ["cache", "caching", "redis", "coherence"],
    text:
      "Caching stores frequently used data closer to the application so repeated requests avoid expensive work. It can reduce latency and database load, but stale data and invalidation rules must be designed carefully. Cache bugs are sneaky little raccoons, so TTLs and ownership rules matter.",
  },
  {
    keywords: ["async", "asynchronous", "thread", "parallel", "executor"],
    text:
      "Asynchronous processing lets work continue without blocking the main request path. Parallel processing splits safe independent work so multiple units run at the same time. The win is better responsiveness and throughput, but it needs limits, error handling, and clear transaction boundaries.",
  },
  {
    keywords: ["latency", "throughput"],
    text:
      "Latency is how long one request takes; throughput is how many requests the system can handle over time. A system can have high throughput but still feel slow if individual requests wait too long. Performance tuning usually needs both views, because users feel latency and platforms feel throughput.",
  },
  {
    keywords: ["kafka", "queue", "messaging", "event"],
    text:
      "A message queue or event stream decouples producers from consumers. Producers publish work, and consumers process it independently, which improves resilience and absorbs traffic spikes. Kafka is commonly used when ordered, durable, high-throughput event streaming is needed.",
  },
  {
    keywords: ["kubernetes", "container", "docker", "pod"],
    text:
      "Containers package an application with its runtime dependencies, while Kubernetes schedules and manages those containers across machines. Kubernetes helps with scaling, rollouts, self-healing, and service discovery. In short: containers package the app; Kubernetes runs the fleet.",
  },
  {
    keywords: ["sql", "nosql"],
    text:
      "SQL databases are strong for structured relational data, joins, transactions, and consistency. NoSQL databases are often chosen for flexible schemas, high-scale access patterns, or specialized data models like documents, key-value, or wide-column storage. The right choice depends on query patterns and consistency needs.",
  },
  {
    keywords: ["acid", "transaction", "transactions"],
    text:
      "ACID describes reliable database transactions: atomicity, consistency, isolation, and durability. It means a transaction completes fully or not at all, preserves valid data rules, avoids unsafe interference, and survives once committed. This is the boring magic that keeps money, orders, and records sane.",
  },
  {
    keywords: ["authentication", "authorization", "auth"],
    text:
      "Authentication verifies who the user is; authorization decides what that verified user can access. Login is authentication. Checking whether that user can open an admin page is authorization.",
  },
  {
    keywords: ["oop", "object", "polymorphism", "inheritance", "encapsulation", "abstraction"],
    text:
      "OOP organizes code around objects that combine data and behavior. Encapsulation hides internal details, abstraction exposes simple interfaces, inheritance reuses behavior through parent-child relationships, and polymorphism lets different objects respond to the same operation in their own way.",
  },
  {
    keywords: ["normalization", "database", "schema"],
    text:
      "Database normalization organizes tables to reduce duplicate data and update anomalies. It usually means separating entities into related tables and connecting them with keys. Denormalization can be useful later for read speed, but normalization gives the data model a clean spine first.",
  },
  {
    keywords: ["load", "balancer", "loadbalancer"],
    text:
      "A load balancer distributes incoming traffic across multiple servers so no single instance carries everything. It improves availability and scaling, and it can remove unhealthy instances from rotation. It is the traffic cop that keeps the backend road from turning into chaos.",
  },
  {
    keywords: ["semantic", "search", "embedding", "vector"],
    text:
      "Semantic search looks for meaning, not just exact keywords. It often uses embeddings, which convert text into vectors so similar ideas sit closer together mathematically. This helps when users phrase the same intent in different words.",
  },
  {
    keywords: ["mcp", "model", "context", "protocol"],
    text:
      "Model Context Protocol, or MCP, is a standard way for AI assistants to connect with external tools and data sources. Instead of every tool needing a custom integration, MCP gives assistants a cleaner pattern for discovering capabilities and requesting context. Think USB-C, but for AI tool connections.",
  },
];

function normalizeAssistantText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+.#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAssistantTokens(input: string) {
  const normalizedInput = normalizeAssistantText(input);
  const tokens = new Set<string>();

  normalizedInput
    .split(" ")
    .filter((word) => word.length > 1 && !assistantStopWords.has(word))
    .forEach((word) => {
      tokens.add(word);
      assistantSynonyms[word]?.forEach((synonym) => tokens.add(synonym));
    });

  return Array.from(tokens);
}

function isGenericLearningQuestion(input: string) {
  const normalizedInput = normalizeAssistantText(input);
  const words = normalizedInput.split(" ").filter(Boolean);
  const hasLearningPhrase = genericLearningPhrases.some(
    (phrase) => normalizedInput.startsWith(phrase) || normalizedInput.includes(` ${phrase} `),
  );
  const hasKnownGenericTopic = genericAssistantResponses.some((response) =>
    response.keywords.some((keyword) => normalizedInput.includes(normalizeAssistantText(keyword))),
  );
  const hasSiteSpecificWord = words.some((word) => siteSpecificQuestionWords.has(word));

  return (hasLearningPhrase || hasKnownGenericTopic) && !hasSiteSpecificWord;
}

function getGenericAssistantResponse(
  input: string,
): Pick<AssistantMessage, "links" | "text"> | null {
  if (!isGenericLearningQuestion(input)) {
    return null;
  }

  const normalizedInput = normalizeAssistantText(input);
  const rankedResponse = genericAssistantResponses
    .map((response) => ({
      response,
      score: response.keywords.filter((keyword) =>
        normalizedInput.includes(normalizeAssistantText(keyword)),
      ).length,
    }))
    .sort((left, right) => right.score - left.score)[0];

  return {
    text:
      rankedResponse?.score > 0
        ? rankedResponse.response.text
        : "I can answer general CS, backend, cloud, AI, and system-design questions when the Gemini key is active. My built-in quick brain already knows topics like CAP theorem, REST APIs, caching, database indexes, async processing, Kubernetes, SQL vs NoSQL, and LLMs.",
    links: [{ href: "/shelf", label: "Sai's Shelf" }],
  };
}

function getAssistantSearchText(entry: AssistantKnowledgeEntry) {
  return normalizeAssistantText(
    [
      entry.title,
      entry.summary,
      ...(entry.details ?? []),
      ...entry.keywords,
      entry.category,
    ].join(" "),
  );
}

function getUniqueAssistantLinks(links: AssistantLink[]) {
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = `${link.href}-${link.label}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function rankAssistantEntries(
  input: string,
  isReaderSignedIn: boolean,
  hasActiveSubscription: boolean,
) {
  const normalizedQuery = normalizeAssistantText(input);
  const tokens = getAssistantTokens(input);

  if (!tokens.length) {
    return [];
  }

  return getAssistantKnowledgeEntries(isReaderSignedIn, hasActiveSubscription)
    .map((entry) => ({
      entry,
      score: scoreAssistantEntry(entry, tokens, normalizedQuery),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score);
}

function getAssistantPromptContext(
  input: string,
  isReaderSignedIn: boolean,
  hasActiveSubscription: boolean,
): AssistantPromptEntry[] {
  const rankedEntries = rankAssistantEntries(input, isReaderSignedIn, hasActiveSubscription);
  const selectedEntries = rankedEntries.length
    ? rankedEntries.slice(0, 8).map((result) => result.entry)
    : getAssistantKnowledgeEntries(isReaderSignedIn, hasActiveSubscription).slice(0, 6);

  return selectedEntries.map((entry) => ({
    category: entry.category,
    details: entry.details?.slice(0, 4),
    summary: entry.summary,
    title: entry.title,
  }));
}

function createAssistantEntry(
  entry: Omit<AssistantKnowledgeEntry, "keywords"> & { keywords?: string[] },
): AssistantKnowledgeEntry {
  return {
    ...entry,
    keywords: entry.keywords ?? [],
  };
}

function getAssistantKnowledgeEntries(
  isReaderSignedIn: boolean,
  hasActiveSubscription: boolean,
) {
  const currentExperience = experience[0];
  const currentRole = currentExperience?.roles[0];
  const currentCompany = currentExperience?.company ?? profile.currentCompany;
  const publicBlog = blogPosts.find((post) => post.slug === PUBLIC_BLOG_SLUG) ?? blogPosts[0];
  const entries: AssistantKnowledgeEntry[] = [
    createAssistantEntry({
      category: "page",
      title: "What the assistant knows",
      summary:
        "This assistant answers from the website content: portfolio sections, selected projects, blogs, AI Radar, latest updates, dashboard notes, credentials, sign-in access, saved posts, and work-with-me links. If a question is outside that scope, it says so instead of guessing.",
      keywords: [
        "assistant",
        "bot",
        "chatbot",
        "trained",
        "website",
        "site",
        "answer",
        "answers",
        "know",
        "scope",
        "help",
      ],
      links: [
        { href: "/start", label: "Start Here" },
        { href: "/portfolio#work", label: "Projects" },
        { href: "/blogs", label: "Blogs" },
        { href: "/ai-radar", label: "AI Radar" },
      ],
      priority: 5,
    }),
    createAssistantEntry({
      category: "profile",
      title: "About Sai Kumar Mediboina",
      summary: `${profile.name} is a ${profile.currentTitle} at ${profile.currentCompany}. ${profile.summary}`,
      details: [`Focus: ${profile.focus}`, `Location: ${profile.location}`],
      keywords: [
        "about",
        "intro",
        "profile",
        "summary",
        "sai",
        "kumar",
        "mediboina",
        profile.role,
        profile.currentTitle,
        profile.currentCompany,
      ],
      links: [{ href: "/portfolio#about", label: "About Sai" }],
      priority: 4,
    }),
    createAssistantEntry({
      category: "experience",
      title: "Current role",
      summary: currentRole
        ? `Sai currently works as ${currentRole.title} at ${currentCompany}. The role focuses on backend platform engineering, search architecture, performance optimization, and AI-enabled workflow design.`
        : `${profile.name} works on backend platform engineering, search systems, performance optimization, and AI-enabled workflows.`,
      details: currentExperience
        ? [
            `Company: ${currentExperience.company}, ${currentExperience.location}.`,
            currentExperience.summary,
            ...currentExperience.achievements.slice(0, 2),
          ]
        : undefined,
      keywords: [
        "current",
        "role",
        "job",
        "career",
        "experience",
        "oracle",
        "application",
        "software",
        "engineer",
        "developer",
      ],
      links: [{ href: "/portfolio#experience", label: "View experience" }],
      priority: 5,
    }),
    createAssistantEntry({
      category: "contact",
      title: "Work With Me and links",
      summary: `Best fit conversations are backend engineering, search systems, performance work, and practical AI or LLM product ideas. You can reach Sai through the Work With Me page, email, or LinkedIn.`,
      details: [`Email: ${profile.email}`, `LinkedIn: ${profile.linkedin}`],
      keywords: ["contact", "email", "mail", "linkedin", "connect", "collaboration", "hire", "work with me"],
      links: [
        { href: "/work-with-me", label: "Work With Me" },
        { href: `mailto:${profile.email}`, label: "Email" },
        { href: profile.linkedin, label: "LinkedIn", external: true },
      ],
      priority: 6,
    }),
    createAssistantEntry({
      category: "subscription",
      title: "Newsletter and reader access",
      summary: isReaderSignedIn
        ? hasActiveSubscription
          ? "You are signed in and subscribed. New selected engineering notes can reach your inbox when updates are sent. Visitors can also join the newsletter from the footer with only an email address."
          : "You are signed in, but updates are not active yet. Subscribe from the profile area, or use the footer newsletter form with an email address."
        : "The footer newsletter form lets visitors subscribe with only an email address. Sign in is still used for protected blog posts and saved posts.",
      keywords: [
        "sign",
        "signin",
        "login",
        "account",
        "subscribe",
        "unsubscribe",
        "newsletter",
        "updates",
        "unlock",
        "saved",
      ],
      links: isReaderSignedIn
        ? [{ href: "/blogs", label: "Browse blogs" }]
        : [{ href: "#newsletter", label: "Join newsletter" }],
      priority: 5,
    }),
    createAssistantEntry({
      category: "project",
      title: "Selected projects",
      summary: `Selected work includes ${projects
        .slice(0, 4)
        .map((project) => project.name)
        .join(", ")}. The common thread is backend scale, search-heavy screening, AI-assisted relevance, and measurable performance improvement.`,
      details: projects
        .slice(0, 4)
        .map((project) => `${project.name}: ${project.impact}`),
      keywords: [
        "project",
        "projects",
        "work",
        "portfolio",
        "selected",
        "matching",
        "screening",
        "search",
        "performance",
      ],
      links: [{ href: "/portfolio#work", label: "View selected work" }],
      priority: 5,
    }),
    createAssistantEntry({
      category: "blog",
      title: "Blogs and articles",
      summary: `The site has ${blogPosts.length} engineering write-ups. The public feature is "${publicBlog.title}"; deeper articles unlock after sign-in so serious readers can explore more without cluttering the main page.`,
      details: orderBlogPostsForAccess(blogPosts)
        .slice(0, 4)
        .map((post) => `${post.title} - ${post.summary}`),
      keywords: ["blogs", "articles", "posts", "writing", "writeups", "read", "content"],
      links: [
        { href: "/blogs", label: "View blog index" },
        { href: getBlogArticleHref(publicBlog.slug), label: "Open public article", external: true },
        ...(isReaderSignedIn ? [] : [{ href: "/signin", label: "Unlock member reads" }]),
      ],
      priority: 5,
    }),
    createAssistantEntry({
      category: "education",
      title: "Education",
      summary: `Education includes ${education
        .map((entry) => `${entry.degree} from ${entry.school} with ${entry.score}`)
        .join("; ")}.`,
      keywords: ["education", "degree", "college", "cgpa", "mtech", "btech", "nit", "jntu"],
      links: [{ href: "/portfolio#credentials", label: "View education" }],
      priority: 4,
    }),
    createAssistantEntry({
      category: "certification",
      title: "Certifications",
      summary: `Credentials include ${certifications
        .slice(0, 4)
        .map((certification) => `${certification.title} from ${certification.issuer}`)
        .join("; ")} and more in the credentials section.`,
      keywords: [
        "certification",
        "certifications",
        "certificate",
        "credentials",
        "oracle",
        "spring",
        "mcp",
        "anthropic",
      ],
      links: [{ href: "/portfolio#credentials", label: "View credentials" }],
      priority: 4,
    }),
    createAssistantEntry({
      category: "skill",
      title: "Tech stack",
      summary:
        "Sai's stack is backend-heavy: Java, Spring Boot, REST APIs, microservices, Oracle 19c, Oracle Text, OpenSearch, OCI, Kubernetes, semantic search, AI similarity, and LLM workflow patterns.",
      details: skills.map((group) => `${group.title}: ${group.items.join(", ")}`),
      keywords: ["tech", "stack", "skills", "technology", "tools", "java", "spring", "oracle"],
      links: [{ href: "/portfolio#skills", label: "View tech stack" }],
      priority: 5,
    }),
    createAssistantEntry({
      category: "page",
      title: "Start Here",
      summary:
        "Start Here is the guided first-visit path. It explains what the website contains, what to read first, and how to follow new updates.",
      keywords: ["start", "new", "first", "guide", "beginner", "glimpse", "navigation"],
      links: [{ href: "/start", label: "Open Start Here" }],
      priority: 4,
    }),
    createAssistantEntry({
      category: "update",
      title: "What's New",
      summary:
        "What's New collects recent site updates from the last 30 days so visitors can scan fresh pages, blog additions, and feature changes quickly.",
      keywords: ["what", "new", "latest", "updates", "recent", "last", "30", "days"],
      links: [{ href: "/whats-new", label: "Open What's New" }],
      priority: 4,
    }),
    createAssistantEntry({
      category: "page",
      title: "AI Radar",
      summary:
        "AI Radar is a live ranked board for official and free AI sources. It refreshes from RSS or Atom feeds, uses source thumbnails only when provided, renders generated cover art otherwise, and links readers to the original articles.",
      details: aiRadarSignals
        .slice(0, 5)
        .map((signal) => `${signal.source}: ${signal.title} (${signal.category})`),
      keywords: [
        "ai",
        "artificial",
        "intelligence",
        "radar",
        "news",
        "latest",
        "sources",
        "openai",
        "anthropic",
        "arxiv",
        "hugging",
        "google",
        "nvidia",
      ],
      links: [{ href: "/ai-radar", label: "Open AI Radar" }],
      priority: 5,
    }),
    createAssistantEntry({
      category: "page",
      title: "Sai's Shelf",
      summary:
        "Sai's Shelf is planned as a useful resource area for CS fundamentals, AI notes, engineering references, and practical learning material.",
      keywords: ["shelf", "resources", "cs", "fundamentals", "learning", "notes"],
      links: [{ href: "/shelf", label: "Open Sai's Shelf" }],
      priority: 4,
    }),
    createAssistantEntry({
      category: "dashboard",
      title: "Creator dashboard",
      summary:
        "The dashboard summarizes portfolio momentum: blog coverage, topic distribution, publishing rhythm, top content, and recent site signals.",
      keywords: ["dashboard", "analytics", "metrics", "charts", "content", "topics", "rhythm"],
      links: [{ href: "/dashboard", label: "Open dashboard" }],
      priority: 4,
    }),
  ];

  projects.forEach((project) => {
    entries.push(
      createAssistantEntry({
        category: "project",
        title: project.name,
        summary: `${project.name}: ${project.impact} ${project.summary}`,
        details: [`Stack: ${project.stack.join(", ")}`, ...project.highlights],
        keywords: [
          "project",
          "work",
          "portfolio",
          project.name,
          project.impact,
          ...project.stack,
          ...project.highlights,
        ],
        links: [{ href: "/portfolio#work", label: "View selected work" }],
        priority: 3,
      }),
    );
  });

  metrics.forEach((metric) => {
    entries.push(
      createAssistantEntry({
        category: "metric",
        title: metric.label,
        summary: `${metric.value}: ${metric.detail}`,
        keywords: ["metric", "impact", "result", "number", metric.value, metric.label],
        links: [{ href: "/portfolio#about", label: "View highlights" }],
        priority: 3,
      }),
    );
  });

  currentFocus.forEach((focus) => {
    entries.push(
      createAssistantEntry({
        category: "profile",
        title: focus.title,
        summary: `${focus.title}: ${focus.caption}. ${focus.detail}`,
        keywords: ["focus", "currently", "working", focus.title, focus.caption],
        links: [{ href: "/portfolio#about", label: "View focus areas" }],
        priority: 3,
      }),
    );
  });

  skills.forEach((group) => {
    entries.push(
      createAssistantEntry({
        category: "skill",
        title: group.title,
        summary: `${group.title}: ${group.items.join(", ")}.`,
        keywords: ["skill", "skills", "stack", "technology", group.title, ...group.items],
        links: [{ href: "/portfolio#skills", label: "View tech stack" }],
        priority: 2,
      }),
    );
  });

  recognitions.forEach((recognition) => {
    entries.push(
      createAssistantEntry({
        category: "recognition",
        title: recognition.title,
        summary: `${recognition.title} from ${recognition.issuer}: ${recognition.detail}`,
        details: [`Highlight: ${recognition.highlight}`],
        keywords: ["award", "recognition", "achievement", recognition.title, recognition.issuer],
        links: [{ href: "/portfolio#recognition", label: "View recognition" }],
        priority: 3,
      }),
    );
  });

  education.forEach((entry) => {
    entries.push(
      createAssistantEntry({
        category: "education",
        title: `${entry.degree} at ${entry.school}`,
        summary: `${entry.degree} from ${entry.school}, ${entry.score}.`,
        keywords: ["education", "degree", "college", "cgpa", entry.degree, entry.school, entry.score],
        links: [{ href: "/portfolio#credentials", label: "View education" }],
        priority: 2,
      }),
    );
  });

  certifications.forEach((certification) => {
    entries.push(
      createAssistantEntry({
        category: "certification",
        title: certification.title,
        summary: `${certification.title} from ${certification.issuer}.`,
        details: [`Year: ${certification.year}`],
        keywords: [
          "certification",
          "certificate",
          "credential",
          certification.title,
          certification.issuer,
          certification.year,
        ],
        links: [{ href: "/portfolio#credentials", label: "View credentials" }],
        priority: 2,
      }),
    );
  });

  orderBlogPostsForAccess(blogPosts).forEach((post) => {
    const canReadPost = post.slug === PUBLIC_BLOG_SLUG || isReaderSignedIn;

    entries.push(
      createAssistantEntry({
        category: "blog",
        title: post.title,
        summary: canReadPost
          ? `${post.title}: ${post.summary}`
          : `${post.title} is in the members-only lab. Sign in to unlock the full article; preview: ${post.summary}`,
        details: canReadPost
          ? [
              `Category: ${post.category}. ${post.readTime}. Published ${post.publishedAt}.`,
              `Stats: ${post.stats.map((stat) => `${stat.label} ${stat.value}`).join(", ")}`,
              ...post.takeaways.slice(0, 2),
            ]
          : [`Category: ${post.category}. ${post.readTime}. Sign in required for the full read.`],
        keywords: [
          "blog",
          "article",
          "post",
          "read",
          post.title,
          post.category,
          post.summary,
          ...post.takeaways,
          ...post.sections.map((section) => section.heading),
        ],
        links: canReadPost
          ? [{ href: getBlogArticleHref(post.slug), label: "Open article", external: true }]
          : [
              { href: "/signin", label: "Unlock article" },
              { href: "/blogs", label: "View blog index" },
            ],
        priority: post.slug === PUBLIC_BLOG_SLUG ? 4 : 3,
      }),
    );
  });

  siteUpdates.forEach((update) => {
    entries.push(
      createAssistantEntry({
        category: "update",
        title: update.title,
        summary: `${update.title}: ${update.summary}`,
        details: [`Added on ${formatUpdateDate(update.date)}. Category: ${update.category}.`],
        keywords: ["update", "latest", "recent", update.category, update.title, update.summary],
        links: [{ href: update.href, label: "Open update" }],
        priority: 2,
      }),
    );
  });

  return entries;
}

function scoreAssistantEntry(
  entry: AssistantKnowledgeEntry,
  tokens: string[],
  normalizedQuery: string,
) {
  const searchText = getAssistantSearchText(entry);
  const titleText = normalizeAssistantText(entry.title);
  const keywordText = normalizeAssistantText(entry.keywords.join(" "));
  let score = entry.priority ?? 0;

  if (normalizedQuery.length > 4 && searchText.includes(normalizedQuery)) {
    score += 10;
  }

  tokens.forEach((token) => {
    if (titleText.includes(token)) {
      score += 5;
    }

    if (keywordText.includes(token)) {
      score += 3;
    }

    if (searchText.includes(token)) {
      score += 1;
    }
  });

  return score;
}

function getAssistantUnknownResponse(): Pick<AssistantMessage, "links" | "text"> {
  return {
    text:
      "That one is outside my portfolio notebook. I would rather say \"not sure yet\" than confidently juggle imaginary facts. Try asking about Sai's projects, blogs, tech stack, updates, subscriber access, or contact details.",
    links: [
      { href: "/start", label: "Start Here" },
      { href: "/blogs", label: "Blogs" },
      { href: "/ai-radar", label: "AI Radar" },
      { href: "/portfolio#work", label: "Projects" },
    ],
  };
}

function getAssistantGreetingResponse(): Pick<AssistantMessage, "links" | "text"> {
  return {
    text:
      "Hey, I am awake and wearing my tiny portfolio librarian badge. Ask me about Sai's projects, blogs, tech stack, performance wins, latest updates, or how to contact him.",
    links: [
      { href: "/start", label: "Start Here" },
      { href: "/portfolio#work", label: "Projects" },
      { href: "/blogs", label: "Blogs" },
      { href: "/ai-radar", label: "AI Radar" },
    ],
  };
}

function formatAssistantEntryResponse(
  entry: AssistantKnowledgeEntry,
  relatedEntries: AssistantKnowledgeEntry[],
): Pick<AssistantMessage, "links" | "text"> {
  const detailText = entry.details?.slice(0, 2).join(" ") ?? "";
  const relatedText = relatedEntries.length
    ? ` Related on this site: ${relatedEntries
        .slice(0, 2)
        .map((relatedEntry) => relatedEntry.title)
        .join(", ")}.`
    : "";
  const links = getUniqueAssistantLinks([
    ...(entry.links ?? []),
    ...relatedEntries.flatMap((relatedEntry) => relatedEntry.links ?? []),
  ]).slice(0, 4);

  return {
    text: `${entry.summary}${detailText ? ` ${detailText}` : ""}${relatedText}`,
    links: links.length ? links : undefined,
  };
}

function renderAssistantText(text: string) {
  const lines = text.split("\n");
  const content: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+?\*\*)/g);

    parts.forEach((part, partIndex) => {
      const key = `${lineIndex}-${partIndex}`;

      if (part.startsWith("**") && part.endsWith("**")) {
        content.push(<strong key={key}>{part.slice(2, -2)}</strong>);
      } else if (part) {
        content.push(<span key={key}>{part.replace(/\*\*/g, "")}</span>);
      }
    });

    if (lineIndex < lines.length - 1) {
      content.push(<br key={`line-${lineIndex}`} />);
    }
  });

  return content;
}

function getAssistantResponse(
  input: string,
  isReaderSignedIn: boolean,
  hasActiveSubscription: boolean,
): Pick<AssistantMessage, "links" | "text"> {
  const normalizedQuery = normalizeAssistantText(input);
  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  const isGreetingOnly =
    queryWords.length > 0 &&
    queryWords.length <= 2 &&
    queryWords.every((word) => /^(hi|hello|hey|yo|namaste|hai)$/.test(word));

  if (isGreetingOnly) {
    return getAssistantGreetingResponse();
  }

  const genericResponse = getGenericAssistantResponse(input);

  if (genericResponse) {
    return genericResponse;
  }

  const tokens = getAssistantTokens(input);

  if (!tokens.length) {
    return getAssistantUnknownResponse();
  }

  const rankedEntries = rankAssistantEntries(input, isReaderSignedIn, hasActiveSubscription);

  const bestMatch = rankedEntries[0];

  if (!bestMatch || bestMatch.score < 5) {
    return getAssistantUnknownResponse();
  }

  const relatedEntries = rankedEntries
    .slice(1)
    .filter((result) => result.entry.category !== bestMatch.entry.category || result.score >= 8)
    .map((result) => result.entry);

  return formatAssistantEntryResponse(bestMatch.entry, relatedEntries);
}

type SiteAssistantProps = {
  isSubscribed: boolean;
  subscriberUser: User | null;
};

function SiteAssistant({ isSubscribed, subscriberUser }: SiteAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [assistantPosition, setAssistantPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [messages, setMessages] = useState<AssistantMessage[]>(getInitialAssistantMessages);
  const assistantRef = useRef<HTMLDivElement | null>(null);
  const assistantDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const assistantMovedRef = useRef(false);
  const suppressAssistantClickRef = useRef(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = [
    "What can you answer?",
    "Show AI Radar",
    "Explain AI and LLM work",
    "What performance work stands out?",
    "How do I contact Sai?",
  ];

  useEffect(() => {
    const messagesContainer = messagesRef.current;

    if (isOpen && messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [isOpen, messages]);

  const getLlmAssistantResponse = async (
    question: string,
    fallbackResponse: Pick<AssistantMessage, "links" | "text">,
  ) => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        fallbackText: fallbackResponse.text,
        context: getAssistantPromptContext(question, Boolean(subscriberUser), isSubscribed),
        history: messages.slice(-6).map((message) => ({
          role: message.role,
          text: message.text,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error("Assistant API request failed.");
    }

    const data = await response.json();
    const text = typeof data?.text === "string" ? data.text.trim() : "";

    return {
      links: fallbackResponse.links,
      text: text || fallbackResponse.text,
    };
  };

  const sendAssistantMessage = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    const response = getAssistantResponse(trimmedValue, Boolean(subscriberUser), isSubscribed);
    const visitorMessageId = Date.now();
    const assistantMessageId = visitorMessageId + 1;

    setMessages((current) => [
      ...current,
      {
        id: visitorMessageId,
        role: "visitor",
        text: trimmedValue,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        text: "Digging through Sai's knowledge base. Tiny gears are turning...",
      },
    ]);
    setInput("");

    getLlmAssistantResponse(trimmedValue, response)
      .then((llmResponse) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  links: llmResponse.links,
                  text: llmResponse.text,
                }
              : message,
          ),
        );
      })
      .catch(() => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  links: response.links,
                  text: response.text,
                }
              : message,
          ),
        );
      });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendAssistantMessage(input);
  };

  const clearAssistantChat = () => {
    setMessages(getInitialAssistantMessages());
    setInput("");
  };

  const clampAssistantPosition = (x: number, y: number) => {
    if (typeof window === "undefined") {
      return { x, y };
    }

    const margin = 12;
    const panelGap = 12;
    const topSafeArea = 32;
    const launcherSize = assistantRef.current?.getBoundingClientRect().width || 64;
    const panel = assistantRef.current?.querySelector<HTMLElement>(".assistant-panel");
    const panelRect = panel?.getBoundingClientRect();
    const minX =
      isOpen && panelRect ? Math.max(margin, panelRect.width - launcherSize + margin) : margin;
    const minY =
      isOpen && panelRect
        ? Math.max(margin, panelRect.height + panelGap + topSafeArea)
        : margin;
    const maxX = window.innerWidth - launcherSize - margin;
    const maxY = window.innerHeight - launcherSize - margin;
    const safeMaxX = Math.max(margin, maxX);
    const safeMaxY = Math.max(margin, maxY);
    const safeMinX = Math.min(minX, safeMaxX);
    const safeMinY = Math.min(minY, safeMaxY);

    return {
      x: Math.min(Math.max(safeMinX, x), safeMaxX),
      y: Math.min(Math.max(safeMinY, y), safeMaxY),
    };
  };

  useEffect(() => {
    if (!isOpen || !assistantPosition) {
      return;
    }

    setAssistantPosition((currentPosition) =>
      currentPosition
        ? clampAssistantPosition(currentPosition.x, currentPosition.y)
        : currentPosition,
    );
  }, [isOpen]);

  const startAssistantDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !assistantRef.current) {
      return;
    }

    const rect = assistantRef.current.getBoundingClientRect();

    assistantDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
    };
    assistantMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveAssistant = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = assistantDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      assistantMovedRef.current = true;
    }

    setAssistantPosition(
      clampAssistantPosition(dragState.originX + deltaX, dragState.originY + deltaY),
    );
  };

  const stopAssistantDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const dragState = assistantDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (assistantMovedRef.current) {
      suppressAssistantClickRef.current = true;
    }

    assistantDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleAssistant = () => {
    if (suppressAssistantClickRef.current) {
      suppressAssistantClickRef.current = false;
      return;
    }

    setIsOpen((open) => !open);
  };

  const assistantStyle: CSSProperties | undefined = assistantPosition
    ? {
        bottom: "auto",
        left: assistantPosition.x,
        right: "auto",
        top: assistantPosition.y,
      }
    : undefined;
  const shouldShowQuickPrompts = messages.length === 1;

  return (
    <div
      className={`site-assistant${isOpen ? " is-open" : ""}`}
      ref={assistantRef}
      style={assistantStyle}
    >
      <button
        className="assistant-launcher"
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close portfolio assistant" : "Open portfolio assistant"}
        onClick={toggleAssistant}
        onPointerCancel={stopAssistantDrag}
        onPointerDown={startAssistantDrag}
        onPointerMove={moveAssistant}
        onPointerUp={stopAssistantDrag}
      >
        <AssistantChatIcon />
      </button>

      <section className="assistant-panel" aria-label="Portfolio assistant">
        <div className="assistant-header">
          <div
            className="assistant-drag-region"
            onPointerCancel={stopAssistantDrag}
            onPointerDown={startAssistantDrag}
            onPointerMove={moveAssistant}
            onPointerUp={stopAssistantDrag}
          >
            <span className="assistant-avatar" aria-hidden="true">
              SK
            </span>
            <div className="assistant-title">
              <h2>Sai&apos;s Bot</h2>
              <p>Portfolio guide</p>
            </div>
          </div>
          <div className="assistant-header-actions">
            <button className="assistant-clear" type="button" onClick={clearAssistantChat}>
              Clear
            </button>
            <button
              className="assistant-close"
              type="button"
              aria-label="Close assistant"
              onClick={() => setIsOpen(false)}
            >
              x
            </button>
          </div>
        </div>

        <div className="assistant-body">
          <div className="assistant-messages" ref={messagesRef}>
            {messages.map((message) => (
              <article className={`assistant-message is-${message.role}`} key={message.id}>
                <div className="assistant-message-bubble">
                  <p>{renderAssistantText(message.text)}</p>
                  {message.links?.length ? (
                    <div className="assistant-links">
                      {message.links.map((link) => (
                        <a
                          href={link.href}
                          key={`${message.id}-${link.label}`}
                          target={link.external ? "_blank" : undefined}
                          rel={link.external ? "opener" : undefined}
                          onClick={() => {
                            if (!link.external) {
                              setIsOpen(false);
                            }
                          }}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {shouldShowQuickPrompts ? (
            <div className="assistant-prompts" aria-label="Suggested assistant prompts">
              {quickPrompts.map((prompt) => (
                <button type="button" key={prompt} onClick={() => sendAssistantMessage(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <form className="assistant-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            placeholder="Search posts or ask a question..."
            aria-label="Ask the portfolio assistant"
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit" aria-label="Send assistant message">
            <AssistantSendIcon />
          </button>
        </form>
      </section>
    </div>
  );
}

type BlogArticleBodyProps = {
  post: BlogPost;
};

function BlogArticleBody({ post }: BlogArticleBodyProps) {
  return (
    <>
      <div className="blog-stat-grid">
        {post.stats.map((stat) => (
          <div className="blog-stat" key={`${post.slug}-${stat.label}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="blog-article">
        {post.sections.map((section) => (
          <section className="blog-article-section" key={section.heading}>
            <h4>{section.heading}</h4>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul className="bullet-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </>
  );
}

type SavePostButtonProps = {
  isBusy: boolean;
  isSaved: boolean;
  onToggle: (post: BlogPost) => void;
  post: BlogPost;
  subscriberUser: User | null;
};

function SavePostButton({
  isBusy,
  isSaved,
  onToggle,
  post,
  subscriberUser,
}: SavePostButtonProps) {
  if (!subscriberUser) {
    return (
      <a className="save-post-button" href={getSignInHref(post.slug)} target="_blank" rel="opener">
        Sign in to save
      </a>
    );
  }

  return (
    <button
      className={`save-post-button${isSaved ? " is-saved" : ""}`}
      type="button"
      disabled={isBusy}
      onClick={() => onToggle(post)}
    >
      <ReaderMenuGlyph type="bookmark" />
      {isBusy && !isSaved ? "Updating..." : isSaved ? "Saved" : "Save post"}
    </button>
  );
}

type ReaderMenuProps = {
  isOpen: boolean;
  isSignedIn: boolean;
  savedPosts: BlogPost[];
  subscriberName: string;
  onClose: () => void;
};

function ReaderMenu({
  isOpen,
  isSignedIn,
  savedPosts,
  subscriberName,
  onClose,
}: ReaderMenuProps) {
  const savedPostLabel = `${savedPosts.length} ${savedPosts.length === 1 ? "saved post" : "saved posts"}`;
  const readerLinks = [
    { href: "/", icon: "home" as const, label: "Home" },
    { href: "/start", icon: "spark" as const, label: "Start Here" },
    { href: "/portfolio#work", icon: "briefcase" as const, label: "Portfolio" },
    { href: "/blogs", icon: "pen" as const, label: "Blogs" },
    { href: "/ai-radar", icon: "radar" as const, label: "AI Radar" },
    { href: "/whats-new", icon: "news" as const, label: "What's New" },
    { href: "/shelf", icon: "shelf" as const, label: "Sai's Shelf" },
    {
      href: isSignedIn ? "/saved-posts" : getSavedPostsSignInHref(),
      icon: "bookmark" as const,
      label: "Saved Posts",
    },
    { href: "/#about", icon: "about" as const, label: "About" },
    { href: "/work-with-me", icon: "mail" as const, label: "Work With Me" },
  ];

  return (
    <div className={`reader-menu${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
      <button
        className="reader-menu-backdrop"
        type="button"
        aria-label="Close reader menu"
        onClick={onClose}
      />
      <aside className="reader-menu-panel" aria-label="Reader menu">
        <div className="reader-menu-heading">
          <div>
            <p className="impact-label">Reader Menu</p>
            <h2>{isSignedIn ? subscriberName : "Browse like a guest, save like a member"}</h2>
            <span>
              {isSignedIn
                ? savedPostLabel
                : "Sign in once and your favorite posts get their own little VIP shelf."}
            </span>
          </div>
          <button className="reader-menu-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <nav className="reader-menu-nav" aria-label="Reader navigation">
          {readerLinks.map((link) => (
            <a
              href={link.href}
              key={link.href}
              onClick={onClose}
            >
              <ReaderMenuGlyph type={link.icon} />
              <span>{link.label}</span>
            </a>
          ))}
        </nav>

        {!isSignedIn ? (
          <p className="reader-menu-note">
            Saved Posts is ready, but it needs your sign-in badge first. After that, every useful
            article you save gets parked neatly for later.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

type SubscriptionAccessCardProps = {
  canUseSubscriptions: boolean;
  isSubscribed: boolean;
  subscriberEmail: string;
  subscriberInitial: string;
  subscriberName: string;
  subscriberUser: User | null;
  subscriptionBusy: boolean;
  subscriptionError: string;
  subscriptionMessage: string;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
};

type ProfileMenuProps = SubscriptionAccessCardProps & {
  isOpen: boolean;
  onToggle: () => void;
};

function ProfileMenu({
  canUseSubscriptions,
  isOpen,
  isSubscribed,
  subscriberEmail,
  subscriberName,
  subscriberUser,
  subscriptionBusy,
  subscriptionError,
  subscriptionMessage,
  onGoogleSignIn,
  onSignOut,
  onSubscribe,
  onToggle,
  onUnsubscribe,
}: ProfileMenuProps) {
  const triggerLabel = subscriberUser ? "Open subscriber profile menu" : "Open sign in menu";

  return (
    <div className={`profile-menu${isOpen ? " is-open" : ""}`}>
      <button
        className="profile-menu-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={triggerLabel}
        onClick={onToggle}
      >
        {subscriberUser?.photoURL ? (
          <img
            className="nav-account-image"
            src={subscriberUser.photoURL}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="nav-account-fallback" aria-hidden="true">
            <AccountCircleIcon />
          </span>
        )}
      </button>

      <div className="profile-menu-panel" role="menu">
        <div className="profile-menu-header">
          <p className="impact-label">{subscriberUser ? "Profile" : "Subscriber Access"}</p>
          <strong>{subscriberUser ? subscriberName : "Sign in to unlock reader access"}</strong>
          <span>
            {subscriberUser
              ? subscriberEmail
              : "Manage blog access and portfolio update preferences from one place."}
          </span>
        </div>

        {subscriberUser ? (
          <span className={`subscription-badge${isSubscribed ? " is-active" : ""}`}>
            {isSubscribed ? "Subscribed" : "Not subscribed"}
          </span>
        ) : null}

        {!canUseSubscriptions ? (
          <p className="status-message is-warning">
            Sign-in is configured in code. Add the Firebase environment variables in Vercel to
            activate it online.
          </p>
        ) : null}

        <div className="profile-menu-actions">
          {subscriberUser ? (
            <>
              {isSubscribed ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={subscriptionBusy}
                  onClick={onUnsubscribe}
                >
                  {subscriptionBusy ? "Updating..." : "Unsubscribe"}
                </button>
              ) : (
                <button
                  className="button button-primary"
                  type="button"
                  disabled={subscriptionBusy}
                  onClick={onSubscribe}
                >
                  {subscriptionBusy ? "Updating..." : "Subscribe"}
                </button>
              )}
              <button
                className="button button-tertiary"
                type="button"
                disabled={subscriptionBusy}
                onClick={onSignOut}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              className="button button-primary"
              type="button"
              disabled={subscriptionBusy || !canUseSubscriptions}
              onClick={onGoogleSignIn}
            >
              {subscriptionBusy ? "Opening..." : "Sign in"}
            </button>
          )}
        </div>

        {subscriptionMessage ? (
          <p className="status-message is-success">{subscriptionMessage}</p>
        ) : null}
        {subscriptionError ? <p className="status-message is-error">{subscriptionError}</p> : null}
      </div>
    </div>
  );
}

function MobileAccountPanel({
  canUseSubscriptions,
  isSubscribed,
  subscriberEmail,
  subscriberName,
  subscriberUser,
  subscriptionBusy,
  onGoogleSignIn,
  onSignOut,
  onSubscribe,
  onUnsubscribe,
}: SubscriptionAccessCardProps) {
  return (
    <div className="mobile-account-panel">
      <div>
        <p className="impact-label">{subscriberUser ? "Account" : "Reader Access"}</p>
        <strong>{subscriberUser ? subscriberName : "Sign in to unlock member reads"}</strong>
        <span>
          {subscriberUser
            ? subscriberEmail
            : "Save posts, unlock protected blogs, and manage update preferences."}
        </span>
      </div>

      {subscriberUser ? (
        <div className="mobile-account-actions">
          {isSubscribed ? (
            <button
              className="button button-secondary"
              type="button"
              disabled={subscriptionBusy}
              onClick={onUnsubscribe}
            >
              {subscriptionBusy ? "Updating..." : "Unsubscribe"}
            </button>
          ) : (
            <button
              className="button button-primary"
              type="button"
              disabled={subscriptionBusy}
              onClick={onSubscribe}
            >
              {subscriptionBusy ? "Updating..." : "Subscribe"}
            </button>
          )}
          <button
            className="button button-tertiary"
            type="button"
            disabled={subscriptionBusy}
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          className="button button-primary"
          type="button"
          disabled={subscriptionBusy || !canUseSubscriptions}
          onClick={onGoogleSignIn}
        >
          {subscriptionBusy ? "Opening..." : "Sign in"}
        </button>
      )}

      {!canUseSubscriptions ? (
        <p className="status-message is-warning">
          Sign-in needs Firebase environment variables in Vercel before it can go live.
        </p>
      ) : null}
    </div>
  );
}

function SubscriptionAccessCard({
  canUseSubscriptions,
  isSubscribed,
  subscriberEmail,
  subscriberInitial,
  subscriberName,
  subscriberUser,
  subscriptionBusy,
  subscriptionError,
  subscriptionMessage,
  onGoogleSignIn,
  onSignOut,
  onSubscribe,
  onUnsubscribe,
}: SubscriptionAccessCardProps) {
  return (
    <div className="updates-card">
      <p className="impact-label">Subscriber Access</p>
      <h3>{subscriberUser ? "Subscription preferences" : "Sign in with Google"}</h3>

      {!canUseSubscriptions ? (
        <p className="status-message is-warning">
          Google sign-in is added in code. Add the Firebase environment variables in Vercel to
          activate this panel online.
        </p>
      ) : null}

      {subscriberUser ? (
        <>
          <div className="subscriber-card">
            {subscriberUser.photoURL ? (
              <img src={subscriberUser.photoURL} alt="" />
            ) : (
              <span className="subscriber-initial" aria-hidden="true">
                {subscriberInitial}
              </span>
            )}
            <div>
              <strong>{subscriberName}</strong>
              <span>{subscriberEmail}</span>
            </div>
            <span className={`subscription-badge${isSubscribed ? " is-active" : ""}`}>
              {isSubscribed ? "Subscribed" : "Not subscribed"}
            </span>
          </div>

          <div className="updates-actions">
            {isSubscribed ? (
              <button
                className="button button-secondary"
                type="button"
                disabled={subscriptionBusy}
                onClick={onUnsubscribe}
              >
                {subscriptionBusy ? "Updating..." : "Unsubscribe"}
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                disabled={subscriptionBusy}
                onClick={onSubscribe}
              >
                {subscriptionBusy ? "Updating..." : "Subscribe"}
              </button>
            )}
            <button
              className="button button-tertiary"
              type="button"
              disabled={subscriptionBusy}
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            className="button button-primary updates-button"
            type="button"
            disabled={subscriptionBusy || !canUseSubscriptions}
            onClick={onGoogleSignIn}
          >
            {subscriptionBusy ? "Opening Google..." : "Sign in with Google"}
          </button>
          <p className="updates-footnote">
            Subscribe to receive selected portfolio and engineering updates. You can unsubscribe
            at any time.
          </p>
        </>
      )}

      {subscriptionMessage ? (
        <p className="status-message is-success">{subscriptionMessage}</p>
      ) : null}
      {subscriptionError ? <p className="status-message is-error">{subscriptionError}</p> : null}
    </div>
  );
}

type BlogIndexSectionProps = {
  blogCategories: string[];
  featuredBlog?: BlogPost;
  featuredBlogIsLocked: boolean;
  isPostSaved: (slug: string) => boolean;
  remainingBlogPosts: BlogPost[];
  savedPostsBusySlug: string;
  selectedBlogCategory: string;
  subscriberUser: User | null;
  visibleBlogPosts: BlogPost[];
  onSelectBlogCategory: (category: string) => void;
  onToggleSavedPost: (post: BlogPost) => void;
};

function BlogIndexSection({
  blogCategories,
  featuredBlog,
  featuredBlogIsLocked,
  isPostSaved,
  remainingBlogPosts,
  savedPostsBusySlug,
  selectedBlogCategory,
  subscriberUser,
  visibleBlogPosts,
  onSelectBlogCategory,
  onToggleSavedPost,
}: BlogIndexSectionProps) {
  return (
    <section className="section shell blog-section" id="blogs">
      <SectionHeading
        eyebrow="Blogs"
        title="Short engineering write-ups that turn resume bullets into clearer technical stories."
        description="Practical notes on performance engineering, search architecture, and AI-enabled backend systems."
      />

      <div className="blog-toolbar">
        <div className="blog-controls" aria-label="Blog categories">
          {blogCategories.map((category) => (
            <button
              className={`blog-filter${selectedBlogCategory === category ? " is-active" : ""}`}
              key={category}
              type="button"
              onClick={() => onSelectBlogCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="blog-toolbar-actions">
          <p className="blog-count">
            {visibleBlogPosts.length} {visibleBlogPosts.length === 1 ? "article" : "articles"}
          </p>
          <a className="blog-updates-link" href="#newsletter">
            Get updates
          </a>
        </div>
      </div>

      <div className="blog-index">
        {featuredBlog ? (
          <article
            className={`blog-featured${featuredBlogIsLocked ? " is-locked" : ""}`}
            id={getBlogAnchorId(featuredBlog.slug)}
          >
            <div className="blog-featured-copy">
              <p className="eyebrow">
                {featuredBlogIsLocked ? "Locked Article" : "Featured Article"}
              </p>
              <div className="blog-meta">
                <span>{featuredBlog.category}</span>
                <span>{featuredBlog.publishedAt}</span>
                <span>{featuredBlog.readTime}</span>
              </div>
              <h3>
                {featuredBlogIsLocked ? (
                  <span>{featuredBlog.title}</span>
                ) : (
                  <a href={getBlogArticleHref(featuredBlog.slug)} target="_blank" rel="opener">
                    {featuredBlog.title}
                  </a>
                )}
              </h3>
              <p>{featuredBlog.summary}</p>
              {featuredBlogIsLocked ? (
                <BlogLockNote />
              ) : (
                <ul className="bullet-list">
                  {featuredBlog.takeaways.map((takeaway) => (
                    <li key={takeaway}>{takeaway}</li>
                  ))}
                </ul>
              )}
              {featuredBlogIsLocked ? (
                <a
                  className="blog-featured-link"
                  href={getSignInHref(featuredBlog.slug)}
                  target="_blank"
                  rel="opener"
                >
                  Sign in to unlock
                </a>
              ) : (
                <div className="blog-action-row">
                  <a
                    className="blog-featured-link"
                    href={getBlogArticleHref(featuredBlog.slug)}
                    target="_blank"
                    rel="opener"
                    aria-label={`Open ${featuredBlog.title} as a standalone article in a new tab`}
                  >
                    Read full post
                  </a>
                  <SavePostButton
                    isBusy={savedPostsBusySlug === featuredBlog.slug}
                    isSaved={isPostSaved(featuredBlog.slug)}
                    post={featuredBlog}
                    subscriberUser={subscriberUser}
                    onToggle={onToggleSavedPost}
                  />
                </div>
              )}
            </div>

            <aside className="blog-featured-aside" aria-label="Featured article metrics">
              <p className="impact-label">Key metrics</p>
              <div className="blog-stat-grid">
                {featuredBlog.stats.map((stat) => (
                  <div className="blog-stat" key={`${featuredBlog.slug}-${stat.label}`}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
            </aside>
          </article>
        ) : (
          <div className="blog-empty">
            <p>No articles are available for this category yet.</p>
          </div>
        )}

        {remainingBlogPosts.length > 0 ? (
          <div className="blog-list" aria-label="Latest blog articles">
            {remainingBlogPosts.map((post, index) => {
              const isLocked = !canReadBlogPost(post, subscriberUser);

              return (
                <article
                  className={`blog-list-item${isLocked ? " is-locked" : ""}`}
                  id={getBlogAnchorId(post.slug)}
                  key={post.slug}
                >
                  <span className="blog-list-number">{String(index + 2).padStart(2, "0")}</span>
                  <div className="blog-list-copy">
                    <div className="blog-meta">
                      <span>{post.category}</span>
                      <span>{post.publishedAt}</span>
                      <span>{post.readTime}</span>
                    </div>
                    <h3>
                      {isLocked ? (
                        <span>{post.title}</span>
                      ) : (
                        <a href={getBlogArticleHref(post.slug)} target="_blank" rel="opener">
                          {post.title}
                        </a>
                      )}
                    </h3>
                    <p>{post.summary}</p>
                    {isLocked ? <BlogLockNote /> : null}
                  </div>
                  {isLocked ? (
                    <a
                      className="blog-list-link"
                      href={getSignInHref(post.slug)}
                      target="_blank"
                      rel="opener"
                    >
                      Unlock
                    </a>
                  ) : (
                    <div className="blog-list-actions">
                      <a
                        className="blog-list-link"
                        href={getBlogArticleHref(post.slug)}
                        target="_blank"
                        rel="opener"
                        aria-label={`Read ${post.title}`}
                      >
                        Read full post
                      </a>
                      <SavePostButton
                        isBusy={savedPostsBusySlug === post.slug}
                        isSaved={isPostSaved(post.slug)}
                        post={post}
                        subscriberUser={subscriberUser}
                        onToggle={onToggleSavedPost}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type BlogIndexPageProps = BlogIndexSectionProps & {
  theme: Theme;
  onThemeToggle: () => void;
};

function BlogIndexPage({ theme, onThemeToggle, ...blogIndexProps }: BlogIndexPageProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to blogs
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Engineering notes</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="blogs-page" id="main-content">
        <BlogIndexSection {...blogIndexProps} />
      </main>
    </>
  );
}

type NewsletterCalloutProps = {
  isSubscribed: boolean;
  subscriberEmail: string;
  subscriberUser: User | null;
  subscriptionBusy: boolean;
  onSubscribe: () => void;
};

function NewsletterCallout({
  isSubscribed,
  subscriberEmail,
  subscriberUser,
  subscriptionBusy,
  onSubscribe,
}: NewsletterCalloutProps) {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "success" | "error">("idle");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [newsletterBusy, setNewsletterBusy] = useState(false);
  const [newsletterAlreadySubscribed, setNewsletterAlreadySubscribed] = useState(false);
  const newsletterIsConfirmed = newsletterStatus === "success";
  const showSubscribedState = Boolean((subscriberUser && isSubscribed) || newsletterIsConfirmed);
  const newsletterTitle = subscriberUser
    ? isSubscribed
      ? "You're already subscribed"
      : "Join with your signed-in email"
    : newsletterIsConfirmed
      ? newsletterAlreadySubscribed
        ? "You're already on the list"
        : "You're subscribed"
      : "Join the Newsletter";
  const newsletterDescription = subscriberUser
    ? isSubscribed
      ? `Updates will go to ${subscriberEmail}. You can unsubscribe from your profile menu or from any email.`
      : `Use ${subscriberEmail} for selected deep dives, engineering notes, and meaningful portfolio updates.`
    : newsletterIsConfirmed
      ? "Future deep dives and engineering notes will land in your inbox when there is something worth opening."
      : "Get notified when new deep dives, engineering notes, and meaningful portfolio updates are published. No spam. Unsubscribe from any email.";

  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (subscriberUser) {
      if (!isSubscribed) {
        onSubscribe();
      }

      return;
    }

    const email = newsletterEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterStatus("error");
      setNewsletterMessage("Please enter a valid email address.");
      return;
    }

    setNewsletterBusy(true);
    setNewsletterStatus("idle");
    setNewsletterMessage("");
    setNewsletterAlreadySubscribed(false);

    try {
      const response = await fetch("/api/subscribe-newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Unable to subscribe right now.");
      }

      setNewsletterEmail(email);
      setNewsletterStatus("success");
      setNewsletterAlreadySubscribed(Boolean(payload.alreadySubscribed));
      setNewsletterMessage(
        payload.message || "You are subscribed. Useful engineering notes will find you.",
      );
    } catch (error) {
      setNewsletterStatus("error");
      setNewsletterMessage(
        error instanceof Error ? error.message : "Unable to subscribe right now.",
      );
    } finally {
      setNewsletterBusy(false);
    }
  };

  return (
    <section className="newsletter-callout" id="newsletter" aria-label="Subscribe to updates">
      <div className="newsletter-icon" aria-hidden="true">
        <ReaderMenuGlyph type="mail" />
      </div>
      <div>
        <p className="eyebrow">Newsletter</p>
        <h2>{newsletterTitle}</h2>
        <p>{newsletterDescription}</p>
      </div>
      <form className="newsletter-form" onSubmit={handleNewsletterSubmit}>
        <label>
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Your email address"
            value={subscriberUser ? subscriberEmail : newsletterEmail}
            onChange={(event) => {
              setNewsletterEmail(event.target.value);
              setNewsletterStatus("idle");
              setNewsletterMessage("");
              setNewsletterAlreadySubscribed(false);
            }}
            disabled={newsletterBusy || Boolean(subscriberUser) || showSubscribedState}
          />
        </label>
        <button
          className={`button ${showSubscribedState ? "button-secondary" : "button-primary"}`}
          type="submit"
          disabled={newsletterBusy || subscriptionBusy || showSubscribedState}
        >
          {showSubscribedState
            ? "Subscribed"
            : newsletterBusy
              ? "Subscribing..."
              : subscriptionBusy
                ? "Updating..."
                : "Subscribe"}
        </button>
        {newsletterMessage ? (
          <p className={`newsletter-status is-${newsletterStatus}`}>{newsletterMessage}</p>
        ) : null}
      </form>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-shell">
        <p>
          &copy; {new Date().getFullYear()} {profile.name}
        </p>
        <div className="footer-links">
          <a href="/ai-radar">AI Radar</a>
          <a href="/work-with-me">Work With Me</a>
          <a href={`mailto:${profile.email}`}>Email</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}

type StartHerePageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function StartHerePage({ theme, onThemeToggle }: StartHerePageProps) {
  const startCards = [
    {
      eyebrow: "01",
      title: "Explore the portfolio",
      detail:
        "Start with selected backend work, performance outcomes, role progression, skills, recognition, and credentials.",
      href: "/portfolio#work",
      cta: "View portfolio",
    },
    {
      eyebrow: "02",
      title: "Read the engineering notes",
      detail:
        "Browse practical write-ups on performance engineering, search architecture, AI relevance, and backend workflows.",
      href: "/blogs",
      cta: "Read blogs",
    },
    {
      eyebrow: "03",
      title: "Check what changed recently",
      detail:
        "Use What's New to scan the latest headlines from the last 30 days before going deeper.",
      href: "/whats-new",
      cta: "See what's new",
    },
    {
      eyebrow: "04",
      title: "Scan the AI radar",
      detail:
        "Follow official and free AI source lanes with short original context and direct links to the source.",
      href: "/ai-radar",
      cta: "Open AI Radar",
    },
    {
      eyebrow: "05",
      title: "Save the useful things",
      detail:
        "Use Sai's Shelf for curated resources and sign in when you want saved posts and content updates.",
      href: "/shelf",
      cta: "Open shelf",
    },
  ];
  const recentUpdates = getRecentSiteUpdates(siteUpdates).slice(0, 3);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to start here
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Start here</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="guide-page shell" id="main-content">
        <section className="guide-hero">
          <p className="eyebrow">Start Here</p>
          <h1>New here? This is the fastest way to understand the site.</h1>
          <p>
            This page gives a quick path through the portfolio: what I build, where the technical
            stories live, what changed recently, and how to follow future updates.
          </p>
        </section>

        <section className="guide-grid" aria-label="Recommended first steps">
          {startCards.map((card) => (
            <article className="guide-card" key={card.title}>
              <span>{card.eyebrow}</span>
              <h2>{card.title}</h2>
              <p>{card.detail}</p>
              <a href={card.href}>{card.cta}</a>
            </article>
          ))}
        </section>

        <section className="mini-updates-panel">
          <div>
            <p className="eyebrow">What's new</p>
            <h2>Recent headlines from the last 30 days.</h2>
          </div>
          <div className="mini-update-list">
            {recentUpdates.length ? (
              recentUpdates.map((update) => (
                <a href={update.href} key={`${update.date}-${update.title}`}>
                  <span>{update.category}</span>
                  <strong>{update.title}</strong>
                  <small>{formatUpdateDate(update.date)}</small>
                </a>
              ))
            ) : (
              <p>No new headlines in the last 30 days. The shelf is calm, for once.</p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

type WhatsNewPageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function WhatsNewPage({ theme, onThemeToggle }: WhatsNewPageProps) {
  const recentUpdates = getRecentSiteUpdates(siteUpdates);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to what's new
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>What's new</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="guide-page shell" id="main-content">
        <section className="guide-hero">
          <p className="eyebrow">What's New</p>
          <h1>Recent headlines from the last 30 days.</h1>
          <p>
            A clean changelog for new articles, shelf additions, page improvements, and useful
            content updates added to this site.
          </p>
        </section>

        <section className="whats-new-list" aria-label="Recent updates">
          {recentUpdates.length ? (
            recentUpdates.map((update) => (
              <article className="whats-new-item" key={`${update.date}-${update.title}`}>
                <div>
                  <span>{update.category}</span>
                  <time dateTime={update.date}>{formatUpdateDate(update.date)}</time>
                </div>
                <h2>{update.title}</h2>
                <p>{update.summary}</p>
                <a href={update.href}>Open update</a>
              </article>
            ))
          ) : (
            <div className="whats-new-empty">
              <ReaderMenuGlyph type="spark" />
              <h2>No new headlines in the last 30 days.</h2>
              <p>
                Quiet weeks are allowed. Subscribe below and the next useful update will find you
                without any refresh-button cardio.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

type AiRadarPageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function getAiRadarSourceTone(source: string) {
  const sourceTones: Record<string, { primary: string; secondary: string }> = {
    "Anthropic News": { primary: "#b85b3c", secondary: "#f2c3a4" },
    "arXiv CS.AI": { primary: "#8c1d40", secondary: "#f4c7d6" },
    "Google AI Blog": { primary: "#1a73e8", secondary: "#cfe1ff" },
    "Hugging Face Blog": { primary: "#f4a51c", secondary: "#ffdf8f" },
    "NVIDIA AI Blog": { primary: "#76b900", secondary: "#d9f99d" },
    "OpenAI News": { primary: "#111c2b", secondary: "#c9d6e4" },
  };

  return sourceTones[source] ?? { primary: "#f0643b", secondary: "#ffe3da" };
}

function getAiRadarSourceInitials(source: string) {
  return source
    .replace(/\b(blog|news|cs\.ai)\b/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function formatAiRadarDate(publishedAt?: string) {
  if (!publishedAt) {
    return "Curated source";
  }

  const date = new Date(publishedAt);

  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function getAiRadarVisualStyle(signal: AiRadarSignal) {
  const tone = getAiRadarSourceTone(signal.source);

  return {
    "--radar-primary": tone.primary,
    "--radar-secondary": tone.secondary,
  } as CSSProperties;
}

function AiRadarPage({ theme, onThemeToggle }: AiRadarPageProps) {
  const [selectedCategory, setSelectedCategory] = useState(ALL_AI_RADAR_CATEGORIES);
  const [liveSignals, setLiveSignals] = useState<AiRadarSignal[]>(aiRadarSignals);
  const [radarStatus, setRadarStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [radarUpdatedAt, setRadarUpdatedAt] = useState("");
  const [radarRefreshTick, setRadarRefreshTick] = useState(0);
  const [radarError, setRadarError] = useState("");
  const aiRadarCategories = [
    ALL_AI_RADAR_CATEGORIES,
    ...Array.from(new Set(liveSignals.map((signal) => signal.category))),
  ];
  const visibleSignals =
    selectedCategory === ALL_AI_RADAR_CATEGORIES
      ? liveSignals
      : liveSignals.filter((signal) => signal.category === selectedCategory);
  const storySignals = visibleSignals.length ? visibleSignals.slice(0, 5) : liveSignals.slice(0, 5);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const activeStory =
    storySignals[activeStoryIndex % Math.max(storySignals.length, 1)] ??
    liveSignals[0] ??
    aiRadarSignals[0];
  const topSignals = visibleSignals
    .filter((signal) => signal.href !== activeStory.href)
    .slice(0, 3);
  const listSignals = visibleSignals
    .filter((signal) => signal.href !== activeStory.href)
    .slice(3);
  const radarHighlights = [
    { label: "Live Feed", value: radarStatus === "live" ? "On" : "Fallback" },
    { label: "Sources", value: `${new Set(liveSignals.map((signal) => signal.source)).size}` },
    { label: "Mode", value: "Ranked" },
  ];

  useEffect(() => {
    setActiveStoryIndex(0);
  }, [selectedCategory, liveSignals]);

  useEffect(() => {
    let isCurrent = true;

    const loadAiRadar = async () => {
      setRadarStatus("loading");
      setRadarError("");

      try {
        const response = await fetch(`/api/ai-radar?limit=12&refresh=${radarRefreshTick}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("AI Radar feed is unavailable.");
        }

        const data = (await response.json()) as AiRadarApiResponse;
        const items: AiRadarApiItem[] = Array.isArray(data.items) ? data.items : [];
        const nextSignals = items
          .map((item): AiRadarSignal | null => {
            if (
              typeof item?.title !== "string" ||
              typeof item?.href !== "string" ||
              typeof item?.source !== "string"
            ) {
              return null;
            }

            return {
              category: typeof item.category === "string" ? item.category : "AI",
              cadence: typeof item.cadence === "string" ? item.cadence : "Live source feed",
              href: item.href,
              imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
              isLive: Boolean(item.isLive),
              publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : undefined,
              rank: typeof item.rank === "number" ? item.rank : undefined,
              source: item.source,
              summary: typeof item.summary === "string" ? item.summary : "",
              title: item.title,
              whyItMatters:
                typeof item.whyItMatters === "string" && item.whyItMatters
                  ? item.whyItMatters
                  : "Fresh signal from a trusted AI source. Open the original article for the full context.",
            };
          })
          .filter((item): item is AiRadarSignal => Boolean(item));

        if (!isCurrent) {
          return;
        }

        if (nextSignals.length) {
          setLiveSignals(nextSignals);
          setRadarStatus("live");
          setRadarUpdatedAt(typeof data?.generatedAt === "string" ? data.generatedAt : "");
        } else {
          setLiveSignals(aiRadarSignals);
          setRadarStatus("fallback");
          setRadarUpdatedAt("");
        }
      } catch (error) {
        if (!isCurrent) {
          return;
        }

        setLiveSignals(aiRadarSignals);
        setRadarStatus("fallback");
        setRadarUpdatedAt("");
        setRadarError(error instanceof Error ? error.message : "AI Radar is using curated fallback sources.");
      }
    };

    loadAiRadar();

    return () => {
      isCurrent = false;
    };
  }, [radarRefreshTick]);

  useEffect(() => {
    if (storySignals.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveStoryIndex((index) => (index + 1) % storySignals.length);
    }, 5200);

    return () => window.clearInterval(intervalId);
  }, [storySignals.length]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to AI Radar
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>AI Radar</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="ai-radar-page shell" id="main-content">
        <section
          className="ai-radar-hero"
          aria-label="Live AI briefing"
          style={getAiRadarVisualStyle(activeStory)}
        >
          <div className="ai-radar-hero-backdrop">
            {activeStory.imageUrl ? (
              <img src={activeStory.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span>{getAiRadarSourceInitials(activeStory.source)}</span>
            )}
          </div>

          <div className="ai-radar-story-card" aria-live="polite">
            <div className="ai-radar-story-topline">
              <span className="ai-radar-live-dot">
                {radarStatus === "loading" ? "Checking feeds" : "Live AI Briefing"}
              </span>
              <span>{activeStory.source}</span>
            </div>

            <div className="ai-radar-story-body">
              <div className="ai-radar-story-thumb">
                {activeStory.imageUrl ? (
                  <img src={activeStory.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <span>{getAiRadarSourceInitials(activeStory.source)}</span>
                )}
              </div>
              <div>
                <div className="ai-radar-source-line">
                  <span>{activeStory.category}</span>
                  <span>{formatAiRadarDate(activeStory.publishedAt)}</span>
                </div>
                <h1>{activeStory.title}</h1>
                <a href={activeStory.href} target="_blank" rel="noreferrer">
                  Read story
                </a>
              </div>
            </div>

            <div className="ai-radar-story-controls" aria-label="AI story controls">
              <div className="ai-radar-story-dots">
                {storySignals.map((signal, index) => (
                  <button
                    className={index === activeStoryIndex ? "is-active" : ""}
                    key={`${signal.source}-${signal.href}`}
                    type="button"
                    aria-label={`Show story ${index + 1}`}
                    onClick={() => setActiveStoryIndex(index)}
                  />
                ))}
              </div>
              <button
                className="ai-radar-next-story"
                type="button"
                onClick={() =>
                  setActiveStoryIndex((index) =>
                    storySignals.length ? (index + 1) % storySignals.length : 0,
                  )
                }
              >
                Next story
              </button>
            </div>
          </div>

          <div className="ai-radar-hero-panel">
            <p className="eyebrow">AI Radar</p>
            <h2>Live AI briefing.</h2>
            <p>
              Rotating stories from trusted AI feeds, ranked for builders who want signal fast.
            </p>
            <div className="ai-radar-signal-strip" aria-label="AI Radar summary">
              {radarHighlights.map((item) => (
                <span key={item.label}>
                  <strong>{item.value}</strong>
                  {item.label}
                </span>
              ))}
            </div>
            <div className="ai-radar-actions">
              <a className="button button-primary" href="#radar-feed">
                View briefing
              </a>
              <button
                className="button button-secondary"
                type="button"
                disabled={radarStatus === "loading"}
                onClick={() => setRadarRefreshTick((tick) => tick + 1)}
              >
                {radarStatus === "loading" ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <p className="ai-radar-status">
              {radarStatus === "live"
                ? `Live briefing${radarUpdatedAt ? ` / ${formatAiRadarDate(radarUpdatedAt)}` : ""}`
                : radarStatus === "loading"
                  ? "Checking trusted feeds"
                  : radarError ? "Curated fallback active" : "Curated fallback active"}
            </p>
          </div>
        </section>

        {topSignals.length ? (
          <section className="ai-radar-top-grid" aria-label="Top ranked AI stories">
            {topSignals.map((signal) => (
              <a
                className="ai-radar-top-card"
                href={signal.href}
                key={`${signal.source}-${signal.href}`}
                target="_blank"
                rel="noreferrer"
                style={getAiRadarVisualStyle(signal)}
              >
                <div className="ai-radar-card-art">
                  {signal.imageUrl ? (
                    <img src={signal.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{getAiRadarSourceInitials(signal.source)}</span>
                  )}
                </div>
                <div className="ai-radar-card-copy">
                  <span>{signal.source}</span>
                  <h2>{signal.title}</h2>
                  <small>{signal.category} / {formatAiRadarDate(signal.publishedAt)}</small>
                </div>
              </a>
            ))}
          </section>
        ) : null}

        <section className="ai-radar-layout" id="radar-feed">
          <aside className="ai-radar-lens" aria-label="AI Radar filters">
            <p className="eyebrow">Signal filters</p>
            <h2>Filter the signal.</h2>
            <div className="ai-radar-filters">
              {aiRadarCategories.map((category) => (
                <button
                  className={category === selectedCategory ? "is-active" : ""}
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="ai-radar-note">
              <strong>Clean reading path.</strong>
              <p>
                Quick preview here. Full context opens at the original source.
              </p>
            </div>
          </aside>

          <div className="ai-radar-feed" aria-label="Curated AI source list">
            {(listSignals.length ? listSignals : visibleSignals).map((signal, index) => (
              <article
                className="ai-radar-item"
                key={`${signal.source}-${signal.href}`}
                style={getAiRadarVisualStyle(signal)}
              >
                <span className="ai-radar-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="ai-radar-mini-art">
                  {signal.imageUrl ? (
                    <img src={signal.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{getAiRadarSourceInitials(signal.source)}</span>
                  )}
                </div>
                <div className="ai-radar-item-copy">
                  <div className="ai-radar-item-meta">
                    <span>{signal.category}</span>
                    <span>{formatAiRadarDate(signal.publishedAt)}</span>
                  </div>
                  <h3>{signal.title}</h3>
                  <p>{signal.summary || signal.whyItMatters}</p>
                </div>
                <div className="ai-radar-item-action">
                  <span>{signal.source}</span>
                  <a href={signal.href} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

type ContactPageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function ContactPage({ theme, onThemeToggle }: ContactPageProps) {
  const collaborationAreas = [
    {
      title: "Backend Performance",
      summary:
        "Diagnose latency, remove repeated work, and make high-volume request paths more predictable.",
      points: ["Database hot paths", "Async execution", "Throughput tuning"],
    },
    {
      title: "Search and Matching Systems",
      summary:
        "Design search-heavy workflows where relevance, scale, and explainability need to work together.",
      points: ["Oracle Text", "OpenSearch", "Hybrid scoring"],
    },
    {
      title: "AI and LLM Workflows",
      summary:
        "Bring practical AI into backend systems without losing control, auditability, or engineering clarity.",
      points: ["Semantic retrieval", "LLM assistance", "Prompt workflows"],
    },
  ];
  const collaborationSteps = [
    {
      label: "01",
      title: "Understand the workflow",
      detail:
        "Clarify the system goal, user path, constraints, and the production signal that matters most.",
    },
    {
      label: "02",
      title: "Find the real bottleneck",
      detail:
        "Separate symptoms from root causes across database access, services, cache, search, and async flows.",
    },
    {
      label: "03",
      title: "Design the clean path",
      detail:
        "Choose the smallest reliable solution that improves performance without creating hidden operational risk.",
    },
    {
      label: "04",
      title: "Validate and document",
      detail:
        "Measure the result, capture the reasoning, and keep the implementation understandable for future teams.",
    },
  ];
  const proofSignals = [
    { value: "97%", label: "Batch latency reduction" },
    { value: "85%", label: "Real-time speedup" },
    { value: "100+ TPS", label: "Runtime scale" },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to Work With Me page
      </a>

      <header className="article-site-header collaboration-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Work With Me</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="collaboration-page" id="main-content">
        <section className="collaboration-hero shell">
          <div className="collaboration-hero-copy">
            <p className="collaboration-pill">Available for meaningful engineering conversations</p>
            <h1>Turn complex backend workflows into reliable, scalable product systems.</h1>
            <p>
              I enjoy conversations around performance engineering, search-heavy architectures,
              AI-assisted relevance, and backend systems where speed, correctness, and trust all
              need to hold together.
            </p>
            <div className="collaboration-actions">
              <a className="button collaboration-primary" href={`mailto:${profile.email}`}>
                Start a conversation
              </a>
              <a
                className="button collaboration-secondary"
                href={profile.linkedin}
                target="_blank"
                rel="noreferrer"
              >
                Connect on LinkedIn
              </a>
            </div>
          </div>

          <aside className="collaboration-signal-card" aria-label="Collaboration signals">
            <p className="collaboration-card-kicker">Engineering focus</p>
            <h2>Performance, search, and practical AI.</h2>
            <div className="collaboration-radar" aria-hidden="true">
              <span className="radar-ring radar-ring-one" />
              <span className="radar-ring radar-ring-two" />
              <span className="radar-line radar-line-one" />
              <span className="radar-line radar-line-two" />
              <span className="radar-dot radar-dot-one" />
              <span className="radar-dot radar-dot-two" />
              <span className="radar-dot radar-dot-three" />
            </div>
            <dl className="collaboration-contact-list">
              <div>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{profile.location}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="collaboration-section shell">
          <div className="collaboration-section-heading">
            <p className="collaboration-eyebrow">Collaboration areas</p>
            <h2>Where I can bring the strongest value.</h2>
            <p>
              The best fit is work that needs thoughtful backend design, measurable performance
              improvement, and clean technical storytelling.
            </p>
          </div>

          <div className="collaboration-card-grid">
            {collaborationAreas.map((area) => (
              <article className="collaboration-area-card" key={area.title}>
                <span className="collaboration-card-icon" aria-hidden="true" />
                <h3>{area.title}</h3>
                <p>{area.summary}</p>
                <ul>
                  {area.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="collaboration-section collaboration-proof shell">
          <div>
            <p className="collaboration-eyebrow">Outcome-oriented</p>
            <h2>Conversations stay grounded in measurable engineering signal.</h2>
            <p>
              I like working from evidence: latency numbers, query behavior, throughput patterns,
              reliability constraints, and the product outcome behind the technical work.
            </p>
          </div>

          <div className="collaboration-proof-grid">
            {proofSignals.map((signal) => (
              <article key={signal.label}>
                <strong>{signal.value}</strong>
                <span>{signal.label}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="collaboration-section shell">
          <div className="collaboration-section-heading">
            <p className="collaboration-eyebrow">How we work together</p>
            <h2>A simple path from problem to useful result.</h2>
          </div>

          <div className="collaboration-process">
            {collaborationSteps.map((step) => (
              <article className="collaboration-step" key={step.label}>
                <span>{step.label}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="collaboration-cta shell">
          <p className="collaboration-eyebrow">Ready to connect</p>
          <h2>Have a backend, search, or AI workflow worth improving?</h2>
          <p>
            Send a short note with the context, goal, and any constraints. I will respond with the
            clearest next step.
          </p>
          <a className="button collaboration-primary" href={`mailto:${profile.email}`}>
            {profile.email}
          </a>
        </section>
      </main>
    </>
  );
}

type BlogArticlePageProps = {
  post?: BlogPost;
  isAccessChecking: boolean;
  isLocked: boolean;
  isPostSaved: (slug: string) => boolean;
  savedPostsBusySlug: string;
  subscriberUser: User | null;
  theme: Theme;
  onToggleSavedPost: (post: BlogPost) => void;
  onThemeToggle: () => void;
};

function BlogArticlePage({
  post,
  isAccessChecking,
  isLocked,
  isPostSaved,
  savedPostsBusySlug,
  subscriberUser,
  theme,
  onToggleSavedPost,
  onThemeToggle,
}: BlogArticlePageProps) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to article
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Engineering notes</span>
            </span>
          </a>

          <div className="article-header-actions">
            {post && !isAccessChecking && !isLocked ? (
              <SavePostButton
                isBusy={savedPostsBusySlug === post.slug}
                isSaved={isPostSaved(post.slug)}
                post={post}
                subscriberUser={subscriberUser}
                onToggle={onToggleSavedPost}
              />
            ) : null}
            <a className="button button-secondary" href="/">
              Home
            </a>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => returnToPortfolioBlog(post?.slug)}
            >
              Back to blogs
            </button>
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="article-page shell" id="main-content">
        {post && isAccessChecking ? (
          <section className="standalone-blog standalone-blog-empty standalone-blog-locked">
            <p className="eyebrow">Checking access</p>
            <div className="standalone-lock-headline">
              <span className="blog-lock-icon" aria-hidden="true">
                <BlogLockIcon />
              </span>
              <h1>Giving the lock one second to check your reader badge.</h1>
            </div>
            <p>
              If you are already signed in, the article will open as soon as your session is
              confirmed.
            </p>
            <a
              className="button button-secondary"
              href={getSignInHref(post.slug)}
            >
              Open sign in
            </a>
          </section>
        ) : post && isLocked ? (
          <section className="standalone-blog standalone-blog-empty standalone-blog-locked">
            <p className="eyebrow">Locked Article</p>
            <div className="standalone-lock-headline">
              <span className="blog-lock-icon" aria-hidden="true">
                <BlogLockIcon />
              </span>
              <h1>{post.title}</h1>
            </div>
            <div className="blog-meta">
              <span>{post.category}</span>
              <span>{post.publishedAt}</span>
              <span>{post.readTime}</span>
            </div>
            <p>{post.summary}</p>
            <BlogLockNote />
            <a
              className="button button-primary"
              href={getSignInHref(post.slug)}
            >
              Sign in to unlock
            </a>
          </section>
        ) : post ? (
          <article className="standalone-blog">
            <div className="standalone-blog-hero">
              <p className="eyebrow">Standalone Article</p>
              <h1>{post.title}</h1>
              <div className="blog-meta">
                <span>{post.category}</span>
                <span>{post.publishedAt}</span>
                <span>{post.readTime}</span>
              </div>
              <p>{post.summary}</p>
              <div className="blog-action-row">
                <SavePostButton
                  isBusy={savedPostsBusySlug === post.slug}
                  isSaved={isPostSaved(post.slug)}
                  post={post}
                  subscriberUser={subscriberUser}
                  onToggle={onToggleSavedPost}
                />
              </div>
            </div>

            <BlogArticleBody post={post} />
          </article>
        ) : (
          <section className="standalone-blog standalone-blog-empty">
            <p className="eyebrow">Article not found</p>
            <h1>This blog post is not available.</h1>
            <p>
              The article link may have changed. You can go back to the blog index and choose a
              post from the current list.
            </p>
            <a className="button button-primary" href="/blogs">
              View blogs
            </a>
          </section>
        )}
      </main>
    </>
  );
}

type SavedPostsPageProps = {
  authReady: boolean;
  savedPosts: BlogPost[];
  savedPostsBusySlug: string;
  subscriberUser: User | null;
  subscriptionError: string;
  subscriptionMessage: string;
  theme: Theme;
  onToggleSavedPost: (post: BlogPost) => void;
  onThemeToggle: () => void;
};

function SavedPostsPage({
  authReady,
  savedPosts,
  savedPostsBusySlug,
  subscriberUser,
  subscriptionError,
  subscriptionMessage,
  theme,
  onToggleSavedPost,
  onThemeToggle,
}: SavedPostsPageProps) {
  const savedPostCount = savedPosts.length;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to saved posts
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Saved reading shelf</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/blogs" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="saved-posts-page shell" id="main-content">
        <section className="saved-posts-panel">
          <div className="saved-posts-hero">
            <p className="eyebrow">Saved Posts</p>
            <h1>Your private reading shelf, minus the dust.</h1>
            <p>
              Articles you save from the blog section appear here in a clean list, so useful
              engineering notes are easy to reopen when the coffee is ready.
            </p>
            {subscriberUser ? (
              <div className="saved-posts-count" aria-label={`${savedPostCount} saved posts`}>
                <strong>{savedPostCount}</strong>
                <span>{savedPostCount === 1 ? "saved post" : "saved posts"}</span>
              </div>
            ) : null}
          </div>

          {subscriptionMessage ? (
            <p className="status-message is-success">{subscriptionMessage}</p>
          ) : null}
          {subscriptionError ? <p className="status-message is-error">{subscriptionError}</p> : null}

          {!authReady ? (
            <div className="saved-posts-empty">
              <ReaderMenuGlyph type="bookmark" />
              <h2>Checking your reader shelf.</h2>
              <p>The bookmarks are putting on their shoes. One second.</p>
            </div>
          ) : !subscriberUser ? (
            <div className="saved-posts-empty">
              <ReaderMenuGlyph type="bookmark" />
              <h2>Sign in to open your saved-posts shelf.</h2>
              <p>
                Your private list lives behind sign-in, so bookmarks do not wander off into the
                internet wearing someone else&apos;s jacket.
              </p>
              <a className="button button-primary" href={getSavedPostsSignInHref()}>
                Sign in to view saved posts
              </a>
            </div>
          ) : savedPosts.length ? (
            <div className="saved-posts-list" aria-label="Saved blog posts">
              {savedPosts.map((post, index) => (
                <article className="saved-posts-item" key={post.slug}>
                  <span className="saved-posts-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="saved-posts-copy">
                    <div className="blog-meta">
                      <span>{post.category}</span>
                      <span>{post.publishedAt}</span>
                      <span>{post.readTime}</span>
                    </div>
                    <h2>{post.title}</h2>
                    <p>{post.summary}</p>
                  </div>
                  <div className="saved-posts-actions">
                    <a
                      className="button button-primary"
                      href={getBlogArticleHref(post.slug)}
                      target="_blank"
                      rel="opener"
                    >
                      Read article
                    </a>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={savedPostsBusySlug === post.slug}
                      onClick={() => onToggleSavedPost(post)}
                    >
                      {savedPostsBusySlug === post.slug ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="saved-posts-empty">
              <ReaderMenuGlyph type="bookmark" />
              <h2>Your saved shelf is impressively empty.</h2>
              <p>
                Go rescue one sharp engineering note from the blog section, and this quiet little
                shelf will instantly look productive.
              </p>
              <a className="button button-primary" href="/blogs">
                Browse blogs
              </a>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

type ShelfPageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function ShelfPage({ theme, onThemeToggle }: ShelfPageProps) {
  const shelfPlans = [
    {
      title: "Backend Patterns",
      detail: "Small notes on caching, async processing, database tuning, and service design.",
    },
    {
      title: "CS Fundamentals",
      detail: "Clean explanations for concepts that are useful in interviews and real systems.",
    },
    {
      title: "AI and LLM Notes",
      detail: "Practical prompts, workflow ideas, and references that are worth revisiting.",
    },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to Sai's Shelf
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Sai's Shelf</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="shelf-page shell" id="main-content">
        <section className="shelf-panel">
          <div className="shelf-hero">
            <p className="eyebrow">Sai's Shelf</p>
            <h1>A growing shelf for useful engineering content.</h1>
            <p>
              This space will collect practical references, short explainers, diagrams, tools,
              and notes that are worth keeping close. I will add content one useful piece at a
              time, so the shelf grows without becoming noisy.
            </p>
          </div>

          <div className="shelf-coming-soon">
            <ReaderMenuGlyph type="shelf" />
            <div>
              <h2>The shelf is being arranged.</h2>
              <p>
                Nothing dusty here yet. Soon this will become a neat corner for the kind of
                content you want to bookmark before future-you starts searching frantically.
              </p>
            </div>
          </div>

          <div className="shelf-plan-grid" aria-label="Planned shelf topics">
            {shelfPlans.map((item) => (
              <article className="shelf-plan-card" key={item.title}>
                <span>Coming soon</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

type DashboardPageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function DashboardPage({ theme, onThemeToggle }: DashboardPageProps) {
  const topics = getDashboardTopics(blogPosts);
  const totalBlogCount = Math.max(blogPosts.length, 1);
  const totalReadMinutes = blogPosts.reduce((total, post) => total + getReadMinutes(post.readTime), 0);
  const averageReadMinutes = blogPosts.length ? Math.round(totalReadMinutes / blogPosts.length) : 0;
  const publicFeatureCount = blogPosts.some((post) => post.slug === PUBLIC_BLOG_SLUG) ? 1 : 0;
  const maxTopicScore = Math.max(...topics.map((topic) => topic.score), 1);
  const cadenceBars = getDashboardActivityBars(siteUpdates);
  const activeCadenceDays = cadenceBars.filter((bar) => bar.isPublishedDay).length;
  const recentUpdateCount = cadenceBars.reduce((total, bar) => total + bar.updateCount, 0);
  const topArticles = [...blogPosts]
    .map((post) => ({
      ...post,
      contentScore:
        getReadMinutes(post.readTime) * 8 + post.sections.length * 6 + post.takeaways.length * 4,
    }))
    .sort((left, right) => right.contentScore - left.contentScore)
    .slice(0, 8);
  const maxArticleScore = Math.max(...topArticles.map((post) => post.contentScore), 1);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to dashboard
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Creator dashboard</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/portfolio#top" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-page" id="main-content">
        <section className="dashboard-shell">
          <div className="dashboard-hero">
            <p className="eyebrow">Creator Dashboard</p>
            <h1>Content cockpit for portfolio momentum.</h1>
            <p>
              A compact view of engineering notes, topic coverage, portfolio signals, and the
              writing pipeline behind this site.
            </p>
            <div className="dashboard-chip-row" aria-label="Dashboard lenses">
              <span>Reader journey</span>
              <span>Engineering notes</span>
              <span>Portfolio signal</span>
            </div>
          </div>

          <div className="dashboard-note">
            <span>At a glance</span>
            <p>
              This dashboard summarizes the content already published on the site. It is designed
              for editorial clarity, not inflated vanity metrics.
            </p>
          </div>

          <div className="dashboard-email-callout">
            <div>
              <span>Content updates</span>
              <h2>Get the signal without refreshing the dashboard.</h2>
              <p>
                Subscribe once and useful engineering notes, dashboard additions, and portfolio
                updates land in your inbox only when there is something worth opening.
              </p>
            </div>
            <a className="button button-primary" href="#newsletter">
              Get updates
            </a>
          </div>

          <div className="dashboard-stat-grid" aria-label="Dashboard summary">
            <article className="dashboard-stat-card">
              <ReaderMenuGlyph type="pen" />
              <span>Total Blogs</span>
              <strong>{blogPosts.length}</strong>
            </article>
            <article className="dashboard-stat-card">
              <ReaderMenuGlyph type="bookmark" />
              <span>Topic Lanes</span>
              <strong>{topics.length}</strong>
            </article>
            <article className="dashboard-stat-card">
              <ReaderMenuGlyph type="briefcase" />
              <span>Projects</span>
              <strong>{projects.length}</strong>
            </article>
            <article className="dashboard-stat-card">
              <ReaderMenuGlyph type="home" />
              <span>Avg. Read Time</span>
              <strong>{averageReadMinutes} min</strong>
            </article>
          </div>

          <div className="dashboard-grid dashboard-grid-two">
            <article className="dashboard-card">
              <div className="dashboard-card-heading">
                <h2>Topic Performance</h2>
                <span>Metric comparison</span>
              </div>
              <p className="dashboard-card-helper">
                Depth score combines read time, structure, and takeaways. Articles shows how many
                posts exist in that topic, while the dot keeps the topic identity clear.
              </p>
              <div className="dashboard-topic-chart">
                {topics.map((topic) => (
                  <div className="dashboard-topic-column" key={topic.category}>
                    <div className="dashboard-topic-bars">
                      <span
                        className="dashboard-topic-bar is-depth"
                        style={
                          {
                            "--bar-height": `${Math.max((topic.score / maxTopicScore) * 100, 12)}%`,
                          } as CSSProperties
                        }
                        title={`${topic.category} depth score: ${topic.score}`}
                      />
                      <span
                        className="dashboard-topic-bar is-posts"
                        style={
                          {
                            "--bar-height": `${Math.max((topic.posts / totalBlogCount) * 100, 12)}%`,
                          } as CSSProperties
                        }
                        title={`${topic.category} articles: ${topic.posts}`}
                      />
                    </div>
                    <small>
                      <i style={{ background: topic.color }} aria-hidden="true" />
                      {topic.category}
                    </small>
                  </div>
                ))}
              </div>
              <div className="dashboard-legend">
                <span><i className="is-depth" /> Depth score</span>
                <span><i className="is-posts" /> Articles</span>
              </div>
            </article>

            <article className="dashboard-card dashboard-donut-card">
              <div className="dashboard-card-heading">
                <h2>Content Distribution</h2>
                <span>By topic</span>
              </div>
              <div
                className="dashboard-donut"
                style={{ background: getDashboardDonutGradient(topics) }}
                aria-hidden="true"
              >
                <span />
              </div>
              <div className="dashboard-legend is-wrapped">
                {topics.map((topic) => (
                  <span key={topic.category}>
                    <i style={{ background: topic.color }} /> {topic.category}
                  </span>
                ))}
              </div>
            </article>
          </div>

          <article className="dashboard-card">
            <div className="dashboard-card-heading">
              <h2>Top Content by Reading Depth</h2>
              <span>Derived from article length and structure</span>
            </div>
            <div className="dashboard-article-bars">
              {topArticles.map((post, index) => (
                <a
                  className="dashboard-article-bar"
                  href={getBlogArticleHref(post.slug)}
                  key={post.slug}
                  target="_blank"
                  rel="opener"
                  style={
                    {
                      "--article-bar": `${Math.max((post.contentScore / maxArticleScore) * 100, 10)}%`,
                    } as CSSProperties
                  }
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{post.title}</strong>
                </a>
              ))}
            </div>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-heading">
              <h2>Publishing Rhythm</h2>
              <span>Last 30 days</span>
            </div>
            <p className="dashboard-card-helper">
              This timeline is based on the site update log. Each bar represents one day; highlighted
              bars show when a page, blog, or dashboard item was published or meaningfully updated.
            </p>
            <div className="dashboard-cadence-stats">
              <span><strong>{recentUpdateCount}</strong> recent updates</span>
              <span><strong>{activeCadenceDays}</strong> active days</span>
              <span><strong>{publicFeatureCount}</strong> public article</span>
              <span><strong>{totalReadMinutes}</strong> min library</span>
            </div>
            <div
              className="dashboard-cadence-chart"
              aria-label="Publishing rhythm chart for the last 30 days"
            >
              {cadenceBars.map((bar, index) => (
                <span
                  className={bar.isPublishedDay ? "is-published" : ""}
                  key={`cadence-${index}`}
                  style={{ "--cadence-height": `${bar.height}%` } as CSSProperties}
                  title={bar.label}
                />
              ))}
            </div>
            <div className="dashboard-cadence-axis" aria-hidden="true">
              <span>{formatUpdateDate(cadenceBars[0]?.date ?? getDateKey(new Date()))}</span>
              <span>30-day window</span>
              <span>Today</span>
            </div>
            <div className="dashboard-legend dashboard-cadence-legend">
              <span><i className="is-published" /> Published or updated</span>
              <span><i className="is-quiet" /> Quiet day</span>
            </div>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-heading">
              <h2>Most Useful Content</h2>
              <span>Structured list format</span>
            </div>
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Blog title</th>
                    <th>Topic</th>
                    <th>Length</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {topArticles.slice(0, 5).map((post, index) => (
                    <tr key={post.slug}>
                      <td>
                        <span>{index + 1}</span>
                        <a href={getBlogArticleHref(post.slug)} target="_blank" rel="opener">
                          {post.title}
                        </a>
                      </td>
                      <td>{post.category}</td>
                      <td>{post.readTime}</td>
                      <td>{post.stats[0]?.value ?? "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-heading">
              <h2>Topic Breakdown</h2>
              <span>Coverage map</span>
            </div>
            <div className="dashboard-topic-breakdown">
              {topics.map((topic) => (
                <section key={topic.category}>
                  <h3>{topic.category}</h3>
                  <p>Blogs: <strong>{topic.posts}</strong></p>
                  <p>Total read time: <strong>{topic.readMinutes} min</strong></p>
                </section>
              ))}
            </div>
          </article>
        </section>
      </main>
    </>
  );
}

type SignInPageProps = SubscriptionAccessCardProps & {
  portfolioReturnBlogSlug?: string;
  signInReturnTarget?: string;
  subscriberView: SubscriberViewState;
  theme: Theme;
  onThemeToggle: () => void;
};

function SignInPage({
  portfolioReturnBlogSlug,
  signInReturnTarget,
  subscriberName,
  subscriberView,
  theme,
  onThemeToggle,
  ...subscriptionProps
}: SignInPageProps) {
  const firstName = subscriberName.split(" ")[0] || "there";
  const returnTargetConfig = getReturnTargetConfig(signInReturnTarget ?? "");
  const heroCopy = {
    guest: {
      title: "Sign in to follow new engineering notes and portfolio updates.",
      body: "Subscribe to practical notes on backend performance, search systems, AI and LLM workflows, and selected portfolio updates. You stay in control and can unsubscribe anytime.",
    },
    newSignedIn: {
      title: "Nice, you made it in. Want the good stuff delivered?",
      body: `Welcome, ${firstName}. You are signed in, but not subscribed yet. Tap subscribe if you want the useful engineering notes to find your inbox instead of playing hide-and-seek.`,
    },
    newSubscribed: {
      title: "You joined the signal. The inbox just got smarter.",
      body: `Welcome aboard, ${firstName}. Future write-ups and selected portfolio updates will land in your inbox. Useful notes only, no newsletter confetti cannon.`,
    },
    newUnsubscribed: {
      title: "No worries. Your inbox gets a quiet little vacation.",
      body: `You are unsubscribed, ${firstName}. No updates will be sent unless you subscribe again. The notes will be here, looking mildly dramatic, whenever you come back.`,
    },
    newSignedOutSubscribed: {
      title: "Signed out, but the update bridge is still open.",
      body: "See you around. Your subscription is active, so the next useful engineering note still knows where to go.",
    },
    newSignedOutUnsubscribed: {
      title: "Signed out and off the list. The inbox rests.",
      body: "No emails will be sent. The door stays open, the lights stay warm, and the engineering notes will behave until you return.",
    },
    returningSubscribed: {
      title: "Welcome back. Your update radar is still switched on.",
      body: `Good to see you again, ${firstName}. You are already subscribed, so new engineering notes and portfolio updates will keep finding their way to you.`,
    },
    returningUnsubscribed: {
      title: "Welcome back. Your updates are still paused.",
      body: `Good to see you again, ${firstName}. Your inbox is safe from me for now. If curiosity starts tapping on the window, subscribe again anytime.`,
    },
    returningResubscribed: {
      title: "Back on the list. The comeback arc begins.",
      body: `Nice move, ${firstName}. Updates are active again, and the next useful engineering note gets a proper boarding pass to your inbox.`,
    },
    returningSignedOutSubscribed: {
      title: "Signed out, but still on the good-stuff route.",
      body: "You are logged out, but your subscription stays active. The portfolio will keep sending selected engineering notes when they are worth your time.",
    },
    returningSignedOutUnsubscribed: {
      title: "Signed out and still unsubscribed. Peace restored.",
      body: "No updates will be sent. Your inbox is now wearing noise-cancelling headphones, and we respect that.",
    },
  }[subscriberView];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to sign in
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Subscriber access</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            {portfolioReturnBlogSlug ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => returnToPortfolioBlog(portfolioReturnBlogSlug)}
              >
                Back to blogs
              </button>
            ) : returnTargetConfig ? (
              <PageBackButton
                fallbackHref={returnTargetConfig.href}
                label={returnTargetConfig.label}
              />
            ) : (
              <PageBackButton fallbackHref="/portfolio#top" label="Back" />
            )}
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="signin-page shell" id="main-content">
        <section className="signin-hero">
          <div className="signin-copy">
            <p className="eyebrow">Subscriber Access</p>
            <h1>{heroCopy.title}</h1>
            <p>{heroCopy.body}</p>
          </div>

          <SubscriptionAccessCard subscriberName={subscriberName} {...subscriptionProps} />
        </section>
      </main>
    </>
  );
}

type SendUpdateResult = {
  error?: string;
  failed?: number;
  mode?: string;
  sent?: number;
  total?: number;
};

type AdminUpdatePageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function AdminUpdatePage({ theme, onThemeToggle }: AdminUpdatePageProps) {
  const [adminSecret, setAdminSecret] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<SendUpdateResult | null>(null);

  const handleSendUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSendBusy(true);
    setSendResult(null);

    try {
      const response = await fetch("/api/send-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          title,
          summary,
          link,
          testEmail,
        }),
      });
      const result = (await response.json()) as SendUpdateResult;

      if (!response.ok) {
        throw new Error(result.error || "Unable to send update.");
      }

      setSendResult(result);
    } catch (error) {
      setSendResult({
        error: error instanceof Error ? error.message : "Unable to send update.",
      });
    } finally {
      setSendBusy(false);
    }
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to admin update sender
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Email updates</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/portfolio#top" label="Back" />
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={onThemeToggle}
            >
              <ThemeToggleIcon theme={theme} />
            </button>
          </div>
        </div>
      </header>

      <main className="admin-update-page shell" id="main-content">
        <section className="admin-update-panel">
          <div className="admin-update-copy">
            <p className="eyebrow">Admin Sender</p>
            <h1>Send a portfolio update email.</h1>
            <p>
              Start with a test recipient. Leave the test recipient blank only when you want to
              send the update to every active subscriber.
            </p>
          </div>

          <form className="admin-update-form" onSubmit={handleSendUpdate}>
            <label>
              <span>Admin secret</span>
              <input
                type="password"
                value={adminSecret}
                onChange={(event) => setAdminSecret(event.target.value)}
                placeholder="Paste ADMIN_SEND_SECRET"
                required
              />
            </label>

            <label>
              <span>Email title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="New engineering write-up is live"
                required
              />
            </label>

            <label>
              <span>Message</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Write a short professional summary for subscribers."
                rows={6}
                required
              />
            </label>

            <label>
              <span>Update link</span>
              <input
                type="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://saikumarmediboina.com/blog/..."
              />
            </label>

            <label>
              <span>Test recipient</span>
              <input
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="your-email@example.com"
              />
            </label>

            <button className="button button-primary" type="submit" disabled={sendBusy}>
              {sendBusy ? "Sending..." : testEmail ? "Send test email" : "Send to subscribers"}
            </button>

            {sendResult?.error ? (
              <p className="status-message is-error">{sendResult.error}</p>
            ) : null}
            {sendResult && !sendResult.error ? (
              <p className="status-message is-success">
                Sent {sendResult.sent} of {sendResult.total} emails
                {sendResult.failed ? `, ${sendResult.failed} failed` : ""}.
              </p>
            ) : null}
          </form>
        </section>
      </main>
    </>
  );
}

function App() {
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [readerMenuOpen, setReaderMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [headerDocked, setHeaderDocked] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [selectedBlogCategory, setSelectedBlogCategory] = useState(ALL_BLOG_CATEGORIES);
  const [subscriberUser, setSubscriberUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [savedPostSlugs, setSavedPostSlugs] = useState<string[]>([]);
  const [savedPostsBusySlug, setSavedPostsBusySlug] = useState("");
  const [subscriberView, setSubscriberView] = useState<SubscriberViewState>("guest");
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [subscriptionError, setSubscriptionError] = useState("");
  const manualSignOutViewRef = useRef<SubscriberViewState | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedProject = projects[selectedProjectIndex];
  const selectedProjectNumber = String(selectedProjectIndex + 1).padStart(2, "0");
  const blogCategories = [
    ALL_BLOG_CATEGORIES,
    ...Array.from(new Set(blogPosts.map((post) => post.category))),
  ];
  const visibleBlogPosts =
    selectedBlogCategory === ALL_BLOG_CATEGORIES
      ? blogPosts
      : blogPosts.filter((post) => post.category === selectedBlogCategory);
  const orderedBlogPosts = orderBlogPostsForAccess(visibleBlogPosts);
  const featuredBlog = orderedBlogPosts[0];
  const remainingBlogPosts = orderedBlogPosts.slice(1);
  const savedPosts = savedPostSlugs
    .map((slug) => blogPosts.find((post) => post.slug === slug))
    .filter((post): post is BlogPost => Boolean(post));
  const featuredBlogIsLocked = Boolean(
    featuredBlog && !canReadBlogPost(featuredBlog, subscriberUser),
  );
  const standaloneBlogSlug = getBlogSlugFromPathname();
  const standaloneBlog = standaloneBlogSlug
    ? blogPosts.find((post) => post.slug === standaloneBlogSlug)
    : undefined;
  const standaloneBlogNeedsAuth = Boolean(
    standaloneBlog && standaloneBlog.slug !== PUBLIC_BLOG_SLUG,
  );
  const standaloneBlogIsLocked = Boolean(
    standaloneBlogNeedsAuth && authReady && !canReadBlogPost(standaloneBlog, subscriberUser),
  );
  const standaloneBlogAccessChecking = Boolean(standaloneBlogNeedsAuth && !authReady);
  const isSignInPage = isSignInPathname();
  const isStartPage = isStartPathname();
  const isWhatsNewPage = isWhatsNewPathname();
  const isAiRadarPage = isAiRadarPathname();
  const isSavedPostsPage = isSavedPostsPathname();
  const isShelfPage = isShelfPathname();
  const isDashboardPage = isDashboardPathname();
  const isBlogsPage = isBlogsPathname();
  const isContactPage = isContactPathname();
  const isPortfolioPage = isPortfolioPathname();
  const isAdminUpdatePage = isAdminUpdatePathname();
  const currentNavLinks = isPortfolioPage ? portfolioNavLinks : mainNavLinks;
  const signInReturnBlogSlug = getSignInReturnBlogSlug();
  const signInReturnTarget = getSignInReturnTarget();
  const signInReturnBlog = signInReturnBlogSlug
    ? blogPosts.find((post) => post.slug === signInReturnBlogSlug)
    : undefined;
  const canUseSubscriptions = isFirebaseConfigured && Boolean(auth && googleProvider);
  const subscriberName = subscriberUser?.displayName ?? "Signed-in reader";
  const subscriberEmail = subscriberUser?.email ?? "Email not shared";
  const subscriberInitial = (subscriberUser?.displayName ?? subscriberUser?.email ?? "S")
    .charAt(0)
    .toUpperCase();
  const isPostSaved = (slug: string) => savedPostSlugs.includes(slug);

  useEffect(() => {
    const sectionIds = [
      "top",
      ...currentNavLinks.flatMap((link) => ("id" in link ? [link.id] : [])),
    ];
    let frameId = 0;

    const updateActiveSection = () => {
      const activationLine = window.innerHeight * 0.78;
      const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter((section): section is HTMLElement => Boolean(section));
      const currentSection =
        [...sections]
          .reverse()
          .find((section) => section.getBoundingClientRect().top <= activationLine) ?? sections[0];

      if (currentSection) {
        startTransition(() => {
          setActiveSection(currentSection.id);
        });
      }
    };

    const scheduleActiveSectionUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleActiveSectionUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveSectionUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleActiveSectionUpdate);
      window.removeEventListener("resize", scheduleActiveSectionUpdate);
    };
  }, [currentNavLinks]);

  useEffect(() => {
    let frameId = 0;

    const updateHeaderPosition = () => {
      setHeaderDocked(window.scrollY > 24);
    };

    const scheduleHeaderPositionUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateHeaderPosition);
    };

    updateHeaderPosition();
    window.addEventListener("scroll", scheduleHeaderPositionUpdate, { passive: true });
    window.addEventListener("resize", scheduleHeaderPositionUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleHeaderPositionUpdate);
      window.removeEventListener("resize", scheduleHeaderPositionUpdate);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1080) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        profileMenuRef.current &&
        event.target instanceof Node &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!readerMenuOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReaderMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [readerMenuOpen]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", theme === "dark" ? "#0f1724" : "#111c2b");
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors so the app still works in restricted environments.
    }
  }, [theme]);

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    let isMounted = true;

    const unsubscribeFromAuth = onAuthStateChanged(auth, (user) => {
      if (!isMounted) {
        return;
      }

      setSubscriberUser(user);
      setAuthReady(true);
      setSubscriptionError("");

      if (!user) {
        setIsSubscribed(false);
        setSavedPostSlugs([]);
        setSavedPostsBusySlug("");
        setReaderMenuOpen(false);
        setSubscriberView(manualSignOutViewRef.current ?? "guest");
        manualSignOutViewRef.current = null;
        setSubscriptionBusy(false);
        return;
      }

      setSubscriptionBusy(true);
      Promise.all([ensureSubscriberProfile(user), getSavedPostSlugs(user.uid)])
        .then(([subscriber, nextSavedPostSlugs]) => {
          if (isMounted) {
            setIsSubscribed(subscriber.subscribed);
            setSavedPostSlugs(nextSavedPostSlugs);
            cacheSavedPostSlugs(user.uid, nextSavedPostSlugs);
            setSubscriberView(getSignedInSubscriberView(subscriber));
          }
        })
        .catch((error) => {
          if (isMounted) {
            setSubscriptionError(getSubscriptionErrorMessage(error));
          }
        })
        .finally(() => {
          if (isMounted) {
            setSubscriptionBusy(false);
          }
        });
    });

    return () => {
      isMounted = false;
      unsubscribeFromAuth();
    };
  }, []);

  useEffect(() => {
    if (!subscriberUser || !canUseSubscriptions) {
      return undefined;
    }

    let isCurrentUser = true;
    const cachedSavedPostSlugs = readCachedSavedPostSlugs(subscriberUser.uid);
    setSavedPostSlugs(cachedSavedPostSlugs);

    const unsubscribeFromSavedPosts = subscribeToSavedPostSlugs(
      subscriberUser.uid,
      (nextSavedPostSlugs) => {
        if (!isCurrentUser) {
          return;
        }

        setSavedPostSlugs(nextSavedPostSlugs);
        cacheSavedPostSlugs(subscriberUser.uid, nextSavedPostSlugs);
      },
      (error) => {
        if (isCurrentUser) {
          setSubscriptionError(getSubscriptionErrorMessage(error));
        }
      },
    );

    return () => {
      isCurrentUser = false;
      unsubscribeFromSavedPosts();
    };
  }, [canUseSubscriptions, subscriberUser]);

  useEffect(() => {
    if (!subscriberUser) {
      return undefined;
    }

    const savedPostsStorageKey = getSavedPostsStorageKey(subscriberUser.uid);

    const handleSavedPostsStorage = (event: StorageEvent) => {
      if (event.key !== savedPostsStorageKey || event.newValue === null) {
        return;
      }

      try {
        setSavedPostSlugs(normalizeSavedPostSlugs(JSON.parse(event.newValue)));
      } catch {
        // Ignore malformed storage events; Firestore remains the source of truth.
      }
    };

    window.addEventListener("storage", handleSavedPostsStorage);

    return () => window.removeEventListener("storage", handleSavedPostsStorage);
  }, [subscriberUser]);

  useEffect(() => {
    if (!auth || !canUseSubscriptions) {
      return undefined;
    }

    let isMounted = true;

    getRedirectResult(auth)
      .then(async (result) => {
        if (!result || !isMounted) {
          return;
        }

        setSubscriptionBusy(true);
        const [subscriber, nextSavedPostSlugs] = await Promise.all([
          ensureSubscriberProfile(result.user),
          getSavedPostSlugs(result.user.uid),
        ]);

        if (isMounted) {
          setSubscriberUser(result.user);
          setIsSubscribed(subscriber.subscribed);
          setSavedPostSlugs(nextSavedPostSlugs);
          cacheSavedPostSlugs(result.user.uid, nextSavedPostSlugs);
          setSubscriberView(getSignedInSubscriberView(subscriber));
          setSubscriptionMessage(
            subscriber.subscribed
              ? "Welcome back. Your subscription is active."
              : "You are signed in. Subscribe when you want updates in your inbox.",
          );
          setSubscriptionError("");

          if (getSignInReturnTarget() === "saved-posts") {
            window.location.href = "/saved-posts";
          }
        }
      })
      .catch((error) => {
        if (isMounted) {
          setSubscriptionError(getSubscriptionErrorMessage(error));
        }
      })
      .finally(() => {
        if (isMounted) {
          setSubscriptionBusy(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canUseSubscriptions]);

  const closeMenu = () => {
    setMenuOpen(false);
    setProfileMenuOpen(false);
    setReaderMenuOpen(false);
  };
  const selectBlogCategory = (category: string) => setSelectedBlogCategory(category);
  const clearSubscriptionFeedback = () => {
    setSubscriptionMessage("");
    setSubscriptionError("");
  };

  const handleGoogleSignIn = async () => {
    clearSubscriptionFeedback();

    if (!auth || !googleProvider || !canUseSubscriptions) {
      setSubscriptionError(
        "Google sign-in is ready in the code. Add Firebase environment variables in Vercel to activate it.",
      );
      return;
    }

    setSubscriptionBusy(true);

    let shouldResetBusy = true;

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const [subscriber, nextSavedPostSlugs] = await Promise.all([
        ensureSubscriberProfile(result.user),
        getSavedPostSlugs(result.user.uid),
      ]);
      setSubscriberUser(result.user);
      setIsSubscribed(subscriber.subscribed);
      setSavedPostSlugs(nextSavedPostSlugs);
      cacheSavedPostSlugs(result.user.uid, nextSavedPostSlugs);
      setSubscriberView(getSignedInSubscriberView(subscriber));
      setSubscriptionMessage(
        subscriber.subscribed
          ? "Welcome back. Your subscription is active."
          : "You are signed in. Subscribe when you want updates in your inbox.",
      );

      if (getSignInReturnTarget() === "saved-posts") {
        window.location.href = "/saved-posts";
      }
    } catch (error) {
      if (shouldUseRedirectSignIn(error)) {
        setSubscriptionMessage("Redirecting to Google sign-in...");
        shouldResetBusy = false;
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      setSubscriptionError(getSubscriptionErrorMessage(error));
    } finally {
      if (shouldResetBusy) {
        setSubscriptionBusy(false);
      }
    }
  };

  const handleToggleSavedPost = async (post: BlogPost) => {
    clearSubscriptionFeedback();

    if (!subscriberUser) {
      setSubscriptionMessage("Sign in first, then you can save articles to your reader menu.");
      return;
    }

    const wasSaved = isPostSaved(post.slug);
    const updateSavedPostSlugs = (getNextSavedPostSlugs: (current: string[]) => string[]) => {
      setSavedPostSlugs((current) => {
        const nextSavedPostSlugs = normalizeSavedPostSlugs(getNextSavedPostSlugs(current));
        cacheSavedPostSlugs(subscriberUser.uid, nextSavedPostSlugs);

        return nextSavedPostSlugs;
      });
    };

    setSavedPostsBusySlug(post.slug);

    try {
      if (wasSaved) {
        updateSavedPostSlugs((current) => current.filter((slug) => slug !== post.slug));
        setSubscriptionMessage("Removed from saved posts.");
        await unsaveReaderPost(subscriberUser.uid, post.slug);
      } else {
        updateSavedPostSlugs((current) =>
          current.includes(post.slug) ? current : [...current, post.slug],
        );
        setSubscriptionMessage("Saved to your reader menu.");
        await saveReaderPost(subscriberUser, post.slug);
      }
    } catch (error) {
      updateSavedPostSlugs((current) =>
        wasSaved
          ? current.includes(post.slug)
            ? current
            : [...current, post.slug]
          : current.filter((slug) => slug !== post.slug),
      );
      setSubscriptionError(getSubscriptionErrorMessage(error));
    } finally {
      setSavedPostsBusySlug("");
    }
  };

  const handleSubscribe = async () => {
    clearSubscriptionFeedback();

    if (!subscriberUser) {
      await handleGoogleSignIn();
      return;
    }

    setSubscriptionBusy(true);

    try {
      await saveSubscriber(subscriberUser);
      setIsSubscribed(true);
      setSubscriberView(getSubscribedSubscriberView(subscriberView));
      setSubscriptionMessage("You are subscribed to portfolio and blog updates.");
    } catch (error) {
      setSubscriptionError(getSubscriptionErrorMessage(error));
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const handleUnsubscribe = async () => {
    clearSubscriptionFeedback();

    if (!subscriberUser) {
      return;
    }

    setSubscriptionBusy(true);

    try {
      await unsubscribeSubscriber(subscriberUser.uid);
      setIsSubscribed(false);
      setSubscriberView(getUnsubscribedSubscriberView(subscriberView));
      setSubscriptionMessage("You have been unsubscribed from future portfolio updates.");
    } catch (error) {
      setSubscriptionError(getSubscriptionErrorMessage(error));
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const handleSignOut = async () => {
    clearSubscriptionFeedback();

    if (!auth) {
      return;
    }

    const wasSubscribedBeforeSignOut = isSubscribed;
    const signedOutView = getSignedOutSubscriberView(subscriberView, wasSubscribedBeforeSignOut);

    setSubscriptionBusy(true);

    try {
      manualSignOutViewRef.current = signedOutView;
      await signOut(auth);
      setReaderMenuOpen(false);
      setSavedPostSlugs([]);
      setSubscriberView(signedOutView);
      setSubscriptionMessage(
        wasSubscribedBeforeSignOut
          ? "You are signed out. Your subscription is still active, so the good engineering stuff can still find you."
          : "You are signed out and off the update list. The inbox is quieter now, but the door stays open whenever curiosity comes back.",
      );
    } catch (error) {
      setSubscriptionError(getSubscriptionErrorMessage(error));
    } finally {
      setSubscriptionBusy(false);
    }
  };

  const renderWithAssistant = (page: ReactNode) => (
    <>
      {page}
      <div className="site-newsletter-footer shell">
        <NewsletterCallout
          isSubscribed={isSubscribed}
          subscriberEmail={subscriberEmail}
          subscriberUser={subscriberUser}
          subscriptionBusy={subscriptionBusy}
          onSubscribe={handleSubscribe}
        />
      </div>
      <SiteFooter />
      <SiteAssistant isSubscribed={isSubscribed} subscriberUser={subscriberUser} />
    </>
  );

  if (standaloneBlogSlug) {
    return renderWithAssistant(
      <BlogArticlePage
        post={standaloneBlog}
        isAccessChecking={standaloneBlogAccessChecking}
        isLocked={standaloneBlogIsLocked}
        isPostSaved={isPostSaved}
        savedPostsBusySlug={savedPostsBusySlug}
        subscriberUser={subscriberUser}
        theme={theme}
        onToggleSavedPost={handleToggleSavedPost}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isSavedPostsPage) {
    return renderWithAssistant(
      <SavedPostsPage
        authReady={authReady}
        savedPosts={savedPosts}
        savedPostsBusySlug={savedPostsBusySlug}
        subscriberUser={subscriberUser}
        subscriptionError={subscriptionError}
        subscriptionMessage={subscriptionMessage}
        theme={theme}
        onToggleSavedPost={handleToggleSavedPost}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isStartPage) {
    return renderWithAssistant(
      <StartHerePage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isWhatsNewPage) {
    return renderWithAssistant(
      <WhatsNewPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isAiRadarPage) {
    return renderWithAssistant(
      <AiRadarPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isShelfPage) {
    return renderWithAssistant(
      <ShelfPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isDashboardPage) {
    return renderWithAssistant(
      <DashboardPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isBlogsPage) {
    return renderWithAssistant(
      <BlogIndexPage
        blogCategories={blogCategories}
        featuredBlog={featuredBlog}
        featuredBlogIsLocked={featuredBlogIsLocked}
        isPostSaved={isPostSaved}
        remainingBlogPosts={remainingBlogPosts}
        savedPostsBusySlug={savedPostsBusySlug}
        selectedBlogCategory={selectedBlogCategory}
        subscriberUser={subscriberUser}
        theme={theme}
        visibleBlogPosts={visibleBlogPosts}
        onSelectBlogCategory={selectBlogCategory}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        onToggleSavedPost={handleToggleSavedPost}
      />,
    );
  }

  if (isContactPage) {
    return renderWithAssistant(
      <ContactPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isSignInPage) {
    return renderWithAssistant(
      <SignInPage
        canUseSubscriptions={canUseSubscriptions}
        isSubscribed={isSubscribed}
        portfolioReturnBlogSlug={signInReturnBlog?.slug}
        signInReturnTarget={signInReturnTarget}
        subscriberEmail={subscriberEmail}
        subscriberInitial={subscriberInitial}
        subscriberName={subscriberName}
        subscriberView={subscriberView}
        subscriberUser={subscriberUser}
        subscriptionBusy={subscriptionBusy}
        subscriptionError={subscriptionError}
        subscriptionMessage={subscriptionMessage}
        theme={theme}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onSubscribe={handleSubscribe}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        onUnsubscribe={handleUnsubscribe}
      />,
    );
  }

  if (isAdminUpdatePage) {
    return renderWithAssistant(
      <AdminUpdatePage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  return renderWithAssistant(
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className={`site-header${headerDocked ? " is-docked" : ""}`}>
        <div className="shell header-shell">
          <div className="brand-cluster">
            <button
              className="reader-menu-trigger"
              type="button"
              aria-expanded={readerMenuOpen}
              aria-label="Open reader menu"
              onClick={() => {
                setReaderMenuOpen((open) => !open);
                setMenuOpen(false);
                setProfileMenuOpen(false);
              }}
            >
              <ReaderMenuGlyph type="menu" />
            </button>

            <a className="brand brand-mark-link" href="#top" onClick={closeMenu} aria-label="Go to home">
              <span className="brand-mark">SK</span>
            </a>

            <a className="brand brand-name-link" href="#top" onClick={closeMenu}>
              <span className="brand-copy">
                <strong>{profile.name}</strong>
                <span>{profile.role}</span>
              </span>
            </a>
          </div>

          <nav
            className={`site-nav${menuOpen ? " is-open" : ""}`}
            id="site-navigation"
            aria-label="Primary"
          >
            {currentNavLinks.map((link) => (
              <a
                key={link.label}
                className={"id" in link && activeSection === link.id ? "is-active" : ""}
                href={"href" in link ? link.href : `#${link.id}`}
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ))}
            <MobileAccountPanel
              canUseSubscriptions={canUseSubscriptions}
              isSubscribed={isSubscribed}
              subscriberEmail={subscriberEmail}
              subscriberInitial={subscriberInitial}
              subscriberName={subscriberName}
              subscriberUser={subscriberUser}
              subscriptionBusy={subscriptionBusy}
              subscriptionError={subscriptionError}
              subscriptionMessage={subscriptionMessage}
              onGoogleSignIn={handleGoogleSignIn}
              onSignOut={handleSignOut}
              onSubscribe={handleSubscribe}
              onUnsubscribe={handleUnsubscribe}
            />
            <div ref={profileMenuRef}>
              <ProfileMenu
                canUseSubscriptions={canUseSubscriptions}
                isOpen={profileMenuOpen}
                isSubscribed={isSubscribed}
                subscriberEmail={subscriberEmail}
                subscriberInitial={subscriberInitial}
                subscriberName={subscriberName}
                subscriberUser={subscriberUser}
                subscriptionBusy={subscriptionBusy}
                subscriptionError={subscriptionError}
                subscriptionMessage={subscriptionMessage}
                onGoogleSignIn={handleGoogleSignIn}
                onSignOut={handleSignOut}
                onSubscribe={handleSubscribe}
                onToggle={() => setProfileMenuOpen((open) => !open)}
                onUnsubscribe={handleUnsubscribe}
              />
            </div>
          </nav>

          <div className="header-actions">
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            >
              <ThemeToggleIcon theme={theme} />
            </button>

            <button
              className="menu-toggle"
              type="button"
              aria-controls="site-navigation"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation"
              onClick={() => {
                setMenuOpen((open) => !open);
                setProfileMenuOpen(false);
              }}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <ReaderMenu
        isOpen={readerMenuOpen}
        isSignedIn={Boolean(subscriberUser)}
        savedPosts={savedPosts}
        subscriberName={subscriberName}
        onClose={() => setReaderMenuOpen(false)}
      />

      <main id="main-content">
        <section className="hero shell" id="top">
          <div className="hero-copy">
            <p className="eyebrow">
              {profile.currentTitle} at {profile.company}
            </p>
            <h1>Backend systems for search, AI, and LLM-enabled enterprise workflows.</h1>
            <p className="hero-lead">{profile.tagline}</p>
            <p className="hero-body">{profile.summary}</p>

            <div className="hero-actions">
              <a className="button button-primary" href={isPortfolioPage ? "#work" : "/portfolio#work"}>
                Explore selected work
              </a>
              <a className="button button-secondary" href="/work-with-me">
                Work with me
              </a>
            </div>

            <ul className="hero-signal-list" aria-label="Core technology areas">
              <li>Java</li>
              <li>Oracle Text</li>
              <li>Semantic Search</li>
              <li>AI Scoring</li>
              <li>LLM Workflows</li>
              <li>OCI</li>
            </ul>
          </div>

          <aside className="hero-panel">
            <div className="hero-panel-primary">
              <p className="eyebrow">Profile Snapshot</p>
              <h2>{profile.name}</h2>
              <p>{profile.focus}</p>
            </div>

            <dl className="profile-facts">
              <div>
                <dt>Current role</dt>
                <dd>{profile.currentTitle}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{profile.currentCompany}</dd>
              </div>
              <div>
                <dt>Core domains</dt>
                <dd>Backend engineering, semantic search, AI relevance, and LLM workflows</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
            </dl>
          </aside>
        </section>

        {isPortfolioPage ? (
          <section className="shell metric-grid" aria-label="Key career metrics">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <p className="metric-value">{metric.value}</p>
                <h2>{metric.label}</h2>
                <p>{metric.detail}</p>
              </article>
            ))}
          </section>
        ) : null}

        <section className="section shell" id="about">
          <SectionHeading
            eyebrow="About"
            title="I like systems work where throughput, trust, search quality, and explainability all need to hold together."
            description="My recent work sits at the intersection of backend architecture, search, AI-assisted relevance, and performance engineering. I enjoy making complex enterprise workflows feel more predictable, faster, and easier to scale."
          />

          <div className="focus-grid">
            {currentFocus.map((focus) => (
              <article className="focus-card" key={focus.title}>
                <p className="focus-caption">{focus.caption}</p>
                <h3>{focus.title}</h3>
                <p>{focus.detail}</p>
              </article>
            ))}
          </div>
        </section>

        {isPortfolioPage ? (
          <>
            <section className="section shell" id="experience">
              <SectionHeading
                eyebrow="Experience"
                title="Most of my recent experience is deep backend work inside high-volume compliance and intelligence systems."
                description="The emphasis has been cloud-native platform work, search-heavy architectures, AI-assisted relevance, and latency reduction across both real-time and batch screening paths."
              />

              <div className="timeline">
                {experience.map((item) => (
                  <article className="timeline-card" key={item.company}>
                    <div className="timeline-meta">
                      <p className="timeline-company">{item.company}</p>
                      <p>{item.employmentType}</p>
                      <p>{item.location}</p>
                    </div>

                    <div className="timeline-body">
                      <div className="role-stack" aria-label={`${item.company} role progression`}>
                        {item.roles.map((role) => (
                          <article className="role-entry" key={`${item.company}-${role.title}`}>
                            <div className="role-entry-marker" aria-hidden="true" />
                            <div>
                              <p className="timeline-role">{role.title}</p>
                              <p className="role-period">{role.period}</p>
                              <p className="role-detail">{role.detail}</p>
                            </div>
                          </article>
                        ))}
                      </div>

                      <p>{item.summary}</p>
                      <ul className="bullet-list">
                        {item.achievements.map((achievement) => (
                          <li key={achievement}>{achievement}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="section shell" id="work">
              <SectionHeading
                eyebrow="Selected Work"
                title="A few backend and AI-flavored case studies that represent the kind of problems I enjoy solving."
                description="This section stays interactive so the work can be explored one case study at a time instead of disappearing into a long wall of cards."
              />

              <div className="work-layout">
                <div className="project-selector" role="tablist" aria-label="Project case studies">
                  {projects.map((project, index) => {
                    const isActive = index === selectedProjectIndex;

                    return (
                      <button
                        key={project.name}
                        className={`project-tab${isActive ? " is-active" : ""}`}
                        role="tab"
                        aria-selected={isActive}
                        type="button"
                        onClick={() => setSelectedProjectIndex(index)}
                      >
                        <span className="project-tab-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="project-tab-copy">
                          <strong>{project.name}</strong>
                          <span>{project.impact}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <article className="project-spotlight" aria-live="polite">
                  <div className="project-spotlight-heading">
                    <p className="eyebrow">Case Study {selectedProjectNumber}</p>
                    <h3>{selectedProject.name}</h3>
                    <p>{selectedProject.summary}</p>
                  </div>

                  <div className="project-spotlight-grid">
                    <div className="project-impact-card">
                      <p className="impact-label">Outcome</p>
                      <p className="impact-value">{selectedProject.impact}</p>
                    </div>

                    <div className="project-stack-card">
                      <p className="impact-label">Stack</p>
                      <ul className="stack-list">
                        {selectedProject.stack.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="project-highlights">
                    <p className="impact-label">Highlights</p>
                    <ul className="bullet-list">
                      {selectedProject.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              </div>
            </section>

            <section className="section shell" id="skills">
              <SectionHeading
                eyebrow="Skills"
                title="The strongest part of my stack is where backend services meet search, databases, and AI-enabled workflows."
                description="I work most comfortably in Java-based backend environments, Oracle-heavy systems, and product flows where scale, explainability, and delivery speed all need to stay aligned."
              />

              <div className="skill-grid">
                {skills.map((group) => (
                  <article className="skill-card" key={group.title}>
                    <h3>{group.title}</h3>
                    <ul className="chip-list">
                      {group.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {!isPortfolioPage ? (
          <BlogIndexSection
            blogCategories={blogCategories}
            featuredBlog={featuredBlog}
            featuredBlogIsLocked={featuredBlogIsLocked}
            isPostSaved={isPostSaved}
            remainingBlogPosts={remainingBlogPosts}
            savedPostsBusySlug={savedPostsBusySlug}
            selectedBlogCategory={selectedBlogCategory}
            subscriberUser={subscriberUser}
            visibleBlogPosts={visibleBlogPosts}
            onSelectBlogCategory={selectBlogCategory}
            onToggleSavedPost={handleToggleSavedPost}
          />
        ) : null}

        {isPortfolioPage ? (
          <>
            <section className="section shell" id="recognition">
              <SectionHeading
                eyebrow="Recognition"
                title="A couple of external signals that back up the delivery story."
                description="These are the recognition points I want front and center because they connect directly to execution, performance, and product-building impact."
              />

              <div className="recognition-grid">
                {recognitions.map((item) => (
                  <article className="recognition-card" key={item.title}>
                    <p className="recognition-highlight">{item.highlight}</p>
                    <h3>{item.title}</h3>
                    <p className="recognition-issuer">{item.issuer}</p>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="section shell" id="credentials">
              <SectionHeading
                eyebrow="Credentials"
                title="Education and certifications that support the engineering work."
                description="This section brings together my education and certifications, while awards and recognition are highlighted separately above."
              />

              <div className="credentials-grid">
                <div className="credential-panel">
                  <h3>Education</h3>
                  {education.map((item) => (
                    <article className="credential-item" key={`${item.school}-${item.degree}`}>
                      <p className="credential-title">{item.degree}</p>
                      <p className="credential-subtitle">{item.school}</p>
                      <p className="credential-detail">
                        {item.score}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="credential-panel">
                  <h3>Certifications</h3>
                  {certifications.map((item) => (
                    <article className="credential-item" key={`${item.title}-${item.year}`}>
                      <p className="credential-title">{item.title}</p>
                      <p className="credential-subtitle">{item.issuer}</p>
                      <p className="credential-detail">{item.year}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}

      </main>
    </>,
  );
}

export default App;
