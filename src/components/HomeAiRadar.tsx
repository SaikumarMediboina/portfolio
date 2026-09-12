import { useEffect, useState } from "react";

type Update = { title: string; source: string; href: string; publishedAt: string };
const FRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function selectHomeRadarUpdates(data: unknown, now = Date.now()): Update[] {
  const items = data && typeof data === "object" && "items" in data ? data.items : null;
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.filter((item): item is Update => {
    if (!item || item.isLive !== true ||
      ![item.title, item.source, item.href, item.publishedAt].every(value => typeof value === "string" && value.trim())) return false;
    const published = Date.parse(item.publishedAt);
    if (!Number.isFinite(published) || published > now || now - published > FRESH_WINDOW_MS) return false;
    try { if (!["https:", "http:"].includes(new URL(item.href).protocol)) return false; }
    catch { return false; }
    return true;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).filter(item => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  }).slice(0, 2);
}

export default function HomeAiRadar() {
  const [updates, setUpdates] = useState<Update[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    const load = async () => {
      try {
        const response = await fetch("/api/ai-radar?limit=18&sort=latest", { signal: controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (!controller.signal.aborted) setUpdates(selectHomeRadarUpdates(data));
      } catch { /* Keep the direct Radar link available if the feed cannot load. */ }
      finally { window.clearTimeout(timeout); }
    };
    void load();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, []);

  return <section className="landing-radar landing-radar-compact" aria-labelledby="landing-radar-title">
    <div className="landing-radar-heading">
      <div><h2 id="landing-radar-title">AI Radar<span aria-hidden="true">.</span></h2><p>AI updates worth your time.</p></div>

    </div>
    {updates.length > 0 && <ul className="landing-radar-list">{updates.map(update => <li key={update.href}>
      <a className="landing-radar-row" href={update.href} target="_blank" rel="noreferrer">
        <h3>{update.title}<span className="landing-radar-arrow" aria-hidden="true"> ↗</span></h3>
        <span className="landing-radar-meta"><span>{update.source}</span><time dateTime={update.publishedAt}>{new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(update.publishedAt))}</time></span>
      </a>
    </li>)}</ul>}
      <a className="landing-radar-all" href="/ai-radar">{updates.length ? "View all updates" : "Explore AI Radar"} <span aria-hidden="true">↗</span></a>
  </section>;
}
