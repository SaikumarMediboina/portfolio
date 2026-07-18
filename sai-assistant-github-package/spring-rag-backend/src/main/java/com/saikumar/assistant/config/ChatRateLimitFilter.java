package com.saikumar.assistant.config;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

@Component
public class ChatRateLimitFilter implements WebFilter {

    private final AssistantProperties properties;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public ChatRateLimitFilter(AssistantProperties properties) {
        this.properties = properties;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (!path.startsWith("/api/chat")) {
            return chain.filter(exchange);
        }

        String key = exchange.getRequest().getRemoteAddress() == null
            ? "unknown"
            : exchange.getRequest().getRemoteAddress().getAddress().getHostAddress();

        if (!allow(key)) {
            exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
            return exchange.getResponse().setComplete();
        }

        return chain.filter(exchange);
    }

    private boolean allow(String key) {
        int capacity = Math.max(1, properties.getRateLimit().getCapacity());
        int refillPerMinute = Math.max(1, properties.getRateLimit().getRefillPerMinute());
        long now = Instant.now().toEpochMilli();

        Bucket bucket = buckets.computeIfAbsent(key, ignored -> new Bucket(capacity, now));
        synchronized (bucket) {
            long elapsedMillis = Math.max(0, now - bucket.lastRefillMillis);
            double refill = elapsedMillis * (refillPerMinute / 60_000.0);
            bucket.tokens = Math.min(capacity, bucket.tokens + refill);
            bucket.lastRefillMillis = now;

            if (bucket.tokens < 1) {
                return false;
            }

            bucket.tokens -= 1;
            return true;
        }
    }

    private static class Bucket {
        private double tokens;
        private long lastRefillMillis;

        Bucket(double tokens, long lastRefillMillis) {
            this.tokens = tokens;
            this.lastRefillMillis = lastRefillMillis;
        }
    }
}
