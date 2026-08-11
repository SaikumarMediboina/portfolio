# Sticky Sessions & Session Affinity

## One-Line Intuition

It's like walking into a bank where you were helped by counter #3 — if you come back with a follow-up question, you'd rather go straight back to counter #3, since that's the only person who actually remembers your file, instead of explaining everything from scratch to counter #7.

---

## The Problem Without It

Every algorithm we've covered so far — Round Robin, Least Connections, IP Hash, and Consistent Hashing — helps the load balancer decide which backend server should handle a request.

Round Robin and Least Connections primarily focus on distributing traffic efficiently, while IP Hash and Consistent Hashing provide more predictable routing and can naturally create affinity by mapping the same key to the same server.

For a completely stateless application, that's usually enough. Each request can be handled independently by any healthy server.

But many real-world applications aren't completely stateless.

Consider a login session, shopping cart, or multi-step checkout flow. If the application stores that state in a server's local memory rather than in a shared store, then which server handles the next request matters.

For example:

- **Request 1 → Server A:** The user logs in. Server A creates and stores the session in its local memory.
- **Request 2 → Server B:** The load balancer sends the next request to Server B. But Server B has never seen this session.
- **Result:** The session isn't found. The user may appear logged out, lose their cart, or be unable to continue the checkout flow.

The load-balancing algorithm isn't necessarily broken. The problem is a mismatch between the application's state model and the routing strategy.

This is where Sticky Sessions (Session Affinity) come in.

Sticky Sessions explicitly maintain an association between a user's session and a specific backend server. Once a session is associated with Server A, subsequent requests from that session are routed back to Server A, commonly using a cookie-based affinity mechanism.

Consistent Hashing provides stable key-to-server mapping. Sticky Sessions provide explicit session-to-server affinity.

Both can result in repeated requests reaching the same server, but they achieve that behavior for different reasons and through different mechanisms.

---

## The Problem in Action

![The problem without sticky sessions](./assets/sticky-problem-without.png)

---

## How It Fits in the Architecture

Sticky Sessions doesn't replace Round Robin or Least Connections — it sits **on top of** them as an override rule. The flow is:

1. First request from a new client → no affinity info exists yet → the normal algorithm (Round Robin, Least Connections, whatever's configured) picks a server as usual.
2. The load balancer **remembers that choice** — either by setting a cookie in the response, or by hashing the client's IP (the two common implementations).
3. Every subsequent request from that same client → the load balancer checks for that affinity signal first. If present, it **skips the normal algorithm entirely** and routes straight to the remembered server.

So affinity is a short-circuit: it only kicks in once a client has been "claimed" by a server, and it takes priority over the algorithm underneath.

---

## How Cookie-Based Affinity Works

![How cookie-based sticky sessions work](./assets/sticky-cookie-mechanism.png)

There are two common ways to implement this:

- **Cookie-based (application-controlled):** The load balancer inserts its own cookie (e.g., `SERVERID=A`) in the response on the first request. Every future request from that browser carries the cookie back, and the LB reads it to route deterministically. This is what AWS ALB's "duration-based stickiness" and NGINX's `sticky cookie` directive do.
- **IP-based (source IP hash):** The LB hashes the client's IP address and consistently maps that hash to the same server — no cookie needed. Works for non-browser clients (mobile apps, IoT devices) but breaks down badly for users behind a shared corporate NAT or proxy, where thousands of different users all appear to have the same IP.

Cookie-based is the more common and more precise choice for web apps, since it identifies the actual browser session rather than a shared network address.

---

## Real-Time Walkthrough

Consider the same checkout service — 3 servers, a user shopping on the site:

1. User visits the site for the first time. No cookie exists yet. LB's Least Connections picks Server A (currently least loaded). Response comes back with `Set-Cookie: SERVERID=A`.
2. User adds an item to cart. Browser automatically sends the cookie back. LB sees `SERVERID=A`, skips Least Connections entirely, routes straight to Server A. Cart update succeeds — because A already has this user's session in memory.
3. User adds 3 more items over the next few minutes, browses a few product pages. Every single request goes to Server A, regardless of how loaded A gets compared to B and C — that's the trade-off, covered below.
4. User proceeds to checkout and pays. All of this happened on Server A, so the entire flow stayed consistent — no lost cart, no forced re-login.
5. Now suppose Server A crashes mid-session (see next section) — this is where sticky sessions show their sharpest weakness.

---

## The Trade-Off, and the Modern Fix

![Sticky session trade-off and the centralized store fix](./assets/sticky-tradeoff-and-fix.png)

Sticky sessions solve the immediate problem, but they introduce two real costs:

- **Load imbalance:** If Server A happens to get "claimed" by several heavy users (e.g., a few power users doing large batch operations), the LB can't move that load elsewhere — even if B and C are sitting idle, A is stuck serving its claimed users because affinity overrides load-aware routing.
- **Data loss on crash:** This is the sharper problem. If Server A crashes, its in-memory session data crashes with it. The LB will reroute the user to Server B — but B has no idea who this user is or what was in their cart. The user's session is gone, not just temporarily unavailable.

The modern, more robust fix — used by nearly every serious production system today — is to **stop storing session state on individual servers at all.** Instead, session data (cart contents, login state, etc.) lives in a fast shared store like Redis or Memcached, external to every application server. With this in place:

- Any server can handle any request for any user — true statelessness restored.
- No sticky routing needed at all — Round Robin or Least Connections can go back to running freely.
- A server crashing has zero impact on session data, since the data was never there in the first place.

This is why, in interviews, "why not just use sticky sessions?" is often followed by "because a shared session store solves the same problem without the downsides" — sticky sessions are a reasonable quick fix, but a centralized store is the architecturally cleaner answer at scale.

---

## Why It's Needed — Summary Table

| Without Sticky Sessions | With Sticky Sessions | With Centralized Session Store |
|---|---|---|
| Stateful apps break — session/cart lost on every server switch | Session stays consistent as long as the assigned server stays up | Session stays consistent regardless of which server handles the request |
| N/A | Load can become imbalanced across servers | Load balancing works freely, no override needed |
| N/A | Server crash = session data lost entirely | Server crash has zero impact on session data |
| Simple, fully stateless routing | Extra complexity: cookie management, affinity timeouts | Extra infra: a shared store to run and maintain |

## One-Line Summary

Sticky Sessions patch the mismatch between stateless load balancing and stateful applications by remembering "this user belongs to this server" — a fast fix that works, but trades away even load distribution and crash resilience, which is exactly why most large-scale systems eventually move session state into a shared store like Redis instead of relying on stickiness at all.
