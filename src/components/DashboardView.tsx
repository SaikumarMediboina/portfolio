import SiteNavigation from "./SiteNavigation";

type DashboardViewProps = {
  summary: { articles: number; topics: number; projects: number; averageReadMinutes: number };
  signals: { label: string; value: string; detail: string }[];
  totalSignals: string;
  status: string;
  loading: boolean;
  events: { label: string; title: string; time: string }[];
  topics: { category: string; posts: number; readMinutes: number; score: number }[];
  articles: { slug: string; title: string; category: string; href: string; minutes: string; signal: string; score: number }[];
  onArticleOpen: (slug: string) => void;
};

export default function DashboardView({ summary, signals, totalSignals, status, loading, events, topics, articles, onArticleOpen }: DashboardViewProps) {
  const maxArticleScore = Math.max(1, ...articles.map(article => article.score));
  return <>
    <a className="skip-link" href="#main-content">Skip to dashboard</a>
    <SiteNavigation minimal fallbackHref="/" />
    <main className="studio-page dash-page" id="main-content">
      <header className="studio-intro dash-intro">
        <div><p className="studio-label">Behind the site</p><h1>Dashboard<span>.</span></h1><p className="studio-description">The writing, the work, and how people explore it.</p></div>
        <a className="studio-text-link" href="/blogs">Explore the writing <span aria-hidden="true">↗</span></a>
      </header>

      <dl className="dash-summary" aria-label="Published content summary">
        {[{ label: "Published articles", value: summary.articles }, { label: "Topics explored", value: summary.topics }, { label: "Projects", value: summary.projects }, { label: "Average read", value: summary.averageReadMinutes, unit: "min" }].map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}{item.unit && <small>{item.unit}</small>}</dd></div>)}
      </dl>

      <section className="dash-activity" aria-labelledby="dash-activity-title">
        <div className="dash-activity-heading"><div><p className="studio-label">01 / Site activity</p><h2 id="dash-activity-title">Small actions. Real interest.</h2></div><p className="dash-status" role="status"><span aria-hidden="true" />{loading ? "Refreshing activity…" : status}</p></div>
        <div className="dash-activity-layout">
          <div><div className="dash-total"><strong>{totalSignals}</strong><span>recorded interactions</span></div>
            <dl className="dash-signals">{signals.map(metric => <div key={metric.label}><dt title={metric.detail}>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
            <p className="dash-caption">Event counts · refreshes every 45 seconds</p>
          </div>
          <div className="dash-recent"><h3>Recent activity</h3>{events.length ? <ol>{events.map((event, index) => <li key={`${event.label}-${index}`}><div><span>{event.label}</span><small>{event.time}</small></div><p>{event.title}</p></li>)}</ol> : <div className="dash-empty"><span aria-hidden="true">↗</span><p>No activity recorded yet.</p><small>Page visits, article reads, and saves will appear here.</small></div>}</div>
        </div>
      </section>

      <section className="studio-section dash-coverage" aria-labelledby="dash-coverage-title">
        <div className="dash-section-intro"><p className="studio-label">02 / The knowledge base</p><h2 id="dash-coverage-title">Where the writing goes.</h2><p>Published articles by topic. Each bar shows its share of the library.</p><div className="dash-library-total"><strong>{topics.reduce((sum, topic) => sum + topic.readMinutes, 0)}</strong><span>minutes of reading</span></div></div>
        <div className="dash-topics">{topics.length ? topics.map(topic => <article key={topic.category}>
          <div className="dash-topic-heading"><h3>{topic.category}</h3><span>{topic.posts} {topic.posts === 1 ? "article" : "articles"}</span></div>
          <div className="dash-track" aria-hidden="true"><span style={{ width: `${topic.posts / Math.max(summary.articles, 1) * 100}%` }} /></div>
          <p><span>{Math.round(topic.posts / Math.max(summary.articles, 1) * 100)}% of library</span><span>{topic.readMinutes} min read</span></p>
        </article>) : <p className="dash-light-empty">Topic coverage will appear as articles are published.</p>}</div>
      </section>

      <section className="studio-section dash-reading" aria-labelledby="dash-reading-title">
        <div className="studio-section-heading"><div><p className="studio-label">03 / Further reading</p><h2 id="dash-reading-title">Room to go deeper.</h2></div><a className="studio-text-link" href="/blogs">All articles <span aria-hidden="true">↗</span></a></div>
        <p className="dash-reading-note">Longer, more structured reads, ranked by reading time, sections, and takeaways.</p>
        <ol className="dash-articles">{articles.map((article, index) => <li key={article.slug}>
          <a href={article.href} onClick={() => onArticleOpen(article.slug)}>
            <span className="dash-rank">{String(index + 1).padStart(2, "0")}</span>
            <div className="dash-article-copy"><h3>{article.title}</h3><p><span>{article.category}</span><span>{article.minutes}</span><span>{article.signal}</span></p></div>
            <div className="dash-depth"><span>Depth <strong>{article.score}</strong></span><div className="dash-track" aria-hidden="true"><span style={{ width: `${article.score / maxArticleScore * 100}%` }} /></div></div>
            <span className="dash-open" aria-hidden="true">↗</span>
          </a>
        </li>)}</ol>
        {!articles.length && <p className="dash-light-empty">New articles will appear here once published.</p>}
        <details className="dash-method"><summary>How the numbers work</summary><p>Content counts come from the published library. Reading depth = estimated minutes × 8 + sections × 6 + takeaways × 4. It describes article structure; visitor interactions are counted separately above.</p></details>
      </section>

      <aside className="dash-follow"><div><p className="studio-label">Keep in the loop</p><h2>More to build. More to share.</h2><p>New engineering notes and useful site updates, in your inbox.</p></div><a className="studio-primary" href="#newsletter">Get updates <span aria-hidden="true">↗</span></a></aside>
    </main>
  </>;
}
