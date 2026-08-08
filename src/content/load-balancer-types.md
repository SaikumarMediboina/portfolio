

## 1. The Core Idea (Simple Analogy First)

Imagine a big restaurant with hundreds of customers arriving at once.

- A **Doorman** stands at the entrance. He just looks at who's walking in and sends them toward some open section. He doesn't ask what they want to eat.
- A **Receptionist** inside actually asks each customer what they want — veg or non-veg, reservation or walk-in — and sends them to the exact right table.

**Load balancer = the "manager" that spreads incoming traffic across multiple servers.**
**L4 Load Balancer = Doorman.** **L7 Load Balancer = Receptionist.**

The difference between them comes down to *how much of the request they actually read* before deciding where to send it.

---

## 2. L4 Load Balancing — What It Is

**L4 (Layer 4)** operates at the **Transport Layer** of the OSI model — the layer where **TCP and UDP** live. It makes routing decisions using only:

- Source IP address
- Destination IP address
- Source Port
- Destination Port

It does **not** open, decrypt, or read the actual application data (HTTP request, headers, cookies) inside the packet. It just looks at the "envelope," not the "letter" inside it.

### How It Works
1. A client opens a TCP connection to the load balancer's IP.
2. L4 LB picks a backend server (using an algorithm like Round Robin, Least Connections, or IP Hash).
3. Once picked, **every packet in that connection** goes to the same backend server — the LB doesn't re-inspect each packet.

### Diagram — L4 Flow

```
+----------------------------------------------+
| CLIENT                                        |
| sends TCP connection                          |
+----------------------------------------------+
        |
        v
+----------------------------------------------+
| L4 LOAD BALANCER (Doorman)                    |
| - reads IP + Port only                        |
| - does not open payload                        |
| - forwards raw packet                          |
+----------------------------------------------+
        |
        v
+----------------------------------------------+
| BACKEND SERVER                                 |
+----------------------------------------------+
```

### Real Example
**Online multiplayer gaming (e.g., matchmaking servers for PUBG, Valorant).** Every millisecond of latency matters, and there's nothing meaningful to "read" in the content — the LB just needs to get the packet to a server fast. **AWS Network Load Balancer (NLB)** is a textbook L4 example, commonly used here.

---

## 3. L7 Load Balancing — What It Is

**L7 (Layer 7)** operates at the **Application Layer** — where **HTTP/HTTPS** live. It actually opens and reads the request:

- URL path (`/api/orders` vs `/api/users`)
- Headers
- Cookies
- Even the request body, if needed

