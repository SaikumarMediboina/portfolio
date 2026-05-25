package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.KnowledgeChunk;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Service
@ConditionalOnProperty(prefix = "assistant.llm", name = "provider", havingValue = "gemini")
public class GeminiLlmClient implements LlmClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(GeminiLlmClient.class);
    private static final String GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

    private final AssistantProperties properties;
    private final PromptBuilder promptBuilder;
    private final WebClient webClient;

    public GeminiLlmClient(AssistantProperties properties, PromptBuilder promptBuilder) {
        this.properties = properties;
        this.promptBuilder = promptBuilder;
        this.webClient = WebClient.builder()
            .baseUrl(GEMINI_API_BASE_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json")
            .build();
    }

    @Override
    public Mono<String> answer(ChatRequest request, List<KnowledgeChunk> chunks) {
        String apiKey = properties.getLlm().getGeminiApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return Mono.just("Gemini is not configured yet. Add GEMINI_API_KEY or switch LLM_PROVIDER back to local.");
        }

        String prompt = promptBuilder.build(request, chunks);
        String groundedPrompt = """
            %s

            %s
            """.formatted(promptBuilder.systemInstructions(), prompt);
        Map<String, Object> body = Map.of(
            "contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", groundedPrompt))
            )),
            "generationConfig", Map.of(
                "temperature", 0.35,
                "topP", 0.9,
                "maxOutputTokens", 700
            )
        );

        return webClient.post()
            .uri("/v1beta/models/{model}:generateContent", normalizedModel(properties.getLlm().getGeminiModel()))
            .header("x-goog-api-key", apiKey)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .timeout(Duration.ofSeconds(16))
            .map(this::extractText)
            .map(String::trim)
            .filter(answer -> !answer.isBlank())
            .switchIfEmpty(Mono.just("I could not generate a grounded answer from the retrieved context."))
            .onErrorResume(error -> {
                LOGGER.warn("Gemini answer request failed.", error);
                return Mono.just(fallbackAnswer(chunks));
            });
    }

    private String fallbackAnswer(List<KnowledgeChunk> chunks) {
        if (chunks == null || chunks.isEmpty()) {
            return "I found relevant site context, but the AI response service is unavailable right now.";
        }

        KnowledgeChunk primary = chunks.get(0);
        return """
            I found the relevant site context, but the AI response service is unavailable right now.

            %s

            Source: %s
            """.formatted(toSentence(primary.chunkText()), primary.sourceUrl()).trim();
    }

    private String extractText(Map<?, ?> response) {
        Object candidatesValue = response.get("candidates");
        if (!(candidatesValue instanceof List<?> candidates) || candidates.isEmpty()) {
            return "";
        }

        Object firstCandidate = candidates.get(0);
        if (!(firstCandidate instanceof Map<?, ?> candidate)) {
            return "";
        }

        Object contentValue = candidate.get("content");
        if (!(contentValue instanceof Map<?, ?> content)) {
            return "";
        }

        Object partsValue = content.get("parts");
        if (!(partsValue instanceof List<?> parts)) {
            return "";
        }

        StringBuilder answer = new StringBuilder();
        for (Object partValue : parts) {
            if (partValue instanceof Map<?, ?> part && part.get("text") instanceof String text) {
                answer.append(text);
            }
        }
        return answer.toString();
    }

    private String normalizedModel(String model) {
        if (model == null || model.isBlank()) {
            return "gemini-2.5-flash";
        }
        return model.startsWith("models/") ? model.substring("models/".length()) : model;
    }

    private String toSentence(String text) {
        String cleaned = text == null ? "" : text.trim();
        if (cleaned.length() <= 520) {
            return cleaned;
        }
        int boundary = cleaned.lastIndexOf(". ", 520);
        return cleaned.substring(0, boundary > 160 ? boundary + 1 : 520).trim();
    }
}
