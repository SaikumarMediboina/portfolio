# Load Balancer Basics — Explained Simply

## The One-Line Idea

A **Load Balancer** is like a restaurant host. When customers walk in, the host doesn't seat everyone at the same table — they look at which tables are free and send each customer to the right one.

In technical terms:

> **A Load Balancer receives incoming requests from users and sends each one to the right backend server, so no single server gets overloaded.**

---

## Why Do We Even Need This?

Imagine you built an app, and right now only one server handles everything.

```
   100 Users
       |
       v
   Server A   →  No problem, easily handled
```

Your app becomes popular. Now thousands of people are using it.

```
  10,000 Users
       |
       v
   Server A   →  Can only safely handle 2,000 requests/sec
                 but 5,000 are arriving!
```

What happens next?

```
CPU        → 100% (maxed out)
Memory     → almost full
Threads    → all busy
Response   → very slow
Eventually → Server A CRASHES
```

Now **everyone** loses access to the app — because everything depended on one machine.

This shows us two real problems:

1. **Capacity problem** — one server can only handle so much traffic.
2. **Single Point of Failure (SPOF)** — if that one server dies, the whole app dies with it.

**The fix:** use multiple servers instead of one. But now a new question comes up — *which server should a user's request go to?* We can't expect users to decide that manually. So we place a **Load Balancer** in the middle to make that decision automatically.

---

## Where Does It Sit in the System?

```
                +----------------+
   User  ------>| Load Balancer  |
                +----------------+
                   /     |     \
                  v      v      v
              Server A Server B Server C
```

The user only knows one address, like `api.myapp.com`. They have no idea whether there are 3 servers behind it or 300 — that detail is completely hidden from them.

---

## Step-by-Step: What Actually Happens

**Step 1 — User sends a request**

```
GET /products/iphone
```

The user thinks they're talking directly to `api.myapp.com`. They don't know or care how many servers exist behind it.

**Step 2 — Request reaches the Load Balancer**

The Load Balancer looks at its list of servers:

```
Server A
Server B
Server C
```

and asks itself: *"Which healthy server should handle this?"*

**Step 3 — Load Balancer picks a server**

```
Server A → 70 active requests
Server B → 20 active requests   ← fewer requests, pick this one!
Server C → 50 active requests
```

Or it might just take turns in order — this simple method is called **Round Robin**:

```
Request 1 → A
Request 2 → B
Request 3 → C
Request 4 → A   (starts over)
```

**Step 4 — Request is forwarded**

```
User → Load Balancer → Server B
```

Server B does the actual work — checks the database, builds a response like:

```json
{ "name": "iPhone", "price": 79999 }
```

**Step 5 — Response comes back the same way**

```
Server B → Load Balancer → User
```

The user only sees the final result. They never know it was "Server B" that helped them.

---

## The Full Picture

```
                    User's Request
                          |
                          v
                 +------------------+
                 |       USER       |
                 +------------------+
                          |
                          v
                 +------------------+
                 |  LOAD BALANCER   |
                 |  "who is free    |
                 |   and healthy?"  |
                 +------------------+
                   /       |       \
                  v        v        v
            +--------+ +--------+ +--------+
            |Server A| |Server B| |Server C|
            +--------+ +--------+ +--------+
                          |
                          v
                       Database
```

---

## What If a Server Dies Mid-Way?

Load Balancers regularly ask each server: *"Are you still alive?"* This is called a **health check**.

```
GET /health

Server A → Healthy   ✅
Server B → Healthy   ✅
Server C → Unhealthy ❌
```

The Load Balancer simply stops sending new traffic to Server C:

```
       Load Balancer
        /        \
       v          v
   Server A    Server B

   Server C
   ❌ ignored until it recovers
```

**Important nuance for interviews:** it does *not* automatically mean a failed request gets magically resent elsewhere. Retrying depends on configuration, and it's only safe for requests that are **idempotent** — meaning doing them again doesn't cause harm.

- `GET /products/10` → safe to retry (just reads data)
- `POST /payments` → risky to retry (could accidentally charge twice)

---

## Why Load Balancers Matter — 4 Big Benefits

### 1. Traffic Distribution
Instead of one server drowning in requests, the load spreads out:

```
5000 requests/sec
        |
        v
      LB
   /   |   \
  v    v    v
 ~1667 ~1667 ~1666
```

### 2. High Availability
Even if one server goes down, the app keeps running because traffic just flows to the healthy ones.

### 3. Scalability
When traffic grows, you don't need to make one server "bigger" — you just **add more servers** (this is called **horizontal scaling**), and the Load Balancer automatically starts using them.

```
Before:  LB → [A, B]
After:   LB → [A, B, C, D, E, F]
```

### 4. Better Performance
Nobody's app "runs faster" because of a load balancer directly — but by making sure no single machine is overloaded, overall response times stay healthy.

---

## A Good Follow-up Question: Can the Load Balancer Itself Fail?

Yes! If you only have **one** Load Balancer and it crashes, your whole system goes down — the Load Balancer itself becomes the single point of failure.

That's why real production systems usually run **multiple load balancers** working together, not just one:

```
                 Users
                   |
                   v
          Highly Available LB Layer
              /            \
           LB-1            LB-2
              \            /
               Backend Servers
              /      |       \
             A       B        C
```

Cloud providers (like AWS, Azure) usually handle this complexity for you behind the scenes.

---

## How to Answer This in an Interview

**❌ Weak answer:**
> "It distributes traffic between servers."

Too basic for someone with real experience.

**✅ Strong answer:**
> "A load balancer sits between clients and a pool of backend servers, distributing requests among the healthy ones. It prevents any single server from being overloaded, supports horizontal scaling, and improves availability by detecting failed instances through health checks and removing them from rotation. It also hides the backend topology from clients — so servers can be added or removed without clients knowing."

If the interviewer digs deeper and asks *"how does it choose the server?"* — that's when you talk about algorithms like Round Robin, Least Connections, IP Hash, and Consistent Hashing (each is its own topic).

---

## One Important Limitation to Remember

A Load Balancer fixes **traffic routing** — it does **not** fix every bottleneck in your system.

```
       LB
     / | \
    A  B  C
     \ | /
      DB
```

If all three servers are hammering the *same* database, adding more app servers won't help — the database itself becomes the new bottleneck.

**Key insight:** Load balancing solves the traffic-distribution problem, not every scaling problem in your architecture.

---

## Quick Recap

- A Load Balancer sits between users and your servers.
- It picks a healthy server for each request using an algorithm (like Round Robin).
- It performs health checks to avoid sending traffic to dead servers.
- It gives you: **distribution + scalability + availability + fault tolerance.**
- It can itself become a single point of failure unless you run more than one.
- It solves traffic routing — not every downstream bottleneck (like an overloaded database).

**Mental shortcut:** whenever you see one entry point fanning out to multiple servers, think:

```
User → LOAD BALANCER → [Server A, Server B, Server C]
```