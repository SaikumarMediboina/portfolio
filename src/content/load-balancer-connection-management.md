# Connection Management in Load Balancers

## One-Line Intuition

Routing decides *where* a request goes; connection management decides *how long it stays there, how it winds down, and what happens the moment a server disappears* — a subway system deciding which platform to send you to versus deciding what happens to your train if the line ahead shuts down mid-journey.

## The Problem It Solves

Every algorithm in this series — Round Robin, Least Connections, IP Hash, Consistent Hashing — answers one question: which server gets the next request. None of them answer a second, equally important question: once a client is connected, what is the load balancer responsible for while that connection is alive?

Real connections aren't uniform. A REST call might last 40ms. A file upload might take 30 seconds. A WebSocket for a chat app might stay open for 8 hours. If a server needs to restart while thousands of clients are mid-connection to it, simply yanking that server out of the pool instantly resets every one of those connections. Connection management is the set of behaviors — draining, keep-alive, pooling, timeout policy, protocol upgrades — that let a load balancer handle this gracefully instead of dropping everyone on the floor the moment something changes.

## How It Fits in the Architecture

An L7 load balancer typically terminates the client's connection and opens a *separate* connection to the backend — meaning it manages two independent connection lifecycles, not one pass-through pipe:

```
Client ── Connection 1 ──▶ Load Balancer ── Connection 2 ──▶ Server
```

This separation is what gives the LB control over client-side behavior (keep-alive, idle timeout, WebSocket upgrades) independently from backend-side behavior (connection reuse, pooling, draining) — the two sides can have entirely different lifetimes.

## Connection Draining

**Draining is the mechanism that makes safe server removal possible: stop routing *new* connections to a server while letting its *existing* connections finish naturally.**

![Connection draining lifecycle — normal, draining, and after-drain states](./assets/connection-draining-lifecycle.png)

The lifecycle has three states. **Normal** — the server takes new and existing traffic like any other. **Draining** — the load balancer marks it, stops sending anything new to it, but lets whatever's already in flight complete undisturbed. **After drain** — once active connection count hits zero, the server is pulled from the pool and shut down cleanly, with nobody's request cut off mid-flight.

This is the backbone of rolling deployments, autoscale-down, and planned maintenance — it converts "kill the server" into "let the server empty itself out, then kill it." A **draining timeout** (commonly 30–60 seconds) puts a ceiling on the wait, since a handful of long-lived WebSocket or streaming connections could otherwise keep a server alive indefinitely; whatever's still open when the timeout hits gets terminated anyway. Short timeouts drain faster but risk cutting off a few slow clients; long timeouts are gentler but slow down deployments — this is a deliberate trade-off every team tunes for its own traffic pattern.

## Keep-Alive vs. WebSocket

These two get confused constantly, but they solve different problems.

![HTTP keep-alive versus WebSocket connection patterns](./assets/keepalive-vs-websocket.png)

**Keep-Alive** reuses one underlying TCP connection across several *sequential* request-response exchanges — the client asks, the server answers, then the same pipe is reused for the next ask. It avoids repeated TCP/TLS handshakes, which is where most of the latency and CPU cost of a fresh connection comes from. It's still fundamentally request-response; only one side speaks at a time.

**WebSocket** starts life as a normal HTTP request that includes an `Upgrade: websocket` header, and once the server accepts, the connection becomes a persistent, full-duplex channel — either side can push a message at any moment, with no request needed first. This is what powers chat, live dashboards, and multiplayer sessions, where the server genuinely needs to speak first.

The practical load-balancing consequence: once a WebSocket is established with a specific backend, every subsequent frame on that connection **must** keep going to that same backend — this is connection-level affinity, and it's stricter than cookie-based sticky sessions because the physical connection itself is the identity, not a token the LB can re-evaluate per request.

## What Happens When the WebSocket's Server Dies

![WebSocket server crash and client reconnect flow](./assets/websocket-crash-reconnect.png)

If the backend holding a live WebSocket crashes, the load balancer cannot "move" that TCP connection to another server — the connection state (sequence numbers, buffers) lived entirely on the crashed machine and dies with it. What actually happens: the connection breaks, the client's own reconnect logic kicks in, and the load balancer routes the *new* connection attempt to a healthy backend, same as any fresh request.

