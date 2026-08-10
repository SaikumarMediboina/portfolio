# Load Balancing Routing Algorithms — The Complete Comparison

*This wraps up the routing-algorithm portion of the Load Balancing series. Six algorithms have been covered in depth — Round Robin, Weighted Round Robin, Least Connections, Weighted Least Connections, IP Hash, and Consistent Hashing. This article is the map: what each one optimizes for, where it breaks, and exactly which one to reach for in a given system design scenario.*

## The One Question Each Algorithm Answers

Every routing algorithm is really just one policy for answering the same question: *"a request just arrived — which server gets it?"* The six algorithms differ in **what information they use** to decide.

```
Round Robin              → uses: nothing but turn order
Weighted Round Robin     → uses: turn order + server capacity
Least Connections        → uses: real-time active connection count
Weighted Least Connections → uses: real-time connection count + server capacity
IP Hash                  → uses: client identity (ignores load entirely)
Consistent Hashing       → uses: client identity, but stable under scaling
```

---

## Full Comparison Table

| Algorithm | Considers current load? | Considers server capacity? | Same client → same server? | Stable when server count changes? | Complexity to implement |
|---|---|---|---|---|---|
| **Round Robin** | No | No | No | — | Very low |
| **Weighted Round Robin** | No | Yes | No | — | Low |
| **Least Connections** | Yes | No | No | — | Medium |
| **Weighted Least Connections** | Yes | Yes | No | — | Medium |
| **IP Hash** | No | No | Yes | No — mass reshuffle | Low |
| **Consistent Hashing** | No | No (unless combined with weighting) | Yes | Yes — only a small arc reshuffles | High |

Two independent axes are doing all the work here: **load-awareness** (Round Robin family vs. Least Connections family) and **client-stickiness** (everything above vs. the hash-based pair). No single algorithm wins on both — that trade-off is the entire reason six different algorithms exist instead of one perfect one.

---

## What Each One Optimizes For — One Line Each

| Algorithm | Optimizes for |
|---|---|
| **Round Robin** | Simplicity — equal turns, zero bookkeeping |
| **Weighted Round Robin** | Fair turns adjusted for known, fixed server capacity |
| **Least Connections** | Sending traffic to whichever server is *actually* least busy right now |
| **Weighted Least Connections** | Least Connections' real-time awareness, corrected for capacity differences |
| **IP Hash** | Keeping one client pinned to one server, for session/cache continuity |
| **Consistent Hashing** | The same stickiness as IP Hash, but without falling apart when the server pool resizes |

---

## Where Each One Breaks

This is usually the more useful half of the comparison — knowing the failure mode tells you when to reach for the next algorithm in the list.

| Algorithm | Breaks when... |
|---|---|
| **Round Robin** | Request durations are uneven — a server stuck with several slow requests still gets the next one on its turn |
| **Weighted Round Robin** | Load spikes are real-time and unpredictable — weights are fixed in advance, so they can't react to a sudden hot server |
| **Least Connections** | Servers have very different capacities — a small server can "look free" (low count) while actually being maxed out |
| **Weighted Least Connections** | Connection count stops being a good proxy for load — e.g. one heavy video-processing connection vs. many light cached reads |
| **IP Hash** | The server pool scales up or down — nearly every client's mapping changes at once, causing mass cache misses and dropped sessions |
| **Consistent Hashing** | One specific key/client gets disproportionately more traffic than others (the "hotspot" problem) — balancing key distribution isn't the same as balancing traffic |

---

## Which One Should You Actually Use? — Scenario Guide

| Scenario | Best fit | Why |
|---|---|---|
| Simple stateless API, all servers identical hardware | **Round Robin** | No load tracking needed, requests are short and uniform, so blind turn-taking is already fair |
| Backend fleet has mixed instance sizes (some 4-core, some 16-core), traffic is fairly uniform per request | **Weighted Round Robin** | Capacity difference is the only variable that matters here — no need for real-time tracking |
| Request durations vary a lot (some 50ms, some 10s) — e.g. mixed read/write API, WebSockets, long-lived DB proxy connections | **Least Connections** | Turn-based routing can't tell a fast request from a slow one; connection count reflects actual in-flight load |
| Same as above, but the server fleet also has mixed hardware capacity | **Weighted Least Connections** | Combines real-time load awareness with capacity awareness — the "best of both" among the four load-based algorithms |
| Users need session stickiness (in-memory sessions, per-server caching) and the server fleet size is stable/rarely changes | **IP Hash** | Simple to implement, guarantees same-client-same-server, and the server-count-change weakness rarely triggers in a static fleet |
| Same stickiness requirement, but the fleet autoscales frequently, or it's a distributed cache/database that needs graceful node addition/removal | **Consistent Hashing** | The only algorithm in this list built specifically to survive server count changes without mass remapping |
| Distributed database or cache needing both stickiness *and* fault-tolerant replication (e.g. "store this data on 3 different nodes") | **Consistent Hashing (with replication)** | The ring's clockwise-N-distinct-servers rule is exactly how systems like DynamoDB and Cassandra decide replica placement |

---

## Real Systems, Real Algorithm Choices

| System / context | Algorithm typically used | Why it fits |
|---|---|---|
| Simple internal microservice, uniform hardware | Round Robin | Nothing more sophisticated is needed |
| Nginx/HAProxy upstream pools with mixed instance types | Weighted Round Robin or Weighted Least Connections | Both are natively supported; the choice depends on whether request durations vary |
| AWS ALB (Application Load Balancer) | Least Outstanding Requests (a Least-Connections variant) | Default algorithm for HTTP/HTTPS target groups, chosen because request durations vary in most web workloads |
| Memcached client-side routing (Ketama) | Consistent Hashing | Distributes cache keys across nodes without a central coordinator, and survives node addition/removal gracefully |
| Video/CDN streaming edge routing | IP Hash or session-based hashing | Keeps a user's video chunks hitting the same edge server for cache locality |
| Cassandra / DynamoDB | Consistent Hashing with virtual nodes and N-way replication | Needs both stable key-to-node mapping and fault-tolerant replica placement — exactly what the ring provides |

---

## The Progression, in One Paragraph

The six algorithms aren't six unrelated ideas — they're a progression of fixes. Round Robin is the simplest possible policy, but ignores that servers differ in capacity — Weighted Round Robin fixes that. Both ignore real-time load, so a server can still get overloaded mid-cycle — Least Connections fixes that by checking actual active connections instead of just taking turns. Least Connections then ignores capacity differences again — Weighted Least Connections folds that back in. All four of those ignore *who* is asking, which breaks session stickiness and caching — IP Hash fixes that by hashing the client. But IP Hash falls apart the moment the server count changes — Consistent Hashing fixes that by moving from a fragile `% N` calculation to a ring where only a small arc reshuffles. Each algorithm exists because the one before it left exactly one gap open.

## One-Line Summary

There's no single "best" load balancing algorithm — Round Robin and its weighted variant optimize for simplicity and known capacity, Least Connections and its weighted variant optimize for real-time load awareness, and IP Hash with Consistent Hashing optimize for client stickiness — the right choice always comes down to whether your system cares more about *even load* or *consistent routing*.
