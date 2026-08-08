# Weighted Round Robin — Continuation of Round Robin

In Round Robin, we saw:

```text
S1 → S2 → S3 → S1 → S2 → S3
```

Weighted Round Robin is the next step.

It is useful when all servers do **not** have the same capacity.

Instead of giving every server the same amount of traffic, we give **more requests to stronger servers and fewer requests to weaker servers**.

---

## 1. ONE-LINE INTUITION

Imagine a restaurant with three waiters:

* Waiter A is very fast
* Waiter B is medium
* Waiter C is slower

If the host gives the same number of customers to all three, the slower waiter may get overloaded.

So the host gives:

```text
A → more customers
B → medium number of customers
C → fewer customers
```

That is the idea behind **Weighted Round Robin**.

> Weighted Round Robin assigns each server a weight, and servers with higher weights receive more traffic.

---

## 2. THE PROBLEM WITHOUT IT

First, recall normal Round Robin.

Suppose we have three backend servers:

```text
S1 = 16 CPU cores
S2 = 8 CPU cores
S3 = 4 CPU cores
```

Plain Round Robin distributes traffic like this:

```text
Request 1 → S1
Request 2 → S2
Request 3 → S3
Request 4 → S1
Request 5 → S2
Request 6 → S3
```

So the distribution is roughly:

```text
S1 → 33%
S2 → 33%
S3 → 33%
```

This looks fair.

But the servers are not equally powerful.

Their real capacities are closer to:

```text
S1 → Strong
S2 → Medium
S3 → Weak
```

Suppose the system receives:

```text
3000 requests/sec
```

Plain Round Robin sends:

```text
S1 → 1000 req/sec
S2 → 1000 req/sec
S3 → 1000 req/sec
```

But assume their actual capacities are:

```text
S1 capacity ≈ 1600 req/sec
S2 capacity ≈ 900 req/sec
S3 capacity ≈ 400 req/sec
```

Now we get:

```text
S1 → Comfortable ✅
S2 → Slightly overloaded ⚠️
S3 → Heavily overloaded ❌
```

On S3:

```text
CPU → 100%
Memory pressure ↑
Request queue ↑
Latency ↑
Timeouts ↑
```

Eventually:

```text
Client
  |
  v
Load Balancer
  |
  v
 S3
  |
  X
Timeout / 503
```

The important observation is:

> The system still has unused capacity, but traffic is being distributed in the wrong proportion.

For example:

```text
S1 still has spare capacity
        ↓
S3 is overloaded
        ↓
Users still experience failures
```

Weighted Round Robin solves this problem.

---

## 3. WHAT DOES “WEIGHT” MEAN?

A **weight** is a relative number that tells the Load Balancer how much traffic a server should receive compared with the other servers.

Example:

```text
S1 weight = 4
S2 weight = 2
S3 weight = 1
```

Total weight:

```text
4 + 2 + 1 = 7
```

Expected traffic share:

```text
S1 → 4/7 ≈ 57%
S2 → 2/7 ≈ 29%
S3 → 1/7 ≈ 14%
```

So if 700 requests arrive:

```text
S1 → about 400 requests
S2 → about 200 requests
S3 → about 100 requests
```

Visually:

```text
             700 Requests
                  |
                  v
           Load Balancer
          /      |       \
         /       |        \
        v        v         v
      S1        S2        S3
      400       200       100

     Weight     Weight     Weight
       4          2          1
```

Now traffic is much closer to the actual server capacities.

---

## 4. HOW IT FITS IN THE ARCHITECTURE

The architecture is the same as normal Round Robin.

```text
                  Client
                     |
                     |
                     v
              +---------------+
              | Load Balancer |
              | Weighted RR   |
              +---------------+
                /      |      \
               /       |       \
              v        v        v
          Server-1 Server-2 Server-3
          Weight 4 Weight 2 Weight 1
```

The client does not know anything about:

```text
Server-1
Server-2
Server-3
Weights
Routing algorithm
```

The client simply sends requests to something like:

```text
https://shop.example.com
```

From the client's point of view:

```text
Client → shop.example.com
```

That's all.

Behind the scenes:

```text
Client
  |
  | HTTP Request
  v
Load Balancer
  |
  | Choose a server
  | based on configured weights
  v
Backend Server
```

