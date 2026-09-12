import type { ReactNode } from "react";
import SiteNavigation from "./SiteNavigation";

type SignInViewProps = {
  backAction: ReactNode; signedIn: boolean; subscribed: boolean; available: boolean; busy: boolean;
  name: string; email: string; initial: string; error: string; message: string; signedOutNotice: string;
  destination: { href: string; label: string }; context: "saved-posts" | "ai-radar" | "article" | "general";
  onSignIn: () => void; onSignOut: () => void; onSubscribe: () => void; onUnsubscribe: () => void;
};

export default function SignInView({ backAction, signedIn, subscribed, available, busy, name, email, initial, error, message, signedOutNotice, destination, context, onSignIn, onSignOut, onSubscribe, onUnsubscribe }: SignInViewProps) {
  const description = context === "saved-posts" ? "Sign in to open your saved posts and pick up where you left off." : context === "ai-radar" ? "Sign in to save AI Radar stories and return to the ideas worth keeping." : context === "article" ? "Sign in to continue reading this engineering note." : "Save useful reads, explore engineering notes, and choose the updates you receive.";
  return <><a className="skip-link" href="#main-content">Skip to sign in</a><SiteNavigation minimal>{backAction}</SiteNavigation>
    <main className="studio-page access-page" id="main-content">
      <section className="access-layout" aria-labelledby="access-title">
        <div className="access-intro"><p className="studio-label">Your reading space</p><h1 id="access-title">{signedIn ? "Make yourself at home" : "Good reads, kept close"}<span>.</span></h1><p className="studio-description">{signedIn ? `Welcome back, ${name.split(" ")[0] || "reader"}. Your reading list and preferences are here whenever you need them.` : description}</p>
          <ul className="access-benefits">{[["01", "Keep the useful things", "Save articles and AI Radar stories in one place."], ["02", "Go a little deeper", "Continue exploring backend systems, search, and applied AI."], ["03", "Choose your updates", "Email updates are optional. Change your preference anytime."]].map(([number,title,detail])=><li key={number}><span>{number}</span><div><h2>{title}</h2><p>{detail}</p></div></li>)}</ul>
          <a className="studio-text-link" href="/blogs">Browse the writing <span aria-hidden="true">↗</span></a>
        </div>
        <div className="access-card">
          <p className="studio-label">{signedIn ? "Your account" : "Reader access"}</p><h2>{signedIn ? "You’re signed in." : "A simple way in."}</h2>
          {signedIn ? <>
            <div className="access-identity"><span aria-hidden="true">{initial}</span><div><strong>{name}</strong><small>{email}</small></div></div>
            <a className="access-continue" href={destination.href}>{destination.label} <span aria-hidden="true">↗</span></a>
            <div className="access-preference"><div><h3>Email updates</h3><span>{subscribed ? "Subscribed" : "Not subscribed"}</span></div><p>{subscribed ? "You’ll receive selected engineering notes and portfolio updates." : "Subscribe if you’d like new notes and selected updates in your inbox."}</p><button type="button" className="access-secondary" disabled={busy} onClick={subscribed ? onUnsubscribe : onSubscribe}>{busy ? "Updating…" : subscribed ? "Unsubscribe" : "Subscribe to updates"}</button></div>
            <button className="access-signout" type="button" disabled={busy} onClick={onSignOut}>Sign out</button>
          </> : <>
            <p className="access-card-copy">Use your Google account to continue. No separate password to remember.</p>
            <button className="access-continue" type="button" disabled={busy || !available} aria-busy={busy} onClick={onSignIn}>{busy ? "Opening Google…" : "Continue with Google"}<span aria-hidden="true">↗</span></button>
            <p className="access-next">{context === "saved-posts" ? "Next: your saved posts" : context === "ai-radar" ? "Next: AI Radar" : context === "article" ? "Continue to your article after signing in" : "Your reading list starts here."}</p>
            <p className="access-optional">Signing in and email subscriptions are separate. You choose whether to subscribe.</p>
          </>}
          {!available && !signedIn && <p className="access-status" role="status">Google sign-in is currently unavailable. Please try again later.</p>}
          {(message || signedOutNotice) && <p className="access-status" role="status">{message || signedOutNotice}</p>}
          {error && <p className="access-status access-error" role="alert">{error}</p>}
        </div>
      </section>
      <footer className="access-footer"><span>Engineering notes. Useful ideas. At your pace.</span><a href="/work-with-me">Need a hand? Get in touch <span aria-hidden="true">↗</span></a></footer>
    </main></>;
}
