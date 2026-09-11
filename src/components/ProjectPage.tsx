import { projects, profile } from "../data/portfolio";
import "./ProjectPage.css";
import SiteNavigation from "./SiteNavigation";

const designNotes: Record<string, { decision: string; tradeoff: string }> = {
  "matching-and-scoring-engine": { decision: "Use screening APIs and resilient ingestion to support both interactive requests and batch workloads.", tradeoff: "These workloads share matching logic but have different latency and throughput needs. A throughput figure alone does not describe interactive response quality." },
  "core-search-engine-migration": { decision: "Move core search from OpenSearch to Oracle Text, bringing matching closer to the stored data.", tradeoff: "Storage-local computation simplifies the search path, but makes database capacity and query tuning more important." },
  "advanced-hybrid-scoring-engine": { decision: "Combine deterministic, fuzzy, and AI similarity signals in a configurable scoring service.", tradeoff: "Combining signals gives more tuning control, but thresholds still need evaluation against false positives and missed matches." },
  "high-volume-batch-processing": { decision: "Replace repeated per-record access with aggregated queries, targeted indexes, and parallel processing.", tradeoff: "Parallelism is useful only while database capacity and transaction isolation remain under control. More threads alone are not the fix." },
  "real-time-screening-optimization": { decision: "Parallelize database work and stream incremental results instead of waiting for JSON aggregation.", tradeoff: "An asynchronous path requires explicit coordination of errors, cancellation, and partial results; a faster response is not the only correctness criterion." },
  "narrative-text-extraction-engine": { decision: "Rank candidate substrings using match quality, token length, and gap penalties before the screening stage.", tradeoff: "Configurable extraction gives control over noisy inputs, but precision claims require representative labelled examples." },
  "enterprise-rag-knowledge-assistant": { decision: "Retrieve and rerank curated evidence before streaming a source-cited answer, using a bounded context of up to five chunks.", tradeoff: "A small evidence window keeps context bounded, but retrieval can omit relevant material. Citations make evidence inspectable; they do not guarantee correctness." },
};

export default function ProjectPage({ slug }: { slug: string }) {
  const project = projects.find((item) => item.slug === slug);
  const notes = designNotes[slug];
  const benchmark = slug === "high-volume-batch-processing" ? { before: 125, after: 3, unit: "minutes", label: "5,000-transaction batch duration" } : slug === "real-time-screening-optimization" ? { before: 2000, after: 300, unit: "ms", label: "Reported real-time response latency" } : null;
  return <><SiteNavigation fallbackHref="/portfolio#work" /><div className="project-page shell">
    <a className="project-skip" href="#project-content">Skip to case study</a>
    <a className="project-return" href="/portfolio#work">← All case studies</a>
    {!project ? <main id="project-content"><h1>Project not found</h1><p>This project link is not available.</p><a href="/portfolio#work">Browse project case studies</a></main> : <main id="project-content">
      <header className="project-page-hero"><p className="eyebrow">Engineering case study</p><h1>{project.name}</h1><p>{project.summary}</p><ul className="project-page-stack" aria-label="Technology stack">{project.stack.map((tech) => <li key={tech}>{tech}</li>)}</ul></header>
      <div className="case-study-context"><section><h2>01 / The problem</h2><p>{project.problem}</p></section><section><h2>02 / My contribution</h2><p>{project.contribution}</p></section></div>
      <figure className="case-study-architecture"><figcaption>03 / Architecture</figcaption><ol>{project.architecture.map((step, index) => <li key={step}><span>0{index + 1}</span><strong>{step}</strong></li>)}</ol></figure>
      {notes && <section className="project-decision"><h2>04 / The design decision</h2><p>{notes.decision}</p><p><strong>The trade-off.</strong> {notes.tradeoff}</p></section>}
      <section className="project-page-result"><h2>05 / Reported result</h2><p className="project-page-impact">{project.result}</p>
        {benchmark && <figure className="project-benchmark"><figcaption>{benchmark.label} · lower is better</figcaption>{[["Before", benchmark.before], ["After", benchmark.after]].map(([label, value]) => <div className="project-benchmark-row" key={label}><span>{label}</span><div aria-hidden="true"><i style={{ width: `${Number(value) / benchmark.before * 100}%` }} /></div><strong>{value} {benchmark.unit}</strong></div>)}</figure>}
        <p className="case-study-evidence">{project.evidenceNote}</p>
      </section>
      <section className="project-page-details"><h2>06 / Implementation details</h2><ul>{project.highlights.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <footer className="project-page-contact"><h2>Want to discuss the engineering?</h2><p>Get in touch to talk about the approach, trade-offs and implementation.</p><a className="button button-primary" href={`mailto:${profile.email}`}>Email Sai</a><a className="button button-secondary" href="/SaiKumarResume.pdf" target="_blank" rel="noreferrer">View resume ↗</a></footer>
      <nav className="project-page-more" aria-label="Other project case studies"><h2>Explore another project</h2>{projects.filter((item) => item.slug !== slug).map((item) => <a key={item.slug} href={`/projects/${item.slug}`}>{item.name} <span aria-hidden="true">↗</span></a>)}</nav>
    </main>}
  </div></>;
}
