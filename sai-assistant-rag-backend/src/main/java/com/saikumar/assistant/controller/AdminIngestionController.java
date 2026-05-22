package com.saikumar.assistant.controller;

import com.saikumar.assistant.config.AssistantProperties;
import com.saikumar.assistant.model.IngestRequest;
import com.saikumar.assistant.model.IngestResponse;
import com.saikumar.assistant.repository.KnowledgeChunkRepository;
import com.saikumar.assistant.service.IngestionService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

@RestController
@RequestMapping("/api/admin")
public class AdminIngestionController {

    private final AssistantProperties properties;
    private final IngestionService ingestionService;
    private final KnowledgeChunkRepository repository;

    public AdminIngestionController(
        AssistantProperties properties,
        IngestionService ingestionService,
        KnowledgeChunkRepository repository
    ) {
        this.properties = properties;
        this.ingestionService = ingestionService;
        this.repository = repository;
    }

    @PostMapping("/ingest")
    public Mono<ResponseEntity<IngestResponse>> ingest(
        @RequestBody(required = false) IngestRequest request,
        @RequestHeader(value = "X-Admin-Secret", required = false) String adminSecret,
        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        if (!isAuthorized(adminSecret, authorization)) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
        }

        IngestRequest safeRequest = request == null ? new IngestRequest(null, true) : request;
        return Mono.fromCallable(() -> ingestionService.ingest(safeRequest))
            .subscribeOn(Schedulers.boundedElastic())
            .map(ResponseEntity::ok);
    }

    @GetMapping("/index")
    public ResponseEntity<Map<String, Object>> indexStatus(
        @RequestHeader(value = "X-Admin-Secret", required = false) String adminSecret,
        @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        if (!isAuthorized(adminSecret, authorization)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.ok(Map.of(
            "mode", repository.mode(),
            "chunks", repository.count()
        ));
    }

    private boolean isAuthorized(String adminSecret, String authorization) {
        String configuredSecret = properties.getAdminSecret();
        if (configuredSecret == null || configuredSecret.isBlank()) {
            return false;
        }

        String bearer = authorization != null && authorization.startsWith("Bearer ")
            ? authorization.substring("Bearer ".length()).trim()
            : "";

        return configuredSecret.equals(adminSecret) || configuredSecret.equals(bearer);
    }
}
