# Weighted Least Connections

*This continues the Load Balancing series — Basics, Types (L4 vs L7), Round Robin, Weighted Round Robin, and Least Connections are covered already. This article fixes the one gap Least Connections leaves open: it treats every server as equally powerful, which isn't true in most real systems.*

## 1. The Core Idea

Go back to the supermarket analogy. Least Connections sends the next customer to whichever counter has the fewest people waiting. But what if one counter has a trainee cashier and another has your fastest, most experienced one? Sending equal customers to both isn't fair — the experienced cashier can clear a bigger queue faster.

> **Weighted Least Connections = pick the server with the lowest *(active connections ÷ capacity weight)* ratio, not just the lowest raw connection count.**

It combines two ideas you've already seen separately: **Weighted Round Robin's** concept of capacity weight, and **Least Connections'** concept of tracking real-time load.

---

## 2. The Problem Plain Least Connections Doesn't Solve

Suppose you have three servers with very different hardware:

```
Server A -> 4 CPU cores
Server B -> 16 CPU cores
Server C -> 8 CPU cores
```

Now check their current active connections:

```
Server A = 20 connections
Server B = 25 connections
Server C = 30 connections
```

Plain Least Connections looks only at the raw numbers and picks **Server A** (20 is the lowest). But Server A has the *least* horsepower of the three — a 4-core box handling 20 connections may already be more strained than Server B's 16-core box handling 25. Least Connections has no concept of "capacity," so it keeps sending traffic to the weakest machine just because its connection count happens to be lower.

**Concrete failure pattern:**

```overload
 Small server keeps "looking free" (low connection count)
                           |
                   Keeps getting picked
                           |
             CPU / Memory maxes out first
                           |
        Slow responses & timeouts on small server
                           |
       While powerful 16-core server sits idle *
```

This is the same class of problem Weighted Round Robin solved for turn-based routing — except here it needs solving for connection-based routing.

---

## 3. How It Fits in the Architecture

Same overall flow as before: `Client --> Servers via Load Balancer`. The only change is what the LB computes before picking a server.

**Step-by-step:**

1. Each server is assigned a **weight**, usually based on capacity (CPU, RAM, benchmarked throughput). Example:
   ```
   Server A -> weight 1  (4 cores)
   Server B -> weight 4  (16 cores)
   Server C -> weight 2  (8 cores)
   ```
2. LB tracks active connections per server, same as plain Least Connections:
   ```
   Server A = 20 connections
   Server B = 25 connections
   Server C = 30 connections
   ```
3. For each server, LB computes a **load ratio**:

```ratios
 +--------------------------------------------------------+
 |   LB Load Ratio Formula: active_connections / weight   |
 +--------------------------------------------------------+
 |  Server A --> 20 conns / weight 1  =  20.00            |
 |  Server B --> 25 conns / weight 4  =   6.25  * Target  |
 |  Server C --> 30 conns / weight 2  =  15.00            |
 +--------------------------------------------------------+
```

4. LB picks the server with the **lowest ratio** — here, Server B, despite having the highest raw connection count. It genuinely has the most spare capacity relative to its size.
5. Request is forwarded, B's connection count increments (25 → 26), ratio recalculated for the next request.
6. Response flows back through the LB to the client, same as any reverse-proxy setup.

**Least Connections vs. Weighted Least Connections**

```
Without Weighting (Plain Least Connections):
A = 20 conns, B = 25 conns, C = 30 conns --> Picks Server A (weakest!)

With Weighting (Weighted Least Connections):
A = 20.00, B = 6.25, C = 15.00           --> Picks Server B (strongest!)
```

---

## 4. Diagram

```weighted-diagram
                      [ USER REQUEST ]
                             |
                             v
               +---------------------------+
               |          CLIENT           |
               +---------------------------+
                             |
                             v
               +---------------------------+
               |       LOAD BALANCER       |
               |  A --> 20 conns / wt 1 = 20.00 |
               |  B --> 25 conns / wt 4 =  6.25 * | <-- Lowest ratio
               |  C --> 30 conns / wt 2 = 15.00 |
               +---------------------------+
                  /          |          \
                 /           |           \
                v            v            v
         +----------+  +----------+  +----------+
         | Server A |  | Server B |  | Server C |
         | (4 cores)|  |(16 cores)|  | (8 cores)|
         +----------+  +----------+  +----------+
                             |
                             | 200 OK (Response)
                             v
                       LOAD BALANCER
                             |
                             v
                          CLIENT
```

