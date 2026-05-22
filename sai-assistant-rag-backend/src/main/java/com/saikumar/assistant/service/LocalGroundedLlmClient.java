package com.saikumar.assistant.service;

import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
@ConditionalOnProperty(prefix = "assistant.llm", name = "provider", havingValue = "local", matchIfMissing = true)
public class LocalGroundedLlmClient implements LlmClient {

    @Override
    public Mono<String> answer(ChatRequest request, List<KnowledgeChunk> chunks) {
        if (chunks.isEmpty()) {
            return Mono.just(
                "I do not have enough indexed website context for that yet. Trigger ingestion first, then I can answer with sources."
            );
        }

        KnowledgeChunk primary = choosePrimaryChunk(request.message(), chunks);
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

    private KnowledgeChunk choosePrimaryChunk(String question, List<KnowledgeChunk> chunks) {
        String normalized = question == null ? "" : question.toLowerCase();
        return chunks.stream()
            .max(Comparator.comparingInt(chunk -> relevanceBoost(normalized, chunk)))
            .orElse(chunks.get(0));
    }

    private int relevanceBoost(String question, KnowledgeChunk chunk) {
        String title = chunk.title() == null ? "" : chunk.title().toLowerCase();
        String source = chunk.sourceUrl() == null ? "" : chunk.sourceUrl().toLowerCase();
        int score = 0;

        if (question.contains("project") || question.contains("backend") || question.contains("worked")) {
            score += containsAny(title + " " + source, "project", "backend") ? 5 : 0;
        }
        if (question.contains("assistant") || question.contains("rag") || question.contains("architecture")) {
            score += containsAny(title + " " + source, "assistant", "rag") ? 5 : 0;
        }
        if (question.contains("who") || question.contains("sai") || question.contains("about")) {
            score += containsAny(title + " " + source, "profile", "about") ? 5 : 0;
        }
        if (question.contains("contact") || question.contains("email") || question.contains("linkedin") || question.contains("reach")) {
            score += containsAny(title + " " + source, "contact", "work-with-me") ? 7 : 0;
        }
        if (question.contains("blog") || question.contains("article") || question.contains("published") || question.contains("post")) {
            score += containsAny(title + " " + source, "blog") ? 7 : 0;
        }

        return score;
    }

    private boolean containsAny(String value, String... tokens) {
        for (String token : tokens) {
            if (value.contains(token)) {
                return true;
            }
        }
        return false;
    }
}
