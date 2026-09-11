import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ReaderMenuProps = {
  isOpen: boolean;
  isSignedIn: boolean;
  savedItemCount: number;
  subscriberName: string;
  onClose: () => void;
};

export default function ReaderMenu({ isOpen, isSignedIn, savedItemCount, subscriberName, onClose }: ReaderMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    if (!panel || !isOpen) return;
    const overflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    panel.showModal();
    document.body.style.overflow = "hidden";
    return () => { panel.close(); document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.getClientRects().length) previousFocus.focus();
      else document.querySelector<HTMLButtonElement>(".unified-toggle")?.focus(); };
  }, [isOpen]);

  if (typeof document === "undefined") return null;
  const groups = [
    { title: "Your reading", links: [["/blogs", "All writing", "Engineering notes and practical ideas"], ["/shelf", "Sai’s Shelf", "Books, resources, and recommendations"]] },
    { title: "Around the site", links: [["/learn-with-me", "Learn With Me", "Explore the fundamentals"], ["/whats-new", "What’s New", "The latest additions"], ["/work-with-me", "Work With Me", "Start a conversation"], ["/about", "About", "A little more about Sai"]] },
  ];
  return createPortal(<dialog ref={dialog} className="reader-drawer" aria-labelledby="reader-drawer-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== dialog.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className="reader-drawer-header"><a href="/" className="reader-drawer-brand" onClick={onClose} aria-label="Home">SKM<span>.</span></a><button type="button" onClick={onClose} aria-label="Close reader menu">Close <span aria-hidden="true">×</span></button></header>
    <div className="reader-drawer-body">
      <p className="reader-drawer-label">Your corner of the site</p><h2 id="reader-drawer-title">Reader menu<span>.</span></h2><p className="reader-drawer-intro">{isSignedIn ? `Welcome back, ${subscriberName || "reader"}.` : "Useful reads. A place to return to."}</p>
      <a className="reader-drawer-saved" href={isSignedIn ? "/saved-posts" : "/signin?return=saved-posts"} onClick={onClose}><div><span className="reader-drawer-label">Saved for later</span><strong>Saved Posts <span aria-hidden="true">↗</span></strong><small>{isSignedIn ? `${savedItemCount} ${savedItemCount === 1 ? "item" : "items"} in your reading list` : "Keep your favourite articles together."}</small></div>{isSignedIn && <span className="reader-drawer-count">{savedItemCount}</span>}</a>
      {groups.map(group => <nav className="reader-drawer-links" aria-label={group.title} key={group.title}><h3>{group.title}</h3>{group.links.map(([href, label, detail]) => <a href={href} key={href} onClick={onClose}><div><strong>{label}</strong><small>{detail}</small></div><span aria-hidden="true">↗</span></a>)}</nav>)}
      <footer className="reader-drawer-footer"><a href="/#newsletter" onClick={onClose}>Email preferences <span aria-hidden="true">↗</span></a><a href="/" onClick={onClose}>Back to home</a></footer>
    </div>
  </dialog>, document.body);
}
