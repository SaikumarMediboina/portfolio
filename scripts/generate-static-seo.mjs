import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const indexPath = path.join(distDir, "index.html");
const SITE_URL = "https://saikumarmediboina.com";
const SITE_NAME = "Sai Kumar Mediboina";
const DEFAULT_SEO_IMAGE_PATH = "/og-default.svg";
const BLOG_SEO_IMAGE_PATH = "/og-blog.svg";
const AI_RADAR_SEO_IMAGE_PATH = "/og-ai-radar.svg";
const DASHBOARD_SEO_IMAGE_PATH = "/og-dashboard.svg";
const DEFAULT_SEO_DESCRIPTION =
  "Portfolio of Sai Kumar Mediboina, a Software Application Engineer specializing in high-throughput screening, search systems, and performance optimization.";
const SEO_BLOCK_PATTERN = /<!-- SEO_METADATA_START -->[\s\S]*?<!-- SEO_METADATA_END -->/;

function loadTsModule(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };

  new Function("exports", "module", outputText)(module.exports, module);

  return module.exports;
}

const { blogPosts } = loadTsModule("src/data/blogs.ts");
const { education, profile, skills } = loadTsModule("src/data/portfolio.ts");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function getAbsoluteSiteUrl(routePath = "/") {
  const cleanPath = routePath.startsWith("/") ? routePath : `/${routePath}`;

  return `${SITE_URL}${cleanPath === "/" ? "/" : cleanPath}`;
}

function getSeoTitle(title) {
  return `${title} | ${SITE_NAME}`;
}

function getBlogArticleHref(slug) {
  return `/blog/${encodeURIComponent(slug)}`;
}

function getBlogPublishedIsoDate(publishedAt) {
  const match = String(publishedAt).match(/([A-Za-z]+)\s+(\d{4})/);

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

function getBlogReadableText(post) {
  return [
    post.title,
    post.category,
    post.summary,
    ...(post.tags ?? []),
    ...post.takeaways,
    ...post.stats.flatMap((stat) => [stat.label, stat.value]),
    ...post.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? []),
    ]),
  ].join(" ");
}

function getBlogWordCount(post) {
  return getBlogReadableText(post)
    .split(/\s+/)
    .filter(Boolean).length;
}

function getBlogPostTags(post) {
  return Array.from(new Set([post.category, ...(post.tags ?? [])].filter(Boolean)));
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

function getWebPageStructuredData(metadata, pageType = "WebPage") {
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

function getBlogArticleStructuredData(post) {
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

function withStructuredData(metadata, extraStructuredData = []) {
  const pageType = metadata.type === "profile" ? "ProfilePage" : "WebPage";

  return {
    ...metadata,
    structuredData: [
      getPersonStructuredData(),
      getWebsiteStructuredData(),
      getWebPageStructuredData(metadata, pageType),
      ...extraStructuredData,
    ],
  };
}

const baseMetadata = {
  canonicalPath: "/",
  description: DEFAULT_SEO_DESCRIPTION,
  imageAlt: "Sai Kumar Mediboina portfolio preview card",
  imagePath: DEFAULT_SEO_IMAGE_PATH,
  priority: "1.0",
  title: getSeoTitle("Software Application Engineer"),
  type: "profile",
};

const staticRoutes = [
  withStructuredData(baseMetadata),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/start",
    description:
      "Start here to explore Sai Kumar Mediboina's portfolio, engineering notes, AI Radar, saved resources, and latest updates.",
    priority: "0.9",
    title: getSeoTitle("Start Here"),
    type: "website",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/portfolio",
    description:
      "Explore Sai Kumar Mediboina's backend engineering portfolio, Oracle experience, performance metrics, projects, skills, education, and certifications.",
    priority: "0.95",
    title: getSeoTitle("Backend Engineering Portfolio"),
    type: "profile",
  }),
  withStructuredData(
    {
      ...baseMetadata,
      canonicalPath: "/blogs",
      description:
        "Read Sai Kumar Mediboina's engineering notes on backend performance, search architecture, AI relevance, and scalable systems.",
      imageAlt: "Engineering notes by Sai Kumar Mediboina",
      imagePath: BLOG_SEO_IMAGE_PATH,
      priority: "0.95",
      title: getSeoTitle("Engineering Notes"),
      type: "website",
    },
    [getBlogStructuredData()],
  ),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/ai-radar",
    description:
      "A curated AI Radar with trusted source links, short builder-focused context, and practical signals for AI engineers.",
    imageAlt: "AI Radar preview by Sai Kumar Mediboina",
    imagePath: AI_RADAR_SEO_IMAGE_PATH,
    priority: "0.85",
    title: getSeoTitle("AI Radar"),
    type: "website",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/whats-new",
    description:
      "See the latest portfolio updates, engineering notes, AI Radar additions, and site changes from Sai Kumar Mediboina.",
    priority: "0.75",
    title: getSeoTitle("What's New"),
    type: "website",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/shelf",
    description:
      "Sai's Shelf is a growing collection of useful engineering resources, CS fundamentals, AI notes, and practical learning material.",
    priority: "0.7",
    title: getSeoTitle("Sai's Shelf"),
    type: "website",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/dashboard",
    description:
      "A creator dashboard showing portfolio content coverage, publishing rhythm, analytics signals, and engineering-note momentum.",
    imageAlt: "Creator dashboard preview by Sai Kumar Mediboina",
    imagePath: DASHBOARD_SEO_IMAGE_PATH,
    priority: "0.75",
    title: getSeoTitle("Creator Dashboard"),
    type: "website",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/work-with-me",
    description:
      "Work with Sai Kumar Mediboina on backend performance, search-heavy systems, AI-assisted workflows, and scalable product engineering.",
    priority: "0.8",
    title: getSeoTitle("Work With Me"),
    type: "profile",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/work-with-me",
    description:
      "Contact Sai Kumar Mediboina for backend performance, search systems, AI workflows, and professional engineering collaboration.",
    noindex: true,
    priority: "0.2",
    routePath: "/contact",
    title: getSeoTitle("Contact"),
    type: "profile",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/signin",
    description:
      "Sign in to follow portfolio updates, unlock member reads, and save useful engineering posts.",
    noindex: true,
    priority: "0.1",
    title: getSeoTitle("Reader Sign In"),
    type: "website",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/saved-posts",
    description:
      "Saved posts and AI Radar stories for signed-in readers of Sai Kumar Mediboina's portfolio.",
    noindex: true,
    priority: "0.1",
    title: getSeoTitle("Saved Posts"),
    type: "website",
  }),
  withStructuredData({
    ...baseMetadata,
    canonicalPath: "/admin-update",
    description: "Private admin update sender for Sai Kumar Mediboina portfolio subscribers.",
    noindex: true,
    priority: "0.0",
    title: getSeoTitle("Admin Updates"),
    type: "website",
  }),
];

