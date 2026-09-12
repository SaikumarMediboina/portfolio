import { certifications, education, experience, profile, projects, recognitions } from "../data/portfolio";
import "./PortfolioPage.css";

const selectedSlugs = ["enterprise-rag-knowledge-assistant", "high-volume-batch-processing", "core-search-engine-migration"];
const featured = selectedSlugs.map((slug) => projects.find((project) => project.slug === slug)!).filter(Boolean);
const disciplines = [
  { title: "Backend Engineering", detail: "Java, Spring Boot, WebFlux, REST APIs, microservices and parallel processing." },
  { title: "Search & AI", detail: "Oracle Text, OpenSearch, hybrid retrieval, RAG, vector search and LLM workflows." },
  { title: "Cloud & Data", detail: "OCI, Kubernetes, Oracle, SQL, PL/SQL, Kafka and production observability." },
];

export default function PortfolioPage() {
  return <div className="folio">
    <a className="folio-skip" href="#main-content">Skip to content</a>
    <header className="folio-header folio-container">
      <a className="folio-wordmark" href="/" aria-label="Sai Kumar Mediboina home">SKM<span aria-hidden="true">.</span></a>
      <nav aria-label="Portfolio navigation">
        <a href="#work">Work</a><a href="#experience">Experience</a><a href="#contact">Contact</a>
        <a href="/SaiKumarResume.pdf" target="_blank" rel="noreferrer">Résumé ↗</a>
      </nav>
    </header>
    <main id="main-content" className="folio-container">
      <section className="folio-intro" id="top" aria-labelledby="folio-name">
        <p className="folio-kicker">Backend engineering · Search · Applied AI</p>
        <h1 id="folio-name">Sai Kumar<br />Mediboina<span>.</span></h1>
        <p className="folio-position">Software Application Engineer at Oracle <span>· NITK alumnus</span></p>
        <p className="folio-statement">Building reliable backend systems, search platforms, and practical AI applications.</p>
        <div className="folio-actions"><a className="folio-primary" href="#work">View work <span aria-hidden="true">↓</span></a><a className="folio-secondary" href="/SaiKumarResume.pdf" download>Download résumé <span aria-hidden="true">↗</span></a></div>
        <div className="folio-social"><a href={`mailto:${profile.email}`}>Email</a><a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></div>
      </section>

      <dl className="folio-impact" aria-label="Reported engineering results">
        <div><dt>5,000-transaction batch</dt><dd>125 <span>→</span> 3 min</dd></div>
        <div><dt>Real-time screening latency</dt><dd>2s <span>→</span> 300ms</dd></div>
        <div><dt>Throughput · sub-2.5s average latency</dt><dd>100+ TPS</dd></div>
      </dl>

      <section className="folio-work" id="work" aria-labelledby="folio-work-title">
        <div className="folio-section-title"><p className="folio-kicker">01 / Selected work</p><h2 id="folio-work-title">The systems behind the results.</h2><p>Three projects across applied AI, performance, and search architecture.</p></div>
        <div className="folio-project-grid">
          {featured.map((project, index) => <article className="folio-work-card" key={project.slug}>
            <p className="folio-kicker">0{index + 1} / {["Applied AI", "Performance", "Search architecture"][index]}</p>
            <h3><a href={`/projects/${project.slug}`}>{project.name}</a></h3>
            <p className="folio-work-summary">{project.summary}</p>
            <p className="folio-work-outcome">{project.result}</p>
            <a className="folio-work-link" href={`/projects/${project.slug}`}>Read case study <span aria-hidden="true">↗</span></a>
          </article>)}
        </div>
        <div className="folio-project-index"><p>Explore all {projects.length} engineering case studies.</p><a href="/projects">View all projects <span aria-hidden="true">↗</span></a></div>
      </section>

      <section className="folio-experience" id="experience" aria-labelledby="folio-experience-title">
        <div className="folio-section-title"><p className="folio-kicker">02 / Experience & foundation</p><h2 id="folio-experience-title">Engineering in practice.</h2></div>
        <div className="folio-career"><div><h3>Oracle</h3><p>Aug 2023 — Present</p></div><div className="folio-timeline">{experience[0].roles.map((role) => <article key={role.title}><p className="folio-date">{role.period}</p><h4>{role.title}</h4><p>{role.detail}</p></article>)}</div></div>
        <div className="folio-credibility"><div id="about"><h3>Education</h3>{education.map((item) => <p key={item.degree}><strong>{item.degree} · {item.school}</strong><span>{item.period} · {item.score}</span></p>)}</div><div id="recognition"><h3>Recognition</h3>{recognitions.map((item) => <p key={item.title}><strong>{item.title}</strong><span>{item.highlight}</span></p>)}</div></div>
        <section className="folio-skills" id="skills" aria-labelledby="folio-skills-title">
          <h3 id="folio-skills-title">Technical Skills</h3>
          <div className="folio-disciplines">{disciplines.map((item) => <div key={item.title}><h4>{item.title}</h4><p>{item.detail}</p></div>)}</div>
        </section>
        <details className="folio-certifications" id="credentials">
          <summary><span>Licenses & certifications</span><span>{certifications.length} entries</span></summary>
          <ul>{certifications.map((item) => <li key={`${item.title}-${item.year}`}>
            <span>{item.title}<small>{item.issuer}</small>
              {item.credentialId && <small>Credential ID: {item.credentialId}</small>}
              {item.credentialUrl && <a className="folio-credential-link" href={item.credentialUrl} target="_blank" rel="noreferrer">Show credential ↗</a>}
            </span>
            <span>{item.issued ? `Issued ${item.issued}` : item.year}</span>
          </li>)}</ul>
        </details>
      </section>

      <section className="folio-contact" id="contact" aria-labelledby="folio-contact-title"><p className="folio-kicker">03 / Get in touch</p><h2 id="folio-contact-title">Discuss a backend<br />or applied AI role.</h2><p>Happy to talk through the systems, decisions, and trade-offs behind my work.</p><div className="folio-actions"><a className="folio-primary" href={`mailto:${profile.email}`}>Email Sai <span aria-hidden="true">↗</span></a><a className="folio-secondary" href="/SaiKumarResume.pdf" download>Download résumé</a></div></section>
    </main>
    <footer className="folio-footer folio-container"><a href="/">Sai Kumar Mediboina</a><nav aria-label="Explore more"><a href="/blogs">Writing</a><a href="/learn-with-me">Learning</a><a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a><a href="#top">Back to top ↑</a></nav></footer>
  </div>;
}
