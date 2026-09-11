import HomeAiRadar from "./HomeAiRadar";
import type { BlogPost } from "../data/blogs";
import { profile, projects } from "../data/portfolio";

const selected = ["enterprise-rag-knowledge-assistant", "high-volume-batch-processing", "core-search-engine-migration"];
export default function HomeLanding({ post, onRead }: { post?: BlogPost; onRead: (post: BlogPost) => void }) {
  return <div className="editorial-home">
    <section className="landing-intro design-container" id="top">
      <p className="design-label">Backend engineering · Search · Applied AI</p>
      <h1>Sai Kumar<br />Mediboina<span>.</span></h1>
      <p className="landing-role">Software Application Engineer at Oracle <span>· NITK alumnus</span></p>
      <p className="landing-description">I build reliable backend systems, search platforms, and practical AI applications.</p>
      <div className="design-actions"><a className="design-primary" href="/portfolio#work">Explore my work ↗</a><a className="design-secondary" href="/SaiKumarResume.pdf" download>Download résumé</a></div>
      <div className="landing-social"><a href={`mailto:${profile.email}`}>Email</a><a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></div>
    </section>
    <section className="landing-work design-container" aria-labelledby="landing-work-title">
      <div className="landing-section-heading"><div><p className="design-label">Selected work</p><h2 id="landing-work-title">Built for real-world constraints.</h2></div><a href="/portfolio#work">All case studies ↗</a></div>
      <div className="landing-projects">{selected.map((slug, index) => {
        const project = projects.find((item) => item.slug === slug);
        if (!project) return null;
        return <article key={slug}><p className="design-label">0{index + 1} / {["Applied AI", "Performance", "Search architecture"][index]}</p><h3><a href={`/projects/${project.slug}`}>{project.name}</a></h3><p>{project.summary}</p><p className="landing-outcome">{project.result}</p><a className="landing-case-link" href={`/projects/${project.slug}`}>Read case study ↗</a></article>;
      })}</div>
    </section>
    {post && <section className="landing-writing design-container" aria-labelledby="landing-writing-title"><div><p className="design-label">From the notebook</p><h2 id="landing-writing-title">Engineering, explained.</h2><a href="/blogs">All writing ↗</a></div><article><p className="design-label">{post.category}</p><h3><a href={`/blog/${post.slug}`} onClick={() => onRead(post)}>{post.title}</a></h3><p>{post.summary}</p><a href={`/blog/${post.slug}`} onClick={() => onRead(post)}>Read article ↗</a></article></section>}
    <HomeAiRadar />
    <section className="landing-contact design-container"><p className="design-label">Get in touch</p><h2>Good systems start<br />with a conversation.</h2><p>For backend, search, and applied AI opportunities.</p><div className="design-actions"><a className="design-primary" href={`mailto:${profile.email}`}>Email Sai ↗</a><a className="design-secondary" href="/work-with-me">Contact details</a></div></section>
  </div>;
}
