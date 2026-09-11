import { useEffect, useRef, useState, type ReactNode } from "react";

const primary = [
  ["/portfolio", "Portfolio"], ["/blogs", "Writing"], ["/about", "About"], ["/work-with-me", "Contact"],
];
const explore = [
  ["/learn-with-me", "Learn With Me"],
  ["/whats-new", "What's New"],
  ["/shelf", "Sai's Shelf"],
  ["/work-with-me", "Work With Me"],
  ["/about", "About"],
];

export default function SiteNavigation({ children, inlineActions = false }: { children?: ReactNode; inlineActions?: boolean }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const update = () => document.documentElement.style.setProperty("--site-navigation-height", `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--site-navigation-height"); };
  }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        setOpen(false);
        if (details.current) details.current.open = false;
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <header ref={header} className={`unified-header${open ? " is-open" : ""}`} onKeyDown={(event) => {
    if (event.key === "Escape") {
      if (details.current?.open) {
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      } else if (open) { setOpen(false); toggle.current?.focus(); }
    }
  }}>
    <div className="unified-bar">
      <a className="unified-brand" href="/" aria-label="Sai Kumar Mediboina home">SKM<span aria-hidden="true">.</span></a>
      <button ref={toggle} className="unified-toggle" type="button" aria-expanded={open} aria-controls="unified-navigation" onClick={() => setOpen(!open)}>{open ? "Close ×" : "Menu ☰"}</button>
      <nav id="unified-navigation" className="unified-links" aria-label="Main navigation" onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setOpen(false);
      }}>
        {primary.map(([href, label]) => <a key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</a>)}
        <a href="/SaiKumarResume.pdf" target="_blank" rel="noreferrer">Résumé ↗</a>
        <details className="unified-explore" ref={details}><summary>Explore</summary><div>{explore.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</div></details>
        {inlineActions && children && <div className="unified-context unified-inline-actions">{children}</div>}
      </nav>
    </div>
    {!inlineActions && children && <div className="unified-context">{children}</div>}
  </header>;
}
