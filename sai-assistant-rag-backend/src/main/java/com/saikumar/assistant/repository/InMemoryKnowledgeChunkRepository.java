package com.saikumar.assistant.repository;

import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
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
    public int count() {
        return chunks.size();
    }

    @Override
    public String mode() {
        return "in-memory-local";
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
}
