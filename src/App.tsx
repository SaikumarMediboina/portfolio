import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
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
  ANALYTICS_EVENT_LABELS,
  getCachedAnalyticsSnapshot,
  loadAnalyticsSnapshot,
  trackAnalyticsEvent,
  type AnalyticsDashboardEvent,
  type AnalyticsEventType,
} from "./lib/analytics";
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
  { href: "/start", icon: "spark" as const, label: "Start Here" },
  { href: "/portfolio", icon: "briefcase" as const, label: "Portfolio" },
  { href: "/active-builds", icon: "briefcase" as const, label: "Active Builds" },
  { href: "/ai-radar", icon: "radar" as const, label: "AI Radar" },
  { href: "/blogs", icon: "pen" as const, label: "Blogs" },
  { href: "/dashboard", icon: "dashboard" as const, label: "Dashboard" },
] as const;

const mainMoreNavLinks = [
  { href: "/learn-with-me", icon: "spark" as const, label: "Learn With Me" },
  { href: "/whats-new", icon: "news" as const, label: "What's New" },
  { href: "/shelf", icon: "shelf" as const, label: "Sai's Shelf" },
  { href: "/work-with-me", icon: "mail" as const, label: "Work With Me" },
  { href: "/about", icon: "about" as const, label: "About" },
] as const;

const certificationCategoryOrder = [
  "AI & LLMs",
  "Backend & Architecture",
  "Oracle & Database",
] as const;

const certificationGroups = certificationCategoryOrder
  .map((category) => ({
    category,
    items: certifications.filter((item) => item.category === category),
  }))
  .filter((group) => group.items.length > 0);

const emptyNavLinks = [] as const;
const LEARN_ACCESS_STORAGE_KEY = "portfolio.learnWithMeAccess.v1";

type SiteUpdate = {
  category: string;
  date: string;
  details?: string[];
  href: string;
  summary: string;
  title: string;
};

const siteUpdates: SiteUpdate[] = [
  {
    category: "Access",
    date: "2026-05-20",
    href: "/learn-with-me",
    title: "Learn With Me is now password protected",
    summary:
      "The learning room now opens only after password verification, keeping early notes, scripts, and experiments separate from the public portfolio.",
    details: [
      "Password verification runs through a Vercel API route, so the password is not placed directly in the frontend bundle.",
      "After a successful unlock, access stays available for the current browser session.",
    ],
  },
  {
    category: "Navigation",
    date: "2026-05-20",
    href: "/",
    title: "Main navigation cleaned up for desktop and mobile",
    summary:
      "The top menu now keeps the primary pages visible and moves secondary pages into More, making the header easier to scan on smaller screens.",
    details: [
      "Primary links stay focused on Start Here, Portfolio, Active Builds, AI Radar, Blogs, and Dashboard.",
      "The mobile menu now opens with safer top spacing so the menu panel does not get clipped near the top of the screen.",
    ],
  },
  {
    category: "Reader Menu",
    date: "2026-05-20",
    href: "/saved-posts",
    title: "Left side menu simplified",
    summary:
      "The side menu now focuses on reader actions and useful destinations instead of repeating every top-level page.",
    details: [
      "The menu order is Home, Saved Posts, Learn With Me, What's New, Sai's Shelf, Work With Me, and About.",
      "Each item uses a distinct icon so the menu is quicker to recognize visually.",
    ],
  },
  {
    category: "Projects",
    date: "2026-05-20",
    href: "/active-builds",
    title: "Sai's Assistant active build added",
    summary:
      "Active Builds now documents Sai's Assistant as the current product build, including architecture, code flow, tech stack, design principles, and roadmap.",
    details: [
      "The page explains how the website knowledge base, assistant API, LLM layer, source chips, and action links work together.",
      "Past notable work stays inside Portfolio, while Active Builds focuses on what is being built right now.",
    ],
  },
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

const SITE_URL = "https://saikumarmediboina.com";
const SITE_NAME = "Sai Kumar Mediboina";
const DEFAULT_SEO_IMAGE_PATH = "/og-default.png";
const BLOG_SEO_IMAGE_PATH = "/og-blog.svg";
const AI_RADAR_SEO_IMAGE_PATH = "/og-ai-radar.svg";
const DASHBOARD_SEO_IMAGE_PATH = "/og-dashboard.svg";
const DEFAULT_SEO_DESCRIPTION =
  "Portfolio of Sai Kumar Mediboina, a Software Application Engineer specializing in high-throughput screening, search systems, and performance optimization.";

type SeoMetadata = {
  analyticsTitle: string;
  canonicalPath: string;
  description: string;
  imageAlt: string;
  imagePath: string;
  noindex?: boolean;
  publishedTime?: string;
  structuredData: unknown[];
  title: string;
  type: "article" | "profile" | "website";
};

function getAbsoluteSiteUrl(path = "/") {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${SITE_URL}${cleanPath === "/" ? "/" : cleanPath}`;
}

function getOpenGraphImageType(imagePath: string) {
  if (/\.png$/i.test(imagePath)) {
    return "image/png";
  }
  return /\.(jpe?g)$/i.test(imagePath) ? "image/jpeg" : "image/svg+xml";
}

function getSeoTitle(title: string) {
  return `${title} | ${SITE_NAME}`;
}

function getBlogPublishedIsoDate(publishedAt: string) {
  const match = publishedAt.match(/([A-Za-z]+)\s+(\d{4})/);

  if (!match) {
    return "2026-05-01";
  }

  const monthIndex = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(match[1].toLowerCase());

  if (monthIndex < 0) {
    return "2026-05-01";
  }

  return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

function getBlogReadableText(post: BlogPost) {
  return [
    post.title,
    post.category,
    post.summary,
    ...post.tags,
    ...post.takeaways,
    ...post.stats.flatMap((stat) => [stat.label, stat.value]),
    ...post.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
    ]),
  ].join(" ");
}

function getBlogWordCount(post: BlogPost) {
  return getBlogReadableText(post)
    .split(/\s+/)
    .filter(Boolean).length;
}

function getEstimatedReadMinutes(post: BlogPost) {
  return Math.max(1, Math.ceil(getBlogWordCount(post) / 210));
}

function getEstimatedReadTimeLabel(post: BlogPost) {
  return `${getEstimatedReadMinutes(post)} min read`;
}

function getEstimatedReadSeconds(post: BlogPost) {
  const wordSeconds = (getBlogWordCount(post) / 210) * 60;
  const structureSeconds = post.sections.length * 18 + post.takeaways.length * 8;

  return Math.max(60, Math.round(wordSeconds + structureSeconds));
}

function getReadingSecondsLeft(post: BlogPost, progress: number) {
  const totalSeconds = getEstimatedReadSeconds(post);
  const remainingRatio = Math.max(0, Math.min(1, 1 - progress / 100));

  return Math.ceil(totalSeconds * remainingRatio);
}

function formatReadingTimeLeft(secondsLeft: number) {
  if (secondsLeft <= 0) {
    return "Article complete";
  }

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  if (hours > 0) {
    return `${hours} hr ${minutes} min left`;
  }

  if (minutes > 0) {
    return `${minutes} min ${seconds} sec left`;
  }

  return `${seconds} sec left`;
}

function getBlogPostTags(post: BlogPost) {
  return Array.from(new Set([post.category, ...post.tags].filter(Boolean)));
}

function getBlogCardSummary(post: BlogPost) {
  const summaries: Record<string, string> = {
    "ai-relevance-semantic-search-llm-workflows": "Hybrid AI relevance for enterprise search.",
    "backend-throughput-database-cache-async-optimization":
      "Throughput gains with cache and async.",
    "batch-screening-latency-97-percent": "Batch latency cut to minutes.",
    "opensearch-to-oracle-text-migration": "Search migration closer to data.",
  };

  return summaries[post.slug] ?? post.title.split(/\s+/).slice(0, 6).join(" ");
}

function getRelatedBlogPosts(currentPost: BlogPost, posts: BlogPost[], limit = 3) {
  const currentTags = new Set(getBlogPostTags(currentPost).map((tag) => tag.toLowerCase()));

  return posts
    .filter((post) => post.slug !== currentPost.slug)
    .map((post) => {
      const relatedTags = getBlogPostTags(post).filter((tag) =>
        currentTags.has(tag.toLowerCase()),
      );
      const categoryScore = post.category === currentPost.category ? 4 : 0;
      const tagScore = relatedTags.length * 2;

      return {
        post,
        relatedTags,
        score: categoryScore + tagScore,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return getEstimatedReadMinutes(left.post) - getEstimatedReadMinutes(right.post);
    })
    .slice(0, limit);
}

function getPersonStructuredData() {
  return {
    "@context": "https://schema.org",
    "@id": `${SITE_URL}/#person`,
    "@type": "Person",
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN",
      addressLocality: "Rajahmundry",
      addressRegion: "Andhra Pradesh",
    },
    alumniOf: education.map((item) => ({
      "@type": "CollegeOrUniversity",
      name: item.school,
    })),
    email: `mailto:${profile.email}`,
    image: getAbsoluteSiteUrl("/profile-avatar.png"),
    jobTitle: profile.currentTitle,
    knowsAbout: skills.flatMap((group) => group.items),
    name: profile.name,
    sameAs: [profile.linkedin],
    url: getAbsoluteSiteUrl("/"),
    worksFor: {
      "@type": "Organization",
      name: "Oracle",
    },
  };
}

function getWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@id": `${SITE_URL}/#website`,
    "@type": "WebSite",
    alternateName: ["Sai Kumar", "Sai Kumar Portfolio"],
    description: DEFAULT_SEO_DESCRIPTION,
    inLanguage: "en",
    name: SITE_NAME,
    publisher: {
      "@id": `${SITE_URL}/#person`,
    },
    url: getAbsoluteSiteUrl("/"),
  };
}

function getWebPageStructuredData(metadata: SeoMetadata, pageType = "WebPage") {
  return {
    "@context": "https://schema.org",
    "@type": pageType,
    about: {
      "@id": `${SITE_URL}/#person`,
    },
    description: metadata.description,
    image: getAbsoluteSiteUrl(metadata.imagePath),
    inLanguage: "en",
    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },
    mainEntity: {
      "@id": `${SITE_URL}/#person`,
    },
    name: metadata.title,
    url: getAbsoluteSiteUrl(metadata.canonicalPath),
  };
}

function getBlogStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    blogPost: blogPosts.map((post) => ({
      "@type": "BlogPosting",
      datePublished: getBlogPublishedIsoDate(post.publishedAt),
      headline: post.title,
      url: getAbsoluteSiteUrl(getBlogArticleHref(post.slug)),
    })),
    description:
      "Engineering notes on backend performance, search architecture, AI relevance, and cloud-native systems.",
    name: "Sai Kumar Mediboina Engineering Notes",
    url: getAbsoluteSiteUrl("/blogs"),
  };
}

function getBlogArticleStructuredData(post: BlogPost) {
  const articleUrl = getAbsoluteSiteUrl(getBlogArticleHref(post.slug));
  const publishedDate = getBlogPublishedIsoDate(post.publishedAt);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    articleSection: post.category,
    author: {
      "@id": `${SITE_URL}/#person`,
    },
    dateModified: publishedDate,
    datePublished: publishedDate,
    description: post.summary,
    headline: post.title,
    image: getAbsoluteSiteUrl(BLOG_SEO_IMAGE_PATH),
    inLanguage: "en",
    keywords: getBlogPostTags(post).join(", "),
    mainEntityOfPage: articleUrl,
    publisher: {
      "@id": `${SITE_URL}/#person`,
    },
    url: articleUrl,
    wordCount: getBlogWordCount(post),
  };
}

function getSeoMetadata({
  activeBuildSlug,
  isAboutPage,
  isAdminUpdatePage,
  isAiRadarPage,
  isBlogsPage,
  isContactPage,
  isDashboardPage,
  isActiveBuildsPage,
  isLearnPage,
  isPortfolioPage,
  isSavedPostsPage,
  isShelfPage,
  isSignInPage,
  isStartPage,
  isWhatsNewPage,
  standaloneBlog,
}: {
  activeBuildSlug?: string;
  isAboutPage: boolean;
  isAdminUpdatePage: boolean;
  isAiRadarPage: boolean;
  isBlogsPage: boolean;
  isContactPage: boolean;
  isDashboardPage: boolean;
  isActiveBuildsPage: boolean;
  isLearnPage: boolean;
  isPortfolioPage: boolean;
  isSavedPostsPage: boolean;
  isShelfPage: boolean;
  isSignInPage: boolean;
  isStartPage: boolean;
  isWhatsNewPage: boolean;
  standaloneBlog?: BlogPost;
}): SeoMetadata {
  if (standaloneBlog) {
    const publishedTime = getBlogPublishedIsoDate(standaloneBlog.publishedAt);

    return {
      analyticsTitle: `Blog: ${standaloneBlog.title}`,
      canonicalPath: getBlogArticleHref(standaloneBlog.slug),
      description: standaloneBlog.summary,
      imageAlt: `${standaloneBlog.title} article preview`,
      imagePath: BLOG_SEO_IMAGE_PATH,
      publishedTime,
      structuredData: [
        getPersonStructuredData(),
        getWebsiteStructuredData(),
        getBlogArticleStructuredData(standaloneBlog),
      ],
      title: getSeoTitle(standaloneBlog.title),
      type: "article",
    };
  }

  const pageDefaults: SeoMetadata = {
    analyticsTitle: "Home",
    canonicalPath: "/",
    description: DEFAULT_SEO_DESCRIPTION,
    imageAlt: "Sai Kumar Mediboina portfolio preview card",
    imagePath: DEFAULT_SEO_IMAGE_PATH,
    structuredData: [],
    title: getSeoTitle("Software Application Engineer"),
    type: "profile",
  };

  const metadata = isStartPage
    ? {
        ...pageDefaults,
        analyticsTitle: "Start Here",
        canonicalPath: "/start",
        description:
          "Start here to explore Sai Kumar Mediboina's portfolio, engineering notes, AI Radar, saved resources, and latest updates.",
        title: getSeoTitle("Start Here"),
        type: "website" as const,
      }
    : isAboutPage
      ? {
          ...pageDefaults,
          analyticsTitle: "About",
          canonicalPath: "/about",
          description:
            "About Sai Kumar Mediboina, a Software Application Engineer focused on backend systems, search architecture, performance optimization, and practical AI workflows.",
          imageAlt: "Sai Kumar Mediboina about page portrait",
          imagePath: "/about-sai.jpg",
          title: getSeoTitle("About Sai Kumar"),
          type: "profile" as const,
        }
    : isPortfolioPage
      ? {
          ...pageDefaults,
          analyticsTitle: "Portfolio",
          canonicalPath: "/portfolio",
          description:
            "Explore Sai Kumar Mediboina's backend engineering portfolio, Oracle experience, performance metrics, projects, skills, education, and certifications.",
          title: getSeoTitle("Backend Engineering Portfolio"),
          type: "profile" as const,
        }
      : isBlogsPage
        ? {
            ...pageDefaults,
            analyticsTitle: "Blogs",
            canonicalPath: "/blogs",
            description:
              "Read Sai Kumar Mediboina's engineering notes on backend performance, search architecture, AI relevance, and scalable systems.",
            imageAlt: "Engineering notes by Sai Kumar Mediboina",
            imagePath: BLOG_SEO_IMAGE_PATH,
            title: getSeoTitle("Engineering Notes"),
            type: "website" as const,
          }
        : isAiRadarPage
          ? {
              ...pageDefaults,
              analyticsTitle: "AI Radar",
              canonicalPath: "/ai-radar",
              description:
                "A curated AI Radar with trusted source links, short builder-focused context, and practical signals for AI engineers.",
              imageAlt: "AI Radar preview by Sai Kumar Mediboina",
              imagePath: AI_RADAR_SEO_IMAGE_PATH,
              title: getSeoTitle("AI Radar"),
              type: "website" as const,
            }
          : isWhatsNewPage
            ? {
                ...pageDefaults,
                analyticsTitle: "What's New",
                canonicalPath: "/whats-new",
                description:
                  "See the latest portfolio updates, engineering notes, AI Radar additions, and site changes from Sai Kumar Mediboina.",
                title: getSeoTitle("What's New"),
                type: "website" as const,
              }
            : isShelfPage
              ? {
                  ...pageDefaults,
                  analyticsTitle: "Sai's Shelf",
                  canonicalPath: "/shelf",
                  description:
                    "Sai's Shelf is a growing collection of useful engineering resources, CS fundamentals, AI notes, and practical learning material.",
                  title: getSeoTitle("Sai's Shelf"),
                  type: "website" as const,
                }
              : isDashboardPage
                ? {
                    ...pageDefaults,
                    analyticsTitle: "Dashboard",
                    canonicalPath: "/dashboard",
                    description:
                      "A creator dashboard showing portfolio content coverage, publishing rhythm, analytics signals, and engineering-note momentum.",
                    imageAlt: "Creator dashboard preview by Sai Kumar Mediboina",
                    imagePath: DASHBOARD_SEO_IMAGE_PATH,
                    title: getSeoTitle("Creator Dashboard"),
                    type: "website" as const,
                  }
                : isLearnPage
                  ? {
                      ...pageDefaults,
                      analyticsTitle: "Learn With Me",
                      canonicalPath: "/learn-with-me",
                      description:
                        "Learn backend fundamentals, performance patterns, search systems, and practical AI workflows with Sai Kumar Mediboina.",
                      title: getSeoTitle("Learn With Me"),
                      type: "website" as const,
                    }
                  : activeBuildSlug === "sai-assistant"
                    ? {
                        ...pageDefaults,
                        analyticsTitle: "Build: Sai's Assistant",
                        canonicalPath: "/active-builds/sai-assistant",
                        description:
                          "Explore the architecture, code flow, tech stack, and design principles behind Sai's Assistant, a website knowledge base plus LLM assistant.",
                        title: getSeoTitle("Sai's Assistant Build"),
                        type: "website" as const,
                      }
                    : activeBuildSlug || isActiveBuildsPage
                    ? {
                        ...pageDefaults,
                        analyticsTitle: "Active Builds",
                        canonicalPath: "/active-builds",
                        description:
                          "See Sai Kumar Mediboina's current build ideas, active portfolio experiments, learning projects, and upcoming engineering content.",
                        title: getSeoTitle("Active Builds"),
                        type: "website" as const,
                      }
                    : isContactPage
                      ? {
                          ...pageDefaults,
                          analyticsTitle: "Work With Me",
                          canonicalPath: "/work-with-me",
                          description:
                            "Work with Sai Kumar Mediboina on backend performance, search-heavy systems, AI-assisted workflows, and scalable product engineering.",
                          title: getSeoTitle("Work With Me"),
                          type: "profile" as const,
                        }
                      : isSignInPage
                        ? {
                            ...pageDefaults,
                            analyticsTitle: "Sign In",
                            canonicalPath: "/signin",
                            description:
                              "Sign in to follow portfolio updates, unlock member reads, and save useful engineering posts.",
                            noindex: true,
                            title: getSeoTitle("Reader Sign In"),
                            type: "website" as const,
                          }
                        : isSavedPostsPage
                          ? {
                              ...pageDefaults,
                              analyticsTitle: "Saved Posts",
                              canonicalPath: "/saved-posts",
                              description:
                                "Saved posts and AI Radar stories for signed-in readers of Sai Kumar Mediboina's portfolio.",
                              noindex: true,
                              title: getSeoTitle("Saved Posts"),
                              type: "website" as const,
                            }
                          : isAdminUpdatePage
                            ? {
                                ...pageDefaults,
                                analyticsTitle: "Admin Update",
                                canonicalPath: "/admin-update",
                                description:
                                  "Private admin update sender for Sai Kumar Mediboina portfolio subscribers.",
                                noindex: true,
                                title: getSeoTitle("Admin Updates"),
                                type: "website" as const,
                              }
                            : pageDefaults;

  const pageType = metadata.type === "profile" ? "ProfilePage" : "WebPage";

  return {
    ...metadata,
    structuredData: [
      getPersonStructuredData(),
      getWebsiteStructuredData(),
      getWebPageStructuredData(metadata, pageType),
      ...(isBlogsPage ? [getBlogStructuredData()] : []),
    ],
  };
}

function setMetaTag(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function removeMetaTag(attribute: "name" | "property", key: string) {
  document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)?.remove();
}

function setCanonicalUrl(path: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", getAbsoluteSiteUrl(path));
}

function setStructuredData(metadata: SeoMetadata) {
  let element = document.getElementById("structured-data-seo") as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement("script");
    element.id = "structured-data-seo";
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(metadata.structuredData);
}

function applySeoMetadata(metadata: SeoMetadata) {
  const canonicalUrl = getAbsoluteSiteUrl(metadata.canonicalPath);
  const imageUrl = getAbsoluteSiteUrl(metadata.imagePath);
  const robotsValue = metadata.noindex
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large";

  document.title = metadata.title;
  setCanonicalUrl(metadata.canonicalPath);
  setMetaTag("name", "description", metadata.description);
  setMetaTag("name", "author", profile.name);
  setMetaTag("name", "robots", robotsValue);
  setMetaTag("property", "og:site_name", SITE_NAME);
  setMetaTag("property", "og:title", metadata.title);
  setMetaTag("property", "og:description", metadata.description);
  setMetaTag("property", "og:type", metadata.type);
  setMetaTag("property", "og:url", canonicalUrl);
  setMetaTag("property", "og:image", imageUrl);
  setMetaTag("property", "og:image:type", getOpenGraphImageType(metadata.imagePath));
  setMetaTag("property", "og:image:width", "1200");
  setMetaTag("property", "og:image:height", "630");
  setMetaTag("property", "og:image:alt", metadata.imageAlt);
  setMetaTag("name", "twitter:card", "summary_large_image");
  setMetaTag("name", "twitter:title", metadata.title);
  setMetaTag("name", "twitter:description", metadata.description);
  setMetaTag("name", "twitter:image", imageUrl);

  if (metadata.publishedTime) {
    setMetaTag("property", "article:published_time", metadata.publishedTime);
    setMetaTag("property", "article:modified_time", metadata.publishedTime);
    setMetaTag("property", "article:author", profile.name);
  } else {
    removeMetaTag("property", "article:published_time");
    removeMetaTag("property", "article:modified_time");
    removeMetaTag("property", "article:author");
  }

  setStructuredData(metadata);
}

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

type AssistantLink = {
  href: string;
  label: string;
  external?: boolean;
  kind?: "action" | "source";
};

type AssistantMessage = {
  actions?: AssistantLink[];
  citations?: AssistantLink[];
  followUps?: string[];
  id: number;
  isLoading?: boolean;
  links?: AssistantLink[];
  loadingLabel?: string;
  loadingProgress?: number;
  role: "assistant" | "visitor";
  responseTimeMs?: number;
  text: string;
};

type AssistantQuickPrompt = {
  label: string;
  prompt: string;
};

function getInitialAssistantMessages(): AssistantMessage[] {
  return [
    {
      id: 1,
      role: "assistant",
      text: "Hey, I am Sai's website assistant. I use Sai's site knowledge base for portfolio questions and an LLM brain for CS, backend, cloud, and AI questions.",
      links: [
        { href: "/blogs", kind: "action", label: "Blogs" },
        { href: "/ai-radar", kind: "action", label: "AI Radar" },
      ],
    },
  ];
}

