# Vertical vs Horizontal Scaling — HLD Interview Guide

> **Analogy used throughout: Restaurant Kitchen** 🍳

---

## 1. One-Line Intuition

> **When customers at a restaurant increase, making one kitchen bigger is Vertical Scaling; opening 5 more kitchens and splitting orders across them is Horizontal Scaling.**

| Term | Meaning |
|---|---|
| **Vertical Scaling / Scale Up** | Increasing the capacity of one machine |
| **Horizontal Scaling / Scale Out** | Increasing the number of machines |

```text
Vertical:
Small Server
    ↓
Bigger Server
    ↓
Much Bigger Server

Horizontal:
Server
    ↓
Server + Server + Server + Server
```

But a one-line definition isn't enough for an interview. The real difficulty:

> **Adding machines in horizontal scaling is easy.
> Correctly distributing work + data + state across them is hard.**

---

## 2. The Problem It Solves

### Scaling isn't just about traffic

When incoming traffic increases, a system needs four main resources:

```text
                   SYSTEM CAPACITY
                         │
       ┌─────────────────┼──────────────────┐
       │                 │                  │
     CPU               Memory             Storage
   Compute              RAM            Capacity + IOPS
       │
       └──────────────────────── Network
                           Bandwidth
```

AWS itself defines instance types based on combinations of CPU, memory, storage, and networking capacity.

### 1. Compute / CPU

```text
1 request → password hashing
          → JSON parsing
          → business logic
          → recommendation calculation
```

As requests increase, CPU heads to 100% → Latency ↑, Queue ↑, Timeouts ↑, throughput saturates.

### 2. Memory / RAM

```text
Caches
DB connection pools
JVM heap
Sessions
Buffers
In-memory objects
```

If RAM runs out: GC pressure → swap → OOM kill → process crash.

### 3. Storage

Two dimensions:

```text
Capacity        →  "How many TB of data can we store?"
Performance      →  "How many reads/writes per second can we do?"
```

10 TB of disk with only 3,000 IOPS → a high-write DB still bottlenecks.

### 4. Network

```text
Video/image service

CPU:       35%
RAM:       50%
Network:  100%   ← the real bottleneck
```

Scaling CPU here won't help at all.

> **Interview line:** "First identify the constrained resource: compute, memory, storage capacity/IOPS, or network bandwidth."

---

## 3. Worked Example — ShopKart Flash Sale

Normal day:

```text
1,000 requests/sec
        │
        ▼
┌────────────────┐
│ App Server     │
│ 8 CPU          │
│ 32 GB RAM      │
└────────────────┘
        │
        ▼
     Database
```

Sale traffic ramp:

```text
1,000 QPS → 3,000 → 6,000 → 10,000 QPS
```

Server capacity ≈ 1,500 QPS.

```text
incoming  = 10,000/sec
processing = 1,500/sec
queue growth ≈ 8,500/sec
```

Result: CPU hits 100% → queue fills up → latency 100ms → 3s → 10s → timeouts → 503 errors → "the site looks down."

Two options: **a bigger kitchen** or **more kitchens**.

---

## 4. Vertical Scaling — Scale Up

> Restaurant: A kitchen has 4 chefs. Instead of opening a new branch, we add 20 chefs, a bigger oven, and a bigger fridge to the *same* kitchen.

```text
Before                        After
┌────────────────────┐        ┌──────────────────────────┐
│ Server             │        │ BIG SERVER               │
│ 8 vCPU             │   →    │ 64 vCPU                  │
│ 32 GB RAM          │        │ 256 GB RAM                │
└────────────────────┘        │ Faster Network / Storage  │
                               └──────────────────────────┘
```

### Step 1 — Identify the bottleneck

```text
CPU = 95%   ← bottleneck
RAM = 40%
Disk = 20%
Network = 35%
```

> Don't blindly double the whole machine — scale the constrained resource, not the entire box.

### Step 2 — Pick a bigger instance

```text
small → medium → large → xlarge → 4xlarge → 16xlarge → metal / high-memory
```

### Step 3 — Redeploy on the bigger machine

Cloud resize operations conceptually = `stop → resize → start` (exact downtime behavior is platform/workload dependent).

