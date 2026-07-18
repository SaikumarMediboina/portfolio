package com.saikumar.assistant.model;

import java.util.List;

public record IngestResponse(
    String mode,
    int documentsRead,
    int chunksIndexed,
    List<String> sources
) {
}