---

## 5. CLIENT → LOAD BALANCER → SERVER FLOW

Let's go through every hop.

### Step 1 — Client sends a request

A user opens a shopping application.

The mobile app sends:

```http
GET /products
Host: shop.example.com
```

Flow:

```text
Mobile App
    |
    | GET /products
    v
Load Balancer
```

The client is not deciding which backend server should process the request.

That responsibility belongs to the Load Balancer.

---

### Step 2 — Load Balancer receives the request

The Load Balancer may internally know something like:

```text
Backend Pool

S1 → HEALTHY → weight 4
S2 → HEALTHY → weight 2
S3 → HEALTHY → weight 1
```

Conceptually:

```text
          Eligible Backends

        +-------------------+
        | S1 | Weight = 4   |
        | S2 | Weight = 2   |
        | S3 | Weight = 1   |
        +-------------------+
```

Now the Load Balancer must answer:

> Which server should receive this request?

That is where the **Weighted Round Robin algorithm** is used.

---

## 6. HOW WEIGHTED ROUND ROBIN PICKS A SERVER

Suppose:

```text
S1 weight = 4
S2 weight = 2
S3 weight = 1
```

A simple conceptual scheduling sequence could be:

```text
S1
S1
S1
S1
S2
S2
S3
```

Then repeat.

So requests may look like:

```text
R1 → S1
R2 → S1
R3 → S1
R4 → S1
R5 → S2
R6 → S2
R7 → S3

R8 → S1
R9 → S1
...
```

Over each group of 7 requests:

```text
S1 receives 4
S2 receives 2
S3 receives 1
```

Therefore:

```text
Traffic ratio = 4 : 2 : 1
```

---

## 7. VISUAL DIAGRAM

```text
                         CLIENTS
                  Request Request Request
                     \      |      /
                      \     |     /
                       v    v    v

                  +------------------+
                  |                  |
                  |  LOAD BALANCER   |
                  |                  |
                  | Weighted RR      |
                  +------------------+
                     /      |      \
                    /       |       \
                   v        v        v

              +---------+ +---------+ +---------+
              |   S1    | |   S2    | |   S3    |
              |         | |         | |         |
              |Weight=4 | |Weight=2 | |Weight=1 |
              +---------+ +---------+ +---------+
                   |          |          |
                   |          |          |
                  57%        29%        14%
                traffic    traffic    traffic
```

---

## 8. REQUEST AND RESPONSE PATH

The request moves like this:

```text
             REQUEST

Client
  |
  | HTTPS Request
  v
Load Balancer
  |
  | Weighted selection
  v
Server-1
```

Then the response comes back:

```text
             RESPONSE

Server-1
  |
  | HTTP 200
  v
Load Balancer
  |
  | HTTP 200
  v
Client
```

Combined:

```text
Client
  |
  | Request
  v
Load Balancer
  |
  | Forward Request
  v
Server
  |
  | Response
  v
Load Balancer
  |
  | Response
  v
Client
```

---

## 9. ROUND ROBIN VS WEIGHTED ROUND ROBIN

Suppose:

```text
S1 = strong server
S2 = medium server
S3 = weak server
```

### Plain Round Robin

Traffic goes:

```text
R1 → S1
R2 → S2
R3 → S3
R4 → S1
R5 → S2
R6 → S3
```

Traffic distribution:

```text
S1 → 33%
S2 → 33%
S3 → 33%
```

Diagram:

```text
             Round Robin

              Requests
                 |
                 v
            Load Balancer
             /    |    \
            /     |     \
           v      v      v
          S1     S2     S3

         33%    33%    33%
```

---

### Weighted Round Robin

Weights:

```text
S1 = 4
S2 = 2
S3 = 1
```

Traffic distribution:

```text
S1 → 57%
S2 → 29%
S3 → 14%
```

Diagram:

```text
        Weighted Round Robin

               Requests
                  |
                  v
             Load Balancer
             /     |     \
            /      |      \
           v       v       v

          S1      S2      S3
          W=4     W=2     W=1

          57%     29%     14%
```

The key difference is:

> Round Robin treats all servers equally.

> Weighted Round Robin distributes traffic according to configured server capacity.

---

## 10. REAL-TIME WALKTHROUGH

