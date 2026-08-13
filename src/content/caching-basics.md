# Caching Basics: What It Is, Why It’s Faster, and Where It Sits in the Architecture

## 1. The Misconception

The first bad mental model engineers pick up is:

> **“A cache is just a faster database.”**

That explanation is convenient, and it causes bad systems.

A cache is not valuable because somebody found a magically faster place to store the same data. A cache is valuable because it lets you **avoid doing expensive work repeatedly**.

That expensive work might be:

- reading from a database,
- calling another service,
- executing a complex query,
- deserializing a large object,
- computing recommendations,
- rendering a response,
- reading from disk,
- crossing a network boundary.

If an API needs the same product record 50,000 times in a minute, the important question is not:

> “How do we make the database query 20% faster?”

The better question is:

> “Why are we executing the same query 50,000 times?”

That is where caching starts.

![What Is Caching](./assets/what-is-caching.png)

The textbook explanation usually stops at:

```text
Database = slow
Cache = fast
```

That misses the important part.

The real model is:

```text
Expensive work
      ↓
Do it once
      ↓
Remember the result
      ↓
Reuse it while it is still useful
```

Once you think about caching this way, TTLs, invalidation, cache misses, stampedes, stale data, and eviction all become easier to reason about.

---

## 2. Why It Actually Breaks

I have seen teams add database indexes, increase connection pools, and scale read replicas while completely missing the actual problem:

**the application was repeatedly asking the database the same question.**

Imagine a product-details endpoint.

Every request performs:

```sql
SELECT *
FROM product
WHERE product_id = ?
```

The query is indexed.

It takes:

```text
8 ms
```

Eight milliseconds sounds excellent.

Now traffic jumps to:

```text
25,000 requests/sec
```

and 70% of those requests are for the same few thousand popular products.

Suddenly the problem is not that an individual query is slow.

The problem is multiplication.

```text
8 ms × thousands of repeated queries
```

Database CPU climbs.

Connection-pool utilization rises.

Replica lag appears.

API p95 moves from:

```text
40 ms → 140 ms
```

Then p99 gets ugly.

At 3 AM, the alert usually does not say:

> “You forgot caching.”

It says:

```text
DB CPU > 90%
Connection pool exhausted
API p99 latency > 2 seconds
Timeout rate increasing
```

![Why Cache — Problem at Scale](./assets/why-cache-problem-at-scale.png)

The on-call engineer sees healthy application pods waiting on the database.

The naive response is often:

> “Add more application instances.”

That can make the problem worse.

Every new application instance opens more connections and sends more identical queries to the same shared database.

**This is where most designs go wrong: horizontally scaling the application can increase pressure on the dependency that is already failing.**

Caching exists partly to break that relationship.

---

## 3. The Correct Mental Model — Walked Through Like a Whiteboard Session

Picture a client on the left.

Your Spring Boot service is in the middle.

The database is on the right.

Without caching, every request walks the entire path:

```text
Client → Application → Database
```

Database returns the row.

Application builds the response.

Done.

Then another request arrives for exactly the same product.

We repeat the whole path.

And again.

And again.

Now put a cache between the application and the expensive data source.

![Where Does Cache Sit](./assets/where-does-cache-sit.png)

The request arrives:

```text
GET /products/42
```

The application first asks:

```text
Cache: do you already have product:42?
```

There are only two interesting answers.

### Cache Hit

The value exists.

```text
Application → Cache
             ↓
          product:42
```

The database is never touched.

That is the fast path.

### Cache Miss

The value is not there.

Now we fall through:

```text
Application
    ↓
  Cache   ← MISS
    ↓
Database
```

The application reads Product 42 from the database.

Before returning the response, it stores a copy in the cache:

```text
product:42 → {...}
```

The next request can reuse that value.

This is the classic **cache-aside pattern**:

```text
1. Check cache
2. If present → return
3. If absent → load source of truth
4. Put result into cache
5. Return
```

![Cache-Aside Pattern](./assets/cache-aside-pattern.png)

Now here's the part everyone messes up.

The cache is **not the source of truth**.

The database owns the durable truth.

The cache owns a temporary, disposable copy.

