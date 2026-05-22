package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.ChatResponse;
import com.saikumar.assistant.model.ChatStreamEvent;
import com.saikumar.assistant.model.Citation;
import com.saikumar.assistant.model.KnowledgeChunk;
import com.saikumar.assistant.repository.KnowledgeChunkRepository;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class ChatService {

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
        List<KnowledgeChunk> chunks = retrieve(safeRequest.message());
        List<Citation> citations = citations(chunks);

        return llmClient.answer(safeRequest, chunks)
            .map(answer -> new ChatResponse(
                safeRequest.sessionId(),
                answer,
                citations,
                chunks.size()
            ));
    }

    public Flux<ChatStreamEvent> stream(ChatRequest request) {
        return answer(request)
            .flatMapMany(response -> {
                List<String> tokens = Arrays.stream(response.answer().split("(?<=\\s)"))
                    .filter(token -> !token.isBlank())
                    .toList();

                Flux<ChatStreamEvent> tokenStream = Flux.fromIterable(tokens)
                    .delayElements(Duration.ofMillis(22))
                    .map(ChatStreamEvent::token);

                return tokenStream.concatWithValues(ChatStreamEvent.done(response.citations()));
            });
    }

    private List<KnowledgeChunk> retrieve(String question) {
        int topK = Math.max(1, properties.getTopK());
        float[] queryEmbedding = embeddingService.embedQuery(question);
        List<KnowledgeChunk> candidates = repository.findNearest(queryEmbedding, Math.max(topK, 50));
        return rerank(question, candidates).stream()
            .limit(topK)
            .toList();
    }

    private List<KnowledgeChunk> rerank(String question, List<KnowledgeChunk> candidates) {
        List<String> tokens = queryTokens(question);
        List<ScoredChunk> scoredChunks = new ArrayList<>();

        for (int index = 0; index < candidates.size(); index++) {
            KnowledgeChunk chunk = candidates.get(index);
            scoredChunks.add(new ScoredChunk(chunk, hybridScore(chunk, tokens), index));
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
        String message = request.message() == null ? "" : request.message().trim();
        if (message.length() > properties.getMaxQuestionLength()) {
            message = message.substring(0, properties.getMaxQuestionLength()).trim();
        }

        String sessionId = request.sessionId() == null || request.sessionId().isBlank()
            ? "anonymous"
            : request.sessionId().trim();

        return new ChatRequest(sessionId, message, request.history());
    }

    private record ScoredChunk(KnowledgeChunk chunk, double score, int vectorRank) {
    }
}