> Vertical scaling **can require downtime or a restart**, unless the platform provides live migration or rolling failover.

### Step 4 — Diminishing returns

```text
Before: 8 vCPU  → ~1,500 QPS
After:  32 vCPU → ~5,000 QPS   (CPU ×4, throughput only ×3.3)
```

Why not ×4? Because of:

```text
locks · DB waits · disk IO · network
single-threaded sections · GC · shared cache contention
```

### Step 5 — Eventually you hit a ceiling

AWS's largest memory-optimized instance (`u-24tb1.metal`) currently offers **~24 TiB RAM and 448 vCPUs** — enormous, but still finite. The ceiling depends on provider + instance family + workload, not a fixed number like "64 CPU."

```text
Need 600 CPUs
Largest suitable machine = 192 CPUs (example)

You cannot:
192 → 384 → 768 forever
```

### The Big Problem: SPOF

**SPOF = Single Point of Failure**

```text
Clients
   │
   ▼
┌──────────────┐
│ Giant Server │  ← crashes
└──────────────┘
        X
Entire application unavailable
```

> **Scalability ≠ Availability.** Solving capacity doesn't solve resilience.

---

## 5. Horizontal Scaling — Scale Out

> Restaurant: Instead of making the main kitchen giant, we open 10 identical kitchens and a host distributes customer orders across them.

```text
               Orders
                  │
                  ▼
              [ Host ]
            /    |    \
           /     |     \
       Kitchen Kitchen Kitchen
```

The system's equivalent of "Host" = **Load Balancer**.

### Step 1 — Multiple copies of the service

```text
App A
App B
App C
App D
```

(Kubernetes horizontal scaling = deploying additional Pods to meet demand.)

### Step 2 — Put a load balancer in front

```text
Users
  │
  ▼
┌───────────────┐
│ Load Balancer │
└───────────────┘
 │      │      │
 ▼      ▼      ▼
App1   App2   App3
```

Algorithms: Round Robin · Least Connections · Weighted routing · Hash-based routing

### Step 3 — Health checks

```text
            LB
          /    \
      App1     App3
     App2 X   ← dead, no traffic routed
```

### Step 4 — Now the *real* horizontal problem appears: state

```text
Request 1 → Kitchen A   "add an iPhone to the cart"
Request 2 → Kitchen B   "show me my cart"
```

If Kitchen A stores the cart in **local memory only**:

```text
Kitchen A memory: cart = ["iPhone"]
Kitchen B memory: cart = []
```

Request 2 returns an empty cart → the user complains. This is the **state distribution problem**.

---

## 6. Stateless vs Stateful

### Stateless Service

> Any request can go to any server because the server doesn't depend on information stored from previous requests in its own memory.

```http
GET /products/123
Authorization: JWT...
```

Any app instance (App1 ✓, App2 ✓, App3 ✓) can process it → horizontal scaling is easy.

### Stateful Service

Examples: Database · Redis (non-replicated) · in-memory sessions · WebSocket connections · game servers · Kafka partition leaders.

**Classic session problem:**

```text
              LB
           /      \
        App1      App2

App1 RAM: session_123 = logged_in

Request #1: Login  → App1   ✓
Request #2: Profile → App2  → "Who are you?" ✗
```

**Fix 1 — Sticky Sessions**

```text
User A → always App1
User B → always App2
```

Works, but causes uneven load and session loss if that node dies.

**Fix 2 — External session store**

```text
             Load Balancer
             /          \
          App1          App2
             \          /
              \        /
               Redis
```

`session_123 → Redis`, so any request from any app instance works.

### Why Databases Are Hard to Scale Horizontally

```text
DB Node A: balance = ₹10,000
DB Node B: balance = ₹10,000

Node A withdraws ₹8,000
Node B withdraws ₹5,000  (simultaneously)

Combined withdrawal = ₹13,000
But actual balance   = ₹10,000   ← inconsistency!
```

Now you need: replication · consensus · locking · leader election · transactions · conflict resolution · quorums · partitioning.

> **Compute is easy to duplicate. Truth is hard to duplicate.**

---

## 7. Full Comparison Diagrams

### Vertical Scaling