Suppose our shopping application has:

```text
S1 → 16-core machine → Weight 4
S2 → 8-core machine  → Weight 2
S3 → 4-core machine  → Weight 1
```

A user named Ravi opens:

```text
https://shop.example.com/home
```

His mobile application sends:

```http
GET /home
```

---

### Step 1 — Request reaches the Load Balancer

```text
Ravi's Phone
     |
     | GET /home
     v
Load Balancer
```

The Load Balancer knows:

```text
S1 → Weight 4 → HEALTHY
S2 → Weight 2 → HEALTHY
S3 → Weight 1 → HEALTHY
```

According to its current Weighted Round Robin state, suppose:

```text
Chosen Server = S1
```

---

### Step 2 — Load Balancer forwards the request

```text
Load Balancer
     |
     | GET /home
     v
    S1
```

S1 receives the request.

It may perform:

```text
Authenticate user
       |
       v
Read recommendation cache
       |
       v
Fetch product information
       |
       v
Build JSON response
```

Example:

```json
{
  "products": [
    "Phone",
    "Laptop",
    "Shoes"
  ]
}
```

---

### Step 3 — Server returns the response

```text
S1
 |
 | HTTP 200
 v
Load Balancer
 |
 | HTTP 200
 v
Ravi's Phone
```

Ravi does not know:

```text
S1 handled my request
```

He only knows:

```text
shop.example.com
```

The Load Balancer hides the individual backend servers from the client.

---

## 11. HOW ARE THE NEXT REQUESTS DISTRIBUTED?

Weights:

```text
S1 = 4
S2 = 2
S3 = 1
```

A basic scheduling window might look like:

```text
R1 → S1
R2 → S1
R3 → S1
R4 → S1
R5 → S2
R6 → S2
R7 → S3
```

Then repeat:

```text
R8  → S1
R9  → S1
R10 → S1
R11 → S1
R12 → S2
R13 → S2
R14 → S3
```

After 14 requests:

```text
S1 → 8 requests
S2 → 4 requests
S3 → 2 requests
```

Ratio:

```text
8 : 4 : 2
```

Simplify it:

```text
4 : 2 : 1
```

Exactly the configured weight ratio.

---

## 12. A SUBTLE PROBLEM

Consider this scheduling sequence:

```text
S1 S1 S1 S1 S2 S2 S3
```

The correct final ratio is:

```text
4 : 2 : 1
```

But notice that S1 receives four requests consecutively:

```text
R1 → S1
R2 → S1
R3 → S1
R4 → S1
```

This can create a small traffic burst.

Instead, we could distribute the same ratio more smoothly:

```text
S1
S2
S1
S3
S1
S2
S1
```

Count again:

```text
S1 = 4
S2 = 2
S3 = 1
```

Same ratio.

But requests are distributed more evenly over time.

This leads to:

### Smooth Weighted Round Robin
---

## 13. SMOOTH WEIGHTED ROUND ROBIN

Imagine three students should receive chocolates in the following ratio:

```text
A = 5
B = 3
C = 2
```

One way:

```text
A A A A A B B B C C
```

The ratio is correct.

But A receives everything first.

A smoother order could be:

```text
A B C A B A C A B A
```

Final count:

```text
A = 5
B = 3
C = 2
```

Same result.

But the distribution is smoother.

Load Balancers can use the same idea.

Instead of:

```text
S1 S1 S1 S1 S2 S2 S3
```

we may get something closer to:

```text
S1 S2 S1 S3 S1 S2 S1
```

This prevents one backend from receiving a sudden batch simply because it has a large weight.

---

## 14. WHAT IF THE CHOSEN SERVER DOES NOT RESPOND?

Suppose:

```text
S1 = Weight 4
S2 = Weight 2
S3 = Weight 1
```

Now S1 crashes.

```text
S1 ❌
S2 ✅
S3 ✅
```

A production Load Balancer should not continue sending requests to S1.

For this, Load Balancers commonly perform **health checks**.

A health check is a small request used to verify whether a backend is working.

Example:

```http
GET /health
```

Flow:

```text
LB ----health check----> S1
LB <------timeout------- S1

LB ----health check----> S2
LB <------200 OK-------- S2

LB ----health check----> S3
LB <------200 OK-------- S3
```

