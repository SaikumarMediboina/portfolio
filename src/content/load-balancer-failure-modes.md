# Failure Modes in Load Balancing

## One-Line Intuition

A production load-balancing system must assume that **servers, load balancers, networks, health checks, and even entire regions can fail** — and still keep traffic flowing safely.

---

## The Problem Without Failure Handling

```text
Users
  |
  v
Load Balancer
  |
  +--> Server A
  +--> Server B
  +--> Server C
```

This works only while every component is healthy. Real systems face server crashes, LB crashes, network failures, overload, bad health checks, stale DNS, config mistakes, and regional outages. Good design asks: **what happens when each layer fails?**

---

## 1. Backend Server Failure

**Example:** Server A's process crashes at 2 AM. Health checks (e.g. `GET /health` every 5s) detect 3 consecutive failures and pull it out of rotation. Traffic silently shifts to B and C — users notice nothing.

![Backend server crash and automatic removal from load balancer rotation](./assets/backend-server-failure.png)

- **Risk:** Slow detection means some requests still get routed to the dead server and fail.
- **Handling:** Health checks, failure thresholds, automatic removal, and safe retries.

---

## 2. Load Balancer Failure

**Example:** The single LB instance runs out of memory and dies. Even though all 3 backend servers are healthy, the entire service is unreachable — this is a **Single Point of Failure (SPOF)**.

![Active-Passive and Active-Active load balancer redundancy architecture](./assets/load-balancer-failure.png)

- **Handling:** Run redundant LBs — **Active-Passive** (standby takes over via VRRP/keepalived) or **Active-Active** (both serve traffic, e.g. behind DNS or a floating IP).

---

## 3. Network Failure

**Example:** A switch between the LB and Server A goes down. Server A's process is fine, but the LB can't reach it — so from the LB's view, A is "unhealthy" even though nothing is wrong with the app itself.

![Network link switch failure causing unreachable backend server](./assets/network-failure.png)

- **Takeaway:** A healthy machine is useless if it can't be reached.
- **Handling:** Redundant network paths, multiple switches/AZs, and failover routes.

---

## 4. Network Partition

**Example:** LB-A can reach Server A, but LB-B (in a different rack) can't, due to a partial network split. Now LB-A marks A "Healthy" while LB-B marks it "Unhealthy" — split-brain view of the same server.

![Partial network split creating split-brain views between load balancers](./assets/network-partition.png)

- **Handling:** Careful health-check design, quorum/consensus where needed, and failure-domain awareness.

---

## 5. Load Balancer Overload

**Example:** LB is rated for 100K req/sec; a flash sale pushes 160K req/sec. CPU spikes, connections get dropped, and latency climbs — even though every backend server is fine.

![Load balancer bottleneck dropped connections during traffic flash sale](./assets/load-balancer-overload.png)

- **Handling:** Scale out LBs horizontally, rate limiting, connection limits, and headroom in capacity planning (plan for failure traffic, not just average traffic).

---

## 6. Backend Overload

**Example:** Server A is at 95% CPU while B and C sit at 35–40%. A basic TCP-level health check still says A is "Healthy" — so the LB keeps sending it traffic, making things worse.

![Uneven load distribution overloading Server A while B and C remain underutilized](./assets/backend-overload.png)

- **Handling:** Least Connections / Weighted Least Connections, latency-aware routing, autoscaling, and load shedding.

---

## 7. Cascading Failure

```text
Server A ❌ → extra load on B & C → B & C overloaded → they fail too → outage
```

**Example:** A crashes, its traffic moves to B and C. They weren't provisioned for the extra 50% load each, so they slow down, get marked unhealthy, and the outage spreads — one failure becomes a total outage.

![Cascading failure propagation from single server crash to total fleet collapse](./assets/cascading-failure.png)

- **Handling:** Spare capacity, autoscaling, rate limiting, circuit breakers, and load shedding.

---

## 8. Health Check False Positive

**Example:** `GET /health` returns `200 OK` because the web process is alive — but the app's database connection pool is exhausted. Every real request fails, yet the LB thinks the server is healthy and keeps routing traffic to it.

![False positive health check returning 200 OK despite exhausted DB pool](./assets/health-check-false-positive.png)

- **Handling:** Health checks should verify real readiness (DB, cache, downstream deps), not just "process is running."

---

## 9. Health Check False Negative

**Example:** A single dropped packet causes one health check to time out. The LB immediately pulls a perfectly healthy server out of rotation, cutting capacity for no real reason.

![False negative health check removing healthy server due to transient packet loss](./assets/health-check-false-negative.png)

- **Handling:** Use thresholds — e.g. "1 failure = suspected, 3 consecutive failures = remove" — instead of acting on one blip.

---

## 10. Flapping Server

```text
Healthy → Unhealthy → Healthy → Unhealthy ...
```

**Example:** A server sits right at the edge of its health-check timeout, so it keeps toggling in and out of rotation every few seconds, causing unstable traffic distribution across the fleet.

![Server flapping state cycle and slow start gradual recovery ramp](./assets/flapping-server-slow-start.png)

- **Handling:** Separate failure/recovery thresholds, cool-down periods, and **slow start** — a recovered server gets traffic ramped gradually (10% → 25% → 50% → 100%) instead of full traffic instantly.

---

## 11. DNS Failure / Stale DNS

**Example:** `api.example.com` pointed to LB-A. LB-A fails, DNS is updated to LB-B — but a client that resolved DNS 10 minutes ago (TTL not expired) keeps hitting the dead LB-A IP from its cache.