```text
                USERS
                  │  10,000 QPS
                  ▼
        ┌──────────────────────┐
        │   BIG APP SERVER     │
        │  64 vCPU              │
        │  256 GB RAM            │
        │  Fast NIC / Fast SSD   │
        └──────────────────────┘
                  │
                  ▼
             Database
```

**Pros:** simple, no distributed coordination, no sharding.
**Cons:** the kitchen dies → everything dies; eventually it can't get bigger.

### Horizontal Scaling

```text
                      USERS
                        │
                        ▼
               ┌─────────────────┐
               │  LOAD BALANCER  │
               └─────────────────┘
                  /     |      \
                 ▼      ▼       ▼
          ┌────────┐ ┌────────┐ ┌────────┐
          │ App 1  │ │ App 2  │ │ App 3  │
          │ 8 CPU  │ │ 8 CPU  │ │ 8 CPU  │
          └────────┘ └────────┘ └────────┘
                \        |        /
                 ▼       ▼        ▼
                 ┌───────────────┐
                 │ Shared DB /   │
                 │ Cache/Queues  │
                 └───────────────┘
```

---

## 8. Real-Time Walkthrough With Numbers

**Setup:** normal traffic 1,000 QPS, sale traffic 10,000 QPS. Base server = 8 vCPU / 32 GB, capacity ≈ 1,250 QPS.

### Situation 1 — Vertical only

```text
8 CPU → 16 → 32 → 64 CPU
Final capacity ≈ 10,500 QPS   ✓ handles the sale
```

Then at 2:03 PM, the server crashes:

```text
Before = 10,500 QPS
After  = 0 QPS        ← 100% → 0% availability
```

### Situation 2 — Horizontal (10 nodes)

```text
Each node ≈ 1,250 QPS
10 nodes → 12,500 QPS capacity (headroom above 10,000 QPS demand)
```

One node crashes:

```text
10 nodes → 9 nodes
Capacity: 12,500 → 11,250 QPS   (still > 10,000 QPS demand)
Per-node load: 10,000 / 9 ≈ 1,111 QPS   (still under the 1,250 limit)
```

```text
Vertical node crash:    capacity → 0
Horizontal node crash:  capacity → ~90%
```

### Cost Curves

```text
Vertical (non-linear, gets steep):        Horizontal (roughly linear hardware cost):
Cost                                       Cost
 ^                    *                     ^              /
 |               *                          |            /
 |          *                                |          /
 |      *                                    |        /
 |  *                                        |      /
 +----------------------> Capacity           +----------------> Capacity
```

Horizontal hides other costs though: load balancers, orchestration (K8s/ECS), monitoring, service discovery, distributed tracing, replication, on-call complexity.

> Horizontal scaling may have a more linear **hardware capacity curve**, but not necessarily a linear **total engineering cost curve**.

---

## 9. Auto-Scaling

### Example Kubernetes HPA

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: product-service
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: product-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

```text
Current replicas    = 5
Current avg CPU     = 84%
Target              = 70%

Desired replicas ≈ 5 × 84/70 ≈ 6
```

### Timeline example

```text
10:00  Traffic = 3k QPS   → Pods = 3
11:00  Traffic = 7k, CPU 88%  → 3 → 6 pods
12:00  Traffic = 14k, CPU 82% → 6 → 12 pods
16:00  Traffic falls, CPU 18% → 12 → 8 → 5 → 3 pods
```

### CPU-only metric can be misleading

```text
CPU = 20%
Latency = 8 sec
Queue = 100,000 requests   ← the service is actually drowning
```

Better signals depending on workload: QPS, queue depth, p95 latency, Kafka consumer lag, active connections.

### Scaling down carelessly is also dangerous

```text
Traffic: 10,000 → 1,000 QPS
Autoscaler: 20 → 2 servers

Traffic spikes back up → 2 nodes overwhelmed →
autoscaler needs time → timeouts
```

Mitigations: cool-down periods, stabilization windows, minimum replicas.

---

## 10. Hybrid Approach (Real-World Reality)

> Companies almost never make one universal "vertical OR horizontal" decision for the whole system — different components scale differently.

```text
                 Load Balancer
                       │
           ┌───────────┼───────────┐
           ▼           ▼           ▼
         App1        App2         App3
           │           │           │
           └───────────┼───────────┘
                       ▼
               Powerful Primary DB
                    64 CPU / 512 GB RAM
                       │
            ┌──────────┴───────────┐
            ▼                      ▼
       Read Replica           Read Replica
```

