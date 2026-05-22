package com.saikumar.assistant.repository;

import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.List;

public interface KnowledgeChunkRepository {

    void deleteAll();

    void saveAll(List<KnowledgeChunk> chunks);

    List<KnowledgeChunk> findNearest(float[] queryEmbedding, int limit);

    int count();

    String mode();
}
