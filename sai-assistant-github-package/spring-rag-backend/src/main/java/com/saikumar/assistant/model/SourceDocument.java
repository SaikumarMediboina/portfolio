package com.saikumar.assistant.model;

import java.util.Map;

public record SourceDocument(
    String sourceUrl,
    String title,
    String text,
    Map<String, String> metadata
) {
}