This is exactly why serious WebSocket architectures never keep the user's actual state (their chat room membership, game state, cursor position) only in the crashed server's memory — that state needs to live in something external like Redis, so the new server the client lands on can pick up where the old one left off. Client-side reconnect logic and heartbeats are the expected, designed-for behavior here, not an edge case to be avoided.

## Why One TCP Connection Can't Split Across Servers

![A single TCP connection pinned to one backend for its full lifetime](./assets/tcp-connection-pinned-backend.png)

At Layer 4, the load balancer is balancing *connections*, not individual requests — it identifies a flow by the tuple of source IP, source port, destination IP, destination port, and protocol, and keeps a connection table mapping each flow to a specific backend. A TCP connection carries sequence numbers, acknowledgment state, and buffers that live only on the one server that's party to the handshake — Server B has no idea what byte offset Server A's connection is currently at. So once Connection 1 is flowing to Server A, every packet in that flow stays pinned to Server A for its entire life; a brand-new connection (Connection 2) is free to land anywhere, including a different backend entirely. This is a hard protocol constraint, not a configuration choice — it's the reason L4 balancing is "per-connection" while L7 balancing can be "per-request."

## Backend Keep-Alive and Connection Pooling

![Load balancer reusing pooled backend connections across multiple client requests](./assets/keepalive-connection-pooling-backend.png)

The same reuse principle that helps on the client side also helps between the load balancer and its backends. Instead of opening a fresh TCP (and possibly TLS) connection to a server for every single incoming request, the LB maintains a small pool of already-established backend connections and hands requests to whichever one is free — even while a single client is using its own keep-alive connection to talk to the LB. This decouples the client's connection count from the backend's: thousands of client keep-alive connections can be served by a much smaller, reused pool of backend connections, cutting handshake overhead and latency on the backend side dramatically.

## Real-Time Walkthrough

Picture a chat application: three chat servers behind a load balancer, users connected over long-lived WebSockets.

1. Users 1 and 3 land on Server A, User 2 on Server B, User 4 on Server C — each holds a WebSocket that may stay open for hours.
2. Server A needs a deployment. The LB marks it **draining** — no new WebSocket connections are sent there, but Users 1 and 3 stay connected and keep chatting uninterrupted.
3. New users (5, 6) get routed to Server B and C instead — Server A's active count only ever goes down from here.
4. Eventually Users 1 and 3 naturally disconnect (or the drain timeout is hit). Server A's active connections reach zero.
5. Server A is now safe to shut down and redeploy with zero forcibly-dropped sessions.
6. Once the new version passes its health check, Server A rejoins the pool and starts receiving new connections again — the whole rollout was invisible to end users.

Contrast this with Server A crashing unexpectedly instead of being drained: there's nothing to wait for, because the connections are already gone the instant the crash happens. The LB's only job at that point is to stop sending *new* traffic there and let each affected client's own reconnect logic re-establish a session with a healthy backend — planned removal drains gracefully, an unplanned crash forces an immediate client-side reconnect.

## Why It's Needed

| Capability | What It Solves |
|---|---|
| Connection draining | Servers can be removed for deploys, scale-down, or maintenance without cutting active users off mid-request |
| Draining timeout | Puts a bound on how long a stubborn long-lived connection can delay a shutdown |
| Keep-alive (client + backend) | Removes repeated TCP/TLS handshake cost for both sides of the load balancer |
| Connection pooling | Lets a small set of reused backend connections serve a much larger number of client connections |
| WebSocket / connection affinity | Keeps every frame of a persistent connection correctly routed to the one backend that holds its state |
| TCP connection tracking | Guarantees packets belonging to one flow are never split across two different backends |
| Idle / keep-alive timeout | Reclaims memory and socket resources tied up by connections nobody is actively using |

## One-Line Summary

Connection management is the layer that turns "pick a server" into "safely own the entire lifecycle of that connection" — draining it out gracefully, reusing it efficiently through keep-alive and pooling, and handling WebSockets and TCP state correctly enough that deployments, scale-downs, and even outright crashes stay invisible to the people actually using the system.

---

*Next in the series:* ***Failure Modes in Load Balancing*** *— understanding how load balancers and backend systems behave during server crashes, network failures, unhealthy nodes, partial outages, and other real-world failure scenarios.*
