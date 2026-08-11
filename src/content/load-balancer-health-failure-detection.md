# Health & Failure Detection in Load Balancing

## One-Line Intuition

A load balancer without health checks is like a call center receptionist who keeps transferring calls to a desk phone that's been ringing unanswered for ten minutes — it has no way of knowing the person left, so it keeps sending the next caller there anyway.

---

## The Problem Without It

Every routing algorithm we've covered so far — Least Connections, IP Hash, Consistent Hashing — assumes one thing: **the servers in the pool are actually alive and capable of serving traffic.** None of those algorithms ask "is this server okay?" They just ask "which server should get this request?"

That's a dangerous gap. In the real world, servers fail in messy, non-binary ways:

- A process crashes → the server is completely dead, connections get refused outright.
- A server is up, but its database connection pool is exhausted → it's "alive" but every request hangs for 30 seconds before timing out.
- A server is mid-deployment, still warming up its cache → it's technically running but not ready to serve real traffic yet.
- A server has high CPU due to a GC pause or memory leak → it responds, but painfully slowly.

Without a mechanism to detect and react to these states, the load balancer keeps routing traffic to broken or degraded servers exactly as if nothing were wrong. Users hit timeouts, error pages, and 500s — not because there wasn't enough healthy capacity, but because the load balancer didn't know some of its capacity was fake.

Health & Failure Detection is the layer that closes this gap. It continuously answers one question for every server in the pool: **"Can this server actually handle a request right now?"** — and feeds that answer back into the routing decision.

---

## How It Fits in the Architecture

Health checking sits as a background, always-on process next to the load balancer's routing logic. It doesn't replace Round Robin, Least Connections, or Consistent Hashing — it **gatekeeps** which servers those algorithms are even allowed to pick from.

```
                     ┌─────────────────────────┐
                     │   Health Checker        │
                     │  (active probes +       │
                     │   passive monitoring)   │
                     └────────────┬────────────┘
                                  │ updates
                                  ▼
                     ┌─────────────────────────┐
   Incoming  ───────▶│    Load Balancer        │
   Requests           │  (routing algorithm runs│
                     │   only over HEALTHY set)│
                     └────────────┬────────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
            Server A ✓       Server B ✓       Server C ✗
            (healthy)        (healthy)        (removed from pool)
```

There are two complementary ways the health checker gathers signal: **active** checks it initiates itself, and **passive** checks it derives from real traffic it's already routing.

---

## Active vs. Passive Health Checks

![Active vs passive health check comparison](./assets/active-vs-passive-health-check.svg)

**Active health checks** are synthetic probes — the load balancer hits a dedicated endpoint like `GET /health` on every server on a fixed schedule (say, every 5 seconds), regardless of whether any real user traffic is flowing. If a server misses enough consecutive pings, it gets flagged.

**Passive health checks** cost nothing extra — the load balancer simply watches the outcome of the real requests it's already sending. A spike in 500s, connection resets, or timeouts from a specific server is itself the signal, no separate probe needed.

Most production systems (AWS ALB, NGINX, Envoy, Kubernetes) run both together: active checks catch a server before it gets *any* real traffic (useful right after deployment), while passive checks catch problems that only show up under real load patterns that a synthetic `/health` ping would never trigger.

---

## Liveness vs. Readiness, and the Slow-But-Alive Trap

![Liveness vs readiness and the slow-but-alive problem](./assets/liveness-readiness-slow-alive.svg)

This is the distinction that trips up a lot of engineers the first time they design this system: **"is the process running" is a different question from "is this server fit to serve traffic."**

- **Liveness** = "Is the process itself still up?" If this fails, the fix is drastic — kill and restart the process. This is what Kubernetes' `livenessProbe` checks.
- **Readiness** = "Is this specific instance currently able to handle a real request well?" If this fails, the fix is gentler — just stop sending it traffic; don't kill it. This is Kubernetes' `readinessProbe`.

A server can be **alive but not ready** — process running fine, but its DB connection pool is exhausted, or it's still loading a cache after a fresh deploy. This is exactly the **slow-but-alive problem**: a lightweight `GET /health` handler might respond in 5ms because it does nothing but confirm the process is up, while the real endpoint `GET /orders` takes 8 seconds because it's waiting on a starved resource. If your health check only measures liveness, the load balancer will happily keep sending this server real traffic — because on paper, it looks fine.

The fix: readiness checks should exercise something closer to the real request path (a lightweight DB ping, a queue-depth check), not just "did the process answer."

---

## Real-Time Walkthrough

Consider an e-commerce checkout service running on 4 servers behind a load balancer:

