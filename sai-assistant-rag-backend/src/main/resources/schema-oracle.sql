CREATE TABLE assistant_knowledge_chunks (
  id VARCHAR2(128) PRIMARY KEY,
  source_url VARCHAR2(1000),
  title VARCHAR2(500),
  chunk_text CLOB NOT NULL,
  vector_embedding VECTOR,
  metadata_json CLOB,
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP
);

CREATE VECTOR INDEX assistant_chunks_vec_idx
  ON assistant_knowledge_chunks (vector_embedding)
  ORGANIZATION NEIGHBOR PARTITIONS
  DISTANCE COSINE;

CREATE INDEX assistant_chunks_source_idx
  ON assistant_knowledge_chunks (source_url);
