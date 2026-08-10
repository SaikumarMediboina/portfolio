# Consistent Hashing

*This continues the Load Balancing series — Basics, Types (L4 vs L7), Round Robin, Weighted Round Robin, Least Connections, Weighted Least Connections, and IP Hash are covered already. IP Hash gave us "same client → same server," but broke almost every mapping the moment a server was added or removed. This article — Consistent Hashing deep dive — fixes exactly that.*

## 1. The Core Idea

Picture a big circular table — like a clock face, but instead of 12 hours it has numbers from 0 to 100 running all the way around and looping back to 0.

Now seat your servers at random spots around that circle. When a client request comes in, you also place the *client* somewhere on the same circle (based on a hash of their IP), and the rule is simple:

> **Walk clockwise from the client's position until you hit the first server. That server handles the request.**

```
Consistent Hashing = both clients AND servers are placed on the same hash ring,
                       and each client is served by the next server found
                       going clockwise from its position.
```

The magic: if one server is added or removed, only the clients sitting in that small arc of the circle move to a different server. **Everyone else stays exactly where they were.**

---

## 2. The Problem This Solves

Recall the IP Hash issue from the last article: `hash(IP) % N`. When N (server count) changes, the modulo result changes for almost every client, because the whole calculation is tightly coupled to N.

```
3 servers: hash(Ravi) % 3 = 0 → Server A
2 servers: hash(Ravi) % 2 = 1 → Server C   (totally different!)
```

This wasn't just Ravi's problem — removing or adding even **one** server reshuffled the mapping for the vast majority of all clients at once. In a system with millions of active sessions and server-local caches, that's catastrophic:

```reshuffle
 Server D added to the pool
             │
             ▼
 hash(x) % 3 becomes hash(x) % 4 for everyone
             │
             ▼
 ~75% of clients now map to a different server
             │
             ▼
 Massive cache misses & broken sessions, all at once 💥
```

Consistent Hashing exists specifically to shrink that blast radius from "almost everyone" down to "only the clients near the change."

---

## 3. How It Fits in the Architecture

Same overall flow — `Client → Load Balancer → Servers` — but the LB's internal decision structure changes completely.

**Step-by-step:**

1. LB defines a **hash ring**: a circular number space, say `0` to `2^32 - 1` (a common range in real systems).
2. Each **server** is hashed and placed at a point on this ring:
   ```
   hash(Server A) → position 15
   hash(Server B) → position 55
   hash(Server C) → position 80
   ```
3. When a **client request** arrives, the LB hashes the client's identity (IP, session ID, etc.) to get its position on the same ring:
   ```
   hash(Client X) → position 40
   ```
4. LB moves **clockwise** from position 40 until it hits a server — that's Server B (at 55). Request goes to Server B.
5. Server processes the request; response flows back through the LB, same reverse-proxy pattern as every prior algorithm.
6. This mapping stays fixed for Client X as long as Server A, B, and C stay on the ring — no recalculation tied to "how many servers exist," unlike plain modulo hashing.

---

## 4. Diagram

![Consistent hashing ring showing Server A at position 15, Server B at position 55, Server C at position 80, and Client X at position 40 walking clockwise to land on Server B](./assets/consistent-hashing-ring.svg)

Client X (position 40) walks clockwise around the ring and lands on Server B (position 55) — the first server encountered.

Everyone between Server A (15) and Server B (55) — positions 16 through 55 — is served by Server B. Everyone between Server B (55) and Server C (80) is served by Server C. Everyone between Server C (80) and Server A (15), wrapping past 99 back to 0, is served by Server A.

**Request flow through the system:**

```routing-flow
        +--------+        +-------------------+        +--------+
        | Client |------->|   LOAD BALANCER    |------->|Server B|
        |   X    |        | (walks ring: 40→55)|        |        |
        +--------+        +-------------------+        +--------+
             ^                                               |
             |                    RESPONSE                    |
             +-----------------------------------------------+
```

---

## 5. Real-Time Walkthrough

Same shopping app as before — Ravi's cart lives in server memory, and we want it to stick to one server.

