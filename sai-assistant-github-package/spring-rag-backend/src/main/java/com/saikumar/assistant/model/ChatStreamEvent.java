package com.saikumar.assistant.model;

import java.util.List;

public record ChatStreamEvent(
    String type,
    String text,
    List<Citation> citations,
    Integer progress,
    String label
) {
    public static ChatStreamEvent stage(String label, int progress) {
        return new ChatStreamEvent("stage", "", List.of(), progress, label);
    }

    public static ChatStreamEvent token(String text) {
        return new ChatStreamEvent("token", text, List.of(), null, null);
    }

    public static ChatStreamEvent done(List<Citation> citations) {
        return new ChatStreamEvent("done", "", citations, 100, "Complete");
    }
}