![Cache Is Temporary — Database Is Source of Truth](./assets/cache-temporary-copy-not-source-of-truth.png)

If I delete the cache and the system cannot reconstruct the value from the real data source, somebody quietly turned the cache into a database.

That is a different architecture.

---

### Why Is the Cache Faster?

People usually answer:

> “Because it is in memory.”

True, but incomplete.

A database read may involve:

```text
Application
   ↓
connection pool
   ↓
network
   ↓
query parsing / planning
   ↓
index lookup
   ↓
storage or buffer manager
   ↓
serialization
   ↓
network
   ↓
application
```

A cache lookup is often much closer to:

```text
Application
   ↓
key lookup
   ↓
cached value
```

![Why Is Cache Faster](./assets/why-is-cache-faster.png)

Even a distributed cache still has a network hop.

Do not mentally treat Redis or Valkey like a local Java `HashMap`.

But you are usually replacing a more expensive operation with a simpler one.

At high request volume, that difference is enormous.

---

### Where Can Caching Sit?

There is no single cache location.

Caching can exist at several layers:

```text
Browser
   ↓
CDN / Edge Cache
   ↓
Reverse Proxy
   ↓
Application Local Cache
   ↓
Distributed Cache
   ↓
Database
```

If the browser has the value, the request may never reach your infrastructure.

If the CDN has it, the request may never reach your region.

If the application-local cache has it, there is no network call to a distributed cache.

If the distributed cache has it, the database is avoided.

The closer the cache is to the caller, the faster the path usually becomes.

But the closer it is to the caller, the harder freshness becomes.

That trade-off shows up constantly in real systems:

> **Distance versus freshness.**

---

## 4. A Real Scenario, with Numbers

One pattern I have seen repeatedly is a read-heavy metadata API.

Assume an API returns merchant configuration.

Traffic:

```text
20,000 requests/sec
```

Database query latency:

```text
p50 = 6 ms
p99 = 35 ms
```

Now the useful observation:

```text
~85% of requests ask for configurations
that were already requested in the previous minute.
```

Originally the architecture was:

```text
API → PostgreSQL
```

At normal traffic:

```text
DB CPU = 45%
```

A promotion starts.

Traffic doubles.

```text
20K RPS → 40K RPS
```

Application instances autoscale correctly.

The database does not.

Within minutes:

```text
DB CPU                  96%
Connection utilization 100%
API p99                 3.2 sec
Timeouts                climbing
```

The first suggestion in the incident call is predictable:

> “Add another read replica.”

That buys capacity.

It does not remove the unnecessary work.

The configuration changes perhaps once every few minutes, but it is being read tens of thousands of times every second.

That is ideal cache material.

We introduce cache-aside with a five-minute TTL.

![TTL and Expiry](./assets/ttl-and-expiry.png)

After warm-up:

```text
Cache hit ratio ≈ 97%
```

Instead of roughly:

```text
40,000 DB reads/sec
```

only a small fraction of reads now hit PostgreSQL.

API latency drops.

Database CPU falls dramatically.

Connection-pool pressure disappears.

The important lesson is not:

> “Redis is fast.”

The important lesson is:

> **We removed work that never needed to happen.**

---

## 5. Where Senior Engineers Disagree

This argument shows up in real design reviews.

**Engineer A:**

> “Give merchant configuration a 30-minute TTL. It barely changes. We're wasting database capacity.”

**Engineer B:**

> “Thirty minutes means someone updates configuration and sees stale data for half an hour.”

**Engineer A:**

> “Then invalidate the key when configuration changes.”

**Engineer B:**

> “Now correctness depends on every write path remembering to invalidate it. Someone adds a bulk update six months from now and forgets.”

**Engineer A:**

> “So the answer is to hammer PostgreSQL forever?”

**Engineer B:**

> “No. Short TTL plus explicit invalidation. Invalidation gives fast freshness. TTL protects us when invalidation is missed.”

That is usually where I land.

```text
Write happens
     ↓
Update source of truth
     ↓
Invalidate cache
     ↓
Next read repopulates cache
```

with:

```text
TTL = 5 minutes
```

as a safety net.

![Read, Write and Cache Invalidation](./assets/read-write-and-invalidation.png)

Why both?

Pure TTL gives predictable eventual freshness, but stale values may remain until expiry.

Pure invalidation gives better freshness, but assumes every mutation path is perfect.

Production mutation paths are never perfect forever.

The TTL gives eventual self-healing.

Invalidation gives normal-case freshness.

---

## 6. The Trap

One implementation passes code review constantly:

```java
if (cache missing) {
    query database;
    cache result;
}
```

It looks correct.

Then a popular key expires.

Suppose:

```text
product:iphone
```

receives:

```text
10,000 requests/sec
```

At exactly 10:00:00, the key expires.

A large number of requests arrive at roughly the same moment.

They all see:

```text
CACHE MISS
```

and they all execute:

```text
SELECT ... FROM product ...
```

The cache protected the database for an hour and then coordinated a traffic spike directly into it.

That is a **cache stampede**.

![Cache Stampede](./assets/cache-stampede.png)

This is counter-intuitive because every individual request is logically correct.

The failure appears only when you look at concurrency.

Possible protections include:

- request coalescing,
- single-flight loading,
- distributed locking,
- TTL jitter,
- stale-while-revalidate.

The principle is simple:

> A cache miss is boring. **Thousands of simultaneous misses for the same key are dangerous.**

---

## 7. Code Snippet

A simplified Spring-style cache-aside path:

```java
public Product getProduct(long id) {
    String key = "product:" + id;

    Product cached = cache.get(key);
    if (cached != null) {
        return cached;
    }

    Product product = repository.findById(id)
        .orElseThrow(ProductNotFoundException::new);

    // TTL protects us if explicit invalidation is ever missed.
    cache.put(key, product, Duration.ofMinutes(5));

    return product;
}
```

This is enough to explain the basic pattern.

It is not enough for a high-traffic production path.

Production code still needs to think about:

- concurrent cache misses,
- serialization failures,
- cache outages,
- oversized values,
- timeouts,
- fallback behavior.

---

## 8. How I’d Design It Today

For a typical Spring Boot service, my default v1 architecture would be boring:

```text
Client
   ↓
Application
   ↓
Distributed Cache
   ↓ miss
Database
```

I would use cache-aside.

I would give every key an explicit TTL.

I would use clear key naming.

I would choose a controlled serialization format.

I would instrument the cache from day one.

The benefits become obvious when hit ratio is healthy:

![Benefits of Caching](./assets/benefits-of-caching.png)

But I would also make the costs explicit.

Caching creates new problems:

- stale data,
- invalidation complexity,
- cache stampedes,
- eviction,
- extra infrastructure,
- memory limits,
- consistency questions.

![Caching Trade-offs](./assets/caching-tradeoffs.png)

I would not cache everything.

The best candidates are usually:

- frequently read,
- relatively expensive to compute or fetch,
- reused across requests,
- tolerant of some bounded staleness.

![When to Cache](./assets/when-to-cache.png)

For v1, I would deliberately avoid:

- multiple cache layers unless necessary,
- complicated event-driven invalidation,
- distributed locks everywhere,
- caching low-value one-off reads.

What I would insist on from day one is observability.

At minimum:

```text
cache hit ratio
cache miss ratio
cache latency
DB fallback latency
evictions
memory usage
cache errors
```

And there is one failure question I always want answered before launch:

```text
Cache unavailable
      ↓
Does the application still work?
```

For ordinary read caching, my preferred answer is:

```text
YES
```

A cache outage should usually degrade performance.

It should not automatically become a full application outage.

That means we may fall back:

```text
Cache unavailable
      ↓
Database
```

But even that can become dangerous.

If a large cache disappears and every application instance immediately sends all traffic to the database, you can convert a cache outage into a database outage.

So the fallback path also needs:

- aggressive timeouts,
- circuit breakers,
- rate limits,
- capacity headroom,
- controlled recovery,
- gradual cache warm-up.

Managed cache services remove a lot of operational work.

They do not remove distributed-systems failure modes.

That part has not changed.

---

## 9. The One Thing to Remember

> **A cache is not primarily a faster place to store data; it is a mechanism for refusing to repeat work you already paid for.**