const blogRoutes = blogPosts.map((post) => {
  const publishedTime = getBlogPublishedIsoDate(post.publishedAt);
  const metadata = {
    canonicalPath: getBlogArticleHref(post.slug),
    description: post.summary,
    imageAlt: `${post.title} article preview`,
    imagePath: BLOG_SEO_IMAGE_PATH,
    priority: "0.82",
    publishedTime,
    title: getSeoTitle(post.title),
    type: "article",
  };

  return {
    ...metadata,
    structuredData: [
      getPersonStructuredData(),
      getWebsiteStructuredData(),
      getBlogArticleStructuredData(post),
    ],
  };
});

const allRoutes = [...staticRoutes, ...blogRoutes];

function renderSeoBlock(metadata) {
  const canonicalUrl = getAbsoluteSiteUrl(metadata.canonicalPath);
  const imageUrl = getAbsoluteSiteUrl(metadata.imagePath);
  const robotsValue = metadata.noindex
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large";
  const articleMeta = metadata.publishedTime
    ? `
    <meta property="article:published_time" content="${escapeHtml(metadata.publishedTime)}" />
    <meta property="article:modified_time" content="${escapeHtml(metadata.publishedTime)}" />
    <meta property="article:author" content="${escapeHtml(profile.name)}" />`
    : "";

  return `<!-- SEO_METADATA_START -->
    <title>${escapeHtml(metadata.title)}</title>
    <meta name="description" content="${escapeHtml(metadata.description)}" />
    <meta name="author" content="${escapeHtml(profile.name)}" />
    <meta name="robots" content="${robotsValue}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:title" content="${escapeHtml(metadata.title)}" />
    <meta property="og:description" content="${escapeHtml(metadata.description)}" />
    <meta property="og:type" content="${escapeHtml(metadata.type)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:type" content="image/svg+xml" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />${articleMeta}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <script id="structured-data-seo" type="application/ld+json">${safeJson(
      metadata.structuredData,
    )}</script>
    <!-- SEO_METADATA_END -->`;
}

function getRouteOutputPath(routePath) {
  if (routePath === "/") {
    return indexPath;
  }

  return path.join(distDir, routePath.replace(/^\//, ""), "index.html");
}

function writeRouteHtml(template, metadata) {
  const outputPath = getRouteOutputPath(metadata.routePath || metadata.canonicalPath);
  const nextHtml = template.replace(SEO_BLOCK_PATTERN, renderSeoBlock(metadata));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, nextHtml);
}

function renderSitemap() {
  const urls = allRoutes
    .filter((route) => !route.noindex && route.canonicalPath !== "/contact")
    .map((route) => {
      const lastmod = route.publishedTime || "2026-05-19";

      return `  <url>
    <loc>${escapeHtml(getAbsoluteSiteUrl(route.canonicalPath))}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.canonicalPath.startsWith("/blog/") ? "monthly" : "weekly"}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function renderRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /admin-update
Disallow: /signin
Disallow: /saved-posts
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

if (!fs.existsSync(indexPath)) {
  throw new Error("dist/index.html was not found. Run this after vite build.");
}

const template = fs.readFileSync(indexPath, "utf8");

if (!SEO_BLOCK_PATTERN.test(template)) {
  throw new Error("SEO metadata block was not found in dist/index.html.");
}

allRoutes.forEach((route) => writeRouteHtml(template, route));
fs.writeFileSync(path.join(distDir, "sitemap.xml"), renderSitemap());
fs.writeFileSync(path.join(distDir, "robots.txt"), renderRobotsTxt());

console.log(`Generated SEO metadata for ${allRoutes.length} routes.`);