function getNormalizedAssistantPathname(pathname: string) {
  const normalizedPathname = pathname.split(/[?#]/)[0]?.replace(/\/$/, "") || "/";
  return normalizedPathname === "" ? "/" : normalizedPathname;
}

function getAssistantQuickPrompts(pathname: string): AssistantQuickPrompt[] {
  const normalizedPathname = getNormalizedAssistantPathname(pathname);
  const blogSlug = normalizedPathname.match(/^\/blog\/([^/]+)$/)?.[1] ?? "";
  const blogPost = blogSlug
    ? blogPosts.find((post) => post.slug === decodeURIComponent(blogSlug))
    : undefined;
  const activeBuildSlug = normalizedPathname.match(/^\/active-builds\/([^/]+)$/)?.[1] ?? "";

  if (blogPost) {
    return [
      { label: "Summary", prompt: `Summarize Sai's blog: ${blogPost.title}` },
      { label: "Takeaways", prompt: `What are the key takeaways from ${blogPost.title}?` },
      { label: "Related", prompt: "What other blogs has Sai published?" },
      { label: "Projects", prompt: "Which projects connect to this blog topic?" },
    ];
  }

  if (normalizedPathname === "/blogs") {
    return [
      { label: "Blogs", prompt: "What blogs has Sai published?" },
      { label: "Count", prompt: "How many blogs has Sai published?" },
      { label: "Topics", prompt: "What backend topics does Sai write about?" },
      { label: "Start", prompt: "Which blog should I read first?" },
    ];
  }

  if (normalizedPathname === "/portfolio") {
    return [
      { label: "Projects", prompt: "Summarize Sai's strongest projects" },
      { label: "Experience", prompt: "What is Sai's work experience?" },
      { label: "Stack", prompt: "What tech stack does Sai use most?" },
      { label: "Impact", prompt: "Which project had the biggest impact?" },
    ];
  }

  if (["/contact", "/work-with-me"].includes(normalizedPathname)) {
    return [
      { label: "Contact", prompt: "How can I contact Sai?" },
      { label: "Fit", prompt: "What kind of work can Sai help with?" },
      { label: "Proof", prompt: "Show Sai's strongest backend projects" },
      { label: "Stack", prompt: "What is Sai's backend tech stack?" },
    ];
  }

  if (normalizedPathname === "/about") {
    return [
      { label: "Profile", prompt: "Who is Sai?" },
      { label: "Role", prompt: "What is Sai's current role?" },
      { label: "Focus", prompt: "What backend areas does Sai focus on?" },
      { label: "Contact", prompt: "How can I contact Sai?" },
    ];
  }

  if (normalizedPathname === "/ai-radar") {
    return [
      { label: "Radar", prompt: "What is new in AI Radar?" },
      { label: "Trends", prompt: "Which AI trends matter for backend builders?" },
      { label: "Sources", prompt: "What sources does AI Radar follow?" },
      { label: "Learn", prompt: "How should I learn from AI Radar updates?" },
    ];
  }

  if (normalizedPathname === "/active-builds" || activeBuildSlug) {
    return [
      { label: "Builds", prompt: "What active builds is Sai working on?" },
      { label: "Assistant", prompt: "Explain Sai's Assistant architecture" },
      { label: "Roadmap", prompt: "What is planned next for Sai's active builds?" },
      { label: "Stack", prompt: "What stack powers these active builds?" },
    ];
  }

  if (normalizedPathname === "/learn-with-me") {
    return [
      { label: "Learn", prompt: "What can I learn with Sai?" },
      { label: "Backend", prompt: "Give me a backend learning path" },
      { label: "Systems", prompt: "How should I practice system design?" },
      { label: "AI", prompt: "How should backend engineers learn AI workflows?" },
    ];
  }

  if (normalizedPathname === "/whats-new") {
    return [
      { label: "Updates", prompt: "What changed recently on Sai's site?" },
      { label: "Builds", prompt: "What active builds changed recently?" },
      { label: "Blogs", prompt: "What new blogs should I read?" },
      { label: "Radar", prompt: "What is new in AI Radar?" },
    ];
  }

  if (normalizedPathname === "/saved-posts") {
    return [
      { label: "Saved", prompt: "What can I do with saved posts?" },
      { label: "Blogs", prompt: "What blogs are worth saving?" },
      { label: "Radar", prompt: "How do AI Radar saves work?" },
      { label: "Account", prompt: "Why should I sign in?" },
    ];
  }

  if (normalizedPathname === "/shelf") {
    return [
      { label: "Shelf", prompt: "What is on Sai's shelf?" },
      { label: "Reading", prompt: "What should a backend engineer read first?" },
      { label: "Topics", prompt: "What themes show up in Sai's shelf?" },
      { label: "Blogs", prompt: "Connect Sai's shelf to his blogs" },
    ];
  }

  if (normalizedPathname === "/dashboard") {
    return [
      { label: "Dashboard", prompt: "What is the creator dashboard?" },
      { label: "Metrics", prompt: "What does Sai track in the dashboard?" },
      { label: "Build", prompt: "How is the dashboard designed?" },
      { label: "Next", prompt: "What could be improved in the dashboard?" },
    ];
  }

  if (normalizedPathname === "/start") {
    return [
      { label: "Start", prompt: "Where should I start on Sai's site?" },
      { label: "Projects", prompt: "Show Sai's strongest projects" },
      { label: "Blogs", prompt: "Which blog should I read first?" },
      { label: "Contact", prompt: "How can I contact Sai?" },
    ];
  }

  if (normalizedPathname === "/signin") {
    return [
      { label: "Access", prompt: "Why should I sign in?" },
      { label: "Saved", prompt: "What does saved posts unlock?" },
      { label: "Blogs", prompt: "What subscriber blogs are available?" },
      { label: "Privacy", prompt: "How does sign-in work on this site?" },
    ];
  }

  return [
    { label: "All", prompt: "What can you answer about this site?" },
    { label: "Portfolio", prompt: "Summarize Sai's strongest projects" },
    { label: "Blogs", prompt: "What does Sai write about?" },
    { label: "AI Radar", prompt: "What is new in AI Radar?" },
  ];
}

const motionRevealSelector = [
  ".hero-copy",
  ".hero-panel",
  ".metric-card",
  ".section-heading",
  ".focus-card",
  ".project-tab",
  ".project-spotlight",
  ".timeline-card",
  ".skill-card",
  ".credential-panel",
  ".recognition-card",
  ".updates-panel",
  ".updates-card",
  ".contact-panel",
  ".blog-toolbar",
  ".blog-featured",
  ".blog-list-item",
  ".guide-hero",
  ".guide-card",
  ".blog-architecture-diagram",
  ".mini-updates-panel",
  ".whats-new-list article",
  ".ai-radar-hero",
  ".ai-radar-top-card",
  ".ai-radar-lens",
  ".ai-radar-item",
  ".collaboration-hero-copy",
  ".collaboration-signal-card",
  ".collaboration-area-card",
  ".collaboration-proof",
  ".collaboration-step",
  ".collaboration-cta",
  ".dashboard-hero",
  ".dashboard-note",
  ".dashboard-email-callout",
  ".dashboard-stat-card",
  ".dashboard-card",
  ".dashboard-topic-breakdown section",
  ".signin-copy",
  ".updates-card",
  ".saved-posts-hero",
  ".saved-posts-item",
  ".saved-posts-empty",
  ".shelf-hero",
  ".shelf-coming-soon",
  ".shelf-plan-card",
  ".standalone-blog",
  ".blog-article-section",
].join(",");

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
const SAVED_AI_RADAR_STORAGE_KEY_PREFIX = "portfolio-saved-ai-radar:";
const NAV_RETURN_FLOW_STORAGE_KEY = "portfolio.navigationReturnFlow.v1";
const NAV_PENDING_SCROLL_STORAGE_KEY = "portfolio.pendingScrollRestore.v1";
const AI_RADAR_SAVE_ID_PREFIX = "ai-radar:";
const ALL_BLOG_CATEGORIES = "All";
const ALL_AI_RADAR_CATEGORIES = "All signals";
const ALL_SAVED_POSTS_TAG = "All";
const PUBLIC_BLOG_SLUG = "backend-throughput-database-cache-async-optimization";
const LOCKED_BLOG_CAPTION = "Members-only. Sign in to unlock.";

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

type SavedAiRadarItem = Pick<
  AiRadarSignal,
  "category" | "href" | "imageUrl" | "publishedAt" | "source" | "summary" | "title"
> & {
  id: string;
  savedAt?: string;
};

type SavedReaderItem = {
  actionLabel: string;
  date?: string;
  href: string;
  id: string;
  kind: "AI Radar" | "Blog";
  summary: string;
  tags: string[];
  title: string;
};

const aiRadarSignals: AiRadarSignal[] = [
  {
    category: "Models",
    cadence: "Official release notes",
    href: "https://openai.com/news/",
    source: "OpenAI",
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
    source: "Anthropic",
    title: "Agentic workflows and model behavior",
    summary:
      "A good source for model capability notes, safety framing, and practical AI workflow direction.",
    whyItMatters:
      "Helpful when thinking about assistants, tool use, MCP-style integrations, and enterprise adoption.",
  },
  {
    category: "Research",
    cadence: "Research and product notes",
    href: "https://deepmind.google/discover/blog/",
    source: "Google/DeepMind",
    title: "Research moving into real products",
    summary:
      "Signals across Gemini, applied research, safety, agents, and AI product direction.",
    whyItMatters:
      "Useful for seeing how frontier research turns into products, platforms, and developer capabilities.",
  },
  {
    category: "Open Source",
    cadence: "Community engineering notes",
    href: "https://huggingface.co/blog",
    source: "Hugging Face",
    title: "Open-source models and developer tooling",
    summary:
      "Practical posts around models, datasets, evaluation, inference, and the open-source AI ecosystem.",
    whyItMatters:
      "Strong place to watch what builders can actually try, fine-tune, host, and integrate.",
  },
  {
    category: "Infrastructure",
    cadence: "AI infrastructure updates",
    href: "https://blogs.nvidia.com/blog/category/artificial-intelligence/",
    source: "NVIDIA",
    title: "AI infrastructure and enterprise adoption",
    summary:
      "Updates around GPUs, inference, enterprise AI systems, robotics, healthcare, and industrial AI.",
    whyItMatters:
      "Good signal for the infrastructure side of AI, especially when models move from demos to production.",
  },
  {
    category: "Agents",
    cadence: "Framework updates",
    href: "https://blog.langchain.com/",
    source: "LangChain",
    title: "Agent frameworks and production patterns",
    summary:
      "Practical notes on agents, retrieval, observability, orchestration, and LLM application patterns.",
    whyItMatters:
      "Strong source for builders turning LLM ideas into maintainable applications and workflows.",
  },
  {
    category: "Cloud AI",
    cadence: "Cloud engineering updates",
    href: "https://aws.amazon.com/blogs/machine-learning/",
    source: "AWS ML",
    title: "Cloud ML architecture and deployment",
    summary:
      "Cloud-native machine learning updates across model hosting, generative AI apps, MLOps, and data platforms.",
    whyItMatters:
      "Helpful for connecting AI ideas with real deployment, scaling, security, and operations choices.",
  },
];

function normalizeAiRadarApiItems(data: AiRadarApiResponse): AiRadarSignal[] {
  const items: AiRadarApiItem[] = Array.isArray(data.items) ? data.items : [];

  return items
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
}

function normalizeSavedPostSlugs(savedPostSlugs: unknown) {
  return Array.isArray(savedPostSlugs)
    ? Array.from(new Set(savedPostSlugs.filter((slug): slug is string => typeof slug === "string")))
    : [];
}

function isSavedAiRadarId(id: string) {
  return id.startsWith(AI_RADAR_SAVE_ID_PREFIX);
}

function getAiRadarSavedId(signal: Pick<AiRadarSignal, "href">) {
  return `${AI_RADAR_SAVE_ID_PREFIX}${encodeURIComponent(signal.href)}`;
}

function getAiRadarHrefFromSavedId(id: string) {
  if (!isSavedAiRadarId(id)) {
    return "";
  }

  try {
    return decodeURIComponent(id.slice(AI_RADAR_SAVE_ID_PREFIX.length));
  } catch {
    return "";
  }
}

function normalizeSavedAiRadarItems(items: unknown): SavedAiRadarItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalizedItems = items
    .map((item): SavedAiRadarItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Partial<SavedAiRadarItem>;
      const href = typeof candidate.href === "string" ? candidate.href : "";
      const id =
        typeof candidate.id === "string" && candidate.id
          ? candidate.id
          : href
            ? getAiRadarSavedId({ href })
            : "";

      if (!id || !isSavedAiRadarId(id)) {
        return null;
      }

      return {
        category: typeof candidate.category === "string" ? candidate.category : "AI",
        href: href || getAiRadarHrefFromSavedId(id),
        id,
        imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : undefined,
        publishedAt:
          typeof candidate.publishedAt === "string" ? candidate.publishedAt : undefined,
        savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : undefined,
        source: typeof candidate.source === "string" ? candidate.source : "AI Radar",
        summary:
          typeof candidate.summary === "string"
            ? candidate.summary
            : "Saved from AI Radar for later reading.",
        title: typeof candidate.title === "string" ? candidate.title : "Saved AI Radar story",
      };
    })
    .filter((item): item is SavedAiRadarItem => Boolean(item));

  return Array.from(new Map(normalizedItems.map((item) => [item.id, item])).values());
}

function getSavedPostsStorageKey(uid: string) {
  return `${SAVED_POSTS_STORAGE_KEY_PREFIX}${uid}`;
}

function getSavedAiRadarStorageKey(uid: string) {
  return `${SAVED_AI_RADAR_STORAGE_KEY_PREFIX}${uid}`;
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

function readCachedSavedAiRadarItems(uid: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return normalizeSavedAiRadarItems(
      JSON.parse(window.localStorage.getItem(getSavedAiRadarStorageKey(uid)) ?? "[]"),
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

function cacheSavedAiRadarItems(uid: string, savedAiRadarItems: SavedAiRadarItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getSavedAiRadarStorageKey(uid),
      JSON.stringify(normalizeSavedAiRadarItems(savedAiRadarItems)),
    );
  } catch {
    // Saved AI Radar metadata is a local enhancement; Firestore still stores the saved IDs.
  }
}

function getCachedSavedAiRadarItemsForSlugs(uid: string, savedPostSlugs: string[]) {
  const savedAiRadarIds = new Set(savedPostSlugs.filter(isSavedAiRadarId));
  const cachedItems = readCachedSavedAiRadarItems(uid).filter((item) =>
    savedAiRadarIds.has(item.id),
  );

  cacheSavedAiRadarItems(uid, cachedItems);

  return cachedItems;
}

function getSavedAiRadarItem(signal: AiRadarSignal): SavedAiRadarItem {
  return {
    category: signal.category,
    href: signal.href,
    id: getAiRadarSavedId(signal),
    imageUrl: signal.imageUrl,
    publishedAt: signal.publishedAt,
    savedAt: new Date().toISOString(),
    source: signal.source,
    summary: signal.summary || signal.whyItMatters,
    title: signal.title,
  };
}

function buildSavedReaderItems(
  savedPostSlugs: string[],
  savedAiRadarItems: SavedAiRadarItem[],
) {
  return savedPostSlugs
    .map((id): SavedReaderItem | null => {
      const post = blogPosts.find((candidate) => candidate.slug === id);

      if (post) {
        return {
          actionLabel: "Read article",
          date: post.publishedAt,
          href: getBlogArticleHref(post.slug),
          id: post.slug,
          kind: "Blog",
          summary: getBlogCardSummary(post),
          tags: getBlogPostTags(post),
          title: post.title,
        };
      }

      const savedSignal =
        savedAiRadarItems.find((item) => item.id === id) ??
        (isSavedAiRadarId(id)
          ? {
              category: "AI Radar",
              href: getAiRadarHrefFromSavedId(id),
              id,
              publishedAt: undefined,
              source: "AI Radar",
              summary: "Saved from AI Radar for later reading.",
              title: "Saved AI Radar story",
            } satisfies SavedAiRadarItem
          : null);

      if (!savedSignal) {
        return null;
      }

      return {
        actionLabel: "Open story",
        date: formatAiRadarDate(savedSignal.publishedAt),
        href: savedSignal.href,
        id: savedSignal.id,
        kind: "AI Radar",
        summary: savedSignal.summary,
        tags: ["AI Radar", savedSignal.source, savedSignal.category],
        title: savedSignal.title,
      };
    })
    .filter((item): item is SavedReaderItem => Boolean(item));
}

function getSavedReaderItemTags(item: SavedReaderItem) {
  return Array.from(new Set([item.kind, ...item.tags].filter(Boolean)));
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

function isLearnPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/learn-with-me";
}

function isActiveBuildsPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/active-builds";
}

function getActiveBuildSlugFromPathname() {
  if (typeof window === "undefined") {
    return "";
  }

  const pathname = window.location.pathname.replace(/\/$/, "");
  const prefix = "/active-builds/";

  if (!pathname.startsWith(prefix)) {
    return "";
  }

  return decodeURIComponent(pathname.slice(prefix.length));
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

function isAboutPathname() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.replace(/\/$/, "") === "/about";
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
    "active-builds": { href: "/active-builds", label: "Back to active builds" },
    learn: { href: "/learn-with-me", label: "Back to learn with me" },
    portfolio: { href: "/portfolio", label: "Back to portfolio" },
    "saved-posts": { href: "/saved-posts", label: "Back" },
    shelf: { href: "/shelf", label: "Back to shelf" },
    start: { href: "/start", label: "Back to start" },
    "whats-new": { href: "/whats-new", label: "Back to what's new" },
    "work-with-me": { href: "/work-with-me", label: "Back to work with me" },
  };

  return returnTargets[target] ?? null;
}

type NavigationReturnFlow = {
  href: string;
  scrollY: number;
  savedAt: number;
};

function getCurrentRelativeHref() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function rememberCurrentNavigationFlow(targetHref: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const targetUrl = new URL(targetHref, window.location.href);

    if (targetUrl.origin !== window.location.origin) {
      return;
    }

    const currentHref = getCurrentRelativeHref();
    const targetRelativeHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    const isSamePageJump =
      targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search;

    if (targetRelativeHref === currentHref || isSamePageJump) {
      return;
    }

    window.sessionStorage.setItem(
      NAV_RETURN_FLOW_STORAGE_KEY,
      JSON.stringify({
        href: currentHref,
        savedAt: Date.now(),
        scrollY: Math.max(0, Math.round(window.scrollY)),
      } satisfies NavigationReturnFlow),
    );
  } catch {
    // Navigation still works even if storage is unavailable.
  }
}

function getRememberedNavigationFlow() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawFlow = window.sessionStorage.getItem(NAV_RETURN_FLOW_STORAGE_KEY);
    const flow = rawFlow ? (JSON.parse(rawFlow) as Partial<NavigationReturnFlow>) : null;

    if (
      !flow ||
      typeof flow.href !== "string" ||
      typeof flow.scrollY !== "number" ||
      typeof flow.savedAt !== "number" ||
      Date.now() - flow.savedAt > 30 * 60 * 1000
    ) {
      window.sessionStorage.removeItem(NAV_RETURN_FLOW_STORAGE_KEY);
      return null;
    }

    return flow as NavigationReturnFlow;
  } catch {
    window.sessionStorage.removeItem(NAV_RETURN_FLOW_STORAGE_KEY);
    return null;
  }
}

function navigateToRememberedFlow(fallbackHref: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const flow = getRememberedNavigationFlow();

  if (!flow || flow.href === getCurrentRelativeHref()) {
    return false;
  }

  try {
    window.sessionStorage.setItem(
      NAV_PENDING_SCROLL_STORAGE_KEY,
      JSON.stringify({
        href: flow.href,
        savedAt: Date.now(),
        scrollY: flow.scrollY,
      } satisfies NavigationReturnFlow),
    );
    window.sessionStorage.removeItem(NAV_RETURN_FLOW_STORAGE_KEY);
  } catch {
    // Fall through to navigation without scroll restoration.
  }

  window.location.href = flow.href || fallbackHref;
  return true;
}