---

## 5. Real-Time Walkthrough

Same shopping app, but now the backend fleet is mixed hardware — common after a partial upgrade or auto-scaling event that added bigger instances.

1. **Setup:**
   ```
   Server A -> weight 1 (old, small instance) -> 20 active conns
   Server B -> weight 4 (new, large instance) -> 25 active conns
   Server C -> weight 2 (mid-size instance)   -> 30 active conns
   ```
2. **User opens the app** -> `GET /api/home` reaches the LB.
3. **LB computes ratios:** A = 20.0, B = 6.25, C = 15.0.
4. **LB picks Server B** — it's carrying more absolute connections than A or C, but relative to its size it has the most breathing room.
5. **Server B processes the request**, count goes 25 → 26, response returns via the LB to the client.
6. **If Server B were to fail health checks mid-request**, the same failover behavior from the Least Connections article applies: LB marks it unhealthy, removes it from the pool, and (for idempotent requests) retries on the next-best ratio among A and C. Non-idempotent requests (like payments) still rely on idempotency keys rather than blind retries.

```health-failover
 Server A: (weight 1) --> [ Healthy ] --> Load Ratio: 20.00
 Server B: (weight 4) --> [ CRASHED ] --> REMOVE FROM POOL *
 Server C: (weight 2) --> [ Healthy ] --> Load Ratio: 15.00 * Selected
```

---

## 6. How Weights Get Decided

Weights aren't guessed — they typically come from one of:

- **Static config** based on known hardware specs (e.g. CPU core count, RAM).
- **Benchmarked throughput** — how many requests/sec a server type sustains under test load.
- **Dynamic weights** in more advanced setups, adjusted automatically based on real-time CPU/memory/latency metrics instead of a fixed number set once and forgotten.

*Interview tip: if asked "how do you assign weights," static weight based on instance type is the simple correct answer; mentioning dynamic, metric-driven weighting shows depth.*

---

## 7. Where This Sits Among the Algorithms You Know

| Algorithm | Considers server capacity? | Considers real-time load? |
|---|---|---|
| Round Robin | No | No |
| Weighted Round Robin | Yes | No |
| Least Connections | No | Yes |
| **Weighted Least Connections** | **Yes** | **Yes** |

This is why Weighted Least Connections is often the default in production-grade load balancers (e.g. Nginx, HAProxy, AWS ALB's least-outstanding-requests mode) — it's the only one of the four that accounts for both dimensions at once.

---

## 8. Limitation Still Worth Naming

Even with weights, connection count is still a **proxy** for load, not a direct measurement. A heavy server-side operation (video transcoding, large report generation) can consume far more CPU per connection than a lightweight cached read — the algorithm still can't see that difference. This is why some systems go a step further and route based on live CPU/latency/queue metrics instead of connection count alone — a topic for a later article in this series.

---

## 9. Why It's Needed — Benefits Summary

| Benefit | What breaks without weighting |
|---|---|
| **Fair utilization** | Small/old servers get overloaded first while big servers idle |
| **Better throughput** | Powerful servers aren't used to their actual capacity |
| **Smooth scaling** | Adding a bigger instance to the pool doesn't actually help unless the LB knows it's bigger |
| **Fewer hot-spots** | Prevents the "smallest server always looks free" trap that plain Least Connections falls into |

## One-Line Summary

Weighted Least Connections is Least Connections with a sense of scale — instead of asking "who has the fewest connections," it asks "who has the most spare capacity relative to their size," giving powerful servers their fair share of traffic.

---

*Next up in this series: **IP Hash / Hash-based Load Balancing** — how requests from the same client are consistently routed to the same server, and why that matters for session stickiness and caching.*
