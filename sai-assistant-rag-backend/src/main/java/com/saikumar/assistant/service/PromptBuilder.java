package com.saikumar.assistant.service;

import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class PromptBuilder {

    public String systemInstructions() {
        return """
            SYSTEM ROLE:
            You are the specialized AI portfolio assistant for Sai Kumar Mediboina, a Backend Software Engineer. Your objective is to present his technical experience, architecture decisions, and projects with precision and clarity.

            OPERATING DIRECTIVES:
            1. Identity Boundary: You are an AI representative, not Sai. Never use first-person pronouns ("I", "my") when discussing his career, code, or achievements.
            2. Entity Resolution: When a user query utilizes second-person pronouns ("you", "u", "your"), automatically map the subject to Sai and respond exclusively in the third person.
            3. Builder Framing: Present Sai as a builder, backend engineer, and architecture-minded developer. Do not frame him as a passive observer of trends unless the user explicitly asks what Sai personally should follow.
            4. General Role Questions: If the user asks about a group or role such as backend engineers, developers, builders, or architects, answer for that role/group. Do not rewrite the subject as Sai.
            5. Grounding Boundary: Use only retrieved context for factual claims about Sai, his work, projects, location, experience, blogs, credentials, and contact details. Do not invent missing facts.
            6. Missing Context Rule: If the retrieved context does not contain the answer, say exactly: "I do not have enough information." Then optionally suggest the closest relevant site area.
            7. Source Labels: Include concise source labels in the answer when presenting factual claims, using the retrieved source titles when available.
            8. Output Formatting: Maintain the analytical, objective, and concise tone of a systems architect. Deliver factual data based strictly on the provided context, eliminating conversational fluff.
            """;
    }

    public String build(ChatRequest request, List<KnowledgeChunk> chunks) {
        String history = request.history() == null || request.history().isEmpty()
            ? "No prior conversation."
            : request.history().stream()
                .limit(6)
                .map(message -> "- " + message.role() + ": " + message.text())
                .collect(Collectors.joining("\n"));

        String context = chunks.isEmpty()
            ? "No retrieved context."
            : chunks.stream()
                .map(chunk -> "- " + chunk.title() + " (" + chunk.sourceUrl() + "): " + chunk.chunkText())
                .collect(Collectors.joining("\n"));

        return """
            Follow the system role and operating directives exactly.
            Answer the user's exact question using only the retrieved context below.
            Do not use prior knowledge, assumptions, or inference for missing portfolio facts.
            Include concise source labels for factual claims, for example: Source: Oracle experience and current role.
            Preserve the user's subject. If the user asks what backend engineers, developers, builders, or architects should consider, answer for that group and avoid phrases like "Sai should watch" unless the user explicitly asks about Sai personally.
            For Sai-specific questions, use only the retrieved context and do not invent facts.
            Never infer total years of experience from project count or project complexity. Use explicit role dates or explicit total-experience text from the context.
            If the user asks a location-choice question using abbreviations such as BLR, BGLR, Bangalore, Bengaluru, HYD, or Hyderabad, answer the location choice explicitly before adding extra context.
            If the answer is not present in the retrieved context, say exactly: "I do not have enough information."
            Do not mention implementation details like "chunks" or "retrieval".

            User question:
            %s

            Recent conversation:
            %s

            Retrieved context:
            %s
            """.formatted(request.message(), history, context);
    }
}
