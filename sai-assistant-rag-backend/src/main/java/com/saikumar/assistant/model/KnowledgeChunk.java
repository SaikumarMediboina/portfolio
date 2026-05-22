package com.saikumar.assistant.model;

import java.time.Instant;
import java.util.Map;

public record KnowledgeChunk(
    String id,
    String sourceUrl,
    String title,
    String chunkText,
    float[] embedding,
    Map<String, String> metadata,
    Instant indexedAt
) {
}
