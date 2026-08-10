# IP Hash & Hash-based Load Balancing

*This continues the Load Balancing series — Basics, Types (L4 vs L7), Round Robin, Weighted Round Robin, Least Connections, and Weighted Least Connections are covered already. All of those answer "which server is least busy right now?" This article covers a different question entirely: "how do I make sure the *same* client always lands on the *same* server?"*

## 1. The Core Idea

Think of a coat check counter at an event. If you hand in your coat and get token #47, you don't want a *different* person handing you back a random coat next time — you want the same coat, every time, based on your token.

Hash-based load balancing works the same way:

> **The LB runs the client's identifying info (usually IP address) through a hash function, and the resulting number decides which server handles that client — consistently, every single time.**

```
hash(client_IP) % number_of_servers  →  server index
```

No connection counts, no round-turns, no weights. Just: same input → same output → same server.

---

## 2. The Problem This Solves

Every algorithm covered so far (Round Robin, Weighted Round Robin, Least Connections, Weighted Least Connections) picks a server based on **current load**. That's great for spreading traffic evenly, but it has a side effect:

```
Request 1 from User X → Server A
Request 2 from User X → Server C   (because A got busier)
Request 3 from User X → Server B   (because C got busier)
```

The same user can land on a **different server on every request**. For stateless APIs (e.g. `GET /products`) that's completely fine. But it breaks two common real-world needs:

**a) Session data stored in server memory (not shared).**

```state-split
 User X logs in  ──>  Server A stores session in local memory
                                 │
 User X's next request  ──>  Routed to Server B
                                 │
 Server B has no session  ──>  "Please log in again" ✗
```

**b) Per-server caching.**

```cache-miss
 Request Product #501  ──>  Server A fetches from DB, caches locally
                                 │
 Request Product #501 again  ──>  Routed to Server C
                                 │
 Server C has no cache for #501  ──>  Hits DB again ✗ (Cold Start)
```

Both problems come from the same root cause: **load-based algorithms don't care about "who" is asking, only "what's free right now."** Hash-based routing fixes this by making the server choice depend on the client's identity instead of current load.

---

## 3. How It Fits in the Architecture

Same skeleton as always: `Client → Load Balancer → Servers`. The difference is entirely in the decision logic.

**Step-by-step:**

1. Client sends a request. LB extracts an identifying key — most commonly the **client's IP address**, but it could also be a session ID, user ID, or a request header, depending on setup.
2. LB runs that key through a **hash function** — a function that converts any input into a fixed-size number, and always produces the *same* number for the *same* input.
   ```
   hash("203.0.113.45") → 8827341
   ```
3. LB maps that number to a server, typically using modulo against the server count:

```hash-calc
 Client IP: "203.0.113.45"
           │
           ▼ (Hash Function)
 Hash Value: 8827341
           │
           ▼ (Modulo Operation)
 8827341 % 3 servers  =  index 0
           │
           ▼
 Target: Server A (index 0)
```

4. Every future request from that same IP hashes to the same number → same modulo result → **same Server A**, every time, as long as the server count doesn't change.
5. Request is forwarded, Server B (or A, C — whichever was selected) processes and returns the response through the LB, same reverse-proxy pattern as before.

---

## 4. Diagram

```hash-flow
                      [ USER REQUEST ]
                      (IP: 203.0.113.45)
                             │
                             ▼
               ┌───────────────────────────┐
               │          CLIENT           │
               └───────────────────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │       LOAD BALANCER       │
               │  hash(203.0.113.45)       │
               │  = 8827341                │
               │  8827341 % 3 = index 0    │
               │  ──> Always Server A  ★   │
               └───────────────────────────┘
                  /          │          \
                 /           │           \
                v            v            v
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Server A │  │ Server B │  │ Server C │
         │ (User X  │  │          │  │          │
         │  pinned  │  │          │  │          │
         │  here)   │  │          │  │          │
         └──────────┘  └──────────┘  └──────────┘
                             │
                             │ 200 OK (Response)
                             ▼
                       LOAD BALANCER
                             │
                             ▼
                          CLIENT
```

---

## 5. Real-Time Walkthrough

User Ravi is using a shopping app that keeps his active cart in server memory (not in a shared cache — a common setup for smaller systems).

1. **First request** — Ravi's app sends `POST /cart/add` from IP `203.0.113.45`.
2. **LB hashes his IP** → `hash(203.0.113.45) % 3 = 0` → **Server A**.
3. Server A adds the item to Ravi's in-memory cart session and responds.
4. **Second request**, seconds later — `GET /cart` from the same IP.
5. **LB hashes the same IP** → same result → **Server A again**.
6. Server A finds Ravi's cart already in memory → responds instantly with his item still there. No "please log in again," no missing cart.

### A Second Real-World Example: Video Streaming (Hotstar/Netflix-style)

