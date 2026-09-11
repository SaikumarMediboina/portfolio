import { createContext, useContext, useState } from "react";

type HeaderAccountState = {
  ready: boolean;
  signedIn: boolean;
  busy: boolean;
  canSignIn: boolean;
  error: string;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export const HeaderAccountContext = createContext<HeaderAccountState | null>(null);

export default function HeaderAccount() {
  const account = useContext(HeaderAccountContext);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  if (!account) return null;
  const busy = account.busy || pending;
  const error = attempted ? localError || account.error : "";
  const handleClick = async () => {
    if (busy || !account.ready) return;
    setAttempted(true);
    setLocalError("");
    setPending(true);
    try {
      await (account.signedIn ? account.onSignOut() : account.onSignIn());
    } catch {
      setLocalError("Unable to complete sign-in or sign-out. Please try again.");
    } finally {
      setPending(false);
    }
  };
  return <div className="header-account">
    <button className="header-account-button" type="button"
      disabled={!account.ready || busy || (!account.signedIn && !account.canSignIn)}
      aria-busy={busy}
      title={!account.ready ? "Checking your session" : !account.signedIn && !account.canSignIn ? "Sign-in is currently unavailable" : undefined}
      onClick={handleClick}>
      {!account.ready ? "Loading…" : busy ? "Please wait…" : account.signedIn ? "Sign out" : "Sign in"}
    </button>
    {error && <div className="header-account-feedback" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempted(false)} aria-label="Dismiss account error">×</button></div>}
  </div>;
}
