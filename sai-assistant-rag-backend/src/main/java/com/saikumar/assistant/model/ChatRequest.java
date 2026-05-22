package com.saikumar.assistant.model;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record ChatRequest(
    String sessionId,
    @NotBlank String message,
    List<ChatMessage> history
) {
}
