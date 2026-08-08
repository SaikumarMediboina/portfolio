# Round Robin Load Balancing

## 1. What is Round Robin?

Round Robin is the **simplest rule** a load balancer can use to decide which healthy server receives the next request. It moves through the server list in order and starts again when it reaches the end.

```sequence
Request 1  ->  Server 1
Request 2  ->  Server 2
Request 3  ->  Server 3
Request 4  ->  Server 1
Request 5  ->  Server 2
Request 6  ->  Server 3
                ...
```

Think of distributing chocolates to children standing in a circle: first child, second child, third child, and then back to the first child. Every turn is predictable and nobody is intentionally skipped.

> Round Robin balances the number of requests. It does not automatically balance the amount of work inside those requests.

## 2. How does the algorithm work?

The load balancer keeps a list of available servers and a pointer to the server that should receive the next request.

```pseudocode
servers = [S1, S2, S3]
index = 0

for every new request:
    target = servers[index]
    send request to target
    index = (index + 1) % length(servers)
```

The modulo operation makes the pointer loop back to `0` after the final server. With three healthy servers, the sequence is always `S1 -> S2 -> S3 -> S1`.

This decision is fast because the load balancer does not need to inspect CPU usage, active connections, response time, or request complexity before choosing a target.

## 3. What happens if a server crashes?

Suppose Server 2 crashes. If the load balancer blindly continues using the original list, every third request sent to Server 2 will fail.

Real systems prevent this with **health checks**. The load balancer periodically calls an endpoint such as `/health` or performs another configured probe. A server that repeatedly fails the check is marked unhealthy and temporarily removed from the eligible pool.

```sequence
Before failure
S1 (healthy)  ->  S2 (healthy)  ->  S3 (healthy)

Health check detects S2 is unavailable
                         |
                         v
After removal
S1 (healthy)  ->  S3 (healthy)  ->  S1 (healthy)
```

When Server 2 recovers and passes the required health checks, it can be added back to the rotation.

> Round Robin itself does not detect failures. The health-check system tells it which servers are safe to use.

## 4. Why is Round Robin useful?

- **Simple:** the rule is easy to implement, operate, and explain.
- **Fast:** choosing the next server requires almost no calculation.
- **Predictable:** healthy servers receive requests in a repeatable sequence.
- **Effective for uniform workloads:** it works well when servers have similar capacity and requests take roughly similar time.

For small stateless services running identical instances, Round Robin is often a practical starting point.

## 5. Where does Round Robin break down?

### Problem 1: It counts requests, not actual work

Imagine two requests:

- Request A generates a large report and takes **10 seconds**.
- Request B performs a simple status check and takes **5 milliseconds**.

Round Robin treats both as one request. After cycling through the other servers, it can send another heavy request to Server 1 while the first report is still running. At that moment, Server 1 may be overloaded even though every server received an equal request count.

**Equal requests do not guarantee equal work.** When request duration varies significantly, **Least Connections** or **Least Response Time** can react to the current state more intelligently.

### Problem 2: It assumes equal server capacity

Suppose Server 1 and Server 2 each have 16 CPU cores, while Server 3 has only 2 CPU cores. Standard Round Robin still gives every server the same number of requests, so the smaller server can become saturated first.

The problem is not the rotation. The problem is that every server receives the same share even when their capacities are different.

## 6. How does Weighted Round Robin help?

**Weighted Round Robin** assigns each server a weight based on its capacity. A stronger server appears more often in the effective rotation and therefore receives a larger share of traffic.

```sequence
Server 1  weight 4  ->  receives about 4 shares
Server 2  weight 2  ->  receives about 2 shares
Server 3  weight 1  ->  receives about 1 share

Example rotation:
S1 -> S1 -> S2 -> S1 -> S3 -> S2 -> S1 -> repeat
```

Weights solve **known capacity differences**, but they still do not measure the real-time cost of each request. A server with a high weight can still become busy because of slow downstream calls or unusually expensive work.

## 7. Which alternative should you consider?

| Algorithm | Decision rule | Useful when |
|---|---|---|
| **Round Robin** | Next healthy server in order | Servers and request costs are similar |
| **Weighted Round Robin** | Rotate according to configured capacity weights | Server sizes are different but predictable |
| **Least Connections** | Fewest active connections | Request duration varies significantly |
| **Least Response Time** | Lowest observed latency, often combined with connection count | Live performance differs across servers |
| **IP Hash** | Hash a client identifier to select a server | Stable client-to-server routing is needed |

There is no universally best routing algorithm. Start with the simplest option that matches the workload, observe real traffic, and move to a more adaptive algorithm only when the evidence justifies it.

## 8. The interview-ready takeaway

Round Robin distributes requests evenly **by count** across healthy servers. It is simple, fast, and effective for similar servers handling similar requests. Health checks must remove failed servers from the eligible pool, and Weighted Round Robin is the natural extension when server capacities differ. If request duration or live server load varies heavily, prefer an algorithm such as Least Connections or Least Response Time.

> Use Round Robin when equal turns are a reasonable approximation of equal work.
