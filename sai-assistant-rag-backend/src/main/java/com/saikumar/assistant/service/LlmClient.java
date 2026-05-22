package com.saikumar.assistant.service;

import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.List;
import reactor.core.publisher.Mono;

public interface LlmClient {

    Mono<String> answer(ChatRequest request, List<KnowledgeChunk> chunks);
}
