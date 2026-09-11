import { projects, profile } from "../data/portfolio";
import "./ProjectPage.css";

export default function ProjectPage({ slug }: { slug: string }) {
  const project = projects.find((item) => item.slug === slug);
  const benchmark = slug === "high-volume-batch-processing" ? { before: 125, after: 3, unit: "minutes", label: "5,000-transaction batch duration" } : slug === "real-time-screening-optimization" ? { before: 2000, after: 300, unit: "ms", label: "Reported real-time response latency" } : null;
  return <div className="project-page shell">
    <a className="project-skip" href="#project-content">Skip to case study</a>
    <header className="project-page-nav"><a href="/">{profile.name}</a><nav aria-label="Project navigation"><a href="/portfolio#work">All projects</a><a href="/SaiKumarResume.pdf" target="_blank" rel="noreferrer">Resume ↗</a><a href="/work-with-me">Contact</a></nav></header>
    {!project ? <main id="project-content"><h1>Project not found</h1><p>This project link is not available.</p><a href="/portfolio#work">Browse project case studies</a></main> : <main id="project-content">
      <header className="project-page-hero"><p className="eyebrow">Engineering case study</p><h1>{project.name}</h1><p>{project.summary}</p><ul className="project-page-stack" aria-label="Technology stack">{project.stack.map((tech) => <li key={tech}>{tech}</li>)}</ul></header>
      <div className="case-study-context"><section><h2>01 / The problem</h2><p>{project.problem}</p></section><section><h2>02 / My contribution</h2><p>{project.contribution}</p></section></div>
      <figure className="case-study-architecture"><figcaption>03 / Architecture <small>Simplified logical flow based on the project description; not a deployment diagram.</small></figcaption><ol>{project.architecture.map((step, index) => <li key={step}><span>0{index + 1}</span><strong>{step}</strong></li>)}</ol></figure>
      <section className="project-page-result"><h2>04 / Reported result</h2><p className="project-page-impact">{project.result}</p>
        {benchmark && <figure className="project-benchmark"><figcaption>{benchmark.label} · lower is better</figcaption>{[["Before", benchmark.before], ["After", benchmark.after]].map(([label, value]) => <div className="project-benchmark-row" key={label}><span>{label}</span><div aria-hidden="true"><i style={{ width: `${Number(value) / benchmark.before * 100}%` }} /></div><strong>{value} {benchmark.unit}</strong></div>)}</figure>}
        <p className="case-study-evidence">{project.evidenceNote}</p>
      </section>
      <section className="project-page-details"><h2>05 / Implementation details</h2><ul>{project.highlights.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <footer className="project-page-contact"><h2>Want to discuss the engineering?</h2><p>Get in touch to talk about the approach, trade-offs and implementation.</p><a className="button button-primary" href={`mailto:${profile.email}`}>Email Sai</a><a className="button button-secondary" href="/SaiKumarResume.pdf" target="_blank" rel="noreferrer">View resume ↗</a></footer>
      <nav className="project-page-more" aria-label="Other project case studies"><h2>Explore another project</h2>{projects.filter((item) => item.slug !== slug).map((item) => <a key={item.slug} href={`/projects/${item.slug}`}>{item.name} <span aria-hidden="true">↗</span></a>)}</nav>
    </main>}
  </div>;
}
