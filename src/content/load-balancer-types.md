

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

## 4. One Request on the Wire — Encapsulation

Now let us combine two ideas in one concrete example: **how a request is encapsulated on the wire** and **how it travels through a real e-commerce system**. A user sends `GET /api/orders` from a mobile app.

> **Small accuracy note:** The diagram below is a simplified request view. Depending on its size, a real HTTP request may be split across multiple TCP segments or IP packets, but each packet still carries the outer network headers required for routing.

```packet
+----------------------------------------------------------+
| SIMPLIFIED VIEW OF AN HTTPS REQUEST                      |
|                                                          |
|  +----------------------------------------------------+  |
|  | IP HEADER                                          |  |
|  | src IP = 203.0.113.10       (user phone)           |  |
|  | dst IP = 52.14.10.5          (load balancer)        |  |
|  |                                                    |  |
|  |  +----------------------------------------------+  |  |
|  |  | TCP HEADER                                   |  |  |
|  |  | src Port = 51422                            |  |  |
|  |  | dst Port = 443              (HTTPS)         |  |  |
|  |  |                                              |  |  |
|  |  |  +----------------------------------------+  |  |  |
|  |  |  | TLS-ENCRYPTED HTTP DATA                |  |  |  |
|  |  |  | GET /api/orders                        |  |  |  |
|  |  |  | Host: api.flipkart.com                 |  |  |  |
|  |  |  | Cookie: session=xyz123                 |  |  |  |
|  |  |  +----------------------------------------+  |  |  |
|  |  +----------------------------------------------+  |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
```

**Notice the boundary:** The IP address and port are present in the outer headers. HTTP details such as `/api/orders`, the host, and the cookie remain inside the TLS-encrypted application payload.

### If the request starts at the application layer, where do IP and Port come from?

A request never travels across the wire as **HTTP alone**. The operating system's network stack automatically encapsulates the application data inside a TCP segment and then inside an IP packet; the application developer does not wrap these layers manually.

- **The L4 load balancer can see the IP address and port** because they are in the outer IP and TCP headers; it does not need to decrypt the HTTP payload.
- **The L7 load balancer can also see the IP address and port** and, when TLS terminates there, it can additionally read the decrypted HTTP path, headers, and cookies.

> **Remember:** L4 works with the outer connection information. After configured TLS termination, L7 can also inspect the inner HTTP request.

---

## 5. The Same Request Through L4 → L7 — Real E-commerce Flow

Now follow the same `GET /api/orders` request through one possible production path. In this example, the AWS NLB uses **TCP pass-through mode**, and TLS terminates at the ALB or NGINX layer.

```flow
+----------------------------------------------------------+
| USER MOBILE APP                                          |
| HTTPS request: GET /api/orders                           |
+----------------------------------------------------------+
                           |
                           v
+----------------------------------------------------------+
| L4 LOAD BALANCER — AWS NLB (DOORMAN)                     |
| Reads: source/destination IP and port                    |
| Does not inspect or decrypt the HTTP payload             |
| Selects a healthy L7 load balancer                       |
+----------------------------------------------------------+
                           |
                           v
+----------------------------------------------------------+
| L7 LOAD BALANCER — AWS ALB / NGINX (RECEPTIONIST)        |
| Terminates TLS                                           |
| Reads: GET /api/orders, Host, headers, and cookies       |
| Routes the request to the Order Service                  |
+----------------------------------------------------------+
                           |
                           v
+----------------------------------------------------------+
| ORDER SERVICE — 10 HEALTHY REPLICAS                      |
+----------------------------------------------------------+
```

The routing decision now happens at two levels:

1. **L4 decision:** It selects a healthy L7 target using the IP address, port, protocol, and connection state. It does not read the application payload.
2. **L7 decision:** It terminates TLS, reads the `GET /api/orders` path and request metadata, and routes the request to the Order Service.

**Important nuance:** During L4 forwarding, NAT or proxying may rewrite the outer IP or port headers depending on the implementation. “Raw forwarding” means that the load balancer does not inspect or decrypt the application payload; it does not guarantee that every byte in the packet remains literally unchanged.

### Why would a production system use both?

- **L4 at the edge:** very high connection volume, TCP/UDP handling, low routing overhead, and network-level distribution.
- **L7 behind it:** SSL/TLS termination, path-based routing, header/cookie rules, authentication integrations, and microservice-aware decisions.

Not every system requires both layers. L4 or L7 alone may be enough for simpler requirements, while combining them can be useful in large or specialized architectures.

> **Interview-ready line:** “IP and port are always available in the outer network headers. L7 becomes smarter because it can additionally terminate TLS and inspect the inner HTTP request.”

---

## 6. Comparison Table

| Dimension | L4 Load Balancer | L7 Load Balancer |
|---|---|---|
| **OSI Layer** | Layer 4 (Transport — TCP/UDP) | Layer 7 (Application — HTTP/HTTPS) |
| **What it reads** | IP address + Port only | Full HTTP request: URL, headers, cookies |
| **Processing overhead** | Lower — no HTTP content parsing | Higher — TLS termination and HTTP parsing may be involved |
| **Routing intelligence** | Low — connection-level | High — request-level, content-aware |
| **SSL/TLS termination** | Often pass-through, though some L4 products can terminate TLS | Common; enables HTTP-aware routing |
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

**L4 routes connections using network information; L7 routes HTTP requests using application information. A system can use either one alone or layer both when its scale, protocol, security, and routing requirements justify it.**

---

## Quick Recap

- L4 = Transport Layer (TCP/UDP) → reads IP + Port only, no content inspection, very fast, connection-level decision
- L7 = Application Layer (HTTP) → reads URL/headers/cookies, SSL termination, request-level decision
- IP and Port are **always** present in every packet — L7 doesn't lose that info, it just goes further and also reads the HTTP payload
- L4 use cases: gaming, streaming, DB traffic, DDoS-resistant edge
- L7 use cases: API gateways, microservices routing, SSL termination, A/B testing
- Core interview line: **"L4 routes connections, L7 routes requests"**
- A common layered option: L4 at the edge → L7 behind it → microservices, when the requirements justify both layers