| Component | Typical scaling pattern |
|---|---|
| App servers | Horizontal (mostly stateless) |
| Redis/cache | Vertical first, replication/sharding later |
| Database | Vertical → read replicas → partition/shard only if truly needed |

### Evolution over time

```text
Startup:        1 app, 1 DB
Growth:          3 app servers, 1 bigger DB
More growth:      20 app servers, primary DB + 3 read replicas + Redis
Massive scale:     1000 app instances, DB shards, replicas, distributed cache, queues, CDN
```

---

## 11. The Distribution Problem (Core of Horizontal Scaling)

Three questions immediately appear once you go horizontal:

**Q1 — Where does the request go?** → Load balancer, service discovery, routing.

**Q2 — Where does the data live?**

```text
DB1 → Users A-M
DB2 → Users N-Z
```

The app must know: Ravi → DB2? Akhil → DB1? (This is **sharding**.)

**Q3 — What if copies disagree?**

```text
Replica A: balance = 100
Replica B: balance = 80
```

Which is truth? → Need consistency rules.

### Concurrency example — last concert ticket

```text
App1                App2
User A               User B
 BUY                  BUY
  │                    │
  └────── DB ──────────┘
```

Without correct transaction/concurrency handling, both users can think they bought seat A12.

> **Vertical scaling asks "how large can one node become?" Horizontal scaling asks "how do independent nodes behave like one correct system?"**

---

## 12. Edge Cases & Failure Modes

**1. Load balancer becomes a SPOF**

```text
             ONE LB
               X
          / / / \ \ \
        10 servers
```

Fix: production LBs are usually themselves highly-available/distributed, not a single VM.

**2. Session stored locally** → use JWT/stateless auth or a shared Redis/session store.

**3. Database becomes the bottleneck**

```text
300 App Servers
 \||||||||||||||/
       DB
```

300 apps × 100 connections each = 30,000 DB connections → the DB collapses.
Fix: connection pooling, DB proxy, caching, read replicas, sharding.

**4. Thundering herd**

```text
cache/server crash → 10,000 requests retry simultaneously → DB melts
```

Fix: exponential backoff + jitter, rate limiting, circuit breakers, request coalescing.

**5. Autoscaling too slow**

```text
Traffic: 1,000 → 100,000 QPS in 2 seconds
Pods need startup time → existing pods overload before new ones are ready
```

Fix: minimum headroom, warm instances, predictive/scheduled scaling, queues, CDN.

---

## 13. Trade-off Table

| Dimension | Vertical | Horizontal |
|---|---|---|
| Basic idea | Bigger machine | More machines |
| Complexity | Lower | Higher |
| Initial setup | Easy | More infrastructure |
| Hardware ceiling | Yes | Much higher aggregate ceiling |
| SPOF risk | High if single node | Lower with redundancy |
| Stateless services | Works | Excellent fit |
| Stateful systems | Simpler initially | Harder |
| Consistency | Simple | Coordination needed |
| Deployment | Resize/restart possible | Rolling deployment possible |
| Cost curve | Can become steep | Compute often more incremental |
| Fault tolerance | Weak alone | Stronger |
| Auto scaling | Less natural | Natural |
| Data distribution | Usually unnecessary | May become necessary |

**Choose vertical when:** the system is small, simplicity matters, workload is stateful, the DB hasn't hit its ceiling, horizontal complexity isn't justified yet.

**Choose horizontal when:** traffic can exceed one node, high availability is required, workload is stateless, traffic is variable, you need autoscaling, you need geographic distribution, single-node failure must not take down the service.

---

## 14. Failure Domains

```text
Vertical:   1 × 64 CPU server fails → lost capacity = 100%
Horizontal: 8 × 8 CPU servers, 1 fails → lost capacity = 12.5%
```

But this only helps if shared dependencies aren't themselves a SPOF:

```text
            LB
       / / / | \ \ \
      8 App Servers   ← nicely horizontal
            │
            ▼
         ONE DB
            X          ← still a SPOF!
```

---

## 15. Database Scaling Stages

