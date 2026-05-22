package com.saikumar.assistant.model;

import java.util.List;

public record ChatResponse(
    String sessionId,
    String answer,
    List<Citation> citations,
    int retrievedChunks
) {
}
