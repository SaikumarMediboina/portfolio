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
@ConditionalOnProperty(prefix = "assistant.llm", name = "provider", havingValue = "groq")
public class GroqLlmClient implements LlmClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(GroqLlmClient.class);

    private final AssistantProperties properties;
    private final PromptBuilder promptBuilder;

    public GroqLlmClient(AssistantProperties properties, PromptBuilder promptBuilder) {
        this.properties = properties;
        this.promptBuilder = promptBuilder;
    }

    @Override
    public Mono<String> answer(ChatRequest request, List<KnowledgeChunk> chunks) {
        String apiKey = properties.getLlm().getGroqApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return Mono.just("Groq is not configured yet. Add GROQ_API_KEY or switch LLM_PROVIDER back to local.");
        }

        String prompt = promptBuilder.build(request, chunks);
        Map<String, Object> body = Map.of(
            "model", normalizedModel(properties.getLlm().getGroqModel()),
            "messages", List.of(
                Map.of(
                    "role", "system",
                    "content", promptBuilder.systemInstructions()
                ),
                Map.of("role", "user", "content", prompt)
            ),
            "temperature", 0.1,
            "top_p", 0.8,
            "max_tokens", 700
        );

        return WebClient.builder()
            .baseUrl(normalizedBaseUrl(properties.getLlm().getGroqBaseUrl()))
            .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json")
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
            .build()
            .post()
            .uri("/chat/completions")
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .timeout(Duration.ofSeconds(16))
            .map(this::extractText)
            .map(String::trim)
            .filter(answer -> !answer.isBlank())
            .switchIfEmpty(Mono.just("I do not have enough information."))
            .onErrorResume(error -> {
                LOGGER.warn("Groq answer request failed.", error);
                return Mono.just(fallbackAnswer(chunks));
            });
    }

    private String extractText(Map<?, ?> response) {
        Object choicesValue = response.get("choices");
        if (!(choicesValue instanceof List<?> choices) || choices.isEmpty()) {
            return "";
        }

        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choice)) {
            return "";
        }

        Object messageValue = choice.get("message");
        if (!(messageValue instanceof Map<?, ?> message)) {
            return "";
        }

        Object contentValue = message.get("content");
        return contentValue instanceof String content ? content : "";
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

    private String normalizedModel(String model) {
        return model == null || model.isBlank() ? "llama-3.1-8b-instant" : model.trim();
    }

    private String normalizedBaseUrl(String baseUrl) {
        String value = baseUrl == null || baseUrl.isBlank()
            ? "https://api.groq.com/openai/v1"
            : baseUrl.trim();
        return value.replaceAll("/+$", "");
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