```text
Stage 1: Vertical scale the single DB
         8 CPU/32GB → 32 CPU/128GB

Stage 2: Add read replicas
              Primary
             /       \
        Replica1   Replica2
         (writes → primary, reads → replicas — watch replication lag)

Stage 3: Partition/shard when writes exceed one DB
         Users 0-1M   → Shard A
         Users 1M-2M  → Shard B
         Users 2M-3M  → Shard C
         (cross-shard queries/transactions become distributed-systems problems)
```

---

## 16. Common Interview Trap

**Weak answer:** "Horizontal, because it's better and unlimited."
❌ Horizontal isn't unlimited — dependencies (DB, Kafka, Redis, network, cloud quotas) still have limits.

**Strong answer:**

> "First I'd identify the bottleneck and the workload's state model. For a stateless app tier, I'd horizontally scale behind a load balancer, keeping session state external. For a stateful component like the primary database, I'd first scale vertically since it's operationally simpler, then add caching and read replicas, and only shard once the write/data-size requirements truly justify the distributed-systems complexity. I'd check CPU, memory, storage IOPS, and network independently rather than assuming CPU is the bottleneck, and keep spare capacity to survive a node failure."

---

## 17. Sample Interview Q&A

**Q:** "Your e-commerce service handles 2K QPS and you expect 20K QPS during a flash sale. Vertical or horizontal — and how do you handle failure?"

**✅ Strong answer:**

> "I'd load-test to find per-instance throughput and check whether CPU, memory, network, or downstream dependencies are the limit. For a stateless app tier, I'd horizontally scale behind a load balancer — e.g. if one instance handles 2,000 QPS, 20,000 QPS mathematically needs ten instances, but I'd provision twelve or more for failure headroom. Sessions go external (Redis/JWT). I'd autoscale on a meaningful signal — CPU, request rate, queue depth, or latency — with a sale-day minimum already warm.
>
> Then I'd validate the database independently: fifty app instances don't help if the DB saturates at 8K QPS. I'd look at query optimization, caching, connection pooling, vertical DB scaling, and read replicas before ever considering sharding.
>
> Finally, I'd design for node loss — if 10 nodes are needed at peak, provision enough headroom that losing one or more doesn't overload the rest."

---

## 18. Decision Framework — Four Questions

Whenever asked to "scale this system," ask:

```text
1. WHAT resource is saturated?         (CPU / RAM / Disk / Network)
2. WHAT state does this component own?
3. CAN requests/data be partitioned?
4. WHAT happens when a node fails?
```

```text
              Need to Scale
                   │
                   ▼
         What is bottleneck?
       /      |      |       \
     CPU     RAM    Disk    Network
                   │
                   ▼
           Is service stateful?
             /             \
           No               Yes
           │                 │
           ▼                 ▼
     Horizontal easy    Coordination needed
           │                 │
           ▼                 ▼
        Add nodes      Scale-up / replicas /
                       partition cautiously
```

---

## 19. Final Mental Model

```text
                        CUSTOMERS
                            │
                     More customers
                            │
                            ▼
                    NEED MORE CAPACITY
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
        VERTICAL SCALE             HORIZONTAL SCALE
       Bigger kitchen               More kitchens

        ┌─────────┐             ┌────┐ ┌────┐ ┌────┐
        │ GIANT   │             │ K1 │ │ K2 │ │ K3 │
        │ KITCHEN │             └────┘ └────┘ └────┘
        └─────────┘                ▲      ▲      ▲
                                    └──────┼──────┘
                                       HOST / LB
        Simple                        Distributed
          │                               │
          ▼                               ▼
     Easy state                     Need coordination
          │                               │
          ▼                               ▼
   Physical ceiling                Add more nodes
          │                               │
          ▼                               ▼
   Bigger failure                 Better redundancy
      domain
```

---

## 20. One-Line Summary

> **Vertical scaling means making one kitchen powerful; horizontal scaling means adding kitchens and splitting the load across them — but the moment you add more kitchens, the distributed-systems question of "who owns the work, the state, the truth?" begins.**

**Shorter interview memory line:**

> **Scale-up buys simplicity with a machine ceiling; scale-out buys capacity and resilience at the cost of coordination complexity.**