# Caching Strategies: Choosing the Right Read and Write Path

HLD Interview Prep Series — Continuation of Caching Basics

Previous: Caching Basics → This article: Read/Write Strategies → Next: Eviction Policies (LRU, LFU)

---

## From Caching Basics to Caching Strategy

The previous article established the core mental model: a cache is a temporary copy that prevents us from repeating expensive work. That is only half the design. The moment data can change, the harder question appears: who is responsible for moving data between the application, cache, and database on reads and writes?

I have seen perfectly healthy caches serve the wrong answer for hours because the read path was fast but the write path was never designed. The cache hit ratio looked excellent. Redis latency looked excellent. The business data was stale. That is the uncomfortable truth: a caching strategy is not mainly a performance choice; it is a failure-semantics choice.

![The bridge from caching basics: fast cache in front of a slower source of truth](./assets/caching-strategies-bridge.png)

---

## 1. Cache-Aside — The Default I Start With

For most read-heavy services, I start with cache-aside because the ownership is obvious. The application asks the cache first. A hit returns immediately. A miss falls through to the database, then the application stores the result in cache for the next request.

Now pause at the write path, because this is where most designs go wrong. I do not usually update both as two independent writes. I update the database first, then invalidate the cache key. The next reader repopulates the cache from the source of truth. That deliberately trades one future miss for a simpler correctness story.

**Example:** Product 101 is cached at ₹999. An admin changes the price to ₹899. The service commits ₹899 to the database, deletes product:101 from cache, and returns success. The next read misses, loads ₹899, and repopulates the cache. The miss is not a defect; it is the mechanism that restores truth.

![Cache-aside scenario: read hit/miss plus write-to-DB followed by cache invalidation](./assets/cache-aside-scenario.png)

---

## 2. Read-Through — Move Loading Responsibility into the Cache Layer

Read-through looks similar from the user's point of view, but the responsibility is different. The application always asks the cache. On a miss, the cache layer knows how to obtain the value from the backing store, stores it, and returns it. The application does not explicitly perform the fallback.

This can make application code cleaner, especially when the cache platform or data-access abstraction already supports loading semantics. The cost is coupling: the caching layer is no longer a dumb key-value store. It now understands where data comes from and how to build it.

I use read-through when that abstraction is already natural. I do not introduce a smarter cache merely to save ten lines of Java. Complexity moved out of the service is still complexity; it just changed address.

![Read-through scenario: the cache owns miss handling and loading from the database](./assets/read-through-scenario.png)

---

## 3. Write-Through — Synchronize Before You Acknowledge

Write-through puts the cache in the synchronous write path. The application writes to the cache, the cache writes to the database, and only then does the operation succeed. The benefit is straightforward: when the caller receives success, both cache and durable store have been updated.

The textbook explanation often calls this "fast because we use cache." That is the wrong intuition. The durable database write is still on the critical path. If the database takes 40 ms, your acknowledged write still waits on roughly that work. Write-through is mostly a consistency and cache-population decision, not a trick for making durable writes free.

It works well when reads immediately after writes must hit a populated cache and the extra synchronous write latency is acceptable. It is less attractive when write throughput dominates.

![Write-through scenario: cache and database are updated synchronously before ACK](./assets/write-through-scenario.png)

---

## 4. Write-Behind — Fast Writes, Expensive Failure Semantics

Write-behind, or write-back, is where the cache stops being merely disposable. The application writes to cache and gets an acknowledgement immediately. The database update happens later, asynchronously.

That can produce excellent write throughput, but the failure contract changed completely. If the cache acknowledges an order, balance change, or state transition and then crashes before flushing it to durable storage, the user has been told a write succeeded that may no longer exist.

I have seen teams choose write-behind because a benchmark looked fantastic, then discover they had accidentally built a durable queue without admitting it. Once acknowledged-but-not-yet-persisted state matters, you need replay, ordering, retries, idempotency, backpressure, and a recovery story. This is not "just caching."

![Write-behind scenario: immediate ACK, asynchronous DB write, and the data-loss window if cache fails first](./assets/write-behind-scenario.png)

---

## 5. Write-Around — Do Not Pollute the Cache with Data Nobody Reads

Write-around deliberately bypasses the cache on writes. The application writes directly to the database. The cache is populated only when a later read actually needs the value.

This is useful for write-heavy, read-rare workloads. Think reports, bulk imports, event-derived records, or large objects that are frequently written but only occasionally requested. Writing every new value into cache can evict genuinely hot data to make room for objects nobody will read.

The trade-off is explicit: the first read after a write is a miss. That is often cheaper than permanently polluting expensive cache memory.

![Write-around scenario: writes bypass cache; a later read populates cache only if the data is actually needed](./assets/write-around-scenario.png)

---

## The Failure That Actually Chooses the Strategy

The dangerous code-review pattern is "update database, then update cache." It looks clean because both operations are individually correct. Under concurrency, it becomes a distributed dual write.

Request A writes price=80. Request B writes price=70. The database operations complete A then B, so the database ends at 70. But the cache updates race and complete B then A, leaving the cache at 80. No exception occurred. Both requests returned success. The system is simply wrong.

This is why I prefer database-write-plus-invalidate for ordinary read caches. Invalidation does not make distributed consistency disappear, but it removes the requirement that the application manufacture the exact new cached representation in the same ordering as every concurrent database write.

### A short design-review argument

> **Engineer A:** "Update the cache immediately after the DB write. Why force the next reader to miss?"
> 
> **Engineer B:** "Because then every write becomes a dual-write ordering problem."
> 
> **Engineer A:** "Invalidating is still a second operation."
> 
> **Engineer B:** "Yes, but if deletion succeeds, the next read reconstructs from truth. Our miss costs 12 ms. We do not need a synchronization protocol to save 12 ms once after a write."

That is usually where I land for a normal product/API service: pay the small miss, keep the correctness story boring.

---

## Production-Realistic Spring Boot Pseudocode

```java
public Product update(long id, ProductUpdate cmd) {
    Product saved = repository.update(id, cmd);
    try {
        cache.delete("product:" + id);
    } catch (CacheException e) {
        // DB is truth; retry invalidation without undoing a valid DB write.
        invalidationQueue.enqueue("product:" + id);
    }
    return saved;
}
```

The non-obvious decision is the failure direction: a cache failure does not roll back an authoritative database write. Instead, failed invalidation is retried and TTL remains the eventual safety net.

---

## How I'd Design It Today

For a new Spring Boot service, I would start with cache-aside and explicit invalidation. I would use a managed Redis/Valkey-compatible cache unless operating the cache itself is genuinely part of the product. Managed infrastructure removes a lot of node, patching, and failover work; it does not remove stale-data, stampede, ordering, or fallback problems.

For v1, I would insist on bounded TTLs, cache timeouts, hit/miss metrics, DB fallback latency, key naming discipline, and protection against a cache outage overwhelming the database. I would deliberately postpone event-driven invalidation, multi-level L1/L2 caching, and write-behind until measurements prove they are necessary.

![Strategy comparison table](./assets/caching-strategies-comparison-table.png)

The rule I care about most is not "which strategy is fastest?" It is: when the operation fails halfway through, which copy are we willing to trust? That one question exposes most bad cache designs immediately.

---

## Next in the Series: Eviction Policies — What to Remove?

Once the read and write paths are clear, the next production question is unavoidable: cache memory is finite. When the cache is full and a new item arrives, which existing item should leave? That is where LRU, LFU, access patterns, and cache pollution become the design problem.