![Stale DNS caching causing client traffic to hit dead IP before TTL expiration](./assets/dns-failure-stale-dns.png)

- **Handling:** Sensible TTLs, health-aware DNS, redundant DNS providers, and multiple endpoints. DNS failover is never instant because of caching.

---

## 12. Connection Failure (Long-Lived Connections)

**Example:** A user has an open WebSocket to Server A for a live chat. Server A crashes — the live connection breaks immediately; it cannot be transparently moved to Server B. The client must detect the drop and reconnect, and the LB then routes the new connection to a healthy server.

![WebSocket connection crash and client side reconnect architecture](./assets/connection-failure.png)

- **Handling:** Build reconnect logic into the client for any app relying on long-lived connections.

---

## 13. Connection Draining Failure

**Example:** During a deploy, Server A is marked "draining" so no new requests go to it while existing ones finish. If the deployment script kills the instance too early (before the drain timeout), in-flight users get disconnected mid-request.

![Premature instance termination cutting off in-flight user requests during drain](./assets/connection-draining-failure.png)

- **Handling:** Graceful shutdown, a proper draining timeout, and deployment coordination that waits for drain to complete.

---

## 14. Session State Failure

**Example:** With sticky sessions, a user's cart lives only in Server A's memory. Server A crashes; the user gets routed to Server B, which has no idea who they are — cart and login session are gone.

![Local memory session loss vs external shared Redis session store architecture](./assets/session-state-failure.png)

- **Better design:** Store session state outside individual servers, e.g. all servers reading/writing to a shared Redis store, so any healthy server can pick up the session.

---

## 15. Configuration Failure

**Example:** A routing-rule change deployed to the LB accidentally sends all `/api` traffic to the wrong backend pool, or a bad health-check config marks every server "unhealthy" at once — a config push breaks 100% of traffic with zero hardware failure.

![Bad configuration push routing traffic incorrectly or disabling all backends](./assets/configuration-failure.png)

- **Handling:** Config validation, canary/staged rollout, automatic rollback, and versioned configuration.

---

## 16. TLS / Certificate Failure

**Example:** TLS terminates at the LB. The certificate silently expires at midnight — every HTTPS request now fails with a cert error, even though backend servers are perfectly healthy.

![Expired TLS certificate at load balancer causing client HTTPS connection failures](./assets/tls-certificate-failure.png)

- **Handling:** Automated renewal, expiry monitoring/alerts, and certificate validation before rollout.

---

## 17. Entire Availability Zone Failure

**Example:** Both the LB and all backend servers sit in AZ-A (e.g. `ap-south-1a`). A power/network event takes AZ-A down entirely — the whole service is offline, regardless of how well individual components were designed.

![Single Availability Zone outage vs Multi-AZ resilient deployment](./assets/availability-zone-failure.png)

- **Better design:** Spread LBs and servers across multiple AZs (e.g. `1a` and `1b`) so traffic can shift to the healthy AZ.

---

## 18. Entire Region Failure

**Example:** The Mumbai region has a major outage. A regional LB can't fix this — traffic needs a **global traffic layer** (GSLB / DNS-based routing) to redirect users to the Singapore region instead.

![Regional data center outage failover to secondary region via GSLB](./assets/region-failure-global-failover.png)

- **Handling:** Global Server Load Balancing (GSLB), DNS-based latency/failover routing, and multi-region deployment.

---

## Summary Table

| Failure Mode | Typical Handling |
|---|---|
| Backend server crash | Remove from rotation |
| Load balancer crash | Active-Passive / Active-Active |
| Network link failure | Redundant paths |
| Network partition | Health + failure-domain design |
| LB overload | Scale out / rate limit |
| Backend overload | Smarter routing / autoscaling |
| Cascading failure | Spare capacity / load shedding |
| False health result | Better checks + thresholds |
| Server flapping | Recovery thresholds / slow start |
| DNS stale cache | TTL + redundant endpoints |
| WebSocket failure | Client reconnect |
| Session loss | Shared session store |
| Bad configuration | Validation + rollback |
| TLS failure | Certificate automation |
| AZ outage | Multi-AZ |
| Region outage | Multi-region / GSLB |

---

## Real-Time Failure Walkthrough

```text
Server A crashes → health checks detect it → traffic shifts to B, C
LB-A crashes → LB-B absorbs all traffic
Mumbai region fails → global traffic routing sends users to Singapore
```

Each layer needs protection at its own level:

```text
Server failure   → local failover (health checks)
LB failure       → LB redundancy
Region failure   → global failover (GSLB)
```

---

## Why It Matters

| Goal | Why It Matters |
|---|---|
| Detect failures quickly | Avoid sending traffic to broken systems |
| Prevent false removals | Preserve healthy capacity |
| Avoid cascading failures | One failure shouldn't become a total outage |
| Remove the LB SPOF | Backend health alone isn't enough |
| Handle connection failures | Support long-lived workloads (WebSockets) |
| Preserve sessions | Users shouldn't lose application state |
| Survive infra outages | Stay available across failure domains |
| Recover safely | Recovered servers should ramp up gradually |

---

## One-Line Summary

**A resilient load-balancing system assumes that servers, load balancers, networks, DNS, connections, and entire regions can fail, then uses health checks, redundancy, capacity planning, graceful recovery, and multi-region failover to keep traffic flowing.**

---

*Next in the series:* ***Production Design decisions*** *— turning system requirements into defensible production load balancing architectures.*
