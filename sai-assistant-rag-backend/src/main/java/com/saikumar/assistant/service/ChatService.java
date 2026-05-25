package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.ChatResponse;
import com.saikumar.assistant.model.ChatStreamEvent;
import com.saikumar.assistant.model.Citation;
import com.saikumar.assistant.model.KnowledgeChunk;
import com.saikumar.assistant.repository.KnowledgeChunkRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@Service
public class ChatService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ChatService.class);
    private static final Duration CHAT_TIMEOUT = Duration.ofSeconds(24);
    private static final Duration LLM_TIMEOUT = Duration.ofSeconds(16);
    private static final Duration RESPONSE_CACHE_TTL = Duration.ofMinutes(10);
    private static final int RESPONSE_CACHE_MAX_SIZE = 120;

    private static final Set<String> STOP_WORDS = Set.of(
        "a",
        "about",
        "all",
        "am",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "can",
        "do",
        "does",
        "for",
        "from",
        "give",
        "has",
        "have",
        "he",
        "his",
        "how",
        "i",
        "in",
        "is",
        "it",
        "me",
        "my",
        "of",
        "on",
        "or",
        "please",
        "show",
        "tell",
        "that",
        "the",
        "this",
        "to",
        "u",
        "want",
        "what",
        "when",
        "where",
        "which",
        "who",
        "why",
        "with",
        "you",
        "your"
    );

    private final AssistantProperties properties;
    private final EmbeddingService embeddingService;
    private final KnowledgeChunkRepository repository;
    private final LlmClient llmClient;
    private final Map<String, CachedResponse> responseCache = new ConcurrentHashMap<>();

    public ChatService(
        AssistantProperties properties,
        EmbeddingService embeddingService,
        KnowledgeChunkRepository repository,
        LlmClient llmClient
    ) {
        this.properties = properties;
        this.embeddingService = embeddingService;
        this.repository = repository;
        this.llmClient = llmClient;
    }

    public Mono<ChatResponse> answer(ChatRequest request) {
        ChatRequest safeRequest = sanitize(request);
        ChatResponse instantResponse = instantResponse(safeRequest);
        if (instantResponse != null) {
            return Mono.just(instantResponse);
        }

        String cacheKey = cacheKey(safeRequest.message());
        CachedResponse cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse != null && !cachedResponse.isExpired()) {
            return Mono.just(cachedResponse.forSession(safeRequest.sessionId()));
        }

        return Mono.fromCallable(() -> {
                List<KnowledgeChunk> chunks = retrieve(safeRequest.message());
                return new RetrievalContext(safeRequest, chunks, citations(chunks));
            })
            .subscribeOn(Schedulers.boundedElastic())
            .flatMap(context -> {
                if (context.chunks().isEmpty()) {
                    return Mono.just(cacheAndReturn(cacheKey, noContextResponse(context.request().sessionId())));
                }

                return llmClient.answer(context.request(), context.chunks())
                    .timeout(LLM_TIMEOUT)
                    .onErrorResume(error -> {
                        LOGGER.warn("Assistant LLM request timed out or failed.", error);
                        return Mono.just(fallbackAnswer(context.chunks()));
                    })
                    .map(answer -> cacheAndReturn(cacheKey, new ChatResponse(
                        context.request().sessionId(),
                        answer,
                        context.citations(),
                        context.chunks().size()
                    )));
            })
            .timeout(CHAT_TIMEOUT)
            .onErrorResume(error -> {
                LOGGER.warn("Assistant chat request timed out or failed.", error);
                return Mono.just(new ChatResponse(
                    safeRequest.sessionId(),
                    "Sai's assistant is online, but the knowledge backend is taking too long right now. Please retry in a moment.",
                    List.of(),
                    0
                ));
            });
    }

    public Flux<ChatStreamEvent> stream(ChatRequest request) {
        ChatRequest safeRequest = sanitize(request);
        ChatResponse instantResponse = instantResponse(safeRequest);
        if (instantResponse != null) {
            return Flux.concat(
                Flux.just(ChatStreamEvent.stage("Answer ready", 92)),
                streamTokens(instantResponse)
            );
        }

        String cacheKey = cacheKey(safeRequest.message());
        CachedResponse cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse != null && !cachedResponse.isExpired()) {
            return Flux.concat(
                Flux.just(ChatStreamEvent.stage("Using cached answer", 92)),
                streamTokens(cachedResponse.forSession(safeRequest.sessionId()))
            );
        }

        Mono<RetrievalContext> retrieval = Mono.fromCallable(() -> {
                List<KnowledgeChunk> chunks = retrieve(safeRequest.message());
                return new RetrievalContext(safeRequest, chunks, citations(chunks));
            })
            .subscribeOn(Schedulers.boundedElastic());

        return Flux.concat(
                Flux.just(
                    ChatStreamEvent.stage("Reading question", 12),
                    ChatStreamEvent.stage("Embedding query", 28),
                    ChatStreamEvent.stage("Retrieving Oracle context", 46)
                ),
                retrieval.flatMapMany(context -> Flux.concat(
                    Flux.just(ChatStreamEvent.stage("Reranking evidence", 62)),
                    context.chunks().isEmpty()
                        ? Flux.concat(
                            Flux.just(ChatStreamEvent.stage("No strong match", 92)),
                            streamTokens(cacheAndReturn(cacheKey, noContextResponse(context.request().sessionId())))
                        )
                        : Flux.concat(
                            Flux.just(ChatStreamEvent.stage("Calling LLM", 78)),
                            llmClient.answer(context.request(), context.chunks())
                                .timeout(LLM_TIMEOUT)
                                .onErrorResume(error -> {
                                    LOGGER.warn("Assistant LLM stream request timed out or failed.", error);
                                    return Mono.just(fallbackAnswer(context.chunks()));
                                })
                                .map(answer -> cacheAndReturn(cacheKey, new ChatResponse(
                                    context.request().sessionId(),
                                    answer,
                                    context.citations(),
                                    context.chunks().size()
                                )))
                                .flatMapMany(response -> Flux.concat(
                                    Flux.just(ChatStreamEvent.stage("Streaming answer", 92)),
                                    streamTokens(response)
                                ))
                        )
                ))
            )
            .timeout(CHAT_TIMEOUT)
            .onErrorResume(error -> {
                LOGGER.warn("Assistant chat stream request timed out or failed.", error);
                ChatResponse fallback = new ChatResponse(
                    safeRequest.sessionId(),
                    "Sai's assistant is online, but the knowledge backend is taking too long right now. Please retry in a moment.",
                    List.of(),
                    0
                );
                return Flux.concat(
                    Flux.just(ChatStreamEvent.stage("Fallback answer", 92)),
                    streamTokens(fallback)
                );
            });
    }

    private Flux<ChatStreamEvent> streamTokens(ChatResponse response) {
        List<String> tokens = Arrays.stream(response.answer().split("(?<=\\s)"))
            .filter(token -> !token.isBlank())
            .toList();

        return Flux.fromIterable(tokens)
            .delayElements(Duration.ofMillis(18))
            .map(ChatStreamEvent::token)
            .concatWithValues(ChatStreamEvent.done(response.citations()));
    }

    private List<KnowledgeChunk> retrieve(String question) {
        int topK = Math.max(1, properties.getTopK());
        float[] queryEmbedding = embeddingService.embedQuery(question);
        List<KnowledgeChunk> candidates = repository.findNearest(queryEmbedding, Math.max(topK, 24));
        List<KnowledgeChunk> ranked = rerank(question, candidates).stream()
            .limit(topK)
            .toList();
        return isBelowSimilarityThreshold(ranked) ? List.of() : ranked;
    }

    private List<KnowledgeChunk> rerank(String question, List<KnowledgeChunk> candidates) {
        List<String> tokens = queryTokens(question);
        List<ScoredChunk> scoredChunks = new ArrayList<>();

        for (int index = 0; index < candidates.size(); index++) {
            KnowledgeChunk chunk = candidates.get(index);
            scoredChunks.add(new ScoredChunk(chunk, hybridScore(chunk, tokens) + vectorScore(chunk, index, candidates.size()), index));
        }

        return scoredChunks.stream()
            .sorted(Comparator
                .comparingDouble(ScoredChunk::score)
                .reversed()
                .thenComparingInt(ScoredChunk::vectorRank))
            .map(ScoredChunk::chunk)
            .toList();
    }

    private double hybridScore(KnowledgeChunk chunk, List<String> tokens) {
        String title = normalize(chunk.title());
        String source = normalize(chunk.sourceUrl());
        String body = normalize(chunk.chunkText());
        String metadata = normalize(chunk.metadata() == null ? "" : chunk.metadata().toString());
        Set<String> tokenSet = new HashSet<>(tokens);

        double score = 0;
        if (metadata.contains("structured site") || metadata.contains("structured-site")) {
            score += 8;
        }
        if (metadata.contains("fallback") || title.startsWith("fallback source")) {
            score -= 100;
        }

        for (String token : tokens) {
            score += countMatches(title, token) * 8.0;
            score += countMatches(source, token) * 3.0;
            score += countMatches(metadata, token) * 2.5;
            score += countMatches(body, token) * 2.0;
        }

        boolean hasExperienceIntent = hasAny(
            tokenSet,
            "experience",
            "exp",
            "role",
            "career",
            "job",
            "employment",
            "oracle"
        );
        boolean hasLocationIntent = hasAny(
            tokenSet,
            "bangalore",
            "bengaluru",
            "bglr",
            "blr",
            "hyd",
            "hyderabad",
            "location",
            "office",
            "city"
        );
        boolean hasProjectIntent = hasAny(
            tokenSet,
            "project",
            "projects",
            "built",
            "build",
            "designed",
            "design",
            "developed",
            "created",
            "implemented",
            "delivered",
            "portfolio",
            "system",
            "systems"
        )
            || (tokenSet.contains("work") && !hasExperienceIntent);

        if (hasExperienceIntent
            && (metadata.contains("category experience")
                || metadata.contains("category\":\"experience")
                || source.contains("#experience")
                || title.contains("experience")
                || title.contains("current role"))) {
            score += 45;
        }

        if (hasLocationIntent
            && (metadata.contains("category experience")
                || metadata.contains("category\":\"experience")
                || metadata.contains("category profile")
                || metadata.contains("category\":\"profile")
                || source.contains("#experience")
                || source.contains("/about")
                || title.contains("experience")
                || title.contains("current role")
                || body.contains("bengaluru")
                || body.contains("bangalore"))) {
            score += 55;
        }

        if (hasExperienceIntent
            && (metadata.contains("category project")
                || metadata.contains("category\":\"project")
                || body.contains("project:")
                || source.contains("#work"))) {
            score -= 18;
        }

        if (hasProjectIntent
            && (metadata.contains("category project")
                || metadata.contains("category\":\"project")
                || body.contains("project:")
                || title.contains("project")
                || source.contains("#work"))) {
            score += 35;
        }

        if (hasAny(tokenSet, "contact", "email", "mail", "linkedin", "phone", "connect", "hire")
            && (metadata.contains("category contact")
                || metadata.contains("category\":\"contact")
                || source.contains("work with me")
                || source.contains("work-with-me")
                || title.contains("contact"))) {
            score += 35;
        }

        if (hasAny(tokenSet, "blog", "blogs", "article", "articles", "post", "posts", "published", "count")
            && (metadata.contains("category blog")
                || metadata.contains("category\":\"blog")
                || source.contains("/blog")
                || title.contains("blog"))) {
            score += 28;
        }

        if (hasAny(tokenSet, "skill", "skills", "stack", "technology", "tools", "tech")
            && (metadata.contains("category skill")
                || metadata.contains("category\":\"skill")
                || source.contains("#skills")
                || title.contains("skill")
                || title.contains("stack"))) {
            score += 28;
        }

        if (hasAny(tokenSet, "certification", "certifications", "certificate", "credential", "credentials", "education", "degree", "cgpa")
            && (metadata.contains("category credential")
                || metadata.contains("category\":\"credential")
                || source.contains("#credentials")
                || title.contains("certification")
                || title.contains("education"))) {
            score += 28;
        }

        if (hasAny(tokenSet, "award", "awards", "recognition", "recognized", "hackathon", "pace")
            && (metadata.contains("category recognition")
                || metadata.contains("category\":\"recognition")
                || source.contains("#recognition")
                || title.contains("recognition"))) {
            score += 28;
        }

        return score;
    }

    private double vectorScore(KnowledgeChunk chunk, int vectorRank, int candidateCount) {
        if (chunk.vectorDistance() != null) {
            double similarity = 1.0 - chunk.vectorDistance();
            return Math.max(0, similarity) * 40.0;
        }

        if (candidateCount <= 1) {
            return 0;
        }

        return Math.max(0, 1.0 - ((double) vectorRank / (candidateCount - 1))) * 12.0;
    }

    private boolean isBelowSimilarityThreshold(List<KnowledgeChunk> chunks) {
        if (chunks.isEmpty()) {
            return false;
        }

        double threshold = properties.getMinVectorSimilarity();
        if (threshold <= 0 || chunks.get(0).vectorDistance() == null) {
            return false;
        }

        return (1.0 - chunks.get(0).vectorDistance()) < threshold;
    }

    private List<String> queryTokens(String question) {
        Set<String> tokens = new HashSet<>();
        for (String token : normalize(question).split(" ")) {
            if (token.length() <= 1 || STOP_WORDS.contains(token)) {
                continue;
            }

            tokens.add(token);
            if (token.endsWith("s") && token.length() > 3) {
                tokens.add(token.substring(0, token.length() - 1));
            }
        }

        if (tokens.contains("project")) {
            tokens.add("work");
            tokens.add("build");
        }
        if (tokens.contains("designed") || tokens.contains("design") || tokens.contains("built") || tokens.contains("developed")) {
            tokens.add("project");
            tokens.add("work");
            tokens.add("build");
        }
        if (tokens.contains("exp") || tokens.contains("experience")) {
            tokens.add("experience");
            tokens.add("role");
            tokens.add("career");
            tokens.add("oracle");
        }
        if (tokens.contains("work") || tokens.contains("working") || tokens.contains("works")) {
            tokens.add("work");
            tokens.add("role");
            tokens.add("current");
        }
        if (tokens.contains("bglr") || tokens.contains("blr") || tokens.contains("bangalore") || tokens.contains("bengaluru")) {
            tokens.add("bengaluru");
            tokens.add("bangalore");
            tokens.add("location");
            tokens.add("office");
            tokens.add("experience");
            tokens.add("oracle");
            tokens.add("role");
        }
        if (tokens.contains("hyd") || tokens.contains("hyderabad")) {
            tokens.add("hyderabad");
            tokens.add("location");
            tokens.add("office");
            tokens.add("experience");
            tokens.add("oracle");
            tokens.add("role");
        }
        if (tokens.contains("blog")) {
            tokens.add("article");
            tokens.add("post");
        }
        if (tokens.contains("contact")) {
            tokens.add("email");
            tokens.add("linkedin");
        }

        return List.copyOf(tokens);
    }

    private boolean hasAny(Set<String> tokens, String... values) {
        for (String value : values) {
            if (tokens.contains(value)) {
                return true;
            }
        }
        return false;
    }

    private int countMatches(String text, String token) {
        if (text.isBlank() || token.isBlank()) {
            return 0;
        }

        int count = 0;
        int index = text.indexOf(token);
        while (index >= 0) {
            count++;
            index = text.indexOf(token, index + token.length());
        }
        return count;
    }

    private String normalize(String value) {
        return value == null
            ? ""
            : value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9+#.:/@-]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private List<Citation> citations(List<KnowledgeChunk> chunks) {
        return chunks.stream()
            .map(chunk -> new Citation(chunk.title(), chunk.sourceUrl()))
            .distinct()
            .limit(3)
            .toList();
    }

    private ChatRequest sanitize(ChatRequest request) {
        if (request == null) {
            return new ChatRequest("anonymous", "", List.of());
        }

        String message = request.message() == null ? "" : request.message().trim();
        if (message.length() > properties.getMaxQuestionLength()) {
            message = message.substring(0, properties.getMaxQuestionLength()).trim();
        }

        String sessionId = request.sessionId() == null || request.sessionId().isBlank()
            ? "anonymous"
            : request.sessionId().trim();

        return new ChatRequest(sessionId, message, request.history());
    }

    private ChatResponse instantResponse(ChatRequest request) {
        String message = normalize(request.message());
        if (message.isBlank()) {
            return null;
        }

        if (message.matches("^(hi|hello|hey|yo|hai|namaste|hlo)$")) {
            return new ChatResponse(
                request.sessionId(),
                "Hey, I am Sai's site assistant. Ask me about his projects, blogs, tech stack, contact details, or backend concepts.",
                List.of(),
                0
            );
        }

        if (message.matches("^(ok|okay|cool|nice|thanks|thank you|done|yes|no)$")) {
            return new ChatResponse(
                request.sessionId(),
                "Got it. Ask a Sai-specific portfolio question, or ask a backend, cloud, database, or AI concept.",
                List.of(),
                0
            );
        }

        if (isCurrentWorkLocationQuestion(message)) {
            return new ChatResponse(
                request.sessionId(),
                "Sai's current Oracle role is associated with Bengaluru (Bangalore), Karnataka, India, and it is listed as remote. It is not Hyderabad in the portfolio context.",
                List.of(new Citation("Oracle experience and current role", "https://saikumarmediboina.com/portfolio#experience")),
                0
            );
        }

        return null;
    }

    private boolean isCurrentWorkLocationQuestion(String message) {
        Set<String> tokens = new HashSet<>(Arrays.asList(message.split(" ")));
        boolean hasLocationToken = hasAny(
            tokens,
            "bangalore",
            "bengaluru",
            "bglr",
            "blr",
            "hyd",
            "hyderabad",
            "location",
            "office",
            "city"
        );
        boolean hasWorkToken = hasAny(
            tokens,
            "company",
            "current",
            "job",
            "office",
            "oracle",
            "role",
            "work",
            "working",
            "works"
        );

        return hasLocationToken && hasWorkToken;
    }

    private ChatResponse cacheAndReturn(String cacheKey, ChatResponse response) {
        if (responseCache.size() >= RESPONSE_CACHE_MAX_SIZE) {
            responseCache.entrySet().removeIf(entry -> entry.getValue().isExpired());
            if (responseCache.size() >= RESPONSE_CACHE_MAX_SIZE) {
                responseCache.clear();
            }
        }

        responseCache.put(cacheKey, CachedResponse.from(response));
        return response;
    }

    private String cacheKey(String message) {
        return normalize(message);
    }

    private ChatResponse noContextResponse(String sessionId) {
        return new ChatResponse(
            sessionId,
            "I do not have enough information.",
            List.of(),
            0
        );
    }

    private String fallbackAnswer(List<KnowledgeChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return "Sai's assistant is online, but the AI response service is taking too long right now. Please retry in a moment.";
        }

        KnowledgeChunk primary = chunks.get(0);
        return """
            I found the relevant site context, but the AI response service is taking too long right now.

            %s

            Source: %s
            """.formatted(toSentence(primary.chunkText()), primary.sourceUrl()).trim();
    }

    private String toSentence(String text) {
        String cleaned = text == null ? "" : text.trim();
        if (cleaned.length() <= 520) {
            return cleaned;
        }
        int boundary = cleaned.lastIndexOf(". ", 520);
        return cleaned.substring(0, boundary > 160 ? boundary + 1 : 520).trim();
    }

    private record RetrievalContext(ChatRequest request, List<KnowledgeChunk> chunks, List<Citation> citations) {
    }

    private record CachedResponse(String answer, List<Citation> citations, int retrievedChunks, Instant expiresAt) {
        static CachedResponse from(ChatResponse response) {
            return new CachedResponse(
                response.answer(),
                response.citations(),
                response.retrievedChunks(),
                Instant.now().plus(RESPONSE_CACHE_TTL)
            );
        }

        boolean isExpired() {
            return Instant.now().isAfter(expiresAt);
        }

        ChatResponse forSession(String sessionId) {
            return new ChatResponse(sessionId, answer, citations, retrievedChunks);
        }
    }

    private record ScoredChunk(KnowledgeChunk chunk, double score, int vectorRank) {
    }
}
