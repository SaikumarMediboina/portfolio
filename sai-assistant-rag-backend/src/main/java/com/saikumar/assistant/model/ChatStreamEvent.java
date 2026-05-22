package com.saikumar.assistant.model;

import java.util.List;

public record ChatStreamEvent(
    String type,
    String text,
    List<Citation> citations
) {
    public static ChatStreamEvent token(String text) {
        return new ChatStreamEvent("token", text, List.of());
    }

    public static ChatStreamEvent done(List<Citation> citations) {
        return new ChatStreamEvent("done", "", citations);
    }
}
