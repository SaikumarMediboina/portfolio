package com.saikumar.assistant.controller;

import com.saikumar.assistant.model.ChatRequest;
import com.saikumar.assistant.model.ChatResponse;
import com.saikumar.assistant.model.ChatStreamEvent;
import com.saikumar.assistant.service.ChatService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping
    public Mono<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        return chatService.answer(request);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<ChatStreamEvent>> stream(@Valid @RequestBody ChatRequest request) {
        return chatService.stream(request)
            .map(event -> ServerSentEvent.builder(event).event(event.type()).build());
    }
}
