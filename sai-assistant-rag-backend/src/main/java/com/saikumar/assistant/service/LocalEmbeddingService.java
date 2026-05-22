package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.stereotype.Service;

@Service
public class LocalEmbeddingService implements EmbeddingService {

    private final AssistantProperties properties;

    public LocalEmbeddingService(AssistantProperties properties) {
        this.properties = properties;
    }

    @Override
    public float[] embed(String text) {
        int dimension = Math.max(8, properties.getEmbeddings().getDimension());
        float[] vector = new float[dimension];
        String normalized = normalize(text);

        for (String token : normalized.split(" ")) {
            if (token.isBlank()) {
                continue;
            }
            int bucket = Math.floorMod(token.hashCode(), dimension);
            vector[bucket] += 1.0f;
        }

        addSemanticBoosts(normalized, vector);
        normalize(vector);
        return vector;
    }

    private void addSemanticBoosts(String text, float[] vector) {
        boost(text, vector, "project", "work", "build", "system", "portfolio");
        boost(text, vector, "backend", "spring", "java", "api", "microservice");
        boost(text, vector, "assistant", "rag", "llm", "chat", "knowledge");
        boost(text, vector, "oracle", "database", "vector", "sql", "search");
        boost(text, vector, "blog", "article", "writing", "post", "read");
    }

    private void boost(String text, float[] vector, String... relatedTerms) {
        boolean matched = false;
        for (String term : relatedTerms) {
            if (text.contains(term)) {
                matched = true;
                break;
            }
        }

        if (!matched) {
            return;
        }

        for (String term : relatedTerms) {
            int bucket = Math.floorMod(stableHash(term), vector.length);
            vector[bucket] += 1.5f;
        }
    }

    private int stableHash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return ((bytes[0] & 0xff) << 24)
                | ((bytes[1] & 0xff) << 16)
                | ((bytes[2] & 0xff) << 8)
                | (bytes[3] & 0xff);
        } catch (NoSuchAlgorithmException exception) {
            return value.hashCode();
        }
    }

    private String normalize(String value) {
        return value == null
            ? ""
            : value.toLowerCase().replaceAll("[^a-z0-9+#.]+", " ").replaceAll("\\s+", " ").trim();
    }

    private void normalize(float[] vector) {
        double norm = 0;
        for (float value : vector) {
            norm += value * value;
        }

        if (norm == 0) {
            return;
        }

        double scale = Math.sqrt(norm);
        for (int index = 0; index < vector.length; index++) {
            vector[index] = (float) (vector[index] / scale);
        }
    }
}
