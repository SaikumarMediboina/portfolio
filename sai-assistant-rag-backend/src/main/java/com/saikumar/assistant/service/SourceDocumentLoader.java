package com.saikumar.assistant.service;

import com.saikumar.assistant.model.SourceDocument;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Service
public class SourceDocumentLoader {

    private final WebClient webClient = WebClient.builder()
        .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(2 * 1024 * 1024))
        .build();

    public SourceDocument load(String url) {
        String html = webClient.get()
            .uri(url)
            .retrieve()
            .bodyToMono(String.class)
            .timeout(Duration.ofSeconds(10))
            .onErrorResume(error -> Mono.just(""))
            .block(Duration.ofSeconds(12));

        if (html == null || html.isBlank()) {
            return fallbackDocument(url);
        }

        Document document = Jsoup.parse(html, url);
        document.select("script,style,noscript,svg,nav,footer").remove();

        String title = document.title().isBlank() ? url : document.title();
        String text = document.body() == null ? "" : document.body().text();

        if (text.isBlank()) {
            return fallbackDocument(url);
        }

        return new SourceDocument(url, title, text, Map.of("loader", "jsoup"));
    }

    public List<SourceDocument> fallbackSeedDocuments() {
        return List.of(
            new SourceDocument(
                "local://profile",
                "Sai Kumar Mediboina profile",
                "Sai Kumar Mediboina is a Software Application Engineer at Oracle. He focuses on Java, Spring Boot, backend systems, search architecture, Oracle Text, OpenSearch, OCI, Kubernetes, performance optimization, semantic search, and LLM-assisted workflow ideas.",
                Map.of("loader", "local-seed")
            ),
            new SourceDocument(
                "local://projects",
                "Sai's backend projects",
                "Selected projects include Matching and Scoring Engine, OpenSearch to Oracle Text migration, high-volume batch processing, real-time screening optimization, narrative text extraction, and advanced hybrid scoring. These projects involve Spring Boot APIs, Oracle database work, search systems, parallel processing, and AI relevance.",
                Map.of("loader", "local-seed")
            ),
            new SourceDocument(
                "local://assistant",
                "Sai's Assistant RAG architecture",
                "Sai's Assistant is designed as a RAG-ready system. The offline pipeline ingests website content, chunks it with metadata, creates embeddings, and stores vectors. The online pipeline handles chat requests, retrieves relevant chunks, builds a grounded prompt, calls an LLM, and returns cited answers with useful actions.",
                Map.of("loader", "local-seed")
            )
        );
    }

    private SourceDocument fallbackDocument(String url) {
        return new SourceDocument(
            url,
            "Fallback source for " + url,
            "This source could not be fetched right now. Keep the URL in the ingestion plan and retry when network access is available.",
            Map.of("loader", "fallback")
        );
    }
}
