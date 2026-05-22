package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DocumentChunker {

    private final AssistantProperties properties;

    public DocumentChunker(AssistantProperties properties) {
        this.properties = properties;
    }

    public List<String> split(String text) {
        String normalized = normalize(text);
        int chunkSize = Math.max(500, properties.getChunkSizeChars());
        int overlap = Math.min(Math.max(0, properties.getChunkOverlapChars()), chunkSize / 2);
        List<String> chunks = new ArrayList<>();

        if (normalized.length() <= chunkSize) {
            return normalized.isBlank() ? List.of() : List.of(normalized);
        }

        int start = 0;
        while (start < normalized.length()) {
            int end = Math.min(normalized.length(), start + chunkSize);
            int sentenceBoundary = normalized.lastIndexOf(". ", end);

            if (sentenceBoundary > start + (chunkSize / 2)) {
                end = sentenceBoundary + 1;
            }

            String chunk = normalized.substring(start, end).trim();
            if (!chunk.isBlank()) {
                chunks.add(chunk);
            }

            if (end >= normalized.length()) {
                break;
            }
            start = Math.max(0, end - overlap);
        }

        return chunks;
    }

    private String normalize(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }
}
