package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.ChatResponse;
import com.saikumar.assistant.model.ChatStreamEvent;
import com.saikumar.assistant.model.Citation;
import com.saikumar.assistant.model.KnowledgeChunk;
import com.saikumar.assistant.repository.KnowledgeChunkRepository;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class ChatService {

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
        float[] queryEmbedding = embeddingService.embed(question);
        return repository.findNearest(queryEmbedding, Math.max(1, properties.getTopK()));
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
}
