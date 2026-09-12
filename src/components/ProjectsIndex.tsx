import { projects } from "../data/portfolio";
import SiteNavigation from "./SiteNavigation";

const featuredOrder = ["enterprise-rag-knowledge-assistant", "high-volume-batch-processing", "core-search-engine-migration"];
const categories: Record<string, string> = {
  "enterprise-rag-knowledge-assistant": "Applied AI",
  "high-volume-batch-processing": "Performance",
  "core-search-engine-migration": "Search architecture",
  "matching-and-scoring-engine": "Backend systems",
  "advanced-hybrid-scoring-engine": "Search & scoring",
  "real-time-screening-optimization": "Performance",
  "narrative-text-extraction-engine": "Text processing",
};
const orderedProjects = [...projects].sort((a, b) => {
  const rank = (slug: string) => featuredOrder.includes(slug) ? featuredOrder.indexOf(slug) : featuredOrder.length;
  return rank(a.slug) - rank(b.slug);
});

export default function ProjectsIndex() {
  return <><a className="skip-link" href="#main-content">Skip to projects</a><SiteNavigation minimal fallbackHref="/portfolio#work" />
    <main className="studio-page project-index" id="main-content">
      <header className="studio-intro project-index-intro"><div><p className="studio-label">Engineering case studies</p><h1>Projects<span>.</span></h1><p className="studio-description">Backend systems, search, and applied AI.<br />The problems, decisions, and results behind the work.</p></div><span className="project-index-count">{projects.length} case studies</span></header>
      <div className="project-index-grid">{orderedProjects.map((project, index) => <article key={project.slug}>
        <p className="studio-label">{String(index + 1).padStart(2, "0")} / {categories[project.slug] ?? "Engineering"}</p>
        <h2><a href={`/projects/${project.slug}`}>{project.name}</a></h2>
        <p className="project-index-summary">{project.summary}</p>
        <div className="project-index-outcome"><span>Reported outcome</span><p>{project.result}</p></div>
        <a className="studio-text-link project-index-read" href={`/projects/${project.slug}`}>Read case study <span aria-hidden="true">↗</span></a>
      </article>)}</div>
      <footer className="project-index-footer"><div><h2>Want to talk through the work?</h2><p>Let’s discuss the approach, implementation, and trade-offs.</p></div><a className="studio-text-link" href="/work-with-me">Get in touch <span aria-hidden="true">↗</span></a></footer>
    </main></>;
}