The Load Balancer now knows:

```text
S1 = UNHEALTHY
S2 = HEALTHY
S3 = HEALTHY
```

Before:

```text
Backend Pool

S1 → Weight 4
S2 → Weight 2
S3 → Weight 1
```

After S1 fails:

```text
Healthy Backend Pool

S2 → Weight 2
S3 → Weight 1
```

Traffic now becomes approximately:

```text
S2 → 2/3 ≈ 67%
S3 → 1/3 ≈ 33%
```

Diagram:

```text
                   Load Balancer
                         |
              +----------+----------+
              |          |          |
              v          v          v
             S1         S2         S3
             ❌         ✅         ✅
          Weight 4   Weight 2   Weight 1
              |
              X
        No new traffic


Remaining traffic:

        S2               S3
        67%              33%
```

---

## 15. ROUTING VS HEALTH CHECKS

These are two different responsibilities.

Weighted Round Robin answers:

```text
Among healthy servers,
which server should receive
the next request?
```

Health checking answers:

```text
Which servers are healthy
enough to receive traffic?
```

Think of it like:

```text
             All Servers
                 |
                 v
           Health Checks
                 |
                 v
          Healthy Servers
                 |
                 v
       Weighted Round Robin
                 |
                 v
          Chosen Server
```

So Weighted Round Robin generally works over the **healthy backend pool**.

---

## 16. WHAT IF S1 COMES BACK?

Suppose S1 restarts.

The Load Balancer sends:

```http
GET /health
```

S1 returns:

```text
200 OK
```

After successful health checks, S1 can be added back:

```text
S1 → HEALTHY → Weight 4
S2 → HEALTHY → Weight 2
S3 → HEALTHY → Weight 1
```

Traffic can again approach:

```text
S1 → 57%
S2 → 29%
S3 → 14%
```

Lifecycle:

```text
S1 Healthy
    |
    v
S1 Crashes
    |
    v
Health Check Fails
    |
    v
Remove S1 From Pool
    |
    v
S1 Restarts
    |
    v
Health Checks Pass
    |
    v
Add S1 Back To Pool
```

---

## 17. WHERE DO WEIGHTS COME FROM?

Weights usually represent relative server capacity.

Example:

```text
Server      CPU      RAM      Weight

S1          16 core  64 GB       4
S2           8 core  32 GB       2
S3           4 core  16 GB       1
```

Weights do not necessarily have to equal the number of CPU cores.

They are **relative numbers**.

For example:

```text
4 : 2 : 1
```

is equivalent to:

```text
40 : 20 : 10
```

because the proportion is identical.

Normally simpler ratios are easier to understand:

```text
4 : 2 : 1
```

---

## 18. STATIC WEIGHTED ROUND ROBIN

In the simplest form, weights are configured manually.

Example:

```text
S1 = 4
S2 = 2
S3 = 1
```

These values remain the same until configuration changes.

This works well when:

```text
Server capacities are known
        +
Server capacities are stable
        +
Request costs are reasonably similar
```

For example:

```text
S1 → large VM
S2 → medium VM
S3 → small VM
```

Their relative capacities are already known.

---

## 19. DYNAMIC WEIGHTING

More advanced systems may adjust effective routing weights based on signals such as:

```text
CPU utilization
Response latency
Error rate
Queue depth
Current load
Server health
```

For example:

Initially:

```text
S1 weight = 4
S2 weight = 2
```

Suppose S1 becomes slow.

An adaptive system might effectively reduce its traffic:

```text
S1 effective weight = 1
S2 effective weight = 2
```

However, once routing is continuously reacting to real-time metrics, the system is becoming more **load-aware** rather than being simple static Weighted Round Robin.

---

## 20. WHY WEIGHTED ROUND ROBIN IS NEEDED

### A. Better Performance

Weighted Round Robin gives stronger servers more work.

Without it:

```text
Strong server → underused
Weak server   → overloaded
```

Example:

```text
S1 CPU → 40%
S3 CPU → 100%
```

The system technically has unused capacity, but users may still experience slow responses because S3 is overloaded.

With weighted routing:

```text
Strong server → more traffic
Weak server   → less traffic
```

---

### B. Better Scalability

Suppose your system initially has:

```text
S1 → 4 CPU cores
S2 → 4 CPU cores
```