1. **Ring setup:** Server A at position 15, Server B at position 55, Server C at position 80.
2. **Ravi's first request** — `hash(Ravi's IP) → 40`. Walking clockwise from 40, the first server hit is **B (55)**. Ravi's cart session lives on Server B.
3. **Ravi's later requests** — same IP, same hash (40), same clockwise walk → **Server B again, every time.** Cart stays intact.

### Now a new server is added

Suppose traffic grows and **Server D** is added at position 45 (between Ravi's position 40 and Server B's position 55).

```
Before: 40 (Ravi) → walks clockwise → hits B (55)
After:  40 (Ravi) → walks clockwise → hits D (45)   ← Ravi now moves to D
```

![Ring diagram showing Server D added at position 45. Client X at position 40 now walks clockwise to Server D instead of Server B. Only the small arc between position 16 and 45 is affected.](./assets/ring-server-added.svg)

Ravi's mapping *does* change — but notice who else is affected: **only clients whose position falls between Server A (15) and the new Server D (45)**. Every client between D (45) and C (80), and between C (80) and A (15, wrapping around), is completely untouched. That's the entire point — instead of "almost everyone reshuffles," it's "only the clients in this one arc reshuffle."

### If a server goes down

Same logic in reverse. If Server B (55) is removed, clients that used to hash to B now walk clockwise past B's old spot and land on Server C (80) instead. Clients that were going to A or C were never affected at all.

![Ring diagram showing Server B removed after going down. Client X at position 40 now walks clockwise past Server B's old spot and lands on Server C at position 80 instead. Server A's clients are unaffected.](./assets/ring-server-down.svg)

---

## 6. Virtual Nodes — Fixing Uneven Distribution

There's a catch: if servers land at random points on the ring, the *arcs* between them can be wildly uneven.

```distribution
 Server A at 15, Server B at 20, Server C at 80

 Arc for B (15→20) = tiny slice   ──> B gets almost no traffic 
 Arc for C (20→80) = huge slice   ──> C gets overloaded ✗
```

The fix used in real systems: give each physical server **multiple points on the ring** (called **virtual nodes**), instead of just one.

```vnodes
 Server A ──> hashed at positions 15, 38, 66, 91  (4 virtual nodes)
 Server B ──> hashed at positions 20, 45, 70, 95
 Server C ──> hashed at positions  5, 30, 55, 80
```

![Ring diagram showing each physical server placed at four virtual node positions instead of one — Server A's four points in teal, Server B's in amber, Server C's in pink — creating many small interleaved arcs instead of three large uneven ones](./assets/ring-virtual-nodes.svg)

With many small virtual-node slices spread evenly around the ring, the *average* load each physical server receives evens out — even though any single arc is still small. This is exactly how systems like **Amazon DynamoDB, Cassandra, and many CDN/cache layers** implement consistent hashing in practice.

---

## 7. Where This Sits Among the Algorithms You Know

| Algorithm | Same client → same server? | Stable when server count changes? |
|---|---|---|
| Round Robin | No | — |
| Weighted Round Robin | No | — |
| Least Connections | No | — |
| Weighted Least Connections | No | — |
| IP Hash (`% N`) | Yes | No — massive reshuffle |
| **Consistent Hashing** | **Yes** | **Yes — only a small arc reshuffles** |

Consistent Hashing keeps IP Hash's biggest strength (stickiness) while removing its biggest weakness (fragility on scaling).

---

## 8. Limitations Worth Naming

- **Still load-blind** — like IP Hash, it doesn't consider current server load or capacity; a client-heavy arc can still overload one server unless combined with enough virtual nodes or weighting.
- **Slightly more complex to implement** — maintaining a ring structure, binary-searching for the "next clockwise server," and managing virtual nodes is more engineering than a simple `% N`.
- **Still requires server removal to be graceful** — if a server disappears without notice (crash, not planned removal), in-flight sessions on that arc are still lost; the ring only limits *how many* clients are affected, not whether the affected ones lose state.

---

## 9. Why It's Needed — Benefits Summary

| Benefit | What breaks without it |
|---|---|
| **Minimal reshuffling on scale-out/in** | Plain hash-based (`% N`) routing causes almost all clients to remap on every server count change |
| **Cache/session stability during scaling** | Autoscaling events would otherwise cause mass cache misses and dropped sessions across the whole system |
| **Predictable growth** | New servers can be added under load without a system-wide "cold start" for caches |
| **Foundation for distributed data systems** | Sharded databases and distributed caches rely on this exact principle to know which node owns which key |

## One-Line Summary

Consistent Hashing places both clients and servers on the same circular ring so that adding or removing a server only reshuffles the small handful of clients near it — turning IP Hash's fragile "almost everyone moves" problem into a stable "only a few move" system.

---

*Next up in this series: **Health & Failure Detection** — how active and passive health checks keep load balancers from routing traffic to dead nodes, and how to avoid false positives.*
