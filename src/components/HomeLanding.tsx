import HomeAiRadar from "./HomeAiRadar";
import type { BlogPost } from "../data/blogs";
import { profile } from "../data/portfolio";

export default function HomeLanding({ post, onRead }: { post?: BlogPost; onRead: (post: BlogPost) => void }) {
  return <div className="editorial-home">
    <div className="landing-hero design-container" id="top">
    <section className="landing-intro" aria-label="Introduction">
      <p className="design-label">Backend engineering · Search · Applied AI</p>
      <h1>Sai Kumar<br />Mediboina<span>.</span></h1>
      <p className="landing-role">Software Application Engineer at Oracle <span>· NITK alumnus</span></p>
      <p className="landing-description">I build reliable backend systems, search platforms, and practical AI applications.</p>
      <div className="design-actions"><a className="design-primary" href="/portfolio">View portfolio ↗</a><a className="design-secondary" href="/SaiKumarResume.pdf" download>Download résumé</a></div>
      <div className="landing-social"><a href={`mailto:${profile.email}`}>Email</a><a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a></div>
    </section>
    <HomeAiRadar />
    </div>
    <section className="landing-current design-container" aria-labelledby="landing-current-title">
      <div><p className="design-label">What I’m building</p><h2 id="landing-current-title">Sai’s Assistant<span>.</span></h2><p className="landing-current-description">A site assistant that connects portfolio knowledge with an LLM, cites its sources, and helps you find the right page.</p></div>
      <div className="landing-current-actions"><a href="/active-builds/sai-assistant">Inside the build <span aria-hidden="true">↗</span></a><a href="/active-builds">All active builds <span aria-hidden="true">↗</span></a></div>
    </section>
    {post && <section className="landing-writing design-container" aria-labelledby="landing-writing-title"><div><p className="design-label">From the notebook</p><h2 id="landing-writing-title">Engineering, explained.</h2><a href="/blogs">All writing ↗</a></div><article><p className="design-label">{post.category}</p><h3><a href={`/blog/${post.slug}`} onClick={() => onRead(post)}>{post.title}</a></h3><p>{post.summary}</p><a href={`/blog/${post.slug}`} onClick={() => onRead(post)}>Read article ↗</a></article></section>}

    <section className="landing-contact design-container"><p className="design-label">Get in touch</p><h2>Good systems start<br />with a conversation.</h2><p>For backend, search, and applied AI opportunities.</p><div className="design-actions"><a className="design-primary" href={`mailto:${profile.email}`}>Email Sai ↗</a><a className="design-secondary" href="/work-with-me">Contact details</a></div></section>
  </div>;
}