Later you add:

```text
S3 → 16 CPU cores
```

Plain Round Robin:

```text
S1 → 33%
S2 → 33%
S3 → 33%
```

But S3 is much stronger.

Weighted Round Robin can use:

```text
S1 weight = 1
S2 weight = 1
S3 weight = 4
```

Then:

```text
             Requests
                |
                v
          Load Balancer
          /     |      \
         v      v       v
        S1     S2      S3
        W1     W1      W4

      ~17%   ~17%    ~66%
```

The stronger server absorbs more traffic.

---

### C. Better Availability

If combined with health checks, unhealthy servers can be removed from routing.

Without that:

```text
Request
   |
   v
Dead Server
   |
   X
Failure
```

With health checks:

```text
Dead Server
    |
    X
Removed from pool

Traffic
    |
    +----> Healthy Server
```

---

### D. Fault Tolerance

If one backend fails:

```text
S1 ❌
S2 ✅
S3 ✅
```

the system can continue using:

```text
S2 + S3
```

instead of the entire application becoming unavailable.

---

### E. Better Capacity Utilization

Without weights:

```text
Strong Server
[████------] 40%

Weak Server
[██████████] 100%
```

With proper weighting:

```text
Strong Server
[███████---] 70%

Weak Server
[██████----] 60%
```

The exact numbers vary, but the goal is to use available capacity more efficiently.

---

## 21. BENEFITS SUMMARY

| Benefit              | How Weighted Round Robin Helps         | Without It                                 |
| -------------------- | -------------------------------------- | ------------------------------------------ |
| Performance          | Stronger servers receive more traffic  | Weak servers become bottlenecks            |
| Scalability          | Different-sized servers can coexist    | Capacity is used inefficiently             |
| Availability         | Works with healthy backend pools       | Failed servers may receive traffic         |
| Fault tolerance      | Failed servers can be removed          | Requests continue failing                  |
| Capacity utilization | Traffic better matches server capacity | Strong servers remain underused            |
| Simplicity           | Easy to configure and understand       | More complex algorithms may be unnecessary |

---

## 22. LIMITATION — WEIGHT IS NOT CURRENT LOAD

This is the most important limitation.

Suppose:

```text
S1 weight = 4
S2 weight = 2
```

Current situation:

```text
S1
├── Heavy request
├── Heavy request
├── Heavy request
└── Heavy request

S2
└── Idle
```

Weighted Round Robin may still choose:

```text
S1
```

because it follows the configured weight ratio.

It does not necessarily know:

```text
S1 is currently busy
S2 is currently idle
```

So:

> Weighted Round Robin balances based on configured capacity, not necessarily real-time load.

---

## 23. LIMITATION — REQUESTS MAY HAVE DIFFERENT COSTS

Consider two APIs:

```text
GET /health
```

takes:

```text
2 ms
```

But:

```text
POST /generate-report
```

takes:

```text
20 seconds
```

From the routing algorithm's point of view:

```text
GET /health             = 1 request
POST /generate-report   = 1 request
```

But computationally:

```text
They are NOT equal.
```

Visual:

```text
Request A
GET /health
     |
     v
    2ms


Request B
Generate Report
     |
     v
  20 seconds
```

Weighted Round Robin primarily reasons about traffic proportion.

It does not automatically understand how expensive each request will be.

---

## 24. LIMITATION — BAD WEIGHTS CREATE BAD BALANCING

Suppose:

```text
S1 and S2 have equal capacity.
```

But somebody configures:

```text
S1 weight = 10
S2 weight = 1
```

Traffic becomes approximately:

```text
S1 → 91%
S2 → 9%
```

Visual:

```text
100 Requests
     |
     v
Load Balancer
   /     \
  /       \
 v         v
S1        S2
91        9
```

S1 can become overloaded even though S2 has lots of unused capacity.

Therefore:

> Weighted Round Robin is only as good as the weights you configure.

---

## 25. LIMITATION — LONG-LIVED CONNECTIONS

Suppose your application uses WebSockets.

One connection may stay open for hours:

```text
Client
  |
  | WebSocket
  |
  v
 S1
```

Imagine:

```text
S1 → 500 active connections
S2 → 100 active connections
```

