package com.saikumar.assistant.service;

import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.List;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class LocalGroundedLlmClient implements LlmClient {

    @Override
    public Mono<String> answer(ChatRequest request, List<KnowledgeChunk> chunks) {
        if (chunks.isEmpty()) {
            return Mono.just(
                "I do not have enough indexed website context for that yet. Trigger ingestion first, then I can answer with sources."
            );
        }

        KnowledgeChunk primary = chunks.get(0);
        String answer = """
            Based on the indexed site knowledge, %s

            The strongest matching source is "%s". You can open it here: %s
            """.formatted(toSentence(primary.chunkText()), primary.title(), primary.sourceUrl()).trim();

        return Mono.just(answer);
    }

    private String toSentence(String text) {
        String cleaned = text == null ? "" : text.trim();
        if (cleaned.length() <= 420) {
            return cleaned;
        }
        int boundary = cleaned.lastIndexOf(". ", 420);
        return cleaned.substring(0, boundary > 160 ? boundary + 1 : 420).trim();
    }
}
