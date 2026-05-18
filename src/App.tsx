import { startTransition, useEffect, useRef, useState, type FormEvent } from "react";
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
  saveSubscriber,
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
  theme: Theme;
  onThemeToggle: () => void;
};

function BlogArticlePage({
  post,
  isAccessChecking,
  isLocked,
  theme,
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
            <a className="button button-secondary" href={getSignInHref(post.slug)}>
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
            <a className="button button-primary" href={getSignInHref(post.slug)}>
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
  portfolioReturnHref: string;
  subscriberView: SubscriberViewState;
  theme: Theme;
  onThemeToggle: () => void;
};

function SignInPage({
  portfolioReturnHref,
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
            <a className="button button-secondary" href={portfolioReturnHref}>
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
  const [activeSection, setActiveSection] = useState("top");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [selectedBlogCategory, setSelectedBlogCategory] = useState(ALL_BLOG_CATEGORIES);
  const [subscriberUser, setSubscriberUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberView, setSubscriberView] = useState<SubscriberViewState>("guest");
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [subscriptionError, setSubscriptionError] = useState("");
  const manualSignOutViewRef = useRef<SubscriberViewState | null>(null);

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

  useEffect(() => {
    const sectionIds = ["top", ...navLinks.map((link) => link.id)];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        if (visible[0]) {
          startTransition(() => {
            setActiveSection(visible[0].target.id);
          });
        }
      },
      {
        rootMargin: "-22% 0px -56% 0px",
        threshold: [0.2, 0.35, 0.55, 0.75],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
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
        setSubscriberView(manualSignOutViewRef.current ?? "guest");
        manualSignOutViewRef.current = null;
        setSubscriptionBusy(false);
        return;
      }

      setSubscriptionBusy(true);
      ensureSubscriberProfile(user)
        .then((subscriber) => {
          if (isMounted) {
            setIsSubscribed(subscriber.subscribed);
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
        const subscriber = await ensureSubscriberProfile(result.user);

        if (isMounted) {
          setSubscriberUser(result.user);
          setIsSubscribed(subscriber.subscribed);
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

  const closeMenu = () => setMenuOpen(false);
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
      const subscriber = await ensureSubscriberProfile(result.user);
      setSubscriberUser(result.user);
      setIsSubscribed(subscriber.subscribed);
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
        portfolioReturnHref={getPortfolioBlogHref(signInReturnBlog?.slug)}
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
            <a
              className={`nav-signin-link${subscriberUser ? " is-account-avatar" : ""}`}
              href="/signin"
              aria-label={subscriberUser ? "Open subscriber account" : undefined}
              title={subscriberUser ? "Subscriber account" : undefined}
              onClick={closeMenu}
            >
              {subscriberUser ? (
                subscriberUser.photoURL ? (
                  <img
                    className="nav-account-image"
                    src={subscriberUser.photoURL}
                    alt={`${subscriberName} account`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="nav-account-fallback" aria-hidden="true">
                    {subscriberInitial}
                  </span>
                )
              ) : (
                "Sign In"
              )}
            </a>
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
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

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
                    <a className="blog-featured-link" href={getSignInHref(featuredBlog.slug)}>
                      Sign in to unlock
                    </a>
                  ) : (
                    <a
                      className="blog-featured-link"
                      href={getBlogArticleHref(featuredBlog.slug)}
                      target="_blank"
                      rel="opener"
                      aria-label={`Open ${featuredBlog.title} as a standalone article in a new tab`}
                    >
                      Read full post
                    </a>
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
                        <a className="blog-list-link" href={getSignInHref(post.slug)}>
                          Unlock
                        </a>
                      ) : (
                        <a
                          className="blog-list-link"
                          href={getBlogArticleHref(post.slug)}
                          target="_blank"
                          rel="opener"
                          aria-label={`Read ${post.title}`}
                        >
                          Read full post
                        </a>
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
    </>
  );
}

export default App;
