package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Service
@ConditionalOnProperty(prefix = "assistant.embeddings", name = "provider", havingValue = "gemini")
public class GeminiEmbeddingService implements EmbeddingService {

    private static final String GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";

    private final AssistantProperties properties;
    private final WebClient webClient;

    public GeminiEmbeddingService(AssistantProperties properties) {
        this.properties = properties;
        this.webClient = WebClient.builder()
            .baseUrl(GEMINI_API_BASE_URL)
            .defaultHeader(HttpHeaders.CONTENT_TYPE, "application/json")
            .build();
    }

    @Override
    public float[] embed(String text) {
        return embedWithTaskType(text, "RETRIEVAL_DOCUMENT");
    }

    @Override
    public float[] embedDocument(String text) {
        return embedWithTaskType(text, "RETRIEVAL_DOCUMENT");
    }

    @Override
    public float[] embedQuery(String text) {
        return embedWithTaskType(text, "RETRIEVAL_QUERY");
    }

    private float[] embedWithTaskType(String text, String taskType) {
        String apiKey = properties.getLlm().getGeminiApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Gemini embeddings require GEMINI_API_KEY.");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("content", Map.of("parts", List.of(Map.of("text", text == null ? "" : text))));
        body.put("taskType", taskType);

        int outputDimension = properties.getEmbeddings().getDimension();
        if (outputDimension > 0) {
            body.put("outputDimensionality", outputDimension);
        }

        Map<?, ?> response = webClient.post()
            .uri("/v1beta/models/{model}:embedContent", normalizedModel(properties.getEmbeddings().getGeminiModel()))
            .header("x-goog-api-key", apiKey)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .block(Duration.ofSeconds(20));

        return extractEmbedding(response);
    }

    private float[] extractEmbedding(Map<?, ?> response) {
        if (response == null || !(response.get("embedding") instanceof Map<?, ?> embedding)) {
            throw new IllegalStateException("Gemini embedding response did not include an embedding.");
        }

        Object valuesValue = embedding.get("values");
        if (!(valuesValue instanceof List<?> rawValues)) {
            throw new IllegalStateException("Gemini embedding response did not include vector values.");
        }

        List<Float> values = new ArrayList<>(rawValues.size());
        for (Object rawValue : rawValues) {
            if (!(rawValue instanceof Number number)) {
                throw new IllegalStateException("Gemini embedding response included a non-numeric vector value.");
            }
            values.add(number.floatValue());
        }

        float[] vector = new float[values.size()];
        for (int index = 0; index < values.size(); index++) {
            vector[index] = values.get(index);
        }
        return vector;
    }

    private String normalizedModel(String model) {
        if (model == null || model.isBlank()) {
            return "gemini-embedding-001";
        }
        return model.startsWith("models/") ? model.substring("models/".length()) : model;
    }
}