A request-count-based algorithm may not perfectly reflect this imbalance.

For workloads dominated by long-lived connections, an approach such as:

```text
Least Connections
```

may be more suitable.

---

## 26. WHEN SHOULD YOU USE WEIGHTED ROUND ROBIN?

Weighted Round Robin is a good fit when:

```text
Backend capacities differ
          +
Capacity ratios are known
          +
Requests are reasonably similar
          +
You want simple routing
          +
You want predictable traffic distribution
```

Examples:

```text
Old servers + newer stronger servers

Different VM sizes

Different hardware generations

Backend machines with known unequal capacity
```

---

## 27. WHEN MAY ANOTHER ALGORITHM BE BETTER?

### Case 1 — Long-running requests

Example:

```text
Request A → 5 milliseconds
Request B → 30 seconds
```

A connection-aware strategy such as:

```text
Least Connections
```

may better represent current load.

---

### Case 2 — Highly variable request processing

If some requests are much more expensive than others, a more load-aware strategy may be useful.

---

### Case 3 — Need the same user routed consistently

Sometimes you want:

```text
User A → always Server 2
```

for some type of state or affinity.

Techniques such as:

```text
IP Hash
Cookie-based affinity
Hash-based routing
```

may be relevant.

---

### Case 4 — Cache-heavy distributed systems

If each backend owns or caches particular data, constantly changing the destination server can hurt cache efficiency.

In those systems:

```text
Consistent Hashing
```

may be more appropriate.

---

## 28. USEFUL HLD EXAMPLE — GRADUAL TRAFFIC SHIFTING

Suppose your current application version runs on:

```text
S1 weight = 10
S2 weight = 10
```

You deploy a new version on:

```text
S3
```

Instead of immediately sending one-third of all traffic to S3, you can start small:

```text
S1 = 10
S2 = 10
S3 = 1
```

Visually:

```text
              Traffic
                 |
                 v
           Load Balancer
          /      |       \
         /       |        \
        v        v         v
       S1       S2        S3
       10       10         1
                         New Version
```

If S3 behaves well, increase its share:

```text
10 : 10 : 3
```

Then:

```text
10 : 10 : 5
```

Eventually:

```text
10 : 10 : 10
```

Flow:

```text
New Version
     |
     v
Small Traffic
     |
     v
Observe
     |
     v
Increase Weight
     |
     v
Observe
     |
     v
Increase Again
```

Weighted routing can therefore be used as one mechanism for controlled traffic shifting.

---

## 29. COMPLETE MENTAL MODEL

Think about Weighted Round Robin like this:

```text
                         CLIENT
                            |
                            |
                            v
                     Load Balancer
                            |
                            |
                  Are servers healthy?
                            |
                            v
                    Healthy Pool
                            |
                            |
                  What are the weights?
                            |
                            v

              +-------------+-------------+
              |             |             |
              v             v             v
             S1            S2            S3
          Weight 4      Weight 2      Weight 1
              |             |             |
              v             v             v
             57%           29%           14%

```

The algorithm is trying to answer:

```text
Which healthy server
should receive the next request
based on its relative capacity?
```

---

## 30. ROUND ROBIN → WEIGHTED ROUND ROBIN EVOLUTION

A useful way to understand routing algorithms is to learn **why the next algorithm exists**.

```text
Problem:
Which server gets the next request?
        |
        v
Round Robin
        |
        | Problem:
        | Servers have different capacities
        v
Weighted Round Robin
        |
        | Problem:
        | Current workloads can be different
        v
Least Connections
        |
        | Problem:
        | Response times may differ
        v
Least Response Time
        |
        | Problem:
        | Need stable client/key mapping
        v
Hashing
        |
        | Problem:
        | Adding/removing servers causes
        | too much remapping
        v
Consistent Hashing
```

This is the best mental model for learning routing algorithms:

> Each new routing algorithm exists to solve an important limitation of a simpler algorithm.

---

## 31. ONE-LINE SUMMARY

> **Weighted Round Robin is a capacity-aware version of Round Robin: stronger servers get higher weights and therefore receive proportionally more requests than weaker servers.**

The most important concept to remember is:

> **Round Robin distributes requests equally; Weighted Round Robin distributes requests according to configured server capacity — but configured capacity is not the same as real-time server load.**
