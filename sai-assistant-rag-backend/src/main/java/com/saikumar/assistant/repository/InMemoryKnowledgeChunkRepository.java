package com.saikumar.assistant.repository;

import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

@Repository
@Profile("!oracle")
public class InMemoryKnowledgeChunkRepository implements KnowledgeChunkRepository {

    private final List<KnowledgeChunk> chunks = new CopyOnWriteArrayList<>();

    @Override
    public void deleteAll() {
        chunks.clear();
    }

    @Override
    public void saveAll(List<KnowledgeChunk> chunksToSave) {
        chunks.addAll(chunksToSave);
    }

    @Override
    public List<KnowledgeChunk> findNearest(float[] queryEmbedding, int limit) {
        return chunks.stream()
            .map(chunk -> withDistance(chunk, cosineDistance(queryEmbedding, chunk.embedding())))
            .sorted(Comparator.comparingDouble(KnowledgeChunk::vectorDistance))
            .limit(limit)
            .toList();
    }

    @Override
    public List<KnowledgeChunk> findExact(List<String> terms, int limit) {
        Set<String> normalizedTerms = normalizeTerms(terms);
        if (normalizedTerms.isEmpty()) {
            return List.of();
        }

        return chunks.stream()
            .map(chunk -> new ExactScoredChunk(chunk, exactScore(chunk, normalizedTerms)))
            .filter(scoredChunk -> scoredChunk.score() > 0)
            .sorted(Comparator.comparingInt(ExactScoredChunk::score).reversed())
            .limit(limit)
            .map(ExactScoredChunk::chunk)
            .toList();
    }

    @Override
    public int count() {
        return chunks.size();
    }

    @Override
    public String mode() {
        return "in-memory-hybrid-search";
    }

    private int exactScore(KnowledgeChunk chunk, Set<String> terms) {
        String title = normalize(chunk.title());
        String source = normalize(chunk.sourceUrl());
        String body = normalize(chunk.chunkText());
        String metadata = normalize(chunk.metadata() == null ? "" : chunk.metadata().toString());

        int score = 0;
        for (String term : terms) {
            score += countMatches(title, term) * 12;
            score += countMatches(source, term) * 5;
            score += countMatches(metadata, term) * 4;
            score += countMatches(body, term) * 3;
        }
        return score;
    }

    private int countMatches(String text, String term) {
        if (text.isBlank() || term.isBlank()) {
            return 0;
        }

        int count = 0;
        int index = text.indexOf(term);
        while (index >= 0) {
            count++;
            index = text.indexOf(term, index + term.length());
        }
        return count;
    }

    private Set<String> normalizeTerms(List<String> terms) {
        Set<String> normalizedTerms = new HashSet<>();
        for (String term : terms) {
            String normalized = normalize(term);
            if (normalized.length() >= 3) {
                normalizedTerms.add(normalized);
            }
        }
        return normalizedTerms;
    }

    private String normalize(String value) {
        return value == null
            ? ""
            : value.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9+#.:/@-]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private double cosineDistance(float[] left, float[] right) {
        if (left.length == 0 || right.length == 0) {
            return 1.0;
        }

        int length = Math.min(left.length, right.length);
        double dot = 0;
        double leftNorm = 0;
        double rightNorm = 0;

        for (int index = 0; index < length; index++) {
            dot += left[index] * right[index];
            leftNorm += left[index] * left[index];
            rightNorm += right[index] * right[index];
        }

        if (leftNorm == 0 || rightNorm == 0) {
            return 1.0;
        }

        return 1.0 - (dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)));
    }

    private KnowledgeChunk withDistance(KnowledgeChunk chunk, double distance) {
        return new KnowledgeChunk(
            chunk.id(),
            chunk.sourceUrl(),
            chunk.title(),
            chunk.chunkText(),
            chunk.embedding(),
            chunk.metadata(),
            chunk.indexedAt(),
            distance
        );
    }

    private record ExactScoredChunk(KnowledgeChunk chunk, int score) {
    }
}
