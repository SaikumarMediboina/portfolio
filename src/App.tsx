import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
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
  { href: "#about", id: "about", label: "About" },
  { href: "/blogs", label: "Blogs" },
  { href: "/whats-new", label: "What's New" },
  { href: "/shelf", label: "Sai's Shelf" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contact", label: "Contact" },
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
    href: "/contact",
    title: "Collaboration page added",
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
      text: "Hey, I am Sai's portfolio assistant. I can help you find projects, blogs, tech stack details, and contact links.",
      links: [
        { href: "/portfolio#work", label: "Projects" },
        { href: "/blogs", label: "Blogs" },
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
const ALL_BLOG_CATEGORIES = "All";
const PUBLIC_BLOG_SLUG = "backend-throughput-database-cache-async-optimization";
const LOCKED_BLOG_CAPTION =
  "This one is in the members-only lab. Sign in and the doors open.";

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

  return window.location.pathname.replace(/\/$/, "") === "/contact";
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

function getUpdatesSignInHref(returnTarget = "blogs") {
  return `/signin?return=${encodeURIComponent(returnTarget)}`;
}

function getSavedPostsSignInHref() {
  return "/signin?return=saved-posts";
}

function getReturnTargetConfig(target: string) {
  const returnTargets: Record<string, { href: string; label: string }> = {
    blogs: { href: "/blogs", label: "Back to blogs" },
    contact: { href: "/contact", label: "Back to contact" },
    dashboard: { href: "/dashboard", label: "Back to dashboard" },
    "saved-posts": { href: "/saved-posts", label: "Back to saved posts" },
    shelf: { href: "/shelf", label: "Back to shelf" },
    start: { href: "/start", label: "Back to start" },
    "whats-new": { href: "/whats-new", label: "Back to what's new" },
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
  | "pen"
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
    pen: (
      <path
        d="M5.2 18.8 6.4 14 15 5.4a2.2 2.2 0 0 1 3.1 3.1L9.5 17.1l-4.3 1.7Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
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

function getAssistantResponse(
  input: string,
  isReaderSignedIn: boolean,
  hasActiveSubscription: boolean,
): Pick<AssistantMessage, "links" | "text"> {
  const query = input.toLowerCase();
  const publicBlog = blogPosts.find((post) => post.slug === PUBLIC_BLOG_SLUG) ?? blogPosts[0];
  const topProjects = projects.slice(0, 3).map((project) => project.name).join(", ");
  const topSkills = skills
    .map((group) => `${group.title}: ${group.items.slice(0, 4).join(", ")}`)
    .join(". ");

  if (query.includes("blog") || query.includes("article") || query.includes("write")) {
    return {
      text: `There are ${blogPosts.length} engineering write-ups. The public feature is "${publicBlog.title}". The other posts are available after sign-in, so interested readers can go deeper without cluttering the main page.`,
      links: [
        { href: "/blogs", label: "View blog index" },
        { href: getBlogArticleHref(publicBlog.slug), label: "Open public article", external: true },
        ...(isReaderSignedIn ? [] : [{ href: "/signin", label: "Sign in to unlock blogs" }]),
      ],
    };
  }

  if (
    query.includes("project") ||
    query.includes("work") ||
    query.includes("matching") ||
    query.includes("screening")
  ) {
    return {
      text: `The selected work focuses on backend systems for compliance screening, search, AI-assisted scoring, and performance tuning. A good starting path is: ${topProjects}.`,
      links: [{ href: "/portfolio#work", label: "Explore selected work" }],
    };
  }

  if (
    query.includes("skill") ||
    query.includes("stack") ||
    query.includes("technology") ||
    query.includes("tech")
  ) {
    return {
      text: `The core stack is backend-heavy: ${topSkills}. The strongest theme is where Java services, Oracle-heavy systems, search, and AI/LLM workflows meet.`,
      links: [{ href: "/portfolio#skills", label: "View tech stack" }],
    };
  }

  if (
    query.includes("performance") ||
    query.includes("latency") ||
    query.includes("throughput") ||
    query.includes("optimization")
  ) {
    return {
      text: "The performance story is a major theme: 97% batch latency reduction, 85% real-time speedup, 100+ TPS runtime scale, and backend throughput improvements using database, cache, and async patterns.",
      links: [
        { href: "/portfolio#work", label: "See performance projects" },
        { href: getBlogArticleHref(publicBlog.slug), label: "Read throughput blog", external: true },
      ],
    };
  }

  if (
    query.includes("contact") ||
    query.includes("email") ||
    query.includes("linkedin") ||
    query.includes("connect")
  ) {
    return {
      text: `You can contact ${profile.name} by email or LinkedIn. Best fit conversations are backend engineering, search systems, performance work, and practical AI/LLM product ideas.`,
      links: [
        { href: "/contact", label: "Go to contact" },
        { href: `mailto:${profile.email}`, label: "Email" },
        { href: profile.linkedin, label: "LinkedIn", external: true },
      ],
    };
  }

  if (
    query.includes("subscribe") ||
    query.includes("sign") ||
    query.includes("account") ||
    query.includes("unlock")
  ) {
    return {
      text: isReaderSignedIn
        ? hasActiveSubscription
          ? "You are signed in and subscribed. New selected engineering notes can reach your inbox when updates are sent."
          : "You are signed in but not subscribed yet. Use the profile menu in the header to subscribe when you want portfolio and blog updates."
        : "Sign in unlocks the protected blog posts and lets you subscribe for selected portfolio and engineering updates. No password collection here, just account-based access.",
      links: isReaderSignedIn ? [{ href: "/blogs", label: "Browse blogs" }] : [{ href: "/signin", label: "Open sign in" }],
    };
  }

  return {
    text: `I can guide you through ${profile.name}'s portfolio: projects, blogs, tech stack, performance highlights, contact details, and subscriber access. Try asking about "blogs", "performance work", "tech stack", or "contact".`,
    links: [
      { href: "/portfolio#work", label: "Projects" },
      { href: "/blogs", label: "Blogs" },
      { href: "/portfolio#skills", label: "Tech stack" },
    ],
  };
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
    "Show me the blogs",
    "Explain the tech stack",
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

  const sendAssistantMessage = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    const response = getAssistantResponse(trimmedValue, Boolean(subscriberUser), isSubscribed);

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "visitor",
        text: trimmedValue,
      },
      {
        id: Date.now() + 1,
        role: "assistant",
        text: response.text,
        links: response.links,
      },
    ]);
    setInput("");
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
              <h2>Sai Bot</h2>
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
                  <p>{message.text}</p>
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
      {isBusy ? "Updating..." : isSaved ? "Saved" : "Save post"}
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
    { href: "/whats-new", icon: "spark" as const, label: "What's New" },
    { href: "/shelf", icon: "shelf" as const, label: "Sai's Shelf" },
    {
      href: isSignedIn ? "/saved-posts" : getSavedPostsSignInHref(),
      icon: "bookmark" as const,
      label: "Saved Posts",
    },
    { href: "/#about", icon: "about" as const, label: "About" },
    { href: "/contact", icon: "mail" as const, label: "Contact" },
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
          <a className="blog-updates-link" href={getUpdatesSignInHref()}>
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
  returnTarget: string;
};

function NewsletterCallout({ returnTarget }: NewsletterCalloutProps) {
  return (
    <section className="newsletter-callout" aria-label="Subscribe to updates">
      <div className="newsletter-icon" aria-hidden="true">
        <ReaderMenuGlyph type="mail" />
      </div>
      <div>
        <p className="eyebrow">Newsletter</p>
        <h2>Get the useful updates without checking the site every week.</h2>
        <p>
          Subscribe for selected engineering notes, new shelf additions, and meaningful portfolio
          updates. No noise, no spam, and you can unsubscribe anytime.
        </p>
      </div>
      <a className="button button-primary" href={getUpdatesSignInHref(returnTarget)}>
        Get updates
      </a>
    </section>
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

        <NewsletterCallout returnTarget="start" />
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

        <NewsletterCallout returnTarget="whats-new" />
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
        Skip to collaboration page
      </a>

      <header className="article-site-header collaboration-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Collaboration</span>
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
  const topArticles = [...blogPosts]
    .map((post) => ({
      ...post,
      contentScore:
        getReadMinutes(post.readTime) * 8 + post.sections.length * 6 + post.takeaways.length * 4,
    }))
    .sort((left, right) => right.contentScore - left.contentScore)
    .slice(0, 8);
  const maxArticleScore = Math.max(...topArticles.map((post) => post.contentScore), 1);
  const cadenceBars = Array.from({ length: 30 }, (_, index) => {
    const isPublishedDay = [1, 2, 3, 4, 5, 14, 23, 25].includes(index);

    return {
      height: isPublishedDay ? 38 + ((index * 11) % 44) : 6,
      isPublishedDay,
    };
  });

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
            <a className="button button-primary" href={getUpdatesSignInHref("dashboard")}>
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
                <span>Articles vs depth</span>
              </div>
              <div className="dashboard-topic-chart">
                {topics.map((topic) => (
                  <div className="dashboard-topic-column" key={topic.category}>
                    <div className="dashboard-topic-bars">
                      <span
                        className="dashboard-topic-bar is-depth"
                        style={
                          {
                            "--bar-height": `${Math.max((topic.score / maxTopicScore) * 100, 12)}%`,
                            "--bar-color": topic.color,
                          } as CSSProperties
                        }
                      />
                      <span
                        className="dashboard-topic-bar is-posts"
                        style={
                          {
                            "--bar-height": `${Math.max((topic.posts / totalBlogCount) * 100, 12)}%`,
                          } as CSSProperties
                        }
                      />
                    </div>
                    <small>{topic.category}</small>
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
              <span>30-day content habit view</span>
            </div>
            <div className="dashboard-cadence-stats">
              <span><strong>{blogPosts.length}</strong> total posts</span>
              <span><strong>{publicFeatureCount}</strong> public feature</span>
              <span><strong>{Math.max(0, blogPosts.length - 1)}</strong> member reads</span>
              <span><strong>{totalReadMinutes}</strong> min library</span>
            </div>
            <div className="dashboard-cadence-chart" aria-label="Publishing rhythm chart">
              {cadenceBars.map((bar, index) => (
                <span
                  className={bar.isPublishedDay ? "is-published" : ""}
                  key={`cadence-${index}`}
                  style={{ "--cadence-height": `${bar.height}%` } as CSSProperties}
                  title={`Day ${index + 1}`}
                />
              ))}
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

    setSavedPostsBusySlug(post.slug);

    try {
      if (isPostSaved(post.slug)) {
        await unsaveReaderPost(subscriberUser.uid, post.slug);
        setSavedPostSlugs((current) => current.filter((slug) => slug !== post.slug));
        setSubscriptionMessage("Removed from saved posts.");
      } else {
        await saveReaderPost(subscriberUser, post.slug);
        setSavedPostSlugs((current) =>
          current.includes(post.slug) ? current : [...current, post.slug],
        );
        setSubscriptionMessage("Saved to your reader menu.");
      }
    } catch (error) {
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

  if (standaloneBlogSlug) {
    return (
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
      />
    );
  }

  if (isSavedPostsPage) {
    return (
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
      />
    );
  }

  if (isStartPage) {
    return (
      <StartHerePage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />
    );
  }

  if (isWhatsNewPage) {
    return (
      <WhatsNewPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />
    );
  }

  if (isShelfPage) {
    return (
      <ShelfPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />
    );
  }

  if (isDashboardPage) {
    return (
      <DashboardPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />
    );
  }

  if (isBlogsPage) {
    return (
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
      />
    );
  }

  if (isContactPage) {
    return (
      <ContactPage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />
    );
  }

  if (isSignInPage) {
    return (
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
      />
    );
  }

  if (isAdminUpdatePage) {
    return (
      <AdminUpdatePage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />
    );
  }

  return (
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
              <a className="button button-secondary" href="/contact">
                Contact me
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

      <footer className="site-footer">
        <div className="shell footer-shell">
          <p>
            &copy; {new Date().getFullYear()} {profile.name}
          </p>
          <div className="footer-links">
            <a href={`mailto:${profile.email}`}>Email</a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>

      <SiteAssistant isSubscribed={isSubscribed} subscriberUser={subscriberUser} />
    </>
  );
}

export default App;