Session stickiness matters even more when there's no explicit "login" involved — video streaming is a good example.

A video isn't sent in one shot — it's broken into small **chunks** (e.g. 10-second segments), and each chunk is a separate HTTP request to the backend.

```cdn-flow
 WITHOUT IP HASH (Round Robin):
 Segment 1 ──> Server A (Caches segment 1)
 Segment 2 ──> Server B (Cold start ── cache miss)
 Segment 3 ──> Server C (Cold start ── cache miss)
 Segment 4 ──> Server A (Segment 4 cold ── cache miss)

 WITH IP HASH:
 Segment 1 ──> Server B (Caches segment 1)
 Segment 2 ──> Server B (Uses warmed cache, prefetches next)
 Segment 3 ──> Server B (Uses warmed cache)
 Segment 4 ──> Server B (Uses warmed cache)
```

Every segment for this user goes to the same Server B. Server B can prefetch and cache upcoming segments locally, so each new request is a fast cache hit instead of a fresh storage fetch — smooth playback, no re-buffering.

This is exactly why CDN and edge-server layers at platforms like Netflix, Hotstar, and YouTube use IP-based (or session-based) hashing — losing that stickiness means losing the entire benefit of caching for that session.

### If Server A goes down

This is the sharp edge of basic hash-based routing. If Server A becomes unhealthy and is removed from the pool, the server *count* changes — say from 3 servers to 2.

```reshuffle
 Pool has 3 servers:
 hash(Ravi's IP) % 3 = 0  ──>  Server A

 Server A crashes (Pool becomes 2 servers):
 hash(Ravi's IP) % 2 = 1  ──>  Server C (Session lost!)
```

Ravi's request now lands on Server C, which has never seen him — his in-memory cart is gone. Worse, **this reshuffling doesn't just affect Ravi** — almost every client's mapping changes when the divisor changes, because `% 3` and `% 2` produce very different results for most inputs. This mass reshuffling when server count changes is the single biggest limitation of plain hash-based routing, and it's exactly the problem the next algorithm in this series is built to solve.

---

## 6. Where the Hash Key Comes From

"Hash-based" doesn't only mean IP. Depending on what needs to stay sticky:

```
hash(client IP)         → classic IP Hash, works at L4 or L7
hash(session cookie ID) → common at L7, survives client IP changes (e.g. mobile switching networks)
hash(user ID / API key) → used when the client is authenticated
hash(URL / cache key)   → used in CDN and cache-server routing, not just client routing
```

*Interview tip: if asked "what if a client's IP changes mid-session" (e.g. Wi-Fi to mobile data), that's exactly why cookie-based or session-ID-based hashing is often preferred over raw IP hashing for user-facing web apps.*

---

## 7. Where This Sits Among the Algorithms You Know

| Algorithm | Considers server capacity? | Considers real-time load? | Same client → same server? |
|---|---|---|---|
| Round Robin | No | No | No |
| Weighted Round Robin | Yes | No | No |
| Least Connections | No | Yes | No |
| Weighted Least Connections | Yes | Yes | No |
| **IP Hash / Hash-based** | **No** | **No** | **Yes** |

Notice the trade-off: every algorithm before this one optimized for *even load*. Hash-based routing optimizes for *consistency* instead — and in exchange, it can produce uneven load if some clients (e.g. one high-traffic corporate IP behind NAT) send far more requests than others, since they're all pinned to one server.

---

## 8. Limitations Worth Naming

- **Uneven load** — if traffic per client varies a lot, some servers can get consistently overloaded while others stay idle, since routing ignores current load entirely.
- **Mass reshuffling on scaling** — as shown above, adding or removing even one server changes `% N` for almost everyone, breaking most existing session/cache affinity at once. This makes basic hash-based routing painful in systems that autoscale frequently.
- **NAT / shared IPs** — many users behind a corporate proxy or campus network share one public IP, so they all get pinned to the same server, defeating the "even-ish" distribution assumption.

---

## 9. Why It's Needed — Benefits Summary

| Benefit | What breaks without it |
|---|---|
| **Session stickiness** | Users get logged out or lose in-progress state (cart, form, upload) every time they're routed to a different server |
| **Cache locality** | Server-local caches stay cold — every request may re-fetch from the database, hurting performance |
| **Predictability** | Debugging is easier when you know a given client always hits the same server for a given time window |
| **Simplicity** | No connection-count tracking or health-polling logic needed just to decide "where does this client go" |

## One-Line Summary

Hash-based load balancing trades "always pick the least busy server" for "always pick the *same* server for the same client" — essential for session stickiness and caching, but fragile whenever the server pool itself changes size.

---

*Next up in this series: **Consistent Hashing** — the fix for hash-based routing's biggest weakness, so that adding or removing a server reshuffles only a small fraction of clients instead of almost everyone.*
