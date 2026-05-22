package com.saikumar.assistant.service;

import com.saikumar.assistant.config.AssistantProperties;
import com.saikumar.assistant.model.IngestRequest;
import com.saikumar.assistant.model.IngestResponse;
import com.saikumar.assistant.model.KnowledgeChunk;
import com.saikumar.assistant.model.SourceDocument;
import com.saikumar.assistant.repository.KnowledgeChunkRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class IngestionService {

    private final AssistantProperties properties;
    private final SourceDocumentLoader sourceDocumentLoader;
    private final DocumentChunker documentChunker;
    private final EmbeddingService embeddingService;
    private final KnowledgeChunkRepository repository;

    public IngestionService(
        AssistantProperties properties,
        SourceDocumentLoader sourceDocumentLoader,
        DocumentChunker documentChunker,
        EmbeddingService embeddingService,
        KnowledgeChunkRepository repository
    ) {
        this.properties = properties;
        this.sourceDocumentLoader = sourceDocumentLoader;
        this.documentChunker = documentChunker;
        this.embeddingService = embeddingService;
        this.repository = repository;
    }

    public IngestResponse ingest(IngestRequest request) {
        List<String> urls = request != null && request.urls() != null && !request.urls().isEmpty()
            ? request.urls()
            : properties.getSeedUrls();

        List<SourceDocument> documents = new ArrayList<>();

        if (urls == null || urls.isEmpty()) {
            documents.addAll(sourceDocumentLoader.fallbackSeedDocuments());
        } else {
            urls.forEach(url -> documents.add(sourceDocumentLoader.load(url)));
        }

        if (documents.stream().allMatch(document -> "fallback".equals(document.metadata().get("loader")))) {
            documents.addAll(sourceDocumentLoader.fallbackSeedDocuments());
        }

        List<KnowledgeChunk> chunks = new ArrayList<>();
        for (SourceDocument document : documents) {
            List<String> chunkTexts = documentChunker.split(document.text());
            for (int index = 0; index < chunkTexts.size(); index++) {
                String chunkText = chunkTexts.get(index);
                chunks.add(new KnowledgeChunk(
                    stableId(document.sourceUrl(), index, chunkText),
                    document.sourceUrl(),
                    document.title(),
                    chunkText,
                    embeddingService.embed(chunkText),
                    Map.of(
                        "chunkIndex", String.valueOf(index),
                        "loader", document.metadata().getOrDefault("loader", "unknown")
                    ),
                    Instant.now()
                ));
            }
        }

        if (request == null || request.reset()) {
            repository.deleteAll();
        }

        repository.saveAll(chunks);

        return new IngestResponse(
            repository.mode(),
            documents.size(),
            chunks.size(),
            documents.stream().map(SourceDocument::sourceUrl).distinct().toList()
        );
    }

    private String stableId(String sourceUrl, int chunkIndex, String chunkText) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((sourceUrl + "|" + chunkIndex + "|" + chunkText)
                .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 32);
        } catch (NoSuchAlgorithmException exception) {
            return Integer.toHexString((sourceUrl + chunkIndex + chunkText).hashCode());
        }
    }
}
