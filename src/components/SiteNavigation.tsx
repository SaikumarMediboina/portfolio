import HeaderAccount from "./HeaderAccount";
import { useEffect, useRef, useState, type ReactNode } from "react";

const primary = [
  ["/portfolio", "Portfolio"], ["/blogs", "Writing"], ["/active-builds", "Active Builds"], ["/work-with-me", "Contact"],
];
const explore = [
  ["/learn-with-me", "Learn With Me"],
  ["/whats-new", "What's New"],
  ["/shelf", "Sai's Shelf"],
  ["/work-with-me", "Work With Me"],
  ["/about", "About"],
];

export default function SiteNavigation({ children, inlineActions = false, minimal, fallbackHref = "/" }: { children?: ReactNode; inlineActions?: boolean; minimal?: boolean; fallbackHref?: string }) {
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  const preserveHeader = normalizedPath === "/" || normalizedPath === "/portfolio" || normalizedPath === "/blogs" || /^\/blogs?\//.test(normalizedPath);
  const compact = minimal ?? !preserveHeader;
  const goBack = () => {
    try {
      if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch { /* Use the explicit fallback when a referrer cannot be parsed. */ }
    window.location.href = fallbackHref;
  };
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
  return <header ref={header} className={`unified-header${open ? " is-open" : ""}${compact ? " unified-minimal" : ""}`} onKeyDown={(event) => {
    if (event.key === "Escape") {
      if (details.current?.open) {
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      } else if (open) { setOpen(false); toggle.current?.focus(); }
    }
  }}>
    <div className="unified-bar">
      <a className="unified-brand" href="/" aria-label="Sai Kumar Mediboina home">SKM<span aria-hidden="true">.</span></a>
      <HeaderAccount />
      {compact ? <nav className="unified-back-action" aria-label="Back navigation">{children ?? <button className="button button-secondary page-back-button" type="button" onClick={goBack}>Back</button>}</nav> : <>
      <button ref={toggle} className="unified-toggle" type="button" aria-expanded={open} aria-controls="unified-navigation" onClick={() => setOpen(!open)}>{open ? "Close ×" : "Menu ☰"}</button>
      <nav id="unified-navigation" className="unified-links" aria-label="Main navigation" onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setOpen(false);
      }}>
        {primary.map(([href, label]) => <a key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</a>)}
        <a href="/SaiKumarResume.pdf" target="_blank" rel="noreferrer">Résumé ↗</a>
        <details className="unified-explore" ref={details}><summary>Explore</summary><div>{explore.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</div></details>
        {inlineActions && children && <div className="unified-context unified-inline-actions">{children}</div>}
      </nav>
      </>}
    </div>
    {!compact && !inlineActions && children && <div className="unified-context">{children}</div>}
  </header>;
}