function restorePendingNavigationScroll() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const rawFlow = window.sessionStorage.getItem(NAV_PENDING_SCROLL_STORAGE_KEY);
    const flow = rawFlow ? (JSON.parse(rawFlow) as Partial<NavigationReturnFlow>) : null;

    if (
      !flow ||
      typeof flow.href !== "string" ||
      typeof flow.scrollY !== "number" ||
      typeof flow.savedAt !== "number" ||
      Date.now() - flow.savedAt > 30 * 1000
    ) {
      window.sessionStorage.removeItem(NAV_PENDING_SCROLL_STORAGE_KEY);
      return;
    }

    const currentHref = getCurrentRelativeHref();

    if (currentHref !== flow.href) {
      return;
    }

    window.sessionStorage.removeItem(NAV_PENDING_SCROLL_STORAGE_KEY);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: flow.scrollY, behavior: "auto" });
      window.setTimeout(() => window.scrollTo({ top: flow.scrollY, behavior: "auto" }), 120);
    });
  } catch {
    window.sessionStorage.removeItem(NAV_PENDING_SCROLL_STORAGE_KEY);
  }
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
      readMinutes: current.readMinutes + getEstimatedReadMinutes(post),
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

    if (navigateToRememberedFlow(fallbackHref)) {
      return;
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

function AssistantRefreshIcon() {
  return (
    <svg className="assistant-refresh-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18.7 9.2a7 7 0 1 0 1.1 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18.7 4.8v4.4h-4.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AssistantCloseIcon() {
  return (
    <svg className="assistant-close-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.5 6.5 17.5 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 6.5 6.5 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  | "dashboard"
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
    dashboard: (
      <>
        <path
          d="M5.2 5.6h5.4v5.4H5.2V5.6ZM13.4 5.6h5.4v3.8h-5.4V5.6ZM13.4 12.2h5.4v6.2h-5.4v-6.2ZM5.2 13.8h5.4v4.6H5.2v-4.6Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
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

function BlogTagList({ limit = 3, post }: { limit?: number; post: BlogPost }) {
  const tags = getBlogPostTags(post);
  const visibleTags = tags.slice(0, limit);
  const hiddenTagCount = Math.max(tags.length - visibleTags.length, 0);

  return (
    <div className="blog-tag-list" aria-label={`${post.title} tags`}>
      {visibleTags.map((tag) => (
        <span key={`${post.slug}-${tag}`}>{tag}</span>
      ))}
      {hiddenTagCount ? <span>+{hiddenTagCount}</span> : null}
    </div>
  );
}

function BlogMetaLine({ accessLabel, post }: { accessLabel?: string; post: BlogPost }) {
  return (
    <div className="blog-meta">
      <span>{post.category}</span>
      <span>{post.publishedAt}</span>
      <span>{getEstimatedReadTimeLabel(post)}</span>
      {accessLabel ? <span>{accessLabel}</span> : null}
    </div>
  );
}

function ReadingProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="reading-progress-track"
      aria-label={`Reading progress ${Math.round(progress)} percent`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <span style={{ "--reading-progress": `${progress}%` } as CSSProperties} />
    </div>
  );
}

function ReadingTimeLeftPill({ secondsLeft }: { secondsLeft: number }) {
  return (
    <div className="reading-time-left-pill" aria-live="polite">
      <span aria-hidden="true" />
      <strong>{formatReadingTimeLeft(secondsLeft)}</strong>
    </div>
  );
}

function BlogArchitectureDiagram({ post }: { post: BlogPost }) {
  if (!post.diagram) {
    return null;
  }

  return (
    <section className="blog-architecture-diagram" aria-labelledby={`${post.slug}-diagram-title`}>
      <div className="blog-diagram-heading">
        <p className="eyebrow">Architecture View</p>
        <h2 id={`${post.slug}-diagram-title`}>{post.diagram.title}</h2>
        <p>{post.diagram.subtitle}</p>
      </div>

      <div className="blog-diagram-canvas" aria-label={post.diagram.title}>
        {post.diagram.lanes.map((lane, laneIndex) => (
          <article className="blog-diagram-lane" key={lane.title}>
            <div className="blog-diagram-lane-title">
              <span>{String(laneIndex + 1).padStart(2, "0")}</span>
              <h3>{lane.title}</h3>
            </div>
            <div className="blog-diagram-node-stack">
              {lane.nodes.map((node) => (
                <div
                  className={`blog-diagram-node${node.tone ? ` is-${node.tone}` : ""}`}
                  key={`${lane.title}-${node.label}`}
                >
                  <strong>{node.label}</strong>
                  <p>{node.detail}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="blog-diagram-footer">
        <p>{post.diagram.caption}</p>
        <div className="blog-diagram-highlights" aria-label="Diagram highlights">
          {post.diagram.highlights.map((highlight) => (
            <span key={`${post.slug}-diagram-${highlight.label}`}>
              <strong>{highlight.value}</strong>
              {highlight.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

type RelatedPostsProps = {
  currentPost: BlogPost;
  subscriberUser: User | null;
  onTrackBlogOpen: (post: BlogPost, source: string) => void;
};

function RelatedPosts({ currentPost, subscriberUser, onTrackBlogOpen }: RelatedPostsProps) {
  const relatedPosts = getRelatedBlogPosts(currentPost, blogPosts);

  if (!relatedPosts.length) {
    return null;
  }

  return (
    <section className="related-posts" aria-label="Related posts">
      <div className="related-posts-heading">
        <p className="eyebrow">Read Next</p>
        <h2>Related engineering notes.</h2>
        <p>Similar backend notes, kept short.</p>
      </div>

      <div className="related-post-grid">
        {relatedPosts.map(({ post, relatedTags }) => {
          const isRelatedPostLocked = !canReadBlogPost(post, subscriberUser);
          const href = isRelatedPostLocked ? getSignInHref(post.slug) : getBlogArticleHref(post.slug);

          return (
            <article
              className={`related-post-card${isRelatedPostLocked ? " is-locked" : ""}`}
              key={post.slug}
            >
              <BlogMetaLine accessLabel={isRelatedPostLocked ? "Locked" : "Open"} post={post} />
              <h3>{post.title}</h3>
              <p>{getBlogCardSummary(post)}</p>
              <div className="related-post-tags">
                {(relatedTags.length ? relatedTags : getBlogPostTags(post).slice(0, 2)).map((tag) => (
                  <span key={`${post.slug}-related-${tag}`}>{tag}</span>
                ))}
              </div>
              <a
                href={href}
                target="_blank"
                rel="opener"
                onClick={() => onTrackBlogOpen(post, "related_post")}
              >
                {isRelatedPostLocked ? "Unlock article" : "Read next"}
              </a>
            </article>
          );
        })}
      </div>
    </section>
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
  | "qa"
  | "recognition"
  | "skill"
  | "subscription"
  | "update";

type AssistantKnowledgeEntry = {
  answerStyle?: "direct" | "expanded";
  category: AssistantKnowledgeCategory;
  details?: string[];
  keywords: string[];
  links?: AssistantLink[];
  priority?: number;
  questions?: string[];
  summary: string;
  title: string;
};

type AssistantPromptEntry = Pick<
  AssistantKnowledgeEntry,
  "category" | "details" | "links" | "summary" | "title"
>;

type GenericAssistantResponse = {
  keywords: string[];
  text: string;
};

type AssistantAnswerMode = "generic" | "site";

type AssistantResponseDraft = Pick<AssistantMessage, "actions" | "citations" | "followUps" | "links" | "text"> & {
  mode: AssistantAnswerMode;
  shouldUseLlm: boolean;
};

type AssistantApiLink = {
  external?: boolean;
  href?: string;
  label?: string;
  title?: string;
  url?: string;
};

type AssistantStreamEvent = {
  citations?: AssistantApiLink[];
  label?: string;
  progress?: number;
  text?: string;
  type?: "done" | "stage" | "token";
};

const assistantApiBaseUrl = (import.meta.env.VITE_ASSISTANT_API_BASE_URL ?? "").replace(/\/+$/, "");
const assistantApiTimeoutMs = 18000;
const assistantStreamTimeoutMs = 30000;

function getAssistantElapsedMs(startTime: number) {
  return Math.max(0, Math.round(performance.now() - startTime));
}

function formatAssistantResponseTime(milliseconds: number) {
  if (milliseconds < 100) {
    return "< 0.1s";
  }

  if (milliseconds < 1000) {
    return `${milliseconds} ms`;
  }

  return `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0)}s`;
}

function getAssistantLoadingProgress(startTime: number) {
  const elapsedMs = Math.max(0, performance.now() - startTime);
  return Math.min(94, Math.round(8 + (1 - Math.exp(-elapsedMs / 4500)) * 86));
}

function getAssistantLoadingLabel(progress: number, mode: AssistantAnswerMode) {
  if (mode === "generic") {
    if (progress < 36) {
      return "Understanding concept";
    }
    if (progress < 72) {
      return "Building explanation";
    }
    return "Finalizing answer";
  }

  if (progress < 34) {
    return "Reading question";
  }
  if (progress < 64) {
    return "Matching sources";
  }
  if (progress < 84) {
    return "Grounding answer";
  }
  return "Finalizing citations";
}

async function fetchAssistantApi(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), assistantApiTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mapAssistantApiCitations(citations: unknown, fallbackCitations?: AssistantLink[]) {
  return Array.isArray(citations)
    ? getUniqueAssistantLinks(
        citations
          .map((link: AssistantApiLink): AssistantLink => {
            const href = link.href ?? link.url ?? "";

            return {
              external: link.external ?? /^https?:\/\//.test(href),
              href,
              kind: "source" as const,
              label: link.label ?? link.title ?? "Source",
            };
          })
          .filter((link: AssistantLink) => Boolean(link.href && link.label)),
      ).slice(0, 3)
    : fallbackCitations;
}

async function readAssistantEventStream(
  response: Response,
  onEvent: (event: AssistantStreamEvent) => void,
) {
  if (!response.body) {
    throw new Error("Assistant stream did not include a response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushEvent = (rawEvent: string) => {
    const data = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();

    if (!data) {
      return;
    }

    onEvent(JSON.parse(data) as AssistantStreamEvent);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    let boundaryIndex = buffer.search(/\r?\n\r?\n/);
    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + (buffer[boundaryIndex] === "\r" ? 4 : 2));
      flushEvent(rawEvent);
      boundaryIndex = buffer.search(/\r?\n\r?\n/);
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    flushEvent(buffer);
  }
}

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
  "he",
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
  bangalore: ["bengaluru", "blr", "bglr", "location", "office"],
  bengaluru: ["bangalore", "blr", "bglr", "location", "office"],
  bglr: ["bengaluru", "bangalore", "blr", "location", "office"],
  blog: ["article", "post", "writeup", "writing"],
  blogs: ["article", "articles", "posts", "writeups", "writing"],
  blr: ["bengaluru", "bangalore", "bglr", "location", "office"],
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
  exp: ["experience", "role", "oracle", "work", "career"],
  hyd: ["hyderabad", "location", "office"],
  hyderabad: ["hyd", "location", "office"],
  location: ["where", "bengaluru", "bangalore", "office", "remote"],
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
  saved: ["posts", "bookmark", "reading", "signin"],
  search: ["opensearch", "oracle", "text", "semantic"],
  signin: ["sign", "login", "subscribe", "unlock"],
  stack: ["skills", "technology", "tools", "tech"],
  newsletter: ["subscribe", "updates", "email", "content"],
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
  "login",
  "location",
  "newsletter",
  "portfolio",
  "project",
  "projects",
  "radar",
  "resume",
  "role",
  "sai",
  "saved",
  "shelf",
  "signin",
  "subscribe",
  "site",
  "stack",
  "tech",
  "unsubscribe",
  "update",
  "updates",
  "website",
  "work",
  "your",
]);

const genericTechWords = new Set([
  "acid",
  "algorithm",
  "api",
  "architecture",
  "async",
  "authentication",
  "authorization",
  "backend",
  "cache",
  "cap",
  "cloud",
  "container",
  "database",
  "deadlock",
  "docker",
  "event",
  "executor",
  "index",
  "java",
  "jvm",
  "kafka",
  "kubernetes",
  "latency",
  "llm",
  "load",
  "microservice",
  "microservices",
  "mcp",
  "nosql",
  "oop",
  "oracle",
  "queue",
  "rest",
  "scaling",
  "semantic",
  "spring",
  "sql",
  "system",
  "thread",
  "throughput",
  "transaction",
  "vector",
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
    keywords: ["trend", "trends", "watch", "emerging"],
    text:
      "For backend builders and architects, the AI trends that matter most are retrieval-augmented generation, agentic workflow orchestration, semantic search, evaluation and observability for AI outputs, secure model integration, and cost-aware inference. The practical lens is not just watching trends; it is knowing where they fit into APIs, data pipelines, search systems, and human-reviewable product workflows.",
  },
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
  const hasKnownTechWord = words.some((word) => genericTechWords.has(word));
  const hasPersonalSiteMarker = words.some((word) =>
    [
      "sai",
      "saikumar",
      "mediboina",
      "you",
      "your",
      "portfolio",
      "site",
      "website",
      "resume",
      "role",
      "experience",
      "project",
      "projects",
      "blog",
      "blogs",
      "contact",
      "education",
      "certification",
      "dashboard",
      "newsletter",
      "saved",
      "shelf",
      "signin",
      "subscribe",
      "updates",
      "work",
    ].includes(word),
  );
  const hasSiteSpecificWord = words.some((word) => siteSpecificQuestionWords.has(word));
  const isSiteQuestion = hasPersonalSiteMarker || (hasSiteSpecificWord && !hasKnownTechWord);

  return (hasLearningPhrase || hasKnownGenericTopic || hasKnownTechWord) && !isSiteQuestion;
}

function getGenericAssistantResponse(
  input: string,
): AssistantResponseDraft | null {
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
    actions: [{ href: "/learn-with-me", kind: "action", label: "Learn With Me" }],
    followUps: getAssistantFollowUps(input, "generic"),
    text:
      rankedResponse?.score > 0
        ? rankedResponse.response.text
        : "I can answer that as a general engineering concept. I will keep it practical, concise, and separate from Sai-specific portfolio facts unless you ask about Sai directly.",
    mode: "generic",
    shouldUseLlm: true,
  };
}

function getAssistantFollowUps(
  question: string,
  mode: AssistantAnswerMode,
  answerText = "",
) {
  const normalizedText = normalizeAssistantText(`${question} ${answerText}`);
  const suggestions: string[] = [];
  const add = (...items: string[]) => {
    items.forEach((item) => {
      if (
        suggestions.length < 3 &&
        normalizeAssistantText(item) !== normalizeAssistantText(question) &&
        !suggestions.some((existing) => normalizeAssistantText(existing) === normalizeAssistantText(item))
      ) {
        suggestions.push(item);
      }
    });
  };

  if (mode === "generic") {
    add(
      "Can you give a real backend example?",
      "How does this show up in system design?",
      "What should I learn next?",
    );
    return suggestions;
  }

  if (/(project|projects|work|built|designed|developed|system|systems)/.test(normalizedText)) {
    add(
      "Which project had the biggest impact?",
      "What tech stack does Sai use most?",
      "How can I contact Sai about backend work?",
    );
  } else if (/(contact|email|linkedin|hire|connect|work with me)/.test(normalizedText)) {
    add(
      "What kind of work can Sai help with?",
      "Show Sai's strongest projects",
      "What is Sai's tech stack?",
    );
  } else if (/(blog|blogs|article|articles|write|published)/.test(normalizedText)) {
    add(
      "How many blogs has Sai published?",
      "Which blog should I read first?",
      "What backend topics does Sai write about?",
    );
  } else if (/(experience|role|career|oracle|job)/.test(normalizedText)) {
    add(
      "What projects support this experience?",
      "What is Sai's current role?",
      "What backend skills does Sai use most?",
    );
  } else if (/(skill|skills|stack|java|spring|oracle|search|cloud|tech)/.test(normalizedText)) {
    add(
      "Which projects use these skills?",
      "What is Sai's backend experience?",
      "What should I ask about Oracle or search?",
    );
  }

  add(
    "What projects has Sai worked on?",
    "How can I contact Sai?",
    "What blogs has Sai published?",
  );
  return suggestions;
}

function getAssistantEntryFollowUps(
  entry: AssistantKnowledgeEntry,
  relatedEntries: AssistantKnowledgeEntry[],
) {
  const categorySuggestions: Partial<Record<AssistantKnowledgeCategory, string[]>> = {
    blog: [
      "How many blogs has Sai published?",
      "Which blog should I read first?",
      "What backend topics does Sai write about?",
    ],
    contact: [
      "What kind of work can Sai help with?",
      "Show Sai's strongest projects",
      "What is Sai's tech stack?",
    ],
    experience: [
      "What projects support this experience?",
      "What is Sai's current role?",
      "What backend skills does Sai use most?",
    ],
    project: [
      "Which project had the biggest impact?",
      "What stack did Sai use in these projects?",
      "How can I contact Sai about backend work?",
    ],
    skill: [
      "Which projects use these skills?",
      "What is Sai's backend experience?",
      "What should I ask about Oracle or search?",
    ],
  };

  const suggestions = [
    ...(categorySuggestions[entry.category] ?? []),
    ...relatedEntries.slice(0, 2).map((relatedEntry) => `Tell me about ${relatedEntry.title}`),
    "What projects has Sai worked on?",
    "How can I contact Sai?",
  ];

  return suggestions
    .filter((suggestion, index, list) =>
      list.findIndex((item) => normalizeAssistantText(item) === normalizeAssistantText(suggestion)) === index,
    )
    .slice(0, 3);
}

function getAssistantSearchText(entry: AssistantKnowledgeEntry) {
  return normalizeAssistantText(
    [
      entry.title,
      entry.summary,
      ...(entry.details ?? []),
      ...(entry.questions ?? []),
      ...entry.keywords,
      entry.category,
    ].join(" "),
  );
}

function hasAssistantToken(text: string, token: string) {
  if (!token) {
    return false;
  }

  if (token.length <= 3) {
    return text.split(" ").includes(token);
  }

  return text.includes(token);
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

function getAssistantActionLinks(links: AssistantLink[] | undefined) {
  return getUniqueAssistantLinks(
    (links ?? []).map((link): AssistantLink => ({ ...link, kind: "action" })),
  ).slice(0, 3);
}

function getAssistantSourceLinks(entries: AssistantKnowledgeEntry[]) {
  const links: AssistantLink[] = [];

  entries.forEach((entry) => {
    const primaryLink = entry.links?.[0];

    if (!primaryLink) {
      return;
    }

    links.push({
      ...primaryLink,
      kind: "source",
      label: entry.title,
    });
  });

  return getUniqueAssistantLinks(links).slice(0, 3);
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
    ? rankedEntries.slice(0, 10).map((result) => result.entry)
    : getAssistantKnowledgeEntries(isReaderSignedIn, hasActiveSubscription).slice(0, 8);

  return selectedEntries.map((entry) => ({
    category: entry.category,
    details: entry.details?.slice(0, 8),
    links: entry.links?.slice(0, 3),
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

type CuratedAssistantQaOptions = {
  currentCompany: string;
  currentRoleTitle: string;
  hasActiveSubscription: boolean;
  isReaderSignedIn: boolean;
  publicBlog: BlogPost;
};

function getCuratedAssistantQaEntries({
  currentCompany,
  currentRoleTitle,
  hasActiveSubscription,
  isReaderSignedIn,
  publicBlog,
}: CuratedAssistantQaOptions): AssistantKnowledgeEntry[] {
  const featuredProjectNames = projects
    .slice(0, 3)
    .map((project) => project.name)
    .join(", ");
  const coreStack = skills
    .flatMap((group) => group.items)
    .slice(0, 12)
    .join(", ");

  return [
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: Experience",
      summary: `Sai is currently ${currentRoleTitle} at ${currentCompany}. He has about ${getProfessionalExperienceDurationText()} of professional experience, with work focused on backend platform engineering, search systems, high-throughput screening, performance tuning, and practical AI-enabled workflows.`,
      questions: [
        "what is sai experience",
        "how many years of experience does sai have",
        "what is sai current role",
        "where does sai work",
        "is sai working in bangalore or hyderabad",
        "is he working in bglr or hyd",
        "tell me about sai career",
      ],
      keywords: [
        "bangalore",
        "bengaluru",
        "bglr",
        "blr",
        "experience",
        "career",
        "current",
        "hyd",
        "hyderabad",
        "location",
        "office",
        "role",
        "oracle",
        "software",
        "application",
        "engineer",
      ],
      links: [{ href: "/portfolio#experience", label: "Experience" }],
      priority: 12,
    }),
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: Projects",
      summary: `Sai's main project work centers on ${featuredProjectNames}. The common theme is building scalable backend systems for screening, search, matching, data-heavy processing, and measurable latency or throughput improvements.`,
      questions: [
        "show sai projects",
        "what projects has sai worked on",
        "what are sai main projects",
        "tell me about sai work",
        "show portfolio projects",
      ],
      keywords: [
        "project",
        "projects",
        "portfolio",
        "work",
        "matching",
        "scoring",
        "screening",
        "search",
      ],
      links: [{ href: "/portfolio#work", label: "Projects" }],
      priority: 12,
    }),
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: Tech stack",
      summary: `Sai's core stack is backend-first: ${coreStack}. His strongest areas are Java and Spring backend services, Oracle-backed data flows, search platforms, cloud-native deployment, and AI or LLM-assisted workflow patterns.`,
      questions: [
        "what is sai tech stack",
        "what technologies does sai use",
        "what are sai skills",
        "show tech stack",
        "what tools does sai know",
      ],
      keywords: [
        "tech",
        "stack",
        "skills",
        "technology",
        "tools",
        "java",
        "spring",
        "oracle",
        "kubernetes",
      ],
      links: [{ href: "/portfolio#skills", label: "Tech stack" }],
      priority: 12,
    }),
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: Contact",
      summary: `For professional conversations, use the Work With Me page, email Sai at ${profile.email}, or connect through LinkedIn. Best-fit topics are backend performance, search systems, cloud-native engineering, and practical AI product ideas.`,
      questions: [
        "how can i contact sai",
        "how to reach sai",
        "what is sai email",
        "where is sai linkedin",
        "can i work with sai",
      ],
      keywords: [
        "contact",
        "email",
        "mail",
        "linkedin",
        "connect",
        "hire",
        "collaboration",
        "work",
      ],
      links: [
        { href: "/work-with-me", label: "Work With Me" },
        { href: profile.linkedin, label: "LinkedIn", external: true },
      ],
      priority: 12,
    }),
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: Saved posts",
      summary: isReaderSignedIn
        ? "Saved Posts is your personal reading list for blog articles and AI Radar items. Save something while reading, then open Saved Posts from the menu to revisit it later with tags."
        : "Saved Posts becomes your personal reading list after sign-in. Until then, the shelf is politely waiting with a tiny bookmark helmet on.",
      questions: [
        "what are saved posts",
        "how do saved posts work",
        "where are my saved posts",
        "why should i sign in to save posts",
        "can i save blogs",
      ],
      keywords: [
        "saved",
        "posts",
        "bookmark",
        "bookmarks",
        "save",
        "reading",
        "list",
        "signin",
        "login",
      ],
      links: isReaderSignedIn
        ? [{ href: "/saved-posts", label: "Saved Posts" }]
        : [{ href: "/signin", label: "Sign in to save" }],
      priority: 12,
    }),
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: Newsletter",
      summary: hasActiveSubscription
        ? "You are subscribed to updates. New selected notes can reach your inbox when Sai publishes or shares important content, and you can unsubscribe whenever you want."
        : "The newsletter is for occasional engineering updates: backend performance notes, search-system ideas, AI workflow content, and new blog drops. You can subscribe from the page footer and unsubscribe anytime.",
      questions: [
        "what is newsletter",
        "how do i get updates",
        "how to subscribe",
        "what emails will i get",
        "can i unsubscribe",
      ],
      keywords: [
        "newsletter",
        "subscribe",
        "unsubscribe",
        "updates",
        "email",
        "inbox",
        "content",
      ],
      links: [{ href: "#newsletter", label: "Newsletter" }],
      priority: 12,
    }),
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: AI Radar",
      summary: "AI Radar is a curated feed of AI news and research links from free, public sources. It highlights useful articles, links to the original source, and lets signed-in readers save interesting items for later.",
      questions: [
        "what is ai radar",
        "how does ai radar work",
        "where do ai radar articles come from",
        "is ai radar free",
        "can i save ai radar posts",
      ],
      keywords: [
        "ai",
        "radar",
        "news",
        "articles",
        "rss",
        "feed",
        "source",
        "sources",
        "latest",
      ],
      links: [{ href: "/ai-radar", label: "AI Radar" }],
      priority: 12,
    }),
    createAssistantEntry({
      answerStyle: "direct",
      category: "qa",
      title: "Q&A: Blogs",
      summary: isReaderSignedIn
        ? `Blogs are Sai's engineering write-ups on performance, search architecture, AI relevance, and backend design. You can read the public article "${publicBlog.title}" plus the unlocked member articles.`
        : `Blogs are Sai's engineering write-ups on performance, search architecture, AI relevance, and backend design. "${publicBlog.title}" is public; the remaining articles unlock after sign-in.`,
      questions: [
        "what blogs are available",
        "what does sai write about",
        "how do blogs work",
        "which blog is public",
        "why are some blogs locked",
      ],
      keywords: [
        "blog",
        "blogs",
        "article",
        "articles",
        "writing",
        "locked",
        "unlocked",
        "read",
      ],
      links: [
        { href: "/blogs", label: "Blogs" },
        { href: getBlogArticleHref(publicBlog.slug), label: "Public article", external: true },
      ],
      priority: 12,
    }),
  ];
}

function getAssistantBlogDetails(post: BlogPost, canReadPost: boolean) {
  if (!canReadPost) {
    return [
      `Category: ${post.category}. ${getEstimatedReadTimeLabel(post)}. Sign in required for the full read.`,
      `Preview takeaways: ${post.takeaways.slice(0, 2).join(" ")}`,
    ];
  }

  const sectionDetails = post.sections.slice(0, 5).map((section) => {
    const paragraphText = section.paragraphs.slice(0, 2).join(" ");
    const bulletText = section.bullets?.length ? ` Key points: ${section.bullets.join(" ")}` : "";

    return `${section.heading}: ${paragraphText}${bulletText}`;
  });
  const diagramDetail = post.diagram
    ? `Diagram: ${post.diagram.title}. ${post.diagram.subtitle} ${post.diagram.caption}`
    : "";

  return [
    `Category: ${post.category}. ${getEstimatedReadTimeLabel(post)}. Published ${post.publishedAt}.`,
    `Stats: ${post.stats.map((stat) => `${stat.label} ${stat.value}`).join(", ")}`,
    `Takeaways: ${post.takeaways.join(" ")}`,
    diagramDetail,
    ...sectionDetails,
  ].filter(Boolean);
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
    ...getCuratedAssistantQaEntries({
      currentCompany,
      currentRoleTitle: currentRole?.title ?? profile.currentTitle,
      hasActiveSubscription,
      isReaderSignedIn,
      publicBlog,
    }),
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
      links: [{ href: "/about", label: "About Sai" }],
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
        "generative",
        "deeplearning",
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
        "Sai's stack is backend-heavy: Java, Spring Boot, REST APIs, microservices, Oracle 19c, Oracle Text, OpenSearch, Oracle 23ai Vector Search, hybrid search, OCI, Kubernetes, semantic search, embeddings, RAG, AI similarity, hybrid retrieval, rule-based reranking, and LLM workflow patterns.",
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
      category: "page",
      title: "Learn With Me",
      summary:
        "Learn With Me is a protected learning room for simple, practical explanations of CS fundamentals, backend systems, search architecture, and AI workflows. It is designed to move from concept, to real scenario, to system-design connection, to a small build.",
      details: [
        "Tracks: Back to Basics, Backend Performance, Search Systems, and Practical AI.",
        "The page is password protected because it can contain early drafts, selected learning notes, and experiments.",
      ],
      keywords: [
        "learn",
        "learning",
        "cs",
        "fundamentals",
        "backend",
        "performance",
        "search",
        "practical",
        "ai",
        "password",
      ],
      links: [{ href: "/learn-with-me", label: "Open Learn With Me" }],
      priority: 4,
    }),
    createAssistantEntry({
      category: "page",
      title: "Active Builds",
      summary:
        "Active Builds now documents Sai's Assistant as the current product build: a website-aware AI guide powered by curated site knowledge, LLM routing, source/action chips, and safe fallback behavior.",
      details: [
        "The page explains the assistant purpose, chat UI architecture, offline ingestion path, online vector-search path, code flow, tech stack, design principles, and future roadmap.",
        "Ingestion: a protected refresh loads structured portfolio knowledge and configured site pages, chunks text with overlap, builds embedding text from title/source/category/body, and stores vectors in Oracle 23ai.",
        "Search: Spring embeds the visitor question, retrieves nearest Oracle VECTOR chunks with cosine distance, reranks by intent, builds a grounded prompt, calls Groq or Gemini, and renders cited answers.",
        "Design principles: grounded by default, third-person identity boundary, visible citations, guarded admin ingest, streaming progress, graceful fallback, and useful direction.",
      ],
      keywords: [
        "active",
        "builds",
        "current",
        "experiments",
        "portfolio",
        "intelligence",
        "assistant",
        "sai assistant",
        "knowledge",
        "architecture",
        "rag",
        "llm",
      ],
      links: [{ href: "/active-builds", label: "Open Active Builds" }],
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
        links: [{ href: "/about", label: "View highlights" }],
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
        links: [{ href: "/about", label: "View focus areas" }],
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
        details: getAssistantBlogDetails(post, canReadPost),
        keywords: [
          "blog",
          "article",
          "post",
          "read",
          post.title,
          post.category,
          post.summary,
          ...post.tags,
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

  if (
    normalizedQuery.length > 4 &&
    entry.questions?.some((question) => {
      const normalizedQuestion = normalizeAssistantText(question);

      return (
        normalizedQuestion.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedQuestion)
      );
    })
  ) {
    score += 14;
  }

  tokens.forEach((token) => {
    if (hasAssistantToken(titleText, token)) {
      score += 5;
    }

    if (hasAssistantToken(keywordText, token)) {
      score += 3;
    }

    if (hasAssistantToken(searchText, token)) {
      score += 1;
    }
  });

  return score;
}

function getAssistantUnknownResponse(): AssistantResponseDraft {
  return {
    text:
      "I do not have enough website context to answer that confidently yet. Try asking about Sai's projects, blogs, tech stack, updates, reader access, or a general CS/backend concept.",
    followUps: [
      "What projects has Sai worked on?",
      "How can I contact Sai?",
      "What is Sai's tech stack?",
    ],
    links: [
      { href: "/start", label: "Start Here" },
      { href: "/portfolio#work", label: "Projects" },
    ],
    mode: "site",
    shouldUseLlm: true,
  };
}

function getAssistantGreetingResponse(): AssistantResponseDraft {
  return {
    text:
      "Hey, I am Sai's site assistant. Ask me about his projects, blogs, tech stack, AI Radar, or general CS and backend concepts. If it is on the site, I will ground the answer in Sai's knowledge base.",
    followUps: [
      "What projects has Sai worked on?",
      "How can I contact Sai?",
      "What blogs has Sai published?",
    ],
    links: [
      { href: "/portfolio#work", label: "Projects" },
      { href: "/blogs", label: "Blogs" },
    ],
    mode: "site",
    shouldUseLlm: false,
  };
}

function getAssistantSmallTalkResponse(): AssistantResponseDraft {
  return {
    text:
      "Nice. Ask me a Sai-specific question, or throw a CS/backend concept at me and I will keep it simple.",
    followUps: [
      "Summarize Sai's strongest projects",
      "What is Sai's tech stack?",
      "Explain semantic search simply",
    ],
    links: undefined,
    mode: "site",
    shouldUseLlm: false,
  };
}

function formatAssistantEntryResponse(
  entry: AssistantKnowledgeEntry,
  relatedEntries: AssistantKnowledgeEntry[],
): AssistantResponseDraft {
  const shouldAnswerDirectly = entry.answerStyle === "direct";
  const detailText = entry.details?.slice(0, 2).join(" ") ?? "";
  const relatedText = !shouldAnswerDirectly && relatedEntries.length
    ? ` Related on this site: ${relatedEntries
        .slice(0, 2)
        .map((relatedEntry) => relatedEntry.title)
        .join(", ")}.`
    : "";
  const links = getUniqueAssistantLinks([
    ...(entry.links ?? []),
    ...(shouldAnswerDirectly
      ? []
      : relatedEntries.flatMap((relatedEntry) => relatedEntry.links ?? [])),
  ]).slice(0, 2);
  const sourceEntries = [entry, ...relatedEntries].slice(0, 3);
  const actionLinks = getAssistantActionLinks(links);

  return {
    actions: actionLinks.length ? actionLinks : undefined,
    citations: getAssistantSourceLinks(sourceEntries),
    followUps: getAssistantEntryFollowUps(entry, relatedEntries),
    text: `${entry.summary}${detailText ? ` ${detailText}` : ""}${relatedText}`,
    links: actionLinks.length ? actionLinks : undefined,
    mode: "site",
    shouldUseLlm: !shouldAnswerDirectly,
  };
}

function parseAssistantMonthYear(value: string) {
  const match = value.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i,
  );

  if (!match) {
    return null;
  }

  const monthIndex = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].indexOf(match[1].slice(0, 3).toLowerCase());

  if (monthIndex < 0) {
    return null;
  }

  return new Date(Number(match[2]), monthIndex, 1);
}

function getProfessionalExperienceDurationText() {
  const rolePeriods = experience.flatMap((entry) => entry.roles.map((role) => role.period));
  const startDates = rolePeriods
    .map((period) => parseAssistantMonthYear(period.split("-")[0] ?? ""))
    .filter((date): date is Date => Boolean(date));
  const earliestStart = startDates.sort((left, right) => left.getTime() - right.getTime())[0];

  if (!earliestStart) {
    return "Sai's professional experience is listed in the Experience section.";
  }

  const now = new Date();
  const totalMonths = Math.max(
    0,
    (now.getFullYear() - earliestStart.getFullYear()) * 12 +
      (now.getMonth() - earliestStart.getMonth()),
  );
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const yearText = years ? `${years} ${years === 1 ? "year" : "years"}` : "";
  const monthText = months ? `${months} ${months === 1 ? "month" : "months"}` : "";

  return [yearText, monthText].filter(Boolean).join(" and ") || "less than a month";
}

function isExperienceDurationQuestion(normalizedQuery: string) {
  const words = normalizedQuery.split(" ").filter(Boolean);
  const hasExperienceWord = words.some((word) =>
    ["experience", "exp", "career", "work"].includes(word),
  );
  const hasDurationWord = words.some((word) =>
    ["year", "years", "yr", "yrs", "long", "total", "much", "many"].includes(word),
  );

  return hasExperienceWord && hasDurationWord;
}

function isCurrentWorkLocationQuestion(normalizedQuery: string) {
  const words = normalizedQuery.split(" ").filter(Boolean);
  const hasLocationWord = words.some((word) =>
    ["bangalore", "bengaluru", "bglr", "blr", "hyd", "hyderabad", "location", "office", "city"].includes(word),
  );
  const hasWorkContext = words.some((word) =>
    ["company", "current", "job", "office", "oracle", "role", "work", "working", "works"].includes(word),
  );

  return hasLocationWord && hasWorkContext;
}

function getCurrentWorkLocationResponse(): AssistantResponseDraft {
  return {
    text:
      "Sai's current Oracle role is associated with Bengaluru (Bangalore), Karnataka, India, and it is listed as remote. It is not Hyderabad in the portfolio context.",
    links: [{ href: "/portfolio#experience", label: "View experience" }],
    mode: "site",
    shouldUseLlm: false,
  };
}

function getExperienceDurationResponse(): AssistantResponseDraft {
  const currentExperience = experience[0];
  const currentRole = currentExperience?.roles[0];
  const previousRole = currentExperience?.roles[1];

  return {
    text: `Sai has about ${getProfessionalExperienceDurationText()} of professional experience, starting at Oracle in Aug 2023. He is currently ${currentRole?.title ?? profile.currentTitle} at ${currentExperience?.company ?? profile.company}${
      previousRole ? `, after working as ${previousRole.title} from ${previousRole.period}.` : "."
    }`,
    links: [{ href: "/portfolio#experience", label: "View experience" }],
    mode: "site",
    shouldUseLlm: false,
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
): AssistantResponseDraft {
  const normalizedQuery = normalizeAssistantText(input);
  const queryWords = normalizedQuery.split(" ").filter(Boolean);
  const isGreetingOnly =
    queryWords.length > 0 &&
    queryWords.length <= 2 &&
    queryWords.every((word) => /^(hi|hello|hey|yo|namaste|hai)$/.test(word));

  if (isGreetingOnly) {
    return getAssistantGreetingResponse();
  }

  const isSmallTalk =
    queryWords.length > 0 &&
    queryWords.length <= 3 &&
    queryWords.every((word) =>
      /^(ok|okay|cool|nice|fine|thanks|thank|done|yes|no|hmm|great)$/.test(word),
    );

  if (isSmallTalk) {
    return getAssistantSmallTalkResponse();
  }

  if (isCurrentWorkLocationQuestion(normalizedQuery)) {
    return getCurrentWorkLocationResponse();
  }

  if (isExperienceDurationQuestion(normalizedQuery)) {
    return getExperienceDurationResponse();
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
  currentPathname: string;
  isSubscribed: boolean;
  isSuppressed?: boolean;
  subscriberUser: User | null;
};

function SiteAssistant({
  currentPathname,
  isSubscribed,
  isSuppressed = false,
  subscriberUser,
}: SiteAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>(getInitialAssistantMessages);
  const loadingIntervalsRef = useRef<number[]>([]);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef(
    `sai-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  );
  const quickPrompts = getAssistantQuickPrompts(currentPathname);

  useEffect(() => {
    const messagesContainer = messagesRef.current;

    if (isOpen && messagesContainer) {
      const shouldKeepWelcomeAtTop = messages.length === 1 && messages[0]?.id === 1;

      messagesContainer.scrollTo({
        top: shouldKeepWelcomeAtTop ? 0 : messagesContainer.scrollHeight,
        behavior: shouldKeepWelcomeAtTop ? "auto" : "smooth",
      });
    }
  }, [isOpen, messages]);

  useEffect(() => {
    return () => {
      loadingIntervalsRef.current.forEach((intervalId) => window.clearInterval(intervalId));
      loadingIntervalsRef.current = [];
    };
  }, []);

  const getLlmAssistantResponse = async (
    question: string,
    fallbackResponse: AssistantResponseDraft,
  ) => {
    const fallbackActions = getAssistantActionLinks(
      fallbackResponse.actions ?? fallbackResponse.links,
    );
    const shouldUseSpringAssistant = Boolean(assistantApiBaseUrl);
    const response = await fetchAssistantApi(
      shouldUseSpringAssistant ? `${assistantApiBaseUrl}/api/chat` : "/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          shouldUseSpringAssistant
            ? {
                history: messages.slice(-6).map((message) => ({
                  role: message.role,
                  text: message.text,
                })),
                message: question,
                sessionId: sessionIdRef.current,
              }
            : {
                question,
                fallbackText: fallbackResponse.text,
                fallbackLinks: fallbackActions,
                sessionId: sessionIdRef.current,
                mode: fallbackResponse.mode,
                context:
                  fallbackResponse.mode === "generic"
                    ? []
                    : getAssistantPromptContext(question, Boolean(subscriberUser), isSubscribed),
                history: messages.slice(-6).map((message) => ({
                  role: message.role,
                  text: message.text,
                })),
              },
        ),
      },
    );

    if (!response.ok) {
      throw new Error("Assistant API request failed.");
    }

    const data = await response.json();
    if (data?.configured === false) {
      return {
        actions: fallbackActions.length ? fallbackActions : undefined,
        citations: fallbackResponse.citations,
        followUps: fallbackResponse.followUps ?? getAssistantFollowUps(question, fallbackResponse.mode, fallbackResponse.text),
        text: fallbackResponse.text,
      };
    }

    const text =
      typeof data?.answer === "string"
        ? data.answer.trim()
        : typeof data?.text === "string"
          ? data.text.trim()
          : "";

    if (!text) {
      throw new Error("Assistant API returned an empty response.");
    }

    const citations = mapAssistantApiCitations(data?.citations, fallbackResponse.citations);
    const actions = getUniqueAssistantLinks([
      ...(Array.isArray(data?.actions)
        ? data.actions
            .map((link: AssistantLink) => ({ ...link, kind: "action" as const }))
            .filter((link: AssistantLink) => Boolean(link.href && link.label))
        : []),
      ...fallbackActions,
    ]).slice(0, 3);

    return {
      actions: actions.length ? actions : undefined,
      citations,
      followUps: getAssistantFollowUps(question, fallbackResponse.mode, text),
      links: actions.length ? actions : fallbackResponse.links?.slice(0, 2),
      text,
    };
  };

  const getStreamingLlmAssistantResponse = async (
    question: string,
    fallbackResponse: AssistantResponseDraft,
    assistantMessageId: number,
  ) => {
    const fallbackActions = getAssistantActionLinks(
      fallbackResponse.actions ?? fallbackResponse.links,
    );
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), assistantStreamTimeoutMs);
    let streamedText = "";
    let citations = fallbackResponse.citations;

    try {
      const response = await fetch(`${assistantApiBaseUrl}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history: messages.slice(-6).map((message) => ({
            role: message.role,
            text: message.text,
          })),
          message: question,
          sessionId: sessionIdRef.current,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Assistant stream request failed.");
      }

      await readAssistantEventStream(response, (event) => {
        if (event.type === "stage") {
          const progress =
            typeof event.progress === "number"
              ? Math.max(1, Math.min(100, Math.round(event.progress)))
              : undefined;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    loadingLabel: event.label ?? message.loadingLabel,
                    loadingProgress: progress ?? message.loadingProgress,
                  }
                : message,
            ),
          );
          return;
        }

        if (event.type === "token" && event.text) {
          streamedText += event.text;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    loadingLabel: "Streaming answer",
                    loadingProgress: Math.max(message.loadingProgress ?? 0, 92),
                    text: streamedText.trimStart(),
                  }
                : message,
            ),
          );
          return;
        }

        if (event.type === "done") {
          citations = mapAssistantApiCitations(event.citations, fallbackResponse.citations);
        }
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    const text = streamedText.trim() || fallbackResponse.text;

    return {
      actions: fallbackActions.length ? fallbackActions : undefined,
      citations,
      followUps: getAssistantFollowUps(question, fallbackResponse.mode, text),
      links: fallbackActions.length ? fallbackActions : fallbackResponse.links?.slice(0, 2),
      text,
    };
  };

  const sendAssistantMessage = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return;
    }

    const responseStartTime = performance.now();
    const response = getAssistantResponse(trimmedValue, Boolean(subscriberUser), isSubscribed);
    trackAnalyticsEvent("assistant_question", {
      question: trimmedValue,
      source: response.mode,
      title: response.mode === "generic" ? "Generic question" : "Site question",
    });
    const visitorMessageId = Date.now();
    const assistantMessageId = visitorMessageId + 1;
    const loadingText =
      response.mode === "generic"
        ? "Thinking through the concept with the LLM brain..."
        : "Checking Sai's knowledge base and matching the best sources...";

    setMessages((current) => [
      ...current,
      {
        id: visitorMessageId,
        role: "visitor",
        text: trimmedValue,
      },
      {
        id: assistantMessageId,
        isLoading: response.shouldUseLlm,
        loadingLabel: response.shouldUseLlm ? getAssistantLoadingLabel(12, response.mode) : undefined,
        loadingProgress: response.shouldUseLlm ? 12 : undefined,
        role: "assistant",
        text: response.shouldUseLlm ? loadingText : response.text,
        actions: response.shouldUseLlm ? undefined : response.actions,
        citations: response.shouldUseLlm ? undefined : response.citations,
        followUps: response.shouldUseLlm ? undefined : response.followUps,
        links: response.shouldUseLlm ? undefined : response.links?.slice(0, 2),
        responseTimeMs: response.shouldUseLlm ? undefined : getAssistantElapsedMs(responseStartTime),
      },
    ]);
    setInput("");

    if (!response.shouldUseLlm) {
      return;
    }

    const shouldUseSpringStream = Boolean(assistantApiBaseUrl);
    let loadingIntervalId: number | undefined;

    if (!shouldUseSpringStream) {
      loadingIntervalId = window.setInterval(() => {
        const progress = getAssistantLoadingProgress(responseStartTime);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId && message.isLoading
              ? {
                  ...message,
                  loadingLabel: getAssistantLoadingLabel(progress, response.mode),
                  loadingProgress: progress,
                }
              : message,
          ),
        );
      }, 450);
      loadingIntervalsRef.current.push(loadingIntervalId);
    }

    const clearLoadingInterval = () => {
      if (loadingIntervalId === undefined) {
        return;
      }

      window.clearInterval(loadingIntervalId);
      loadingIntervalsRef.current = loadingIntervalsRef.current.filter((id) => id !== loadingIntervalId);
    };

    const llmResponsePromise = shouldUseSpringStream
      ? getStreamingLlmAssistantResponse(trimmedValue, response, assistantMessageId)
      : getLlmAssistantResponse(trimmedValue, response);

    llmResponsePromise
      .then((llmResponse) => {
        clearLoadingInterval();
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  actions: llmResponse.actions,
                  citations: llmResponse.citations,
                  followUps: llmResponse.followUps,
                  isLoading: false,
                  links: llmResponse.links,
                  loadingLabel: undefined,
                  loadingProgress: undefined,
                  responseTimeMs: getAssistantElapsedMs(responseStartTime),
                  text: llmResponse.text,
                }
              : message,
          ),
        );
      })
      .catch(() => {
        clearLoadingInterval();
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  actions: response.actions,
                  citations: response.citations,
                  followUps: response.followUps,
                  isLoading: false,
                  links: response.links,
                  loadingLabel: undefined,
                  loadingProgress: undefined,
                  responseTimeMs: getAssistantElapsedMs(responseStartTime),
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

  const toggleAssistant = () => {
    setIsOpen((open) => !open);
  };
  const shouldShowQuickPrompts = messages.length === 1;

  return (
    <div
      className={`site-assistant${isOpen ? " is-open" : ""}${isSuppressed ? " is-suppressed" : ""}`}
    >
      <button
        className="assistant-launcher"
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close portfolio assistant" : "Open portfolio assistant"}
        onClick={toggleAssistant}
      >
        <AssistantChatIcon />
      </button>

      <section
        className="assistant-panel"
        aria-label="Portfolio assistant"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="assistant-header">
          <div
            className="assistant-drag-region"
            aria-label="Assistant title"
          >
            <span className="assistant-avatar" aria-hidden="true">
              <img src="/profile-avatar.png" alt="" />
              <span className="assistant-online-dot" />
            </span>
            <div className="assistant-title">
              <h2>
                Sai&apos;s Assistant <span className="assistant-beta-badge">BETA</span>
              </h2>
              <p>Always here to help</p>
            </div>
          </div>
          <div className="assistant-header-actions">
            <button
              className="assistant-clear"
              type="button"
              aria-label="Restart assistant chat"
              onClick={clearAssistantChat}
            >
              <AssistantRefreshIcon />
            </button>
            <button
              className="assistant-close"
              type="button"
              aria-label="Close assistant"
              onClick={() => setIsOpen(false)}
            >
              <AssistantCloseIcon />
            </button>
          </div>
        </div>

        <div className="assistant-body">
          <div className="assistant-messages" ref={messagesRef} aria-live="polite">
            {messages.map((message) => (
              <article className={`assistant-message is-${message.role}`} key={message.id}>
                {message.role === "assistant" ? (
                  <span className="assistant-message-avatar" aria-hidden="true">
                    <img src="/profile-avatar.png" alt="" />
                  </span>
                ) : null}
                <div className="assistant-message-bubble">
                  <p>{renderAssistantText(message.text)}</p>
                  {message.isLoading && typeof message.loadingProgress === "number" ? (
                    <div className="assistant-loading-progress" aria-label="Assistant response progress">
                      <div>
                        <span>{message.loadingLabel ?? "Working"}</span>
                        <strong>{message.loadingProgress}%</strong>
                      </div>
                      <span className="assistant-loading-track">
                        <i style={{ width: `${message.loadingProgress}%` }} />
                      </span>
                    </div>
                  ) : null}
                  {message.role === "assistant" && typeof message.responseTimeMs === "number" ? (
                    <small className="assistant-response-time">
                      Time taken: {formatAssistantResponseTime(message.responseTimeMs)}
                    </small>
                  ) : null}
                  {message.citations?.length ? (
                    <div className="assistant-link-group">
                      <span>Sources</span>
                      <div className="assistant-links">
                        {message.citations.map((link) => (
                          <a
                            href={link.href}
                            key={`${message.id}-source-${link.label}`}
                            target={link.external ? "_blank" : undefined}
                            rel={link.external ? "noreferrer" : undefined}
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
                    </div>
                  ) : null}
                  {(message.actions ?? message.links)?.length ? (
                    <div className="assistant-link-group">
                      <span>Actions</span>
                      <div className="assistant-links">
                        {(message.actions ?? message.links)?.map((link) => (
                          <a
                            href={link.href}
                            key={`${message.id}-action-${link.label}`}
                            target={link.external ? "_blank" : undefined}
                            rel={link.external ? "noreferrer" : undefined}
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
                    </div>
                  ) : null}
                  {message.role === "assistant" && message.followUps?.length ? (
                    <div className="assistant-followups">
                      <span>Follow-up</span>
                      <div>
                        {message.followUps.map((followUp) => (
                          <button
                            type="button"
                            key={`${message.id}-followup-${followUp}`}
                            onClick={() => sendAssistantMessage(followUp)}
                          >
                            {followUp}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {shouldShowQuickPrompts ? (
            <div className="assistant-prompts" aria-label="Suggested assistant prompts">
              {quickPrompts.map((prompt, index) => (
                <button
                  className={index === 0 ? "is-active" : undefined}
                  type="button"
                  key={prompt.label}
                  onClick={() => sendAssistantMessage(prompt.prompt)}
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <form className="assistant-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            placeholder="Ask about Sai, projects, blogs, or AI..."
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
      aria-busy={isBusy}
      aria-label={`${isSaved ? "Remove" : "Save"} ${post.title}`}
      aria-pressed={isSaved}
      disabled={isBusy}
      onClick={() => onToggle(post)}
    >
      <ReaderMenuGlyph type="bookmark" />
      {isBusy && !isSaved ? "Updating..." : isSaved ? "Saved" : "Save post"}
    </button>
  );
}

type SaveAiRadarButtonProps = {
  className?: string;
  isBusy: boolean;
  isSaved: boolean;
  onToggle: () => void;
  subscriberUser: User | null;
};

function SaveAiRadarButton({
  className = "",
  isBusy,
  isSaved,
  onToggle,
  subscriberUser,
}: SaveAiRadarButtonProps) {
  const buttonClassName = `save-post-button save-radar-button${className ? ` ${className}` : ""}${
    isSaved ? " is-saved" : ""
  }`;

  if (!subscriberUser) {
    return (
      <a className={buttonClassName} href="/signin?return=ai-radar">
        Sign in to save
      </a>
    );
  }

  return (
    <button
      className={buttonClassName}
      type="button"
      aria-busy={isBusy}
      aria-label={isSaved ? "Remove AI Radar item from saved posts" : "Save AI Radar item"}
      aria-pressed={isSaved}
      disabled={isBusy}
      onClick={onToggle}
    >
      <ReaderMenuGlyph type="bookmark" />
      {isBusy && !isSaved ? "Saving..." : isSaved ? "Saved" : "Save"}
    </button>
  );
}

type ReaderMenuProps = {
  isOpen: boolean;
  isSignedIn: boolean;
  savedItemCount: number;
  subscriberName: string;
  onClose: () => void;
};

function ReaderMenu({
  isOpen,
  isSignedIn,
  savedItemCount,
  subscriberName,
  onClose,
}: ReaderMenuProps) {
  const savedPostLabel = `${savedItemCount} ${savedItemCount === 1 ? "saved item" : "saved items"}`;
  const readerLinks = [
    { href: "/", icon: "home" as const, label: "Home" },
    {
      href: isSignedIn ? "/saved-posts" : getSavedPostsSignInHref(),
      icon: "bookmark" as const,
      label: "Saved Posts",
    },
    { href: "/learn-with-me", icon: "spark" as const, label: "Learn With Me" },
    { href: "/whats-new", icon: "news" as const, label: "What's New" },
    { href: "/shelf", icon: "shelf" as const, label: "Sai's Shelf" },
    { href: "/work-with-me", icon: "mail" as const, label: "Work With Me" },
    { href: "/about", icon: "about" as const, label: "About" },
  ];

  return (
    <div
      className={`reader-menu${isOpen ? " is-open" : ""}`}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
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

      <div className="profile-menu-panel" role="menu" aria-hidden={!isOpen} inert={!isOpen}>
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
          <p className="status-message is-warning" role="status">
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
          <p className="status-message is-success" role="status">{subscriptionMessage}</p>
        ) : null}
        {subscriptionError ? (
          <p className="status-message is-error" role="alert">{subscriptionError}</p>
        ) : null}
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
        <p className="status-message is-warning" role="status">
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
        <p className="status-message is-warning" role="status">
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
        <p className="status-message is-success" role="status">{subscriptionMessage}</p>
      ) : null}
      {subscriptionError ? (
        <p className="status-message is-error" role="alert">{subscriptionError}</p>
      ) : null}
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
  onTrackBlogOpen: (post: BlogPost, source: string) => void;
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
  onTrackBlogOpen,
  onToggleSavedPost,
}: BlogIndexSectionProps) {
  return (
    <section className="section shell blog-section" id="blogs">
      <SectionHeading
        eyebrow="Blogs"
        title="Engineering notes, kept easy to scan."
        description="Short reads on backend performance, search architecture, and practical AI systems."
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
              <BlogMetaLine
                accessLabel={featuredBlogIsLocked ? "Members only" : "Unlocked"}
                post={featuredBlog}
              />
              <h3>
                {featuredBlogIsLocked ? (
                  <span>{featuredBlog.title}</span>
                ) : (
                  <a
                    href={getBlogArticleHref(featuredBlog.slug)}
                    target="_blank"
                    rel="opener"
                    onClick={() => onTrackBlogOpen(featuredBlog, "featured_title")}
                  >
                    {featuredBlog.title}
                  </a>
                )}
              </h3>
              <p>{getBlogCardSummary(featuredBlog)}</p>
              <BlogTagList post={featuredBlog} />
              {featuredBlogIsLocked ? <BlogLockNote /> : null}
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
                    onClick={() => onTrackBlogOpen(featuredBlog, "featured_cta")}
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
                    <BlogMetaLine accessLabel={isLocked ? "Members only" : "Unlocked"} post={post} />
                    <h3>
                      {isLocked ? (
                        <span>{post.title}</span>
                      ) : (
                        <a
                          href={getBlogArticleHref(post.slug)}
                          target="_blank"
                          rel="opener"
                          onClick={() => onTrackBlogOpen(post, "list_title")}
                        >
                          {post.title}
                        </a>
                      )}
                    </h3>
                    <p>{getBlogCardSummary(post)}</p>
                    <BlogTagList post={post} />
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
                        onClick={() => onTrackBlogOpen(post, "list_cta")}
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
      trackAnalyticsEvent("newsletter_subscribe", {
        source: payload.alreadySubscribed ? "newsletter_existing_email" : "newsletter_email",
        title: "Newsletter",
      });
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
          <p
            className={`newsletter-status is-${newsletterStatus}`}
            role={newsletterStatus === "error" ? "alert" : "status"}
          >
            {newsletterMessage}
          </p>
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

type HomePageProps = Pick<
  BlogIndexSectionProps,
  | "featuredBlog"
  | "isPostSaved"
  | "remainingBlogPosts"
  | "savedPostsBusySlug"
  | "subscriberUser"
  | "onTrackBlogOpen"
  | "onToggleSavedPost"
>;

function HomePage({
  featuredBlog,
  isPostSaved,
  remainingBlogPosts,
  savedPostsBusySlug,
  subscriberUser,
  onTrackBlogOpen,
  onToggleSavedPost,
}: HomePageProps) {
  const [homeRadarSignals, setHomeRadarSignals] = useState<AiRadarSignal[]>(
    aiRadarSignals.slice(0, 5),
  );
  const [homeRadarStatus, setHomeRadarStatus] = useState<"loading" | "live" | "fallback">(
    "loading",
  );
  const [homeRadarActiveIndex, setHomeRadarActiveIndex] = useState(0);
  const homeLanes = [
    {
      cta: "View work",
      detail: "Projects, skills, role story, and proof.",
      href: "/portfolio",
      icon: "briefcase" as const,
      meta: "Work",
      title: "Portfolio",
    },
    {
      cta: "Read notes",
      detail: "Backend lessons with clean diagrams.",
      href: "/blogs",
      icon: "pen" as const,
      meta: `${blogPosts.length} field notes`,
      title: "Blogs",
    },
    {
      cta: "Scan updates",
      detail: "AI stories worth tracking today.",
      href: "/ai-radar",
      icon: "radar" as const,
      meta: "Live signals",
      title: "AI Radar",
    },
    {
      cta: "Open cockpit",
      detail: "Content, analytics, and saved signals.",
      href: "/dashboard",
      icon: "news" as const,
      meta: "Dashboard",
      title: "Dashboard",
    },
  ];
  const homeProof = [
    { label: "Batch runs", value: metrics[0]?.value ?? "97%", text: "2h 5m to 3m" },
    { label: "Real-time path", value: metrics[1]?.value ?? "85%", text: "2s to 300ms" },
    { label: "Runtime scale", value: metrics[2]?.value ?? "100+ TPS", text: "Sub-2.5s latency" },
  ];
  const homeWritingPreview = [featuredBlog, ...remainingBlogPosts]
    .filter((post): post is BlogPost => Boolean(post))
    .slice(0, 3);
  const latestUpdate = getRecentSiteUpdates(siteUpdates)[0];
  const homeRadarPreviewSignals = (homeRadarSignals.length ? homeRadarSignals : aiRadarSignals).slice(
    0,
    5,
  );
  const homeRadarActiveSignal =
    homeRadarPreviewSignals[homeRadarActiveIndex % homeRadarPreviewSignals.length] ??
    aiRadarSignals[0];

  useEffect(() => {
    let isCurrent = true;

    const loadHomeRadar = async () => {
      setHomeRadarStatus("loading");

      try {
        const response = await fetch("/api/ai-radar?limit=7&surface=home", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("AI Radar feed is unavailable.");
        }

        const nextSignals = normalizeAiRadarApiItems((await response.json()) as AiRadarApiResponse);

        if (!isCurrent) {
          return;
        }

        if (nextSignals.length) {
          setHomeRadarSignals(nextSignals);
          setHomeRadarStatus("live");
        } else {
          setHomeRadarSignals(aiRadarSignals.slice(0, 5));
          setHomeRadarStatus("fallback");
        }
      } catch {
        if (!isCurrent) {
          return;
        }

        setHomeRadarSignals(aiRadarSignals.slice(0, 5));
        setHomeRadarStatus("fallback");
      }
    };

    loadHomeRadar();

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    setHomeRadarActiveIndex(0);
  }, [homeRadarSignals]);

  useEffect(() => {
    if (homeRadarPreviewSignals.length <= 1) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setHomeRadarActiveIndex((index) => (index + 1) % homeRadarPreviewSignals.length);
    }, 4600);

    return () => window.clearInterval(intervalId);
  }, [homeRadarPreviewSignals.length]);

  return (
    <>
      <section className="home-hero shell" id="top">
        <div className="home-hero-copy">
          <p className="eyebrow">Backend Systems / AI Search / Performance</p>
          <h1>Hey, Sai here.</h1>
          <p className="home-hero-lede">
            I build reliable backend systems, search workflows, and practical AI experiments for
            high-volume products.
          </p>

          <div className="home-hero-actions">
            <a className="button button-primary" href="/portfolio">
              View portfolio
            </a>
            <a className="button button-secondary" href="/work-with-me">
              Work with me
            </a>
            <a className="home-text-link" href="/blogs">
              Read engineering notes
            </a>
          </div>

          <div className="home-trust-strip" aria-label="Core strengths">
            <a href="/active-builds">Active builds</a>
            <a href="/learn-with-me">Learn with me</a>
          </div>
        </div>

        <aside
          className="home-radar-board"
          aria-label="AI Radar live preview"
          style={getAiRadarVisualStyle(homeRadarActiveSignal)}
        >
          <article className="home-radar-briefing-card">
            <div className="home-radar-briefing-top">
              <span className="home-radar-live-pill">
                <span aria-hidden="true" />
                {homeRadarStatus === "live" ? "Live Radar" : "Curated Radar"}
              </span>
              <a href="/ai-radar">Open radar</a>
            </div>

            <div className="home-radar-briefing-body" aria-live="polite">
              <div className="home-radar-briefing-art" aria-hidden="true">
                {homeRadarActiveSignal.imageUrl ? (
                  <img
                    src={homeRadarActiveSignal.imageUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <AiRadarSourceMark className="is-large" source={homeRadarActiveSignal.source} />
                )}
              </div>

              <div className="home-radar-briefing-copy">
                <div className="home-radar-briefing-meta">
                  <span>
                    {String((homeRadarActiveIndex % homeRadarPreviewSignals.length) + 1).padStart(
                      2,
                      "0",
                    )}
                    /{String(homeRadarPreviewSignals.length).padStart(2, "0")}
                  </span>
                  <AiRadarSourceBadge source={homeRadarActiveSignal.source} />
                  <span>{homeRadarActiveSignal.category}</span>
                </div>
                <h2>{homeRadarActiveSignal.title}</h2>
                <p>{homeRadarActiveSignal.summary || homeRadarActiveSignal.whyItMatters}</p>
                <div className="home-radar-briefing-actions">
                  <AiRadarFreshness
                    className="home-radar-feed-freshness"
                    publishedAt={homeRadarActiveSignal.publishedAt}
                  />
                  <a
                    href={homeRadarActiveSignal.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      trackAnalyticsEvent("ai_radar_open", {
                        category: homeRadarActiveSignal.category,
                        source: "home_rotating_card",
                        title: homeRadarActiveSignal.title,
                      })
                    }
                  >
                    Read signal
                  </a>
                </div>
              </div>
            </div>

            <div className="home-radar-briefing-controls" aria-label="Top AI Radar stories">
              {homeRadarPreviewSignals.map((signal, index) => (
                <button
                  className={
                    index === homeRadarActiveIndex % homeRadarPreviewSignals.length
                      ? "is-active"
                      : ""
                  }
                  key={`${signal.source}-${signal.href}`}
                  type="button"
                  aria-label={`Show AI Radar story ${index + 1}`}
                  onClick={() => setHomeRadarActiveIndex(index)}
                />
              ))}
            </div>
          </article>
        </aside>
      </section>

      <section className="home-section shell home-lanes" id="about">
        <div className="home-section-heading">
          <p className="eyebrow">Start Fast</p>
          <h2>Get value in the first five minutes.</h2>
          <p>
            Pick a lane based on what you need: proof of work, backend notes, AI updates, or a quick
            view of what is active.
          </p>
        </div>

        <div className="home-lane-grid">
          {homeLanes.map((lane) => (
            <article className="home-lane-card" key={lane.title}>
              <div className="home-lane-icon">
                <ReaderMenuGlyph type={lane.icon} />
              </div>
              <span>{lane.meta}</span>
              <h3>{lane.title}</h3>
              <p>{lane.detail}</p>
              <a href={lane.href}>{lane.cta}</a>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section shell home-proof">
        <div className="home-proof-copy">
          <p className="eyebrow">Current Signal</p>
          <h2>Backend work with measurable outcomes.</h2>
          <p>Performance, search quality, and reliability.</p>
        </div>

        <div className="home-proof-grid">
          {homeProof.map((item) => (
            <article className="home-proof-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section shell home-work-preview">
        <div className="home-work-card">
          <p className="eyebrow">Featured Build</p>
          <h2>{projects[0]?.name}</h2>
          <p>{projects[0]?.summary}</p>
          <div className="home-stack-row" aria-label="Featured project stack">
            {projects[0]?.stack.slice(0, 5).map((item) => <span key={item}>{item}</span>)}
          </div>
          <a className="button button-primary" href="/portfolio#work">
            Explore selected work
          </a>
        </div>

        <div className="home-update-card">
          <div className="home-update-visual" aria-hidden="true">
            <div className="home-radar-orbit">
              <span className="home-radar-dot is-one" />
              <span className="home-radar-dot is-two" />
              <span className="home-radar-dot is-three" />
              <strong>AI</strong>
            </div>
            <div className="home-update-sources">
              <span>Official sources</span>
              <span>Curated notes</span>
              <span>Safe links</span>
            </div>
          </div>
          <p className="eyebrow">Latest Update</p>
          <h3>{latestUpdate?.title ?? "Fresh updates are coming"}</h3>
          <p>{latestUpdate?.summary ?? "New engineering notes and site updates will appear here."}</p>
          <a href={latestUpdate?.href ?? "/whats-new"}>Open what's new</a>
        </div>
      </section>

      <section className="home-section shell home-writing">
        <div className="home-section-heading">
          <p className="eyebrow">Latest Notes</p>
          <h2>Short reads. Real systems.</h2>
          <p>Backend notes with diagrams, metrics, and practical takeaways.</p>
        </div>

        <div className="home-writing-carousel-card">
          <div className="home-writing-carousel-top">
            <div>
              <span>Engineering blog</span>
              <strong>{blogPosts.length} practical notes</strong>
            </div>
            <a href="/blogs">View all</a>
          </div>

          <div className="home-writing-carousel-window" aria-label="Latest blog previews">
            <div
              className={`home-writing-carousel-track${
                homeWritingPreview.length > 2 ? " is-animated" : ""
              }`}
            >
              {homeWritingPreview.map((post) => {
                const isLocked = !canReadBlogPost(post, subscriberUser);

                return (
                  <article
                    className={`home-writing-row${isLocked ? " is-locked" : ""}`}
                    key={post.slug}
                  >
                    <div className="home-writing-row-copy">
                      <BlogMetaLine accessLabel={isLocked ? "Members only" : "Unlocked"} post={post} />
                      <h3>{post.title}</h3>
                      <p>{getBlogCardSummary(post)}</p>
                    </div>
                    <div className="home-writing-row-actions">
                      {isLocked ? (
                        <a href={getSignInHref(post.slug)} target="_blank" rel="opener">
                          Unlock
                        </a>
                      ) : (
                        <>
                          <a
                            href={getBlogArticleHref(post.slug)}
                            target="_blank"
                            rel="opener"
                            onClick={() => onTrackBlogOpen(post, "home_preview")}
                          >
                            Read
                          </a>
                          <SavePostButton
                            isBusy={savedPostsBusySlug === post.slug}
                            isSaved={isPostSaved(post.slug)}
                            post={post}
                            subscriberUser={subscriberUser}
                            onToggle={onToggleSavedPost}
                          />
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className="home-writing-footer">
          <a className="button button-secondary" href="/blogs">
            View all blogs
          </a>
          <a className="home-text-link" href="#newsletter">
            Get updates
          </a>
        </div>
      </section>

      <section className="home-section shell home-final-cta">
        <p className="eyebrow">Work With Me</p>
        <h2>Have a backend, search, performance, or AI workflow problem worth untangling?</h2>
        <p>
          Bring the messy system, the slow path, or the idea that needs sharper architecture. I will
          meet it with practical engineering, clear thinking, and a bias toward measurable outcomes.
        </p>
        <div className="home-hero-actions">
          <a className="button button-primary" href="/work-with-me">
            Start a conversation
          </a>
          <a className="button button-secondary" href={profile.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </section>
    </>
  );
}

type StartHerePageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function StartHerePage({ theme, onThemeToggle }: StartHerePageProps) {
  const siteSnapshot = [
    { label: "Career proof", value: "Portfolio" },
    { label: "Engineering notes", value: String(blogPosts.length) },
    { label: "Live build", value: "AI Bot" },
    { label: "Reader tools", value: "Saved + Updates" },
  ];
  const primaryDestinations: Array<{
    detail: string;
    href: string;
    icon: ReaderMenuGlyphType;
    label: string;
  }> = [
    {
      detail: "Experience, projects, skills, credentials.",
      href: "/portfolio",
      icon: "briefcase",
      label: "Portfolio",
    },
    {
      detail: "Technical notes with diagrams.",
      href: "/blogs",
      icon: "pen",
      label: "Blogs",
    },
    {
      href: "/ai-radar",
      icon: "radar",
      detail: "Fresh AI updates from trusted sources.",
      label: "AI Radar",
    },
    {
      detail: "Current systems being built.",
      href: "/active-builds",
      icon: "spark",
      label: "Active Builds",
    },
    {
      detail: "Site activity and content signals.",
      href: "/dashboard",
      icon: "dashboard",
      label: "Dashboard",
    },
    {
      detail: "Collaboration, email, LinkedIn.",
      href: "/work-with-me",
      icon: "mail",
      label: "Work With Me",
    },
  ];
  const featureSections: Array<{
    accent: string;
    href: string;
    icon: ReaderMenuGlyphType;
    items: Array<{ detail: string; href?: string; name: string }>;
    label: string;
    title: string;
  }> = [
    {
      accent: "is-coral",
      href: "/portfolio",
      icon: "briefcase",
      label: "Professional Profile",
      title: "Proof of work and career story",
      items: [
        { detail: "Short intro and engineering focus.", href: "/", name: "Home overview" },
        { detail: "Role, company, and professional summary.", href: "/about", name: "About" },
        { detail: "Current and past role context.", href: "/portfolio#experience", name: "Experience" },
        { detail: "Backend, search, AI, and performance work.", href: "/portfolio#work", name: "Projects" },
        { detail: "Java, Spring, Oracle, cloud, search, AI.", href: "/portfolio#skills", name: "Tech stack" },
        { detail: "Awards and professional recognition.", href: "/portfolio#recognition", name: "Recognition" },
        { detail: "Education, CGPA, certifications.", href: "/portfolio#credentials", name: "Credentials" },
      ],
    },
    {
      accent: "is-blue",
      href: "/blogs",
      icon: "pen",
      label: "Writing",
      title: "Engineering notes and reading flow",
      items: [
        { detail: "All articles in one clean index.", href: "/blogs", name: "Blog library" },
        { detail: "Only the selected article opens.", href: "/blogs", name: "Dedicated article pages" },
        { detail: "One public article, deeper reads for members.", href: "/blogs", name: "Locked and unlocked reads" },
        { detail: "Progress bar and time remaining while reading.", href: "/blogs", name: "Reading progress" },
        { detail: "Architecture visuals inside blogs.", href: "/blogs", name: "Quality diagrams" },
        { detail: "Categories, related posts, and save actions.", href: "/blogs", name: "Tags and saved posts" },
      ],
    },
    {
      accent: "is-sage",
      href: "/ai-radar",
      icon: "radar",
      label: "AI + Builds",
      title: "AI radar, assistant, and active systems",
      items: [
        { detail: "Curated AI stories from official sources.", href: "/ai-radar", name: "AI Radar" },
        { detail: "Published date and freshness signals.", href: "/ai-radar", name: "Freshness labels" },
        { detail: "Save AI stories into your reading shelf.", href: "/ai-radar", name: "Save AI Radar posts" },
        { detail: "Current systems with dedicated subpages.", href: "/active-builds", name: "Active Builds" },
        { detail: "Architecture behind the site assistant.", href: "/active-builds/sai-assistant", name: "Sai's Assistant build" },
        { detail: "Password-protected learning lab.", href: "/learn-with-me", name: "Learn With Me" },
        { detail: "Useful resources planned for future use.", href: "/shelf", name: "Sai's Shelf" },
      ],
    },
    {
      accent: "is-gold",
      href: "/signin",
      icon: "bookmark",
      label: "Reader System",
      title: "Personalized reading and updates",
      items: [
        { detail: "Sign in without creating a password here.", href: "/signin", name: "Google sign-in" },
        { detail: "Save blogs and AI Radar stories.", href: "/saved-posts", name: "Saved Posts" },
        { detail: "Tag filters for saved content.", href: "/saved-posts", name: "Saved-post tags" },
        { detail: "Selected updates sent by email.", href: "#newsletter", name: "Newsletter" },
        { detail: "Clean subscribe and unsubscribe states.", href: "/signin", name: "Subscriber controls" },
        { detail: "Recent site changes in one place.", href: "/whats-new", name: "What's New" },
      ],
    },
    {
      accent: "is-plum",
      href: "/dashboard",
      icon: "dashboard",
      label: "Utilities",
      title: "Navigation, metrics, and support features",
      items: [
        { detail: "Left-side reader menu for fast movement.", href: "/", name: "Reader menu" },
        { detail: "Compact header with More menu.", href: "/", name: "Main navigation" },
        { detail: "Light and dark Redwood-inspired themes.", href: "/", name: "Theme toggle" },
        { detail: "Content, analytics, and site signals.", href: "/dashboard", name: "Dashboard" },
        { detail: "Ask about the site or tech concepts.", href: "/", name: "Sai's Bot" },
        { detail: "Every subpage keeps Home and Back.", href: "/", name: "Home and Back flow" },
        { detail: "Designed for desktop and mobile browsing.", href: "/", name: "Responsive layout" },
        { detail: "Email and LinkedIn collaboration path.", href: "/work-with-me", name: "Work With Me" },
      ],
    },
  ];
  const suggestedPath: Array<{ href: string; label: string; text: string }> = [
    {
      href: "/portfolio",
      label: "First 2 minutes",
      text: "Open Portfolio for the professional story.",
    },
    {
      href: "/blogs",
      label: "Next 5 minutes",
      text: "Read one engineering note with diagrams.",
    },
    {
      href: "/active-builds",
      label: "After that",
      text: "Explore Active Builds and AI Radar.",
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

      <main className="guide-page start-page shell" id="main-content">
        <section className="start-hero">
          <div>
            <p className="eyebrow">Start Here</p>
            <h1>What this website offers, at a glance.</h1>
            <p>
              A guided map for portfolio proof, engineering notes, AI updates, active builds,
              reader tools, and ways to connect.
            </p>
            <div className="start-hero-actions">
              <a className="button button-primary" href="/portfolio">
                View portfolio
              </a>
              <a className="button button-secondary" href="/blogs">
                Read blogs
              </a>
            </div>
          </div>

          <div className="start-snapshot" aria-label="Website snapshot">
            {siteSnapshot.map((stat) => (
              <span key={stat.label}>
                <strong>{stat.value}</strong>
                {stat.label}
              </span>
            ))}
          </div>
        </section>

        <section className="start-destination-strip" aria-label="Primary destinations">
          {primaryDestinations.map((destination) => (
            <a href={destination.href} key={destination.label}>
              <ReaderMenuGlyph type={destination.icon} />
              <span>
                <strong>{destination.label}</strong>
                <small>{destination.detail}</small>
              </span>
            </a>
          ))}
        </section>

        <section className="start-feature-directory" aria-labelledby="site-feature-directory">
          <div className="start-section-heading">
            <p className="eyebrow">Website Directory</p>
            <h2 id="site-feature-directory">Every feature, grouped by what visitors need.</h2>
            <p>Scan the list, open what matters, and come back anytime from the header.</p>
          </div>

          <div className="start-feature-sections">
            {featureSections.map((section) => (
              <section className={`start-feature-section ${section.accent}`} key={section.title}>
                <div className="start-feature-section-head">
                  <span>
                    <ReaderMenuGlyph type={section.icon} />
                  </span>
                  <div>
                    <p>{section.label}</p>
                    <h3>{section.title}</h3>
                  </div>
                  <a href={section.href}>Open</a>
                </div>

                <div className="start-feature-list">
                  {section.items.map((item) => (
                    <a href={item.href ?? section.href} key={item.name}>
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="start-path-panel">
          <div>
            <p className="eyebrow">Suggested Path</p>
            <h2>If you are new here, use this route.</h2>
          </div>

          <div className="start-path-list">
            {suggestedPath.map((step, index) => (
              <a href={step.href} key={step.label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.label}</strong>
                <small>{step.text}</small>
              </a>
            ))}
          </div>
        </section>

        <section className="mini-updates-panel start-updates-panel">
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

type LearnWithMePageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function getStoredLearnAccess() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(LEARN_ACCESS_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

function LearnWithMePage({ theme, onThemeToggle }: LearnWithMePageProps) {
  const [accessGranted, setAccessGranted] = useState(getStoredLearnAccess);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const learningTracks = [
    {
      detail:
        "Short, beginner-friendly explainers for distributed systems, databases, networking, and core CS ideas.",
      icon: "spark" as const,
      label: "Track 01",
      title: "Back to Basics",
    },
    {
      detail:
        "Practical notes on latency, caching, indexing, async processing, and production backend tradeoffs.",
      icon: "briefcase" as const,
      label: "Track 02",
      title: "Backend Performance",
    },
    {
      detail:
        "Simple breakdowns of matching, ranking, semantic retrieval, scoring, and search-heavy architecture.",
      icon: "radar" as const,
      label: "Track 03",
      title: "Search Systems",
    },
    {
      detail:
        "Hands-on AI workflow ideas with clear boundaries, useful automation, and real engineering context.",
      icon: "news" as const,
      label: "Track 04",
      title: "Practical AI",
    },
  ];
  const learningFlow = [
    "Understand the concept",
    "See a real scenario",
    "Connect it to system design",
    "Apply it in a small build",
  ];

  const handleLearnAccessSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = accessPassword.trim();

    setAccessError("");
    setAccessMessage("");

    if (!password) {
      setAccessError("Please enter the access password.");
      return;
    }

    setAccessBusy(true);

    try {
      const response = await fetch("/api/learn-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAccessError(
          typeof payload.error === "string"
            ? payload.error
            : "Unable to verify the password right now.",
        );
        return;
      }

      try {
        window.sessionStorage.setItem(LEARN_ACCESS_STORAGE_KEY, "granted");
      } catch {
        // Session storage is a convenience only; access still opens for the current render.
      }

      setAccessGranted(true);
      setAccessPassword("");
      setAccessMessage("Access granted. Welcome in.");
    } catch {
      setAccessError("Network hiccup. Please try the password again in a moment.");
    } finally {
      setAccessBusy(false);
    }
  };

  const handleLearnAccessLogout = () => {
    try {
      window.sessionStorage.removeItem(LEARN_ACCESS_STORAGE_KEY);
    } catch {
      // If storage is blocked, still lock the room for the current render.
    }

    setAccessGranted(false);
    setAccessPassword("");
    setAccessError("");
    setAccessMessage("Learn With Me is locked again. Password required to reopen.");
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to learn with me
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>Learn with me</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref="/" label="Back" />
            {accessGranted ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={handleLearnAccessLogout}
              >
                Logout
              </button>
            ) : null}
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

      <main className="guide-page learn-page shell" id="main-content">
        {!accessGranted ? (
          <section className="learn-access-panel" aria-labelledby="learn-access-title">
            <div className="learn-access-copy">
              <p className="eyebrow">Protected Learning Room</p>
              <h1 id="learn-access-title">Enter the password to open Learn With Me.</h1>
              <p>
                This space is reserved for selected learning notes, experiments, and early drafts.
                Once the password is verified, the room opens for this browser session.
              </p>
            </div>

            <form className="learn-access-card" onSubmit={handleLearnAccessSubmit}>
              <div className="guide-feature-icon">
                <ReaderMenuGlyph type="spark" />
              </div>
              <label htmlFor="learn-access-password">
                <span>Access password</span>
                <input
                  id="learn-access-password"
                  type="password"
                  value={accessPassword}
                  autoComplete="current-password"
                  placeholder="Enter password"
                  onChange={(event) => {
                    setAccessPassword(event.target.value);
                    setAccessError("");
                    setAccessMessage("");
                  }}
                />
              </label>
              <button className="button button-primary" type="submit" disabled={accessBusy}>
                {accessBusy ? "Checking..." : "Unlock Learn With Me"}
              </button>
              {accessError ? (
                <p className="status-message is-error" role="alert">
                  {accessError}
                </p>
              ) : null}
              {accessMessage ? (
                <p className="status-message is-success" role="status">
                  {accessMessage}
                </p>
              ) : null}
            </form>
          </section>
        ) : (
          <>
            <section className="guide-hero learn-hero">
              <p className="eyebrow">Learn With Me</p>
              <h1>Small lessons for strong computer science foundations.</h1>
              <p>
                A learning space for simple, practical explanations of backend systems, CS
                fundamentals, search architecture, and AI workflows. The goal is clarity first,
                depth next.
              </p>
            </section>

            <section className="learn-track-grid" aria-label="Learning tracks">
              {learningTracks.map((track) => (
                <article className="learn-track-card" key={track.title}>
                  <div className="guide-feature-icon">
                    <ReaderMenuGlyph type={track.icon} />
                  </div>
                  <span>{track.label}</span>
                  <h2>{track.title}</h2>
                  <p>{track.detail}</p>
                </article>
              ))}
            </section>

            <section className="learn-flow-panel" aria-label="Learning format">
              <div>
                <p className="eyebrow">Format</p>
                <h2>Each topic will stay simple, visual, and useful.</h2>
                <p>
                  I will keep this section friendly for new learners while still connecting concepts
                  to real backend engineering work.
                </p>
              </div>
              <ol>
                {learningFlow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </>
        )}
      </main>
    </>
  );
}

type ActiveBuildsPageProps = {
  activeBuildSlug?: string;
  theme: Theme;
  onThemeToggle: () => void;
};

function ActiveBuildsPage({ activeBuildSlug = "", theme, onThemeToggle }: ActiveBuildsPageProps) {
  const isSaiAssistantBuildPage = activeBuildSlug === "sai-assistant";
  const assistantSignals = [
    { label: "Frontend", value: "Vercel UI" },
    { label: "Backend", value: "Spring RAG" },
    { label: "Retrieval", value: "Hybrid Search" },
  ];
  const ragPipelineCards = [
    {
      detail:
        "The floating React panel captures the visitor message, session id, and recent chat history, then sends one clean request to the managed assistant service.",
      endpoint: "Browser request",
      title: "Chat UI bridge",
      tone: "is-blue",
    },
    {
      detail:
        "Admin refresh loads curated portfolio knowledge, chunks it by section, creates normalized Gemini document vectors, and stores each record with metadata.",
      endpoint: "Protected refresh",
      title: "Offline ingestion",
      tone: "is-coral",
    },
    {
      detail:
        "Visitor questions run through semantic vector search and exact text search, then Spring applies rule-based reranking before the model answers from grounded context.",
      endpoint: "Grounded response",
      title: "Online chat",
      tone: "is-sage",
    },
  ];
  const activeBuildCards = [
    {
      description:
        "Website knowledge base, smart routing, LLM support, source chips, and guided actions.",
      href: "/active-builds/sai-assistant",
      status: "Open build",
      tags: ["Live", "Assistant", "LLM"],
      title: "Tech behind Sai's Assistant",
      tone: "is-coral",
    },
    {
      description:
        "A Spring Boot platform for background jobs, distributed workers, retries, and AI-assisted failure analysis.",
      href: undefined,
      status: "Coming soon",
      tags: ["Spring Boot", "Queues", "AI Ops"],
      title: "SpringOps AI: Distributed Job Scheduler",
      tone: "is-sage",
    },
    {
      description:
        "A curated content pipeline for official AI updates, source ranking, freshness labels, and saveable reads.",
      href: undefined,
      status: "Coming soon",
      tags: ["Feeds", "Ranking", "Content"],
      title: "AI Radar Intelligence Pipeline",
      tone: "is-blue",
    },
    {
      description:
        "Train NLP models on curated text datasets with distributed workers, evaluation jobs, embeddings, and deployment-ready inference.",
      href: undefined,
      status: "Planned",
      tags: ["NLP", "Datasets", "Distributed ML"],
      title: "Distributed NLP Model Training Pipeline",
      tone: "is-gold",
    },
  ];
  const architectureFlow = [
    {
      after: "Chat UI",
      before: "Website Visitor",
      detail: "The visitor opens the floating assistant and asks about Sai, projects, blogs, contact, skills, or backend topics.",
      title: "Capture intent",
    },
    {
      after: "Managed Spring API",
      before: "Chat UI",
      detail:
        "The frontend resolves the assistant endpoint from its deployment environment and sends the request to the managed Spring service.",
      title: "Route to backend",
    },
    {
      after: "Hybrid Retrieval",
      before: "Spring API",
      detail:
        "Spring sanitizes the request, creates a retrieval-query embedding, then gathers semantic vector matches and exact text matches.",
      title: "Retrieve candidates",
    },
    {
      after: "Rule Reranker",
      before: "Hybrid Retrieval",
      detail:
        "Rule-based ranking blends exact match strength, vector similarity, metadata, title, category, section, and intent signals before choosing evidence.",
      title: "Rank evidence",
    },
    {
      after: "Groq / Gemini LLM",
      before: "Grounded Prompt",
      detail:
        "The prompt carries strict identity rules, retrieved evidence, citations, and a confidence boundary that avoids invented portfolio facts.",
      title: "Generate safely",
    },
    {
      after: "Answer + Citations",
      before: "LLM Response",
      detail: "The UI renders the answer, source chips, and links while keeping the chat session responsive.",
      title: "Render result",
    },
  ];
  const chatUiArchitecture = [
    {
      detail:
        "A fixed assistant launcher opens a compact panel with message history, suggested prompts, restart control, close control, and source chips.",
      label: "React component",
      title: "Floating chat surface",
    },
    {
      detail:
        "The browser stores only UI state and session identity. Questions are sent as JSON with sessionId, message, and optional recent history.",
      label: "Client state",
      title: "Session-aware request",
    },
    {
      detail:
        "The frontend resolves its assistant endpoint from the deployment environment, so production traffic is routed to the managed Spring service while preview and local builds can use their configured fallback path.",
      label: "Deployment switch",
      title: "Environment-based routing",
    },
    {
      detail:
        "The public chat endpoint is available only to approved portfolio origins, while ingestion and indexing operations remain behind a separate administrative authentication boundary.",
      label: "Boundary",
      title: "Public chat, protected operations",
    },
    {
      detail:
        "Spring returns answer text, citations, retrieved chunk count, timing, and follow-up prompts. The UI turns those fields into readable source links and next actions.",
      label: "Response contract",
      title: "Cited response model",
    },
    {
      detail:
        "If the backend or model is unavailable, the assistant keeps the user oriented with a safe fallback instead of pretending.",
      label: "Failure mode",
      title: "Graceful fallback",
    },
  ];
  const ingestionSteps = [
    {
      detail:
        "The admin refresh reads curated portfolio facts first, then fetches configured public site pages and extracts readable body text.",
      meta: "Structured docs + site pages",
      title: "Load sources",
    },
    {
      detail:
        "Each source is normalized, split into roughly 2.2K-character chunks, and given overlap so sentence context survives chunk boundaries.",
      meta: "Chunk size 2200, overlap 220",
      title: "Chunk content",
    },
    {
      detail:
        "The embedding input combines title, source URL, category, section, and chunk text, so the vector carries semantic meaning plus page context.",
      meta: "Title + URL + category + text",
      title: "Build embedding text",
    },
    {
      detail:
        "Gemini creates retrieval-document vectors for chunks. When using a reduced 1536-dimension output, Spring normalizes each vector before storing it.",
      meta: "Gemini document embeddings",
      title: "Create normalized vectors",
    },
    {
      detail:
        "Spring writes the chunk text, source fields, category, section, priority, loader, source kind, and vector into Oracle 23ai.",
      meta: "Oracle VECTOR + metadata",
      title: "Store index",
    },
  ];
  const retrievalSteps = [
    {
      detail:
        "The chat endpoint sanitizes the message, keeps session context, handles greetings and direct facts, and skips full retrieval for cached answers.",
      meta: "Fast path first",
      title: "Receive question",
    },
    {
      detail:
        "The question is embedded with retrieval-query intent, matching the document vectors created during ingestion.",
      meta: "Gemini query embedding",
      title: "Vectorize question",
    },
    {
      detail:
        "Spring runs semantic vector search for meaning and exact lexical search for literal matches across titles, URLs, metadata, and chunk text.",
      meta: "Exact + semantic",
      title: "Hybrid search",
    },
    {
      detail:
        "Spring merges both candidate sets, removes duplicates, then reranks with explicit rules for projects, contact, blogs, skills, credentials, experience, and location.",
      meta: "Rule-based rerank",
      title: "Rank evidence",
    },
    {
      detail:
        "If the strongest match is too weak, the backend returns a controlled no-context answer instead of sending poor evidence to the model.",
      meta: "Similarity threshold",
      title: "Guard weak matches",
    },
    {
      detail:
        "The prompt includes the user question, short history, retrieved context, identity rules, and grounding rules before the LLM writes the answer.",
      meta: "Grounded prompt",
      title: "Generate answer",
    },
  ];
  const vectorDetails = [
    {
      detail:
        "Embeddings and generation are separate jobs. Gemini creates searchable vectors; Groq or Gemini writes the final answer.",
      label: "Model boundary",
    },
    {
      detail:
        "Chunk embeddings use retrieval-document mode, while visitor questions use retrieval-query mode. That keeps both sides tuned for search.",
      label: "Document/query modes",
    },
    {
      detail:
        "1536-dimension Gemini vectors are L2-normalized before storage so cosine distance behaves consistently.",
      label: "Normalized vectors",
    },
    {
      detail:
        "Oracle semantic search returns cosine distance, while exact search pulls literal matches that vector search may not surface.",
      label: "Hybrid retrieval",
    },
    {
      detail:
        "Spring uses rule-based boosts with distance, metadata, source titles, categories, and page intent, then applies a no-answer threshold.",
      label: "Rule ranking",
    },
  ];
  const architectureFacts = [
    {
      label: "Embedding model",
      value: "Gemini retrieval embeddings",
    },
    {
      label: "Vector shape",
      value: "1536 dimensions, L2 normalized",
    },
    {
      label: "Search metric",
      value: "Exact text + cosine distance",
    },
    {
      label: "Final ranking",
      value: "Rule-based reranking",
    },
    {
      label: "Failure mode",
      value: "No-context fallback for weak matches",
    },
  ];
  const codeFlow = [
    {
      detail: "Normalize the visitor message, cap question length, preserve session id, and check instant/cache paths.",
      title: "Sanitize + cache",
    },
    {
      detail: "Create a normalized retrieval-query vector using the configured embedding provider.",
      title: "Embed query",
    },
    {
      detail: "Fetch semantic vector candidates and exact text candidates, then merge both lists by chunk id.",
      title: "Hybrid search",
    },
    {
      detail: "Apply deterministic rules for exact matches, vector similarity, source metadata, category, title, body keywords, and page-aware intent.",
      title: "Rule rerank",
    },
    {
      detail: "Apply the minimum similarity gate before using retrieved context for generation.",
      title: "Confidence gate",
    },
    {
      detail: "Build a grounded prompt with system-role rules, page context, retrieved evidence, and citations.",
      title: "Prompt",
    },
    {
      detail: "Call the answer model, return citations, timing, source count, and follow-up questions to the UI.",
      title: "Generate",
    },
  ];
  const stackGroups = [
    {
      detail: "A static portfolio surface that keeps the chat experience lightweight and routes requests from deployment config.",
      eyebrow: "Portfolio surface",
      items: ["React + TypeScript", "Floating chat launcher", "Session state", "Citation rendering"],
      title: "Frontend",
    },
    {
      detail: "A managed API layer for chat, retrieval orchestration, model calls, rate controls, and protected knowledge refresh.",
      eyebrow: "Service layer",
      items: ["Spring Boot 3", "WebFlux endpoints", "Approved origins", "Rate limiting", "Admin refresh"],
      title: "Backend API",
    },
    {
      detail: "A curated portfolio corpus stored as searchable chunks with source metadata for grounded answers.",
      eyebrow: "Retrieval layer",
      items: ["Autonomous Database", "Hybrid search", "Exact text match", "Normalized vectors", "Rule reranking"],
      title: "Knowledge Store",
    },
    {
      detail: "A prompt and model boundary that separates embeddings from answer generation and cites retrieved evidence.",
      eyebrow: "Generation layer",
      items: ["Gemini embeddings", "Groq answer model", "Grounded prompt", "Identity guardrails"],
      title: "Model Layer",
    },
  ];
  const howItWorks = [
    {
      detail: "Sai-specific answers are built from retrieved portfolio, project, blog, contact, and credential chunks.",
      title: "Grounded answers",
    },
    {
      detail: "The assistant never speaks as Sai and maps user phrases like 'you' or 'u' back to Sai in third person.",
      title: "Identity boundary",
    },
    {
      detail: "The chat UI surfaces citations so visitors can open the source page behind each answer.",
      title: "Visible sources",
    },
    {
      detail: "If retrieval is weak or the LLM fails, the service returns a controlled fallback rather than an invented answer.",
      title: "Controlled failure",
    },
  ];
  const nextUpgrades = [
    "Add retrieval evaluation tests with expected chunks for project, contact, blog, and experience questions.",
    "Add thumbs up/down feedback capture for weak answers.",
    "Add an admin retrieval audit view for chunks, scores, model, and latency.",
    "Move ingestion to a staged batch flow before activating a refreshed knowledge base.",
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to active builds
      </a>

      <div className="backdrop-orb backdrop-orb-left" aria-hidden="true" />
      <div className="backdrop-orb backdrop-orb-right" aria-hidden="true" />

      <header className="article-site-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>{isSaiAssistantBuildPage ? "Sai's Assistant" : "Active builds"}</span>
            </span>
          </a>

          <div className="article-header-actions">
            <a className="button button-secondary" href="/">
              Home
            </a>
            <PageBackButton fallbackHref={isSaiAssistantBuildPage ? "/active-builds" : "/"} label="Back" />
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

      <main className="guide-page active-builds-page shell" id="main-content">
        {!isSaiAssistantBuildPage ? (
          <>
        <section className="guide-hero active-builds-hero active-builds-catalog-hero" id="active-builds-top">
          <p className="eyebrow">Active Builds</p>
          <h1>Build lab for current engineering experiments.</h1>
          <p>
            A focused index of systems I am building now and shaping next. Open the live build to
            see the architecture, code flow, stack, and design decisions.
          </p>

          <div className="active-builds-catalog-actions">
            <a className="button button-primary" href="/active-builds/sai-assistant">
              Open current build
            </a>
            <a className="button button-secondary" href="/">
              Back to home
            </a>
          </div>
        </section>

        <section className="active-builds-menu-panel active-builds-catalog-panel" aria-label="Active builds menu">
          <div>
            <p className="eyebrow">Build Menu</p>
            <h2>Choose a build to explore.</h2>
            <p>
              Active items open as detailed case studies. Planned systems stay visible as coming
              soon cards, so the roadmap is clear without pretending everything is already shipped.
            </p>
          </div>
          <div className="active-builds-menu-list">
            {activeBuildCards.map((item) => {
              const cardContent = (
                <>
                  <span>{item.status}</span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  <div className="active-builds-card-tags" aria-label={`${item.title} tags`}>
                    {item.tags.map((tag) => (
                      <em key={tag}>{tag}</em>
                    ))}
                  </div>
                </>
              );

              return item.href ? (
                <a
                  className={`active-builds-menu-item ${item.tone} is-clickable`}
                  href={item.href}
                  key={item.title}
                >
                  {cardContent}
                </a>
              ) : (
                <article
                  className={`active-builds-menu-item ${item.tone} is-coming-soon`}
                  key={item.title}
                >
                  {cardContent}
                </article>
              );
            })}
          </div>
        </section>
          </>
        ) : null}

        {isSaiAssistantBuildPage ? (
          <>
        <section className="guide-hero active-builds-hero active-assistant-hero" id="sai-assistant-build">
          <p className="eyebrow">Live Build</p>
          <h1>Sai&apos;s Assistant: website knowledge base plus LLM.</h1>
          <p>
            A hybrid assistant that answers website questions from trusted site data, handles
            general tech questions with an LLM, and guides visitors to the right page.
          </p>
          <div className="active-assistant-signal-row" aria-label="Assistant build status">
            {assistantSignals.map((signal) => (
              <span key={signal.label}>
                <strong>{signal.value}</strong>
                {signal.label}
              </span>
            ))}
          </div>
        </section>

        <section className="active-assistant-section active-assistant-pipeline-section">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">RAG Blueprint</p>
            <h2>Three layers, one assistant.</h2>
            <p>
              The browser owns the chat experience, Spring owns retrieval and model calls, and
              Oracle owns the indexed portfolio knowledge.
            </p>
          </div>

          <div className="active-assistant-pipeline-grid">
            {ragPipelineCards.map((pipeline) => (
              <article className={`active-assistant-pipeline-card ${pipeline.tone}`} key={pipeline.title}>
                <span>{pipeline.endpoint}</span>
                <h3>{pipeline.title}</h3>
                <p>{pipeline.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="active-assistant-section active-assistant-rag-deep-dive">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">Ingestion + Hybrid Search</p>
            <h2>How content becomes searchable knowledge.</h2>
            <p>
              The system has two clean paths: an offline indexing path that prepares the knowledge
              base, and an online retrieval path that combines exact search, semantic search, and
              rule-based ranking before answering.
            </p>
          </div>

          <div className="assistant-rag-fact-strip" aria-label="Assistant retrieval facts">
            {architectureFacts.map((fact) => (
              <span key={fact.label}>
                <strong>{fact.value}</strong>
                {fact.label}
              </span>
            ))}
          </div>

          <div className="assistant-rag-lanes">
            <article className="assistant-rag-lane">
              <div className="assistant-rag-lane-heading">
                <span>Offline path</span>
                <h3>Ingestion builds the Oracle vector index.</h3>
                <p>
                  Admin refresh converts trusted portfolio and site content into durable chunks,
                  embeddings, metadata, and source records.
                </p>
              </div>
              <ol>
                {ingestionSteps.map((step, index) => (
                  <li key={step.title}>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    <div>
                      <span>{step.meta}</span>
                      <h4>{step.title}</h4>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>

            <article className="assistant-rag-lane is-online">
              <div className="assistant-rag-lane-heading">
                <span>Online path</span>
                <h3>Hybrid retrieval ranks evidence for every question.</h3>
                <p>
                  Chat requests become query vectors and exact text searches. Spring merges both
                  result sets and applies deterministic ranking rules before the model writes.
                </p>
              </div>
              <ol>
                {retrievalSteps.map((step, index) => (
                  <li key={step.title}>
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    <div>
                      <span>{step.meta}</span>
                      <h4>{step.title}</h4>
                      <p>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          </div>

          <div className="assistant-vector-detail-grid" aria-label="Embedding and vector search details">
            {vectorDetails.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="active-assistant-section active-assistant-ui-section">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">Chat UI Architecture</p>
            <h2>How the website chat connects to the RAG backend.</h2>
            <p>
              The UI is a small product surface: it manages conversation state, sends a clean
              request to Spring, and renders answers with citations instead of hiding the system.
            </p>
          </div>

          <div className="assistant-ui-architecture-grid">
            {chatUiArchitecture.map((item) => (
              <article className="assistant-ui-architecture-card" key={item.title}>
                <span>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="active-assistant-section active-assistant-architecture-board">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">Architecture</p>
            <h2>One clean request path through hybrid retrieval.</h2>
            <p>
              The assistant is not only a chat popup. It is a deployed RAG path across Vercel,
              Render, Oracle 23ai, rule-based reranking, and the configured LLM provider.
            </p>
          </div>

          <div className="assistant-flowchart" aria-label="Sai's Assistant end-to-end flowchart">
            <svg className="assistant-flowchart-svg" viewBox="0 0 932 663" role="img">
              <title>Sai&apos;s Assistant architecture flowchart</title>
              <defs>
                <marker
                  id="assistant-screen-arrow"
                  markerHeight="7"
                  markerWidth="7"
                  orient="auto"
                  refX="6"
                  refY="3.5"
                >
                  <path className="assistant-flow-arrow-head" d="M0,0 L7,3.5 L0,7 Z" />
                </marker>
              </defs>

              <path className="assistant-flow-edge" d="M455 56 V94" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M410 134 C383 145 365 153 363 174" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M363 214 C321 229 269 230 266 252" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M441 201 C510 214 606 222 608 252" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M266 292 V350" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M341 292 C385 304 445 314 446 350" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M191 292 C136 318 111 340 111 420 V549 H142" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M445 391 C408 414 375 423 373 450" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M505 390 C558 407 598 421 598 450" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M598 490 V529" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M373 490 C372 514 286 536 212 548" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M177 569 C178 590 259 607 317 616" markerEnd="url(#assistant-screen-arrow)" />
              <path className="assistant-flow-edge" d="M504 628 C722 594 718 558 718 455 V179 C718 140 575 128 499 116" markerEnd="url(#assistant-screen-arrow)" />

              <rect className="assistant-flow-node-rect" x="390" y="16" width="130" height="40" />
              <text className="assistant-flow-node-text" x="455" y="40">Website Visitor</text>

              <rect className="assistant-flow-node-rect" x="410" y="95" width="89" height="40" />
              <text className="assistant-flow-node-text" x="454.5" y="119">Chat UI</text>

              <rect className="assistant-flow-node-rect" x="286" y="174" width="155" height="40" />
              <text className="assistant-flow-node-text" x="363.5" y="198">Render Spring API</text>

              <rect className="assistant-flow-node-rect" x="191" y="252" width="150" height="40" />
              <text className="assistant-flow-node-text" x="266" y="276">Rule Reranker</text>

              <rect className="assistant-flow-node-rect" x="526" y="252" width="164" height="40" />
              <text className="assistant-flow-node-text" x="608" y="276">CORS + Grounding</text>

              <rect className="assistant-flow-label-bg" x="227" y="314" width="78" height="20" />
              <text className="assistant-flow-label-text" x="266" y="328">No context</text>

              <rect className="assistant-flow-node-rect" x="204" y="351" width="124" height="40" />
              <text className="assistant-flow-node-text" x="266" y="375">No-info fallback</text>

              <rect className="assistant-flow-label-bg" x="396" y="314" width="99" height="20" />
              <text className="assistant-flow-label-text" x="445.5" y="328">Portfolio question</text>

              <rect className="assistant-flow-node-rect" x="366" y="351" width="159" height="40" />
              <text className="assistant-flow-node-text" x="445.5" y="375">Hybrid Retrieval</text>

              <rect className="assistant-flow-label-bg" x="114" y="410" width="123" height="20" />
              <text className="assistant-flow-label-text" x="175.5" y="424">Generic tech question</text>

              <rect className="assistant-flow-node-rect" x="278" y="450" width="189" height="40" />
              <text className="assistant-flow-node-text" x="372.5" y="474">Grounded Prompt</text>

              <rect className="assistant-flow-node-rect" x="505" y="450" width="186" height="40" />
              <text className="assistant-flow-node-text" x="598" y="474">Exact Search + Metadata</text>

              <rect className="assistant-flow-node-rect" x="529" y="529" width="138" height="40" />
              <text className="assistant-flow-node-text" x="598" y="553">Oracle 23ai Store</text>

              <rect className="assistant-flow-node-rect" x="142" y="529" width="70" height="40" />
              <text className="assistant-flow-node-text" x="177" y="553">Groq LLM</text>

              <rect className="assistant-flow-node-rect" x="317" y="608" width="187" height="40" />
              <text className="assistant-flow-node-text" x="410.5" y="632">Answer with citations</text>
            </svg>
          </div>

          <div className="assistant-blueprint" aria-label="Sai's Assistant architecture explanation">
            <div className="assistant-stage-flow">
              {architectureFlow.map((stage, index) => (
                <article className="assistant-stage-card" key={stage.title}>
                  <span className="assistant-stage-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="assistant-stage-links" aria-label={`${stage.title} flow context`}>
                    <span>{stage.before}</span>
                    <strong aria-hidden="true">-&gt;</strong>
                    <span>{stage.after}</span>
                  </div>
                  <h3>{stage.title}</h3>
                  <p>{stage.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="active-assistant-section">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">Code Flow</p>
            <h2>How the code handles every question.</h2>
            <p>
              Each stage has one job, so the bot stays predictable, debuggable, and easy to improve.
            </p>
          </div>

          <ol className="active-assistant-flow">
            {codeFlow.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="active-assistant-section">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">Tech Stack</p>
            <h2>Production path for the assistant.</h2>
            <p>
              A deployed frontend, managed Spring service, Oracle-backed retrieval layer, and
              model boundary work together without exposing internal endpoints in the UI.
            </p>
          </div>

          <div className="assistant-stack-flow" aria-label="Assistant production stack">
            {stackGroups.map((group, index) => (
              <article className="assistant-stack-flow-node" key={group.title}>
                <div className="assistant-stack-flow-head">
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <span>{group.eyebrow}</span>
                </div>
                <h3>{group.title}</h3>
                <p>{group.detail}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="active-assistant-section active-assistant-how">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">How It Works</p>
            <h2>Simple rules that make it reliable.</h2>
            <p>Fast answers, grounded facts, clean fallback, and useful actions.</p>
          </div>

          <div className="active-assistant-principles">
            {howItWorks.map((principle) => (
              <article key={principle.title}>
                <h3>{principle.title}</h3>
                <p>{principle.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="active-assistant-section active-assistant-roadmap-section" id="active-builds-roadmap">
          <div className="active-assistant-section-heading">
            <p className="eyebrow">Next Build</p>
            <h2>Where this assistant goes next.</h2>
            <p>These upgrades move it closer to a proper website AI layer.</p>
          </div>

          <div className="active-assistant-roadmap-grid">
            {nextUpgrades.map((upgrade, index) => (
              <span key={upgrade}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                {upgrade}
              </span>
            ))}
          </div>
        </section>
          </>
        ) : null}
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
                {update.details?.length ? (
                  <ul className="whats-new-details">
                    {update.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
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
  isAiRadarSaved: (signal: AiRadarSignal) => boolean;
  savedPostsBusySlug: string;
  subscriberUser: User | null;
  theme: Theme;
  onToggleSavedAiRadar: (signal: AiRadarSignal) => void;
  onThemeToggle: () => void;
};

function getAiRadarSourceTone(source: string) {
  const sourceTones: Record<string, { primary: string; secondary: string }> = {
    Anthropic: { primary: "#b86b4b", secondary: "#f1c7aa" },
    "Anthropic News": { primary: "#b86b4b", secondary: "#f1c7aa" },
    "AWS ML": { primary: "#ff9900", secondary: "#ffd58f" },
    "Google/DeepMind": { primary: "#4285f4", secondary: "#b9dcff" },
    "Google DeepMind": { primary: "#4285f4", secondary: "#b9dcff" },
    "Google AI Blog": { primary: "#4285f4", secondary: "#b9dcff" },
    "Hugging Face": { primary: "#f0a120", secondary: "#ffe19b" },
    "Hugging Face Blog": { primary: "#f0a120", secondary: "#ffe19b" },
    LangChain: { primary: "#19a974", secondary: "#b7f0d8" },
    NVIDIA: { primary: "#76b900", secondary: "#d9f99d" },
    "NVIDIA AI Blog": { primary: "#76b900", secondary: "#d9f99d" },
    OpenAI: { primary: "#314158", secondary: "#cbd7e6" },
    "OpenAI News": { primary: "#314158", secondary: "#cbd7e6" },
  };

  return sourceTones[source] ?? { primary: "#f0643b", secondary: "#ffe3da" };
}

function getAiRadarSourceStyle(source: string) {
  const tone = getAiRadarSourceTone(source);

  return {
    "--radar-primary": tone.primary,
    "--radar-secondary": tone.secondary,
  } as CSSProperties;
}

function getAiRadarSourceBrand(source: string) {
  const sourceBrands: Record<string, { label: string; mark: string }> = {
    Anthropic: { label: "Anthropic", mark: "A" },
    "Anthropic News": { label: "Anthropic", mark: "A" },
    "AWS ML": { label: "AWS ML", mark: "AWS" },
    "Google/DeepMind": { label: "Google/DeepMind", mark: "G" },
    "Google DeepMind": { label: "Google/DeepMind", mark: "G" },
    "Google AI Blog": { label: "Google/DeepMind", mark: "G" },
    "Hugging Face": { label: "Hugging Face", mark: "HF" },
    "Hugging Face Blog": { label: "Hugging Face", mark: "HF" },
    LangChain: { label: "LangChain", mark: "LC" },
    NVIDIA: { label: "NVIDIA", mark: "NV" },
    "NVIDIA AI Blog": { label: "NVIDIA", mark: "NV" },
    OpenAI: { label: "OpenAI", mark: "OA" },
    "OpenAI News": { label: "OpenAI", mark: "OA" },
  };

  return sourceBrands[source] ?? { label: source, mark: getAiRadarSourceInitials(source) || "AI" };
}

function getAiRadarSourceInitials(source: string) {
  return source
    .replace(/\b(blog|news|cs\.ai|machine learning)\b/gi, "")
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

function formatAiRadarFreshness(publishedAt?: string) {
  if (!publishedAt) {
    return "Source monitored";
  }

  const publishedDate = new Date(publishedAt);

  if (Number.isNaN(publishedDate.getTime())) {
    return "Freshness unavailable";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60)),
  );

  if (elapsedMinutes < 1) {
    return "Published just now";
  }

  if (elapsedMinutes < 60) {
    return `Published ${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `Published ${elapsedHours} hr${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  if (elapsedDays < 30) {
    return `Published ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);

  if (elapsedMonths < 12) {
    return `Published ${elapsedMonths} mo ago`;
  }

  const elapsedYears = Math.floor(elapsedMonths / 12);

  return `Published ${elapsedYears} yr${elapsedYears === 1 ? "" : "s"} ago`;
}

function AiRadarFreshness({
  className = "",
  publishedAt,
}: {
  className?: string;
  publishedAt?: string;
}) {
  const label = formatAiRadarFreshness(publishedAt);

  return publishedAt ? (
    <time className={className} dateTime={publishedAt} title={formatAiRadarDate(publishedAt)}>
      {label}
    </time>
  ) : (
    <span className={className}>{label}</span>
  );
}

function AiRadarSourceBadge({
  compact = false,
  onDark = false,
  source,
}: {
  compact?: boolean;
  onDark?: boolean;
  source: string;
}) {
  const brand = getAiRadarSourceBrand(source);

  return (
    <span
      className={`ai-source-badge${compact ? " is-compact" : ""}${onDark ? " is-on-dark" : ""}`}
      style={getAiRadarSourceStyle(source)}
      aria-label={`${brand.label} source`}
      title={brand.label}
    >
      <span className="ai-source-badge-mark" aria-hidden="true">
        {brand.mark}
      </span>
      {!compact ? <span className="ai-source-badge-label">{brand.label}</span> : null}
    </span>
  );
}

function AiRadarSourceMark({
  className = "",
  source,
}: {
  className?: string;
  source: string;
}) {
  const brand = getAiRadarSourceBrand(source);

  return (
    <span
      className={`ai-source-visual-mark${className ? ` ${className}` : ""}`}
      style={getAiRadarSourceStyle(source)}
      aria-label={`${brand.label} source`}
      title={brand.label}
    >
      {brand.mark}
    </span>
  );
}

function getAiRadarVisualStyle(signal: AiRadarSignal) {
  return getAiRadarSourceStyle(signal.source);
}

function AiRadarPage({
  isAiRadarSaved,
  savedPostsBusySlug,
  subscriberUser,
  theme,
  onToggleSavedAiRadar,
  onThemeToggle,
}: AiRadarPageProps) {
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
  const feedSignals = visibleSignals.filter((signal) => signal.href !== activeStory.href);
  const radarHighlights = [
    { label: "Live Feed", value: radarStatus === "live" ? "On" : "Fallback" },
    { label: "Sources", value: `${new Set(liveSignals.map((signal) => signal.source)).size}` },
    { label: "Mode", value: "Ranked" },
  ];
  const trackAiRadarOpen = (signal: AiRadarSignal, source: string) => {
    trackAnalyticsEvent("ai_radar_open", {
      category: signal.category,
      source,
      title: signal.title,
    });
  };

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
        const nextSignals = normalizeAiRadarApiItems(data);

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
              <AiRadarSourceMark className="is-hero" source={activeStory.source} />
            )}
          </div>

          <div className="ai-radar-story-card" aria-live="polite">
            <div className="ai-radar-story-topline">
              <span className="ai-radar-live-dot">
                {radarStatus === "loading" ? "Checking feeds" : "Live AI Briefing"}
              </span>
              <AiRadarSourceBadge onDark source={activeStory.source} />
            </div>

            <div className="ai-radar-story-body">
              <div className="ai-radar-story-thumb">
                {activeStory.imageUrl ? (
                  <img src={activeStory.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <AiRadarSourceMark className="is-hero" source={activeStory.source} />
                )}
              </div>
              <div>
                <div className="ai-radar-source-line">
                  <span>{activeStory.category}</span>
                  <AiRadarFreshness publishedAt={activeStory.publishedAt} />
                </div>
                <h1>{activeStory.title}</h1>
                <div className="ai-radar-story-actions">
                  <a
                    href={activeStory.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackAiRadarOpen(activeStory, "hero_story")}
                  >
                    Read story
                  </a>
                  <SaveAiRadarButton
                    className="is-on-dark"
                    isBusy={savedPostsBusySlug === getAiRadarSavedId(activeStory)}
                    isSaved={isAiRadarSaved(activeStory)}
                    subscriberUser={subscriberUser}
                    onToggle={() => onToggleSavedAiRadar(activeStory)}
                  />
                </div>
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
            {(feedSignals.length ? feedSignals : visibleSignals).map((signal, index) => (
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
                    <AiRadarSourceMark source={signal.source} />
                  )}
                </div>
                <div className="ai-radar-item-copy">
                  <div className="ai-radar-item-meta">
                    <span>{signal.category}</span>
                  </div>
                  <h3>{signal.title}</h3>
                  <p>{signal.summary || signal.whyItMatters}</p>
                  <div className="ai-radar-freshness-row">
                    <AiRadarFreshness
                      className="ai-radar-freshness"
                      publishedAt={signal.publishedAt}
                    />
                  </div>
                </div>
                <div className="ai-radar-item-action">
                  <AiRadarSourceBadge source={signal.source} />
                  <SaveAiRadarButton
                    isBusy={savedPostsBusySlug === getAiRadarSavedId(signal)}
                    isSaved={isAiRadarSaved(signal)}
                    subscriberUser={subscriberUser}
                    onToggle={() => onToggleSavedAiRadar(signal)}
                  />
                  <a
                    href={signal.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackAiRadarOpen(signal, "feed_item")}
                  >
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

type AboutPageProps = {
  theme: Theme;
  onThemeToggle: () => void;
};

function AboutPage({ theme, onThemeToggle }: AboutPageProps) {
  const aboutLinks = [
    { href: "/portfolio", label: "Portfolio", note: "Experience and selected work" },
    { href: "/blogs", label: "Blogs", note: "Engineering notes" },
    { href: "/active-builds", label: "Active Builds", note: "Systems being built now" },
    { href: "/ai-radar", label: "AI Radar", note: "Curated AI updates" },
    { href: "/work-with-me", label: "Work With Me", note: "Collaboration and contact" },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to About page
      </a>

      <header className="article-site-header about-header">
        <div className="shell article-header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">SK</span>
            <span className="brand-copy">
              <strong>{profile.name}</strong>
              <span>About</span>
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

      <main className="about-page shell" id="main-content">
        <section className="about-hero" aria-labelledby="about-page-title">
          <div className="about-hero-copy">
            <p className="eyebrow">About Me</p>
            <h1 id="about-page-title">Sai Kumar Mediboina</h1>
            <div className="about-intro-lines">
              <p>I am a {profile.currentTitle} at {profile.company}.</p>
              <p>I work on backend systems where scale, search quality, and reliability matter.</p>
              <p>My recent focus includes high-throughput screening, matching engines, and AI-assisted workflows.</p>
              <p>I use this site to share my work, engineering notes, active builds, and useful AI updates.</p>
            </div>
          </div>

          <div className="about-portrait-card">
            <img src="/about-sai.jpg" alt="Sai Kumar Mediboina smiling at a workspace" />
          </div>
        </section>

        <nav className="about-link-grid" aria-label="Explore key portfolio pages">
          {aboutLinks.map((link) => (
            <a href={link.href} key={link.label}>
              <strong>{link.label}</strong>
              <span>{link.note}</span>
            </a>
          ))}
        </nav>
      </main>
    </>
  );
}

function ContactPage({ theme, onThemeToggle }: ContactPageProps) {
  const collaborationAreas = [
    {
      icon: "briefcase" as const,
      title: "Backend Performance",
      summary:
        "Diagnose latency, remove repeated work, and make high-volume request paths more predictable.",
      points: ["Database hot paths", "Async execution", "Throughput tuning"],
    },
    {
      icon: "radar" as const,
      title: "Search and Matching Systems",
      summary:
        "Design search-heavy workflows where relevance, scale, and explainability need to work together.",
      points: ["Oracle Text", "OpenSearch", "Hybrid scoring"],
    },
    {
      icon: "spark" as const,
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
                <span className="collaboration-card-icon" aria-hidden="true">
                  <ReaderMenuGlyph type={area.icon} />
                </span>
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
  onTrackBlogOpen: (post: BlogPost, source: string) => void;
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
  onTrackBlogOpen,
  onToggleSavedPost,
  onThemeToggle,
}: BlogArticlePageProps) {
  const [readingProgress, setReadingProgress] = useState(0);
  const articleRef = useRef<HTMLElement | null>(null);
  const readingSecondsLeft = post ? getReadingSecondsLeft(post, readingProgress) : 0;

  useEffect(() => {
    if (!post || isAccessChecking || isLocked) {
      return;
    }

    trackAnalyticsEvent("blog_open", {
      category: post.category,
      slug: post.slug,
      source: "article_page",
      title: post.title,
    });
  }, [isAccessChecking, isLocked, post]);

  useEffect(() => {
    if (!post || isAccessChecking || isLocked) {
      setReadingProgress(0);
      return undefined;
    }

    let frameId = 0;

    const updateReadingProgress = () => {
      const article = articleRef.current;

      if (!article) {
        setReadingProgress(0);
        return;
      }

      const rect = article.getBoundingClientRect();
      const articleTop = window.scrollY + rect.top;
      const articleHeight = article.offsetHeight;
      const readableDistance = Math.max(articleHeight - window.innerHeight * 0.55, 1);
      const rawProgress =
        ((window.scrollY - articleTop + window.innerHeight * 0.22) / readableDistance) * 100;
      const nextProgress = Math.min(Math.max(rawProgress, 0), 100);

      setReadingProgress(nextProgress);
    };

    const scheduleReadingProgressUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateReadingProgress);
    };

    updateReadingProgress();
    window.addEventListener("scroll", scheduleReadingProgressUpdate, { passive: true });
    window.addEventListener("resize", scheduleReadingProgressUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleReadingProgressUpdate);
      window.removeEventListener("resize", scheduleReadingProgressUpdate);
    };
  }, [isAccessChecking, isLocked, post]);

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
        {post && !isAccessChecking && !isLocked ? (
          <div className="reading-progress-panel">
            <div className="shell reading-progress-shell">
              <ReadingProgressBar progress={readingProgress} />
              <ReadingTimeLeftPill secondsLeft={readingSecondsLeft} />
            </div>
          </div>
        ) : null}
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
            <BlogMetaLine accessLabel="Members only" post={post} />
            <p>{post.summary}</p>
            <BlogTagList limit={6} post={post} />
            <BlogLockNote />
            <div className="standalone-lock-preview" aria-label="Locked article preview">
              <span>
                <strong>{getEstimatedReadTimeLabel(post)}</strong>
                Full read time
              </span>
              <span>
                <strong>{post.sections.length}</strong>
                Structured sections
              </span>
              <span>
                <strong>{post.takeaways.length}</strong>
                Key takeaways
              </span>
            </div>
            <div className="standalone-lock-actions">
              <a className="button button-primary" href={getSignInHref(post.slug)}>
                Sign in to unlock
              </a>
              <a className="button button-secondary" href="/blogs">
                Browse all posts
              </a>
            </div>
          </section>
        ) : post ? (
          <article className="standalone-blog" ref={articleRef}>
            <div className="standalone-blog-hero">
              <p className="eyebrow">Unlocked Article</p>
              <h1>{post.title}</h1>
              <BlogMetaLine accessLabel="Reader view" post={post} />
              <p>{post.summary}</p>
              <BlogTagList limit={6} post={post} />
              <div className="article-reader-panel" aria-label="Article reader details">
                <span>
                  <strong>{getBlogWordCount(post).toLocaleString()}</strong>
                  Words
                </span>
                <span>
                  <strong>{post.sections.length}</strong>
                  Sections
                </span>
                <span>
                  <strong>{Math.round(readingProgress)}%</strong>
                  Progress
                </span>
                <span>
                  <strong>{formatReadingTimeLeft(readingSecondsLeft)}</strong>
                  Time left
                </span>
              </div>
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

            <BlogArchitectureDiagram post={post} />
            <BlogArticleBody post={post} />
            <RelatedPosts
              currentPost={post}
              subscriberUser={subscriberUser}
              onTrackBlogOpen={onTrackBlogOpen}
            />
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
  savedItems: SavedReaderItem[];
  savedPostsBusySlug: string;
  subscriberUser: User | null;
  subscriptionError: string;
  subscriptionMessage: string;
  theme: Theme;
  onRemoveSavedItem: (id: string) => void;
  onThemeToggle: () => void;
};

function SavedPostsPage({
  authReady,
  savedItems,
  savedPostsBusySlug,
  subscriberUser,
  subscriptionError,
  subscriptionMessage,
  theme,
  onRemoveSavedItem,
  onThemeToggle,
}: SavedPostsPageProps) {
  const [selectedSavedTag, setSelectedSavedTag] = useState(ALL_SAVED_POSTS_TAG);
  const savedPostCount = savedItems.length;
  const savedFilterTags = [
    ALL_SAVED_POSTS_TAG,
    ...Array.from(new Set(savedItems.flatMap(getSavedReaderItemTags))).sort((firstTag, secondTag) =>
      firstTag.localeCompare(secondTag),
    ),
  ];
  const filteredSavedItems =
    selectedSavedTag === ALL_SAVED_POSTS_TAG
      ? savedItems
      : savedItems.filter((item) => getSavedReaderItemTags(item).includes(selectedSavedTag));

  useEffect(() => {
    if (
      selectedSavedTag !== ALL_SAVED_POSTS_TAG &&
      !savedItems.some((item) => getSavedReaderItemTags(item).includes(selectedSavedTag))
    ) {
      setSelectedSavedTag(ALL_SAVED_POSTS_TAG);
    }
  }, [savedItems, selectedSavedTag]);

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
              Articles and AI Radar stories you save appear here in a clean list, with tags that
              make each useful note easy to reopen when the coffee is ready.
            </p>
            {subscriberUser ? (
              <div className="saved-posts-count" aria-label={`${savedPostCount} saved posts`}>
                <strong>{savedPostCount}</strong>
                <span>{savedPostCount === 1 ? "saved post" : "saved posts"}</span>
              </div>
            ) : null}
          </div>

          {subscriptionMessage ? (
            <p className="status-message is-success" role="status">{subscriptionMessage}</p>
          ) : null}
          {subscriptionError ? (
            <p className="status-message is-error" role="alert">{subscriptionError}</p>
          ) : null}

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
          ) : savedItems.length ? (
            <>
              <div className="saved-posts-filter" aria-label="Filter saved posts by tag">
                <span>Filter</span>
                <div className="saved-posts-tags">
                  {savedFilterTags.map((tag) => (
                    <button
                      className={`saved-tag-button${selectedSavedTag === tag ? " is-active" : ""}`}
                      type="button"
                      aria-pressed={selectedSavedTag === tag}
                      key={tag}
                      onClick={() => setSelectedSavedTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSavedItems.length ? (
                <div className="saved-posts-list" aria-label="Saved reader items">
                  {filteredSavedItems.map((item, index) => (
                    <article className="saved-posts-item" key={item.id}>
                      <span className="saved-posts-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="saved-posts-copy">
                        <div className="blog-meta saved-posts-meta">
                          {getSavedReaderItemTags(item).map((tag) => (
                            <button
                              className={`saved-inline-tag${
                                selectedSavedTag === tag ? " is-active" : ""
                              }`}
                              type="button"
                              aria-pressed={selectedSavedTag === tag}
                              key={`${item.id}-${tag}`}
                              onClick={() => setSelectedSavedTag(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                          {item.date ? <span>{item.date}</span> : null}
                        </div>
                        <h2>{item.title}</h2>
                        <p>{item.summary}</p>
                      </div>
                      <div className="saved-posts-actions">
                        <a
                          className="button button-primary"
                          href={item.href}
                          target="_blank"
                          rel="opener"
                        >
                          {item.actionLabel}
                        </a>
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={savedPostsBusySlug === item.id}
                          onClick={() => onRemoveSavedItem(item.id)}
                        >
                          {savedPostsBusySlug === item.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="saved-posts-empty">
                  <ReaderMenuGlyph type="bookmark" />
                  <h2>No saved posts under {selectedSavedTag} yet.</h2>
                  <p>
                    That tag shelf is still waiting for its first resident. Switch back to All or
                    save something new from Blogs or AI Radar.
                  </p>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => setSelectedSavedTag(ALL_SAVED_POSTS_TAG)}
                  >
                    Show all saved posts
                  </button>
                </div>
              )}
            </>
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

const dashboardSignalMetrics: Array<{
  detail: string;
  tone: string;
  type: AnalyticsEventType;
}> = [
  {
    detail: "Every major page visit.",
    tone: "is-rust",
    type: "page_view",
  },
  {
    detail: "Article reads and blog clicks.",
    tone: "is-blue",
    type: "blog_open",
  },
  {
    detail: "Reader bookmarks.",
    tone: "is-gold",
    type: "saved_post",
  },
  {
    detail: "External AI story opens.",
    tone: "is-green",
    type: "ai_radar_open",
  },
  {
    detail: "New update subscribers.",
    tone: "is-violet",
    type: "newsletter_subscribe",
  },
  {
    detail: "Questions asked to Sai's bot.",
    tone: "is-slate",
    type: "assistant_question",
  },
];

function formatAnalyticsSignalTime(value?: string) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatCompactNumber(value: number) {
  if (value < 1000) {
    return `${value}`;
  }

  return new Intl.NumberFormat("en-US", {
    compactDisplay: "short",
    maximumFractionDigits: value < 10000 ? 1 : 0,
    notation: "compact",
  }).format(value);
}

function getAnalyticsEventTitle(event: AnalyticsDashboardEvent) {
  return event.title || event.path || ANALYTICS_EVENT_LABELS[event.type];
}

function DashboardPage({ theme, onThemeToggle }: DashboardPageProps) {
  const topics = getDashboardTopics(blogPosts);
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState(getCachedAnalyticsSnapshot);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const totalBlogCount = Math.max(blogPosts.length, 1);
  const totalReadMinutes = blogPosts.reduce(
    (total, post) => total + getEstimatedReadMinutes(post),
    0,
  );
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
        getEstimatedReadMinutes(post) * 8 + post.sections.length * 6 + post.takeaways.length * 4,
    }))
    .sort((left, right) => right.contentScore - left.contentScore)
    .slice(0, 8);
  const maxArticleScore = Math.max(...topArticles.map((post) => post.contentScore), 1);
  const totalTrackedSignals = dashboardSignalMetrics.reduce(
    (total, metric) => total + analyticsSnapshot.counters[metric.type],
    0,
  );
  const latestAnalyticsEvents = analyticsSnapshot.events.slice(0, 6);
  const analyticsSourceText = analyticsSnapshot.configured
    ? "Synced from Firestore"
    : analyticsSnapshot.events.length
      ? "Local preview until cloud signals connect"
      : "Waiting for the first visitor signals";

  useEffect(() => {
    let isCurrent = true;

    const refreshAnalytics = async () => {
      const nextSnapshot = await loadAnalyticsSnapshot();

      if (isCurrent) {
        setAnalyticsSnapshot(nextSnapshot);
        setAnalyticsLoading(false);
      }
    };

    refreshAnalytics();

    const intervalId = window.setInterval(refreshAnalytics, 45000);

    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, []);

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

          <section className="dashboard-signal-panel" aria-label="Live portfolio analytics">
            <div className="dashboard-signal-head">
              <div>
                <p className="eyebrow">Live Site Signals</p>
                <h2>What visitors actually use.</h2>
                <p>
                  A clean interaction layer for page views, article opens, saved posts, AI Radar
                  reads, newsletter joins, and assistant questions.
                </p>
              </div>
              <div className="dashboard-signal-total">
                <span>Tracked signals</span>
                <strong>{formatCompactNumber(totalTrackedSignals)}</strong>
                <small>{analyticsLoading ? "Refreshing..." : analyticsSourceText}</small>
              </div>
            </div>

            <div className="dashboard-signal-grid">
              {dashboardSignalMetrics.map((metric) => (
                <article className={`dashboard-signal-card ${metric.tone}`} key={metric.type}>
                  <span>{ANALYTICS_EVENT_LABELS[metric.type]}</span>
                  <strong>{formatCompactNumber(analyticsSnapshot.counters[metric.type])}</strong>
                  <small>{metric.detail}</small>
                </article>
              ))}
            </div>

            <div className="dashboard-signal-stream">
              <div className="dashboard-signal-stream-heading">
                <h3>Recent activity</h3>
                <span>{analyticsSnapshot.configured ? "Live feed" : "Preview feed"}</span>
              </div>
              {latestAnalyticsEvents.length ? (
                <div className="dashboard-signal-events">
                  {latestAnalyticsEvents.map((event, index) => (
                    <article
                      className="dashboard-signal-event"
                      key={`${event.type}-${event.createdAt ?? index}-${event.title ?? event.path ?? index}`}
                    >
                      <span>{event.label}</span>
                      <strong>{getAnalyticsEventTitle(event)}</strong>
                      <small>{formatAnalyticsSignalTime(event.createdAt)}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="dashboard-signal-empty">
                  Signals will appear here as visitors read, save, subscribe, and ask Sai's bot
                  questions.
                </p>
              )}
            </div>
          </section>

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

          <article className="dashboard-card dashboard-depth-card">
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
                  onClick={() =>
                    trackAnalyticsEvent("blog_open", {
                      category: post.category,
                      slug: post.slug,
                      source: "dashboard_depth",
                      title: post.title,
                    })
                  }
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

          <article className="dashboard-card dashboard-cadence-card">
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
                        <a
                          href={getBlogArticleHref(post.slug)}
                          target="_blank"
                          rel="opener"
                          onClick={() =>
                            trackAnalyticsEvent("blog_open", {
                              category: post.category,
                              slug: post.slug,
                              source: "dashboard_table",
                              title: post.title,
                            })
                          }
                        >
                          {post.title}
                        </a>
                      </td>
                      <td>{post.category}</td>
                      <td>{getEstimatedReadTimeLabel(post)}</td>
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
              <p className="status-message is-error" role="alert">{sendResult.error}</p>
            ) : null}
            {sendResult && !sendResult.error ? (
              <p className="status-message is-success" role="status">
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isCompactNav, setIsCompactNav] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 1080px)").matches,
  );
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
  const [savedAiRadarItems, setSavedAiRadarItems] = useState<SavedAiRadarItem[]>([]);
  const [savedPostsBusySlug, setSavedPostsBusySlug] = useState("");
  const [subscriberView, setSubscriberView] = useState<SubscriberViewState>("guest");
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [subscriptionError, setSubscriptionError] = useState("");
  const manualSignOutViewRef = useRef<SubscriberViewState | null>(null);
  const moreMenuRef = useRef<HTMLDetailsElement | null>(null);
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
  const savedReaderItems = buildSavedReaderItems(savedPostSlugs, savedAiRadarItems);
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
  const isLearnPage = isLearnPathname();
  const isActiveBuildsPage = isActiveBuildsPathname();
  const activeBuildSlug = getActiveBuildSlugFromPathname();
  const isBlogsPage = isBlogsPathname();
  const isAboutPage = isAboutPathname();
  const isContactPage = isContactPathname();
  const isPortfolioPage = isPortfolioPathname();
  const isAdminUpdatePage = isAdminUpdatePathname();
  const seoMetadata = getSeoMetadata({
    activeBuildSlug,
    isAboutPage,
    isAdminUpdatePage,
    isAiRadarPage,
    isBlogsPage,
    isContactPage,
    isDashboardPage,
    isActiveBuildsPage,
    isLearnPage,
    isPortfolioPage,
    isSavedPostsPage,
    isShelfPage,
    isSignInPage,
    isStartPage,
    isWhatsNewPage,
    standaloneBlog,
  });
  const analyticsPageTitle = seoMetadata.analyticsTitle;
  const currentNavLinks = isPortfolioPage ? portfolioNavLinks : mainNavLinks;
  const currentMoreNavLinks = isPortfolioPage ? emptyNavLinks : mainMoreNavLinks;
  const currentPathname =
    typeof window === "undefined" ? "/" : window.location.pathname.replace(/\/$/, "") || "/";
  const compactNavIsHidden = isCompactNav && !menuOpen;
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
  const isAiRadarSaved = (signal: AiRadarSignal) =>
    savedPostSlugs.includes(getAiRadarSavedId(signal));
  const isNavLinkActive = (
    link: (typeof currentNavLinks)[number] | (typeof currentMoreNavLinks)[number],
  ) => {
    if ("id" in link && link.id) {
      return activeSection === link.id;
    }

    if (!("href" in link)) {
      return false;
    }

    const [hrefPath] = link.href.split("#");
    const normalizedHref = (hrefPath || "/").replace(/\/$/, "") || "/";

    return currentPathname === normalizedHref || currentPathname.startsWith(`${normalizedHref}/`);
  };
  const trackBlogOpen = (post: BlogPost, source: string) => {
    trackAnalyticsEvent("blog_open", {
      category: post.category,
      slug: post.slug,
      source,
      title: post.title,
    });
  };

  useEffect(() => {
    restorePendingNavigationScroll();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealElements = Array.from(
      document.querySelectorAll<HTMLElement>(motionRevealSelector),
    );

    revealElements.forEach((element, index) => {
      element.classList.add("motion-reveal");
      element.style.setProperty("--motion-delay", `${Math.min((index % 8) * 0.055, 0.36)}s`);
    });

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -10% 0px",
        threshold: 0.14,
      },
    );

    revealElements.forEach((element) => revealObserver.observe(element));

    return () => revealObserver.disconnect();
  }, [
    isAdminUpdatePage,
    isAiRadarPage,
    isBlogsPage,
    isContactPage,
    isDashboardPage,
    activeBuildSlug,
    isActiveBuildsPage,
    isLearnPage,
    isPortfolioPage,
    isSavedPostsPage,
    isShelfPage,
    isSignInPage,
    isStartPage,
    isWhatsNewPage,
    savedPostSlugs.length,
    selectedBlogCategory,
    selectedProjectIndex,
    standaloneBlogSlug,
    subscriberUser?.uid,
  ]);

  useEffect(() => {
    const sectionIds = [
      "top",
      ...currentNavLinks.flatMap((link) =>
        "id" in link && typeof link.id === "string" ? [link.id] : [],
      ),
      ...currentMoreNavLinks.flatMap((link) =>
        "id" in link && typeof link.id === "string" ? [link.id] : [],
      ),
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
  }, [currentMoreNavLinks, currentNavLinks]);

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
    const compactNavQuery = window.matchMedia("(max-width: 1080px)");
    const syncCompactNav = () => {
      setIsCompactNav(compactNavQuery.matches);

      if (!compactNavQuery.matches) {
        setMenuOpen(false);
      }
    };

    syncCompactNav();
    compactNavQuery.addEventListener("change", syncCompactNav);

    return () => compactNavQuery.removeEventListener("change", syncCompactNav);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

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
    if (!moreMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        moreMenuRef.current &&
        event.target instanceof Node &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setMoreMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreMenuOpen]);

  useEffect(() => {
    if (!menuOpen && isCompactNav) {
      setMoreMenuOpen(false);
    }
  }, [isCompactNav, menuOpen]);

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
    applySeoMetadata(seoMetadata);
  }, [seoMetadata]);

  useEffect(() => {
    trackAnalyticsEvent("page_view", {
      source: "route",
      title: analyticsPageTitle,
    });
  }, [analyticsPageTitle]);

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
        setSavedAiRadarItems([]);
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
            const nextSavedAiRadarItems = getCachedSavedAiRadarItemsForSlugs(
              user.uid,
              nextSavedPostSlugs,
            );
            setIsSubscribed(subscriber.subscribed);
            setSavedPostSlugs(nextSavedPostSlugs);
            setSavedAiRadarItems(nextSavedAiRadarItems);
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
    const cachedSavedAiRadarItems = getCachedSavedAiRadarItemsForSlugs(
      subscriberUser.uid,
      cachedSavedPostSlugs,
    );
    setSavedPostSlugs(cachedSavedPostSlugs);
    setSavedAiRadarItems(cachedSavedAiRadarItems);

    const unsubscribeFromSavedPosts = subscribeToSavedPostSlugs(
      subscriberUser.uid,
      (nextSavedPostSlugs) => {
        if (!isCurrentUser) {
          return;
        }

        const nextSavedAiRadarItems = getCachedSavedAiRadarItemsForSlugs(
          subscriberUser.uid,
          nextSavedPostSlugs,
        );
        setSavedPostSlugs(nextSavedPostSlugs);
        setSavedAiRadarItems(nextSavedAiRadarItems);
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
    const savedAiRadarStorageKey = getSavedAiRadarStorageKey(subscriberUser.uid);

    const handleSavedPostsStorage = (event: StorageEvent) => {
      if (
        (event.key !== savedPostsStorageKey && event.key !== savedAiRadarStorageKey) ||
        event.newValue === null
      ) {
        return;
      }

      try {
        if (event.key === savedPostsStorageKey) {
          const nextSavedPostSlugs = normalizeSavedPostSlugs(JSON.parse(event.newValue));
          setSavedPostSlugs(nextSavedPostSlugs);
          setSavedAiRadarItems(
            getCachedSavedAiRadarItemsForSlugs(subscriberUser.uid, nextSavedPostSlugs),
          );
        } else {
          setSavedAiRadarItems(normalizeSavedAiRadarItems(JSON.parse(event.newValue)));
        }
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
        const nextSavedAiRadarItems = getCachedSavedAiRadarItemsForSlugs(
          result.user.uid,
          nextSavedPostSlugs,
        );

        if (isMounted) {
          setSubscriberUser(result.user);
          setIsSubscribed(subscriber.subscribed);
          setSavedPostSlugs(nextSavedPostSlugs);
          setSavedAiRadarItems(nextSavedAiRadarItems);
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
          } else if (getSignInReturnTarget() === "ai-radar") {
            window.location.href = "/ai-radar";
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
    setMoreMenuOpen(false);
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
      const nextSavedAiRadarItems = getCachedSavedAiRadarItemsForSlugs(
        result.user.uid,
        nextSavedPostSlugs,
      );
      setSubscriberUser(result.user);
      setIsSubscribed(subscriber.subscribed);
      setSavedPostSlugs(nextSavedPostSlugs);
      setSavedAiRadarItems(nextSavedAiRadarItems);
      cacheSavedPostSlugs(result.user.uid, nextSavedPostSlugs);
      setSubscriberView(getSignedInSubscriberView(subscriber));
      setSubscriptionMessage(
        subscriber.subscribed
          ? "Welcome back. Your subscription is active."
          : "You are signed in. Subscribe when you want updates in your inbox.",
      );

      if (getSignInReturnTarget() === "saved-posts") {
        window.location.href = "/saved-posts";
      } else if (getSignInReturnTarget() === "ai-radar") {
        window.location.href = "/ai-radar";
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
        trackAnalyticsEvent("unsaved_post", {
          category: post.category,
          slug: post.slug,
          source: "blog",
          title: post.title,
        });
        await unsaveReaderPost(subscriberUser.uid, post.slug);
      } else {
        updateSavedPostSlugs((current) =>
          current.includes(post.slug) ? current : [...current, post.slug],
        );
        setSubscriptionMessage("Saved to your reader menu.");
        trackAnalyticsEvent("saved_post", {
          category: post.category,
          slug: post.slug,
          source: "blog",
          title: post.title,
        });
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

  const handleToggleSavedAiRadar = async (signal: AiRadarSignal) => {
    clearSubscriptionFeedback();

    if (!subscriberUser) {
      setSubscriptionMessage("Sign in first, then AI Radar stories get their own shelf pass.");
      return;
    }

    const savedId = getAiRadarSavedId(signal);
    const wasSaved = isAiRadarSaved(signal);
    const previousSavedPostSlugs = savedPostSlugs;
    const previousSavedAiRadarItems = savedAiRadarItems;
    const nextSavedPostSlugs = normalizeSavedPostSlugs(
      wasSaved
        ? previousSavedPostSlugs.filter((slug) => slug !== savedId)
        : [...previousSavedPostSlugs, savedId],
    );
    const nextSavedAiRadarItems = normalizeSavedAiRadarItems(
      wasSaved
        ? previousSavedAiRadarItems.filter((item) => item.id !== savedId)
        : [...previousSavedAiRadarItems, getSavedAiRadarItem(signal)],
    );

    setSavedPostsBusySlug(savedId);
    setSavedPostSlugs(nextSavedPostSlugs);
    setSavedAiRadarItems(nextSavedAiRadarItems);
    cacheSavedPostSlugs(subscriberUser.uid, nextSavedPostSlugs);
    cacheSavedAiRadarItems(subscriberUser.uid, nextSavedAiRadarItems);

    try {
      if (wasSaved) {
        setSubscriptionMessage("Removed from saved posts.");
        trackAnalyticsEvent("unsaved_post", {
          category: signal.category,
          slug: savedId,
          source: "ai_radar",
          title: signal.title,
        });
        await unsaveReaderPost(subscriberUser.uid, savedId);
      } else {
        setSubscriptionMessage("Saved to your reader menu.");
        trackAnalyticsEvent("saved_post", {
          category: signal.category,
          slug: savedId,
          source: "ai_radar",
          title: signal.title,
        });
        await saveReaderPost(subscriberUser, savedId);
      }
    } catch (error) {
      setSavedPostSlugs(previousSavedPostSlugs);
      setSavedAiRadarItems(previousSavedAiRadarItems);
      cacheSavedPostSlugs(subscriberUser.uid, previousSavedPostSlugs);
      cacheSavedAiRadarItems(subscriberUser.uid, previousSavedAiRadarItems);
      setSubscriptionError(getSubscriptionErrorMessage(error));
    } finally {
      setSavedPostsBusySlug("");
    }
  };

  const handleRemoveSavedItem = async (id: string) => {
    clearSubscriptionFeedback();

    if (!subscriberUser) {
      setSubscriptionMessage("Sign in first, then your saved shelf opens properly.");
      return;
    }

    const previousSavedPostSlugs = savedPostSlugs;
    const previousSavedAiRadarItems = savedAiRadarItems;
    const removedSavedItem = savedReaderItems.find((item) => item.id === id);
    const nextSavedPostSlugs = previousSavedPostSlugs.filter((slug) => slug !== id);
    const nextSavedAiRadarItems = isSavedAiRadarId(id)
      ? previousSavedAiRadarItems.filter((item) => item.id !== id)
      : previousSavedAiRadarItems;

    setSavedPostsBusySlug(id);
    setSavedPostSlugs(nextSavedPostSlugs);
    setSavedAiRadarItems(nextSavedAiRadarItems);
    cacheSavedPostSlugs(subscriberUser.uid, nextSavedPostSlugs);
    cacheSavedAiRadarItems(subscriberUser.uid, nextSavedAiRadarItems);

    try {
      trackAnalyticsEvent("unsaved_post", {
        category: removedSavedItem?.tags[0],
        slug: id,
        source: isSavedAiRadarId(id) ? "ai_radar" : "saved_posts",
        title: removedSavedItem?.title,
      });
      await unsaveReaderPost(subscriberUser.uid, id);
      setSubscriptionMessage("Removed from saved posts.");
    } catch (error) {
      setSavedPostSlugs(previousSavedPostSlugs);
      setSavedAiRadarItems(previousSavedAiRadarItems);
      cacheSavedPostSlugs(subscriberUser.uid, previousSavedPostSlugs);
      cacheSavedAiRadarItems(subscriberUser.uid, previousSavedAiRadarItems);
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
      trackAnalyticsEvent("newsletter_subscribe", {
        source: "signed_in_reader",
        title: "Portfolio updates",
      });
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
      setSavedAiRadarItems([]);
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
      <SiteAssistant
        currentPathname={currentPathname}
        isSubscribed={isSubscribed}
        isSuppressed={menuOpen || readerMenuOpen || profileMenuOpen}
        subscriberUser={subscriberUser}
      />
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
        onTrackBlogOpen={trackBlogOpen}
        onToggleSavedPost={handleToggleSavedPost}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isSavedPostsPage) {
    return renderWithAssistant(
      <SavedPostsPage
        authReady={authReady}
        savedItems={savedReaderItems}
        savedPostsBusySlug={savedPostsBusySlug}
        subscriberUser={subscriberUser}
        subscriptionError={subscriptionError}
        subscriptionMessage={subscriptionMessage}
        theme={theme}
        onRemoveSavedItem={handleRemoveSavedItem}
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
        isAiRadarSaved={isAiRadarSaved}
        savedPostsBusySlug={savedPostsBusySlug}
        subscriberUser={subscriberUser}
        theme={theme}
        onToggleSavedAiRadar={handleToggleSavedAiRadar}
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

  if (isLearnPage) {
    return renderWithAssistant(
      <LearnWithMePage
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      />,
    );
  }

  if (isActiveBuildsPage || activeBuildSlug) {
    return renderWithAssistant(
      <ActiveBuildsPage
        activeBuildSlug={activeBuildSlug}
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
        onTrackBlogOpen={trackBlogOpen}
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

  if (isAboutPage) {
    return renderWithAssistant(
      <AboutPage
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
                setMoreMenuOpen(false);
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

          <button
            className={`site-nav-backdrop${menuOpen ? " is-open" : ""}`}
            type="button"
            aria-label="Close main menu"
            onClick={closeMenu}
          />

          <nav
            className={`site-nav${menuOpen ? " is-open" : ""}`}
            id="site-navigation"
            aria-label="Primary"
            aria-hidden={compactNavIsHidden}
            inert={compactNavIsHidden}
          >
            <div className="site-nav-drawer-heading">
              <div>
                <p className="impact-label">Main Menu</p>
                <h2>Explore the site</h2>
              </div>
              <button className="reader-menu-close" type="button" onClick={closeMenu}>
                Close
              </button>
            </div>

            {currentNavLinks.map((link) => {
              const linkHref = "href" in link ? link.href : `#${link.id}`;

              return (
                <a
                  key={link.label}
                  className={isNavLinkActive(link) ? "is-active" : ""}
                  href={linkHref}
                  onClick={() => {
                    rememberCurrentNavigationFlow(linkHref);
                    closeMenu();
                  }}
                >
                  {link.label}
                </a>
              );
            })}
            {currentMoreNavLinks.length && isCompactNav
              ? currentMoreNavLinks.map((link) => (
                  <a
                    key={link.label}
                    className={isNavLinkActive(link) ? "is-active" : ""}
                    href={link.href}
                    onClick={() => {
                      rememberCurrentNavigationFlow(link.href);
                      closeMenu();
                    }}
                  >
                    {link.label}
                  </a>
                ))
              : null}
            {currentMoreNavLinks.length && !isCompactNav ? (
              <details
                className={`site-nav-more${moreMenuOpen ? " is-open" : ""}${
                  currentMoreNavLinks.some(isNavLinkActive) ? " has-active" : ""
                }`}
                open={moreMenuOpen}
                ref={moreMenuRef}
                onToggle={(event) => {
                  setMoreMenuOpen(event.currentTarget.open);
                  setProfileMenuOpen(false);
                }}
              >
                <summary
                  className="site-nav-more-button"
                  aria-controls="site-navigation-more"
                  aria-expanded={moreMenuOpen}
                >
                  <span className="site-nav-more-label">
                    <span>More</span>
                  </span>
                  <span className="site-nav-more-caret" aria-hidden="true" />
                </summary>

                <div className="site-nav-more-panel" id="site-navigation-more">
                  {currentMoreNavLinks.map((link) => (
                    <a
                      key={link.label}
                      className={isNavLinkActive(link) ? "is-active" : ""}
                      href={link.href}
                      onClick={() => {
                        rememberCurrentNavigationFlow(link.href);
                        closeMenu();
                      }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </details>
            ) : null}
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
                onToggle={() => {
                  setProfileMenuOpen((open) => !open);
                  setMoreMenuOpen(false);
                }}
                onUnsubscribe={handleUnsubscribe}
              />
            </div>

            <button
              className="menu-toggle"
              type="button"
              aria-controls="site-navigation"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation"
              onClick={() => {
                setMenuOpen((open) => !open);
                setMoreMenuOpen(false);
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
        savedItemCount={savedReaderItems.length}
        subscriberName={subscriberName}
        onClose={() => setReaderMenuOpen(false)}
      />

      <main id="main-content">
        {isPortfolioPage ? (
          <>
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

        <section className="section shell portfolio-about-section" id="about">
          <SectionHeading
            eyebrow="About"
            title="Backend systems where speed, search quality, and explainable AI meet."
            description="I focus on reliable services, practical ranking logic, and AI workflows that stay clear enough to operate."
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
                description="Cloud-native platform work and latency reduction."
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
                description="Explore one case study at a time."
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
                description="Java backend, Oracle systems, search, and AI."
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

        {isPortfolioPage ? (
          <>
            <section className="section shell" id="recognition">
              <SectionHeading
                eyebrow="Recognition"
                title="A couple of external signals that back up the delivery story."
                description="Recognition tied to measurable execution."
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
                description="Education and professional certifications."
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

                <div className="credential-panel certification-panel">
                  <div className="credential-panel-heading">
                    <h3>Certifications</h3>
                    <span>{certifications.length} credentials</span>
                  </div>

                  <div className="certification-groups">
                    {certificationGroups.map((group) => (
                      <section
                        className="certification-group"
                        key={group.category}
                        aria-label={`${group.category} certifications`}
                      >
                        <div className="certification-group-heading">
                          <p>{group.category}</p>
                          <span>{group.items.length}</span>
                        </div>

                        <div className="certification-list">
                          {group.items.map((item) => (
                            <article className="credential-item certification-item" key={`${item.title}-${item.year}`}>
                              <div className="certification-item-main">
                                <p className="credential-title">{item.title}</p>
                                <span className="credential-year">{item.year}</span>
                              </div>
                              <p className="credential-subtitle">{item.issuer}</p>
                              {item.credentialId ? (
                                <p className="credential-detail">Credential ID: {item.credentialId}</p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}

          </>
        ) : (
          <HomePage
            featuredBlog={featuredBlog}
            isPostSaved={isPostSaved}
            remainingBlogPosts={remainingBlogPosts}
            savedPostsBusySlug={savedPostsBusySlug}
            subscriberUser={subscriberUser}
            onTrackBlogOpen={trackBlogOpen}
            onToggleSavedPost={handleToggleSavedPost}
          />
        )}
      </main>
    </>,
  );
}

export default App;