Because it understands HTTP, it can also **terminate SSL** — decrypt HTTPS traffic at the load balancer, then talk to backend servers over plain HTTP internally (so individual services don't need to manage their own certificates).

### How It Works
1. Client sends an HTTPS request.
2. L7 LB decrypts it (SSL termination).
3. It reads the URL/headers/cookies.
4. Based on that content, it routes to the *correct* backend service — not just "any" server.

### Diagram — L7 Flow

```
+----------------------------------------------+
| CLIENT                                        |
| sends HTTPS request                            |
+----------------------------------------------+
        |
        v
+----------------------------------------------+
| L7 LOAD BALANCER (Receptionist)                |
| - terminates SSL                                |
| - reads URL / headers / cookies                 |
| - routes by content                             |
+----------------------------------------------+
        |                    |
        v                    v
+----------------------------------------------+
| ORDER SERVICE                                  |
+----------------------------------------------+
+----------------------------------------------+
| USER SERVICE                                   |
+----------------------------------------------+
```

### Real Example
**API Gateway in a microservices architecture** (e.g., Netflix, Amazon, Flipkart). A single domain like `api.flipkart.com` receives all traffic, and the L7 LB routes `/orders` to the Order Service, `/cart` to the Cart Service, `/payments` to the Payment Service. **AWS Application Load Balancer (ALB)** or **NGINX** are classic L7 examples.

---

## 4. Why IP/Port Are Always Visible — Even for "Application Layer" Requests

This is a common point of confusion, so it's worth being precise about it.

An HTTP request never travels alone on the wire. It's always **wrapped (encapsulated)** inside a TCP segment, which is wrapped inside an IP packet. This wrapping happens automatically at the OS/network-stack level — the application developer never has to do it manually.

```
+----------------------------------------------+
| OUTER LAYER: IP HEADER                         |
|   src IP -> dst IP                              |
+----------------------------------------------+

+----------------------------------------------+
| NEXT LAYER: TCP HEADER                         |
|   src Port -> dst Port                          |
+----------------------------------------------+

+----------------------------------------------+
| INNER LAYER: HTTP DATA (encrypted)             |
|   GET /api/orders                               |
|   Cookie: session=xyz                           |
+----------------------------------------------+
```

- **L4 LB** reads only the outer two layers (IP + TCP headers) — this info is always sitting right there, no unwrapping needed.
- **L7 LB** reads the outer layers **too**, but *additionally* decrypts and opens the innermost layer (HTTP data).

So it's not that L4 "doesn't have" IP/Port and L7 "does" — **both always have IP/Port**, because it's structurally impossible to route a packet without it. The real difference is whether the LB goes one layer deeper and reads the actual HTTP content.

---

## 5. Combined Real-World Example — One Request, Full Journey

Take a concrete case: a user opens the Flipkart app and requests `GET /api/orders`.

```
+----------------------------------------------+
| USER app -> GET /api/orders                    |
+----------------------------------------------+
        |
        v
+----------------------------------------------+
| L4 LB                                           |
| sees: IP + Port 443                             |
| forwards raw packet                             |
+----------------------------------------------+
        |
        v
+----------------------------------------------+
| L7 LB                                           |
| decrypts, reads /api/orders                     |
| routes by path                                  |
+----------------------------------------------+
        |
        v
+----------------------------------------------+
| Order Service (10 replicas)                     |
+----------------------------------------------+
```

**Why layer them this way in production?**
- **L4 at the edge**: absorbs huge volumes of traffic fast, filters/soaks up DDoS attacks, doesn't waste CPU decrypting packets that might be malicious.
- **L7 behind it**: only well-formed, filtered traffic reaches this stage, where the expensive work (SSL decryption, content-based routing) happens.

This **L4 → L7 → Microservices** layering is exactly how large-scale systems like Netflix, Amazon, and Flipkart are architected.

---

## 6. Comparison Table

| Dimension | L4 Load Balancer | L7 Load Balancer |
|---|---|---|
| **OSI Layer** | Layer 4 (Transport — TCP/UDP) | Layer 7 (Application — HTTP/HTTPS) |
| **What it reads** | IP address + Port only | Full HTTP request: URL, headers, cookies |
| **Speed** | Very fast (no content parsing) | Slightly slower (must parse content) |
| **Routing intelligence** | Low — connection-level | High — request-level, content-aware |
| **SSL termination** | Usually no (pass-through) | Yes |
| **Decision granularity** | Per connection | Per individual request |
| **Use cases** | Gaming, streaming, DB traffic, DDoS-resistant edge layer | API gateways, microservices, web apps, A/B testing |
| **AWS example** | Network Load Balancer (NLB) | Application Load Balancer (ALB) |

---

## 7. When to Choose L4 vs L7

### Choose L4 when:
- Latency is critical and there's nothing meaningful to route on (real-time gaming, video/audio streaming over UDP).
- You need a fast, DDoS-resistant layer at the network edge.
- Traffic is internal service-to-service TCP that doesn't need content-based decisions (e.g., raw database replication traffic).

### Choose L7 when:
- You're running microservices and need to route by URL path (`/orders`, `/users`, `/payments`).
- You need centralized SSL termination instead of managing certs on every backend service.
- You want cookie/header-based routing — session affinity, A/B testing, geo-based routing.

**In practice, most large systems use both** — L4 first for speed and protection, L7 behind it for smart routing.

---

## One-line Summary

**L4 routes fast and blind at the connection level using only IP/Port; L7 routes smart and content-aware at the individual-request level by reading the actual HTTP data — real systems typically layer both together.**

---

## Quick Recap

- L4 = Transport Layer (TCP/UDP) → reads IP + Port only, no content inspection, very fast, connection-level decision
- L7 = Application Layer (HTTP) → reads URL/headers/cookies, SSL termination, request-level decision
- IP and Port are **always** present in every packet — L7 doesn't lose that info, it just goes further and also reads the HTTP payload
- L4 use cases: gaming, streaming, DB traffic, DDoS-resistant edge
- L7 use cases: API gateways, microservices routing, SSL termination, A/B testing
- Core interview line: **"L4 routes connections, L7 routes requests"**
- Real systems: L4 at the edge → L7 behind it → microservices (layered architecture)