package com.saikumar.assistant.service;

import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class PromptBuilder {

    public String build(ChatRequest request, List<KnowledgeChunk> chunks) {
        String context = chunks.isEmpty()
            ? "No retrieved context."
            : chunks.stream()
                .map(chunk -> "- " + chunk.title() + " (" + chunk.sourceUrl() + "): " + chunk.chunkText())
                .collect(Collectors.joining("\n"));

        return """
            You are Sai Kumar Mediboina's website assistant.
            Answer only from retrieved website context for Sai-specific questions.
            If the answer is not present, say that politely and guide the visitor to the website.
            Keep the answer concise and useful.

            User question:
            %s

            Retrieved context:
            %s
            """.formatted(request.message(), context);
    }
}
