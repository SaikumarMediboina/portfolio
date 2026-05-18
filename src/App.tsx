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

const navLinks = [
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "work", label: "Work" },
  { id: "skills", label: "Skills" },
  { id: "blogs", label: "Blogs" },
  { id: "recognition", label: "Recognition" },
  { id: "credentials", label: "Credentials" },
  { id: "contact", label: "Contact" },
] as const;

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
        { href: "#work", label: "Projects" },
        { href: "#blogs", label: "Blogs" },
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

function getSignInReturnBlogSlug() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("blog") ?? "";
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

function getBlogAnchorId(slug: string) {
  return `blog-${slug}`;
}

function getPortfolioBlogHref(slug?: string) {
  return slug ? `/#${getBlogAnchorId(slug)}` : "/#blogs";
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
  const targetId = slug ? getBlogAnchorId(slug) : "blogs";

  try {
    const portfolioWindow = window.opener as Window | null;

    if (portfolioWindow && !portfolioWindow.closed) {
      portfolioWindow.location.hash = targetId;
      portfolioWindow.document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
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

type ReaderMenuGlyphType = "about" | "bookmark" | "briefcase" | "home" | "mail" | "menu" | "pen";

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
        { href: "#blogs", label: "View blog index" },
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
      links: [{ href: "#work", label: "Explore selected work" }],
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
      links: [{ href: "#skills", label: "View tech stack" }],
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
        { href: "#work", label: "See performance projects" },
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
        { href: "#contact", label: "Go to contact" },
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
      links: isReaderSignedIn ? [{ href: "#blogs", label: "Browse blogs" }] : [{ href: "/signin", label: "Open sign in" }],
    };
  }

  return {
    text: `I can guide you through ${profile.name}'s portfolio: projects, blogs, tech stack, performance highlights, contact details, and subscriber access. Try asking about "blogs", "performance work", "tech stack", or "contact".`,
    links: [
      { href: "#work", label: "Projects" },
      { href: "#blogs", label: "Blogs" },
      { href: "#skills", label: "Tech stack" },
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
  savedPosts: BlogPost[];
  savedPostsBusySlug: string;
  subscriberName: string;
  onClose: () => void;
  onToggleSavedPost: (post: BlogPost) => void;
};

function ReaderMenu({
  isOpen,
  savedPosts,
  savedPostsBusySlug,
  subscriberName,
  onClose,
  onToggleSavedPost,
}: ReaderMenuProps) {
  const readerLinks = [
    { href: "#top", icon: "home" as const, label: "Home" },
    { href: "#work", icon: "briefcase" as const, label: "Portfolio" },
    { href: "#blogs", icon: "pen" as const, label: "Blogs" },
    { href: "#reader-saved-posts", icon: "bookmark" as const, label: "Saved Posts" },
    { href: "#about", icon: "about" as const, label: "About" },
    { href: "#contact", icon: "mail" as const, label: "Contact" },
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
            <h2>{subscriberName}</h2>
            <span>{savedPosts.length} saved posts</span>
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
              onClick={() => {
                if (link.href !== "#reader-saved-posts") {
                  onClose();
                }
              }}
            >
              <ReaderMenuGlyph type={link.icon} />
              <span>{link.label}</span>
            </a>
          ))}
        </nav>

        <section className="reader-saved-posts" id="reader-saved-posts">
          <div className="reader-saved-heading">
            <p className="impact-label">Saved Posts</p>
            <span>{savedPosts.length}</span>
          </div>

          {savedPosts.length ? (
            <div className="reader-saved-list">
              {savedPosts.map((post) => (
                <article className="reader-saved-item" key={post.slug}>
                  <div>
                    <h3>{post.title}</h3>
                    <p>
                      {post.category} | {post.readTime}
                    </p>
                  </div>
                  <div className="reader-saved-actions">
                    <a href={getBlogArticleHref(post.slug)} target="_blank" rel="opener">
                      Read
                    </a>
                    <button
                      type="button"
                      disabled={savedPostsBusySlug === post.slug}
                      onClick={() => onToggleSavedPost(post)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="reader-saved-empty">
              Save useful articles from the blog section and they will appear here.
            </p>
          )}
        </section>
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
          <a className="brand" href="/#top">
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
            <button
              className="button button-secondary"
              type="button"
              onClick={() => returnToPortfolioBlog(post?.slug)}
            >
              Back to portfolio
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
              The article link may have changed. You can go back to the portfolio blogs and
              choose a post from the current list.
            </p>
            <a className="button button-primary" href="/#blogs">
              View blogs
            </a>
          </section>
        )}
      </main>
    </>
  );
}

type SignInPageProps = SubscriptionAccessCardProps & {
  portfolioReturnBlogSlug?: string;
  subscriberView: SubscriberViewState;
  theme: Theme;
  onThemeToggle: () => void;
};

function SignInPage({
  portfolioReturnBlogSlug,
  subscriberName,
  subscriberView,
  theme,
  onThemeToggle,
  ...subscriptionProps
}: SignInPageProps) {
  const firstName = subscriberName.split(" ")[0] || "there";
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
          <a className="brand" href="/#top">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Subscriber access</span>
            </span>
          </a>

          <div className="article-header-actions">
            {portfolioReturnBlogSlug ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => returnToPortfolioBlog(portfolioReturnBlogSlug)}
              >
                Back to portfolio
              </button>
            ) : (
              <a className="button button-secondary" href="/#top">
                Back to portfolio
              </a>
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
          <a className="brand" href="/#top">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Email updates</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/#top">
              Back to portfolio
            </a>
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
  const savedPosts = blogPosts.filter((post) => savedPostSlugs.includes(post.slug));
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
  const isAdminUpdatePage = isAdminUpdatePathname();
  const signInReturnBlogSlug = getSignInReturnBlogSlug();
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
    const sectionIds = ["top", ...navLinks.map((link) => link.id)];
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
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
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

  if (isSignInPage) {
    return (
      <SignInPage
        canUseSubscriptions={canUseSubscriptions}
        isSubscribed={isSubscribed}
        portfolioReturnBlogSlug={signInReturnBlog?.slug}
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

      <header className="site-header">
        <div className="shell header-shell">
          <a className="brand" href="#top" onClick={closeMenu}>
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>{profile.role}</span>
            </span>
          </a>

          <nav
            className={`site-nav${menuOpen ? " is-open" : ""}`}
            id="site-navigation"
            aria-label="Primary"
          >
            {navLinks.map((link) => (
              <a
                key={link.id}
                className={activeSection === link.id ? "is-active" : ""}
                href={`#${link.id}`}
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
            {subscriberUser ? (
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
            ) : null}

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

      {subscriberUser ? (
        <ReaderMenu
          isOpen={readerMenuOpen}
          savedPosts={savedPosts}
          savedPostsBusySlug={savedPostsBusySlug}
          subscriberName={subscriberName}
          onClose={() => setReaderMenuOpen(false)}
          onToggleSavedPost={handleToggleSavedPost}
        />
      ) : null}

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
              <a className="button button-primary" href="#work">
                Explore selected work
              </a>
              <a className="button button-secondary" href={`mailto:${profile.email}`}>
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

        <section className="shell metric-grid" aria-label="Key career metrics">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <p className="metric-value">{metric.value}</p>
              <h2>{metric.label}</h2>
              <p>{metric.detail}</p>
            </article>
          ))}
        </section>

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

        <section className="section shell" id="blogs">
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
                  onClick={() => selectBlogCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="blog-count">
              {visibleBlogPosts.length} {visibleBlogPosts.length === 1 ? "article" : "articles"}
            </p>
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
                      <a
                        href={getBlogArticleHref(featuredBlog.slug)}
                        target="_blank"
                        rel="opener"
                      >
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
                        onToggle={handleToggleSavedPost}
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
                      <span className="blog-list-number">
                        {String(index + 2).padStart(2, "0")}
                      </span>
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
                            <a
                              href={getBlogArticleHref(post.slug)}
                              target="_blank"
                              rel="opener"
                            >
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
                            onToggle={handleToggleSavedPost}
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

        <section className="section shell" id="contact">
          <div className="contact-panel">
            <div className="contact-copy">
              <p className="eyebrow">Contact</p>
              <h2>Let's connect if you are building backend systems that need speed, scale, trust, and practical AI.</h2>
              <p>
                This portfolio is designed to stay simple around the work itself. For
                collaboration, backend engineering conversations, or opportunities, you can
                reach me directly by email or LinkedIn.
              </p>
            </div>

            <div className="contact-actions">
              <a className="button button-primary" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
              <a
                className="button button-secondary"
                href={profile.linkedin}
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </section>
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
