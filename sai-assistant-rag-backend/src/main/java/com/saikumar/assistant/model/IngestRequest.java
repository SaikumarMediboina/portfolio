package com.saikumar.assistant.model;

import java.util.List;

public record IngestRequest(
    List<String> urls,
    boolean reset
) {
}
