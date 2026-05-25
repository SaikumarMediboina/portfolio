package com.saikumar.assistant.repository;

import com.saikumar.assistant.model.KnowledgeChunk;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
    public int count() {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM assistant_knowledge_chunks",
            Integer.class
        );
        return count == null ? 0 : count;
    }

    @Override
    public String mode() {
        return "oracle-23ai-vector-search";
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
}
