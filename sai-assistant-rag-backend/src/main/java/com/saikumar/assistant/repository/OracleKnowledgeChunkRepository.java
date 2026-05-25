package com.saikumar.assistant.repository;

import com.saikumar.assistant.model.KnowledgeChunk;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@Profile("oracle")
public class OracleKnowledgeChunkRepository implements KnowledgeChunkRepository {

    private final JdbcTemplate jdbcTemplate;

    public OracleKnowledgeChunkRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void deleteAll() {
        jdbcTemplate.update("DELETE FROM assistant_knowledge_chunks");
    }

    @Override
    public void saveAll(List<KnowledgeChunk> chunks) {
        String sql = """
            INSERT INTO assistant_knowledge_chunks
              (id, source_url, title, chunk_text, vector_embedding, metadata_json, indexed_at)
            VALUES (?, ?, ?, ?, TO_VECTOR(?), ?, SYSTIMESTAMP)
            """;

        jdbcTemplate.batchUpdate(
            sql,
            chunks,
            100,
            (preparedStatement, chunk) -> {
                preparedStatement.setString(1, chunk.id());
                preparedStatement.setString(2, chunk.sourceUrl());
                preparedStatement.setString(3, chunk.title());
                preparedStatement.setString(4, chunk.chunkText());
                preparedStatement.setString(5, toVectorLiteral(chunk.embedding()));
                preparedStatement.setString(6, toMetadataJson(chunk.metadata()));
            }
        );
    }

    @Override
    public List<KnowledgeChunk> findNearest(float[] queryEmbedding, int limit) {
        String sql = """
            SELECT
              id,
              source_url,
              title,
              chunk_text,
              metadata_json,
              indexed_at,
              VECTOR_DISTANCE(vector_embedding, TO_VECTOR(?), COSINE) AS vector_distance
            FROM assistant_knowledge_chunks
            ORDER BY vector_distance
            FETCH FIRST ? ROWS ONLY
            """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> mapChunk(rs), toVectorLiteral(queryEmbedding), limit);
    }

    @Override
    public List<KnowledgeChunk> findExact(List<String> terms, int limit) {
        List<String> normalizedTerms = normalizeTerms(terms);
        if (normalizedTerms.isEmpty()) {
            return List.of();
        }

        String scoreExpression = String.join(
            " + ",
            normalizedTerms.stream()
                .map(term -> """
                    CASE WHEN LOWER(title) LIKE ? THEN 12 ELSE 0 END +
                    CASE WHEN LOWER(source_url) LIKE ? THEN 5 ELSE 0 END +
                    CASE WHEN LOWER(DBMS_LOB.SUBSTR(metadata_json, 4000, 1)) LIKE ? THEN 4 ELSE 0 END +
                    CASE WHEN LOWER(DBMS_LOB.SUBSTR(chunk_text, 4000, 1)) LIKE ? THEN 3 ELSE 0 END
                    """)
                .toList()
        );

        String sql = """
            SELECT
              id,
              source_url,
              title,
              chunk_text,
              metadata_json,
              indexed_at,
              CAST(NULL AS NUMBER) AS vector_distance
            FROM (
              SELECT
                id,
                source_url,
                title,
                chunk_text,
                metadata_json,
                indexed_at,
                (%s) AS exact_score
              FROM assistant_knowledge_chunks
            )
            WHERE exact_score > 0
            ORDER BY exact_score DESC, indexed_at DESC
            FETCH FIRST ? ROWS ONLY
            """.formatted(scoreExpression);

        List<Object> params = new ArrayList<>();
        for (String term : normalizedTerms) {
            String pattern = "%" + term + "%";
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }
        params.add(limit);

        return jdbcTemplate.query(sql, (rs, rowNum) -> mapChunk(rs), params.toArray());
    }

    @Override
    public int count() {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM assistant_knowledge_chunks",
            Integer.class
        );
        return count == null ? 0 : count;
    }

    @Override
    public String mode() {
        return "oracle-23ai-hybrid-search";
    }

    private KnowledgeChunk mapChunk(ResultSet rs) throws SQLException {
        return new KnowledgeChunk(
            rs.getString("id"),
            rs.getString("source_url"),
            rs.getString("title"),
            rs.getString("chunk_text"),
            new float[0],
            Map.of("metadataJson", rs.getString("metadata_json")),
            rs.getTimestamp("indexed_at").toInstant(),
            nullableDouble(rs, "vector_distance")
        );
    }

    private Double nullableDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    private String toVectorLiteral(float[] vector) {
        StringBuilder builder = new StringBuilder("[");
        for (int index = 0; index < vector.length; index++) {
            if (index > 0) {
                builder.append(',');
            }
            builder.append(vector[index]);
        }
        return builder.append(']').toString();
    }

    private String toMetadataJson(Map<String, String> metadata) {
        StringBuilder builder = new StringBuilder("{");
        int index = 0;
        for (Map.Entry<String, String> entry : metadata.entrySet()) {
            if (index++ > 0) {
                builder.append(',');
            }
            builder
                .append('"')
                .append(escapeJson(entry.getKey()))
                .append("\":\"")
                .append(escapeJson(entry.getValue()))
                .append('"');
        }
        return builder.append('}').toString();
    }

    private String escapeJson(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private List<String> normalizeTerms(List<String> terms) {
        Set<String> normalizedTerms = new LinkedHashSet<>();
        for (String term : terms) {
            String normalized = term == null
                ? ""
                : term.toLowerCase(Locale.ROOT)
                    .replaceAll("[^a-z0-9+#.:/@-]+", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
            if (normalized.length() >= 3) {
                normalizedTerms.add(normalized);
            }
        }
        return normalizedTerms.stream().limit(12).toList();
    }
}
