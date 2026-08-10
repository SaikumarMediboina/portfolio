# Least Connections Load Balancing

*This continues the Load Balancing series — we've covered the Basics (what an LB is, where it sits, why it's needed), the Types (L4 vs L7 routing), and the first routing algorithms (Round Robin, Weighted Round Robin). Now we move to a smarter routing algorithm: Least Connections.*

## 1. The Core Idea

Picture a supermarket with four billing counters. A smart manager doesn't send the next customer to "whichever counter is next in line" — they look at which counter currently has the **fewest people waiting** and send the customer there.

That's Least Connections in one sentence:

> **The Load Balancer (LB) sends each new request to the server that currently has the fewest active (open) connections.**

---

## 2. The Problem Without Load Balancing

Imagine a shopping app running on a single server:

- Max comfortable capacity: **1,000 concurrent connections**
- Average request time: **500 ms**

As traffic grows — 100 users, then 800, then 1,300 — the server crosses its limit. What happens next, step by step:

```cascade
 Requests pile up in queue
           ↓
 Response time increases
           ↓
 Requests start timing out
           ↓
 Users retry (adding MORE load)
           ↓
 Server overloads further
           ↓
 Server crashes ──> FULL OUTAGE 💥
```

A single machine has physical limits — CPU, memory, network I/O. Users can't be made to wait for hardware. The fix is **horizontal scaling**: run the app on multiple servers. But that raises a new question — *which server should handle each incoming request?* That's where a Load Balancer with a selection algorithm comes in.

---

## 3. Where It Fits in the Architecture

```topology
 Client ──> [ Load Balancer ] ──┬──> Server A
                                ├──> Server B
                                └──> Server C
```

The client never talks to backend servers directly — it only knows one address (e.g. `api.shop.com`). Behind that address sits the LB.

**Step-by-step flow:**

1. Client sends a request (e.g. `GET /api/home`) to the LB.
2. LB maintains a live count of active connections per backend server:

```connections
 ┌───────────────────────────────┐
 │   Load Balancer Connections   │
 ├───────────────────────────────┤
 │  Server A ──> 120 active      │
 │  Server B ──>  45 active  ★   │  <-- Target (Minimum)
 │  Server C ──>  80 active      │
 └───────────────────────────────┘
```

3. LB picks the server with the **minimum** count — here, Server B.
4. Request is forwarded to Server B; its counter increments (45 → 46).
5. Server B processes the request and returns a response — **through the LB**, not directly to the client (this is the reverse-proxy pattern).
6. Once the connection closes, the counter decrements again (46 → 45).

**What counts as a "connection"?** Any client/LB-to-server session that's currently open and not yet completed. Long-running requests (file uploads, streaming, WebSockets) keep the counter elevated longer — which is exactly the signal Least Connections uses.

### Least Connections vs. Round Robin

Round Robin just cycles through servers in order — 1→A, 2→B, 3→C, 4→A — regardless of how busy each one is. If Server A is already handling 200 slow requests, Round Robin will still send it the next one on its turn.

Least Connections checks actual load first:

```decision
 Active Connection Count:
 A = 200, B = 20, C = 30
           │
           ▼
 [ Choose Minimum: B ] ──> Route to Server B
```

This makes it noticeably better for workloads with **uneven request durations** (some requests take 50ms, others take 10 seconds) — common in systems using WebSockets, streaming, or long-lived DB proxy connections.

---

## 4. Diagram

```routing-flow
                      [ USER REQUEST ]
                             │
                             ▼
               ┌───────────────────────────┐
               │          CLIENT           │
               └───────────────────────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │       LOAD BALANCER       │
               │   A = 90 active conns     │
               │   B = 25 active conns  ★  │  <-- Least connections
               │   C = 60 active conns     │
               └───────────────────────────┘
                  /          │          \
                 /           │           \
                v            v            v
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │ Server A │  │ Server B │  │ Server C │
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

A user opens a Flipkart-like shopping app.

1. **Client request** — `GET /api/home` leaves the phone, hits `api.shop.com` (resolves to the LB).
2. **LB checks load** — `Server A=150, Server B=75, Server C=90` → minimum is Server B.
3. **Forward** — LB sends the request to Server B, increments its count to 76.
4. **Server B works** — validates session, calls product service, fetches from cache/DB, builds JSON response.
5. **Response returns** — Server B → LB → Client. Server B's count drops back to 75.

The client has no idea which server handled it — that abstraction is the whole point.

### If the chosen server doesn't respond

Production LBs run periodic **health checks** (e.g. `GET /health` every few seconds). If Server B stops responding:

```health
 Server A:  [ Healthy ]   ──>  Route ✓
 Server B:  [ CRASHED ]   ──>  REMOVE FROM POOL ✗
 Server C:  [ Healthy ]   ──>  Route ✓
```

New requests go only to A or C. For the request that was already in flight to B, whether the LB retries it on another server **depends on the request type**:

- **Safe/idempotent requests** (e.g. `GET /products`) — safe to retry on another healthy server.
- **Non-idempotent requests** (e.g. `POST /payment`) — retrying blindly is dangerous, since the original request might have already succeeded server-side before the response was lost, risking a duplicate charge. This is why payment-type APIs use an **Idempotency-Key** so retries are safe.

---

## 6. One Gap Worth Flagging

Not all servers are equal. If Server B has 4x the CPU of Server A, plain Least Connections can under-utilize B because it only looks at raw connection count, not actual capacity. A weighted version of this algorithm fixes that — we'll cover **Weighted Least Connections** in detail in the next article of this series.

---

## 7. Limitation to Know for Interviews

**Connection count ≠ actual load.** A server with 10 open connections doing heavy video processing can be more overloaded than one with 30 connections serving cached responses. Plain Least Connections would (incorrectly) route more traffic to the "busier-looking" but actually-lighter server.

More advanced load balancers combine multiple signals — CPU, memory, response latency, queue depth — instead of relying on connection count alone.

---

## 8. Why It's Needed — Benefits Summary

| Benefit | What breaks without it |
|---|---|
| **Availability** | One server crash = entire app down |
| **Scalability** | Adding servers doesn't help if nothing distributes traffic across them |
| **Fault Tolerance** | Requests keep hitting a dead server instead of being rerouted |
| **Performance** | Uneven load piles onto one server while others sit idle, causing timeouts |

## One-Line Summary

A load balancer is the traffic cop of a distributed system, and with Least Connections, it routes every new request to whichever healthy server is currently least busy — keeping the system fast, fault-tolerant, and able to scale as traffic grows.

---

*Next up in this series: **Weighted Least Connections** — how we combine "who's least busy" with "who's actually more powerful" for better routing decisions.*
