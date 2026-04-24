import { startTransition, useEffect, useState } from "react";
import {
  blogPosts,
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

const navLinks = [
  { id: "about", label: "About" },
  { id: "work", label: "Work" },
  { id: "blogs", label: "Blogs" },
  { id: "recognition", label: "Recognition" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Skills" },
  { id: "credentials", label: "Credentials" },
  { id: "contact", label: "Contact" },
] as const;

type Theme = "light" | "dark";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

const THEME_STORAGE_KEY = "portfolio-theme";

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

function App() {
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const selectedProject = projects[selectedProjectIndex];
  const selectedProjectNumber = String(selectedProjectIndex + 1).padStart(2, "0");

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

  const closeMenu = () => setMenuOpen(false);

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
          </nav>

          <div className="header-actions">
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            >
              <span className="theme-toggle-indicator" aria-hidden="true" />
              <span>{theme === "light" ? "Dark theme" : "Light theme"}</span>
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

        <section className="section shell" id="blogs">
          <SectionHeading
            eyebrow="Blogs"
            title="Short engineering write-ups that turn resume bullets into clearer technical stories."
            description="These featured posts are meant to show how I think through performance work, search migrations, and AI or LLM-oriented system design in a more practical way."
          />

          <div className="blog-grid">
            {blogPosts.map((post) => (
              <article className="blog-card" key={post.title}>
                <div className="blog-meta">
                  <span>{post.category}</span>
                  <span>{post.publishedAt}</span>
                  <span>{post.readTime}</span>
                </div>
                <h3>{post.title}</h3>
                <p>{post.summary}</p>
                <ul className="bullet-list">
                  {post.takeaways.map((takeaway) => (
                    <li key={takeaway}>{takeaway}</li>
                  ))}
                </ul>
              </article>
            ))}
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

        <section className="section shell" id="experience">
          <SectionHeading
            eyebrow="Experience"
            title="Most of my recent experience is deep backend work inside high-volume compliance and intelligence systems."
            description="The emphasis has been cloud-native platform work, search-heavy architectures, AI-assisted relevance, and latency reduction across both real-time and batch screening paths."
          />

          <div className="timeline">
            {experience.map((item) => (
              <article className="timeline-card" key={`${item.company}-${item.role}`}>
                <div className="timeline-meta">
                  <p className="timeline-role">{item.role}</p>
                  <p>{item.company}</p>
                  <p>{item.period}</p>
                  <p>{item.location}</p>
                </div>

                <div className="timeline-body">
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