1. **Normal state:** Servers A, B, C, D — all healthy, active checks every 5s return 200 OK, real checkout requests succeed. Least Connections algorithm freely picks among all four.
2. **Server C starts struggling:** A slow memory leak causes GC pauses. The active health check endpoint is lightweight, so it still returns 200 OK in 5ms — liveness passes. But real `/checkout` requests routed to C start taking 6–8 seconds instead of 200ms.
3. **Passive detection kicks in:** The load balancer notices C's real-traffic latency and error rate crossing a threshold (e.g., p99 latency > 3s for 10 consecutive requests, or error rate > 20% over a rolling window). C is marked **SUSPECTED**.
4. **Confirmation:** One more failed threshold check (say, 3 total bad signals) → C is marked **UNHEALTHY** and removed from the LB's active rotation. Zero new traffic goes to it. Existing in-flight requests are allowed to drain.
5. **Recovery loop, not abandonment:** The LB doesn't forget about C. It keeps sending it background *synthetic* active health checks even while it's removed — no real traffic yet. Once C returns 2 consecutive successful checks (readiness confirms it can handle real work again — not just that the process is up), it moves to **RECOVERING**.
6. **Slow start, not a full dump:** C doesn't jump straight back to a full share of traffic. Real requests are reintroduced gradually — 10% → 25% → 50% → 100% over roughly a minute — while latency and error rate are watched at each step. If C wobbles again during the ramp, it's dropped straight back to UNHEALTHY instead of continuing.
7. **Back to HEALTHY:** C reaches full weight and rejoins the pool normally. Users never saw an outage — they just experienced momentarily reduced capacity while C was quietly excluded, verified, and eased back in.

---

## The Full State Machine

![Node health state machine with removal and recovery thresholds](./assets/health-state-machine.svg)

Note the two thresholds doing the real work here, both deliberately **asymmetric**:

- **Removal threshold** is usually stricter (e.g., 3 consecutive failures) — you don't want one blip (a single dropped packet, a GC pause) to yank a perfectly good server out of rotation.
- **Recovery threshold** is often even stricter or requires sustained evidence (e.g., 2+ consecutive successes, sometimes with a cooldown period first) — you want real confidence before trusting a previously-flaky server with full traffic again. Flapping (rapidly toggling healthy/unhealthy) is worse than a slightly slow recovery, since it causes cascading connection churn.

---

## Recovery Is Gradual, Not Binary (Slow Start)

A common misconception: once a server passes its recovery threshold, does the LB just dump full traffic back on it immediately? In production systems, no — and there's a good reason.

There are actually two different kinds of traffic involved in the RECOVERING state, and it's worth being precise about which is which:

- **The recovery probe itself is always synthetic** — the same lightweight `GET /health` active check, run in the background, whether the server is HEALTHY, UNHEALTHY, or RECOVERING. This never carries real user traffic; it's purely how the LB decides *whether* to start trusting the server again.
- **Once that probe passes, real traffic does get sent** — but gradually, not all at once. This is called **slow start** (AWS ALB and Envoy both use this exact term). Instead of jumping from 0% to 100% of its fair share, the server's traffic weight ramps up over a fixed window — for example, 10% → 25% → 50% → 100% over 30–60 seconds — while its live error rate and latency are watched closely at each step.

Why not just flip it back to full traffic instantly?

- **Cold caches:** the server was just recovering — its local cache, JIT-compiled code paths, or connection pools may still be cold. A sudden full-traffic slam can re-trigger the exact same overload that caused the failure in the first place.
- **False recovery:** the health probe passing 2 consecutive times is a hopeful signal, not a guarantee. A small ramp limits the blast radius if the server was only "kind of okay" and starts failing again under real load.
- **Herd behavior across the fleet:** if several servers recover around the same time (e.g., after a rolling deploy), instantly giving all of them full weight can cause the LB's routing decisions to swing wildly. A gradual ramp smooths this out.

So the accurate way to describe the full loop: **UNHEALTHY → passes background synthetic probes → RECOVERING → real traffic reintroduced gradually via slow start → HEALTHY (full weight)**. If error rate or latency spikes at any point during the ramp, the LB drops the server straight back to UNHEALTHY rather than continuing the ramp — recovery is not a one-way door until it's fully earned.

---

## Why It's Needed — Summary Table

| Without Health & Failure Detection | With Health & Failure Detection |
|---|---|
| LB keeps routing to dead/crashed servers → user-facing errors | Dead servers detected and removed within seconds |
| A slow-but-alive server silently degrades latency for a chunk of users | Readiness checks catch degradation liveness alone would miss |
| One bad deploy can take down a slice of traffic for minutes | Active checks catch a broken server before real users ever hit it |
| Recovered servers are either trusted too soon (flapping) or never re-added (wasted capacity) | Threshold-based recovery brings servers back safely and gradually |
| No distinction between "restart me" and "just don't send me traffic" | Liveness vs readiness gives the right remediation for the right failure |

## One-Line Summary

Health & Failure Detection is what turns a load balancer from "I'll route to whoever's in my list" into "I'll only route to whoever I've actually confirmed can handle it right now" — and it does this by combining active probes, passive traffic observation, and asymmetric thresholds so servers are pulled out fast but trusted back in carefully.
