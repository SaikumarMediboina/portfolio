package com.saikumar.assistant.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "assistant")
public class AssistantProperties {

    private String adminSecret = "";
    private String allowedOrigins = "http://localhost:5173,https://saikumarmediboina.com";
    private int maxQuestionLength = 700;
    private int topK = 5;
    private int chunkSizeChars = 2200;
    private int chunkOverlapChars = 220;
    private List<String> seedUrls = new ArrayList<>();
    private RateLimit rateLimit = new RateLimit();
    private Oracle oracle = new Oracle();
    private Llm llm = new Llm();
    private Embeddings embeddings = new Embeddings();

    public String getAdminSecret() {
        return adminSecret;
    }

    public void setAdminSecret(String adminSecret) {
        this.adminSecret = adminSecret;
    }

    public String getAllowedOrigins() {
        return allowedOrigins;
    }

    public void setAllowedOrigins(String allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    public List<String> getAllowedOriginList() {
        return List.of(allowedOrigins.split(",")).stream()
            .map(String::trim)
            .filter(origin -> !origin.isBlank())
            .toList();
    }

    public int getMaxQuestionLength() {
        return maxQuestionLength;
    }

    public void setMaxQuestionLength(int maxQuestionLength) {
        this.maxQuestionLength = maxQuestionLength;
    }

    public int getTopK() {
        return topK;
    }

    public void setTopK(int topK) {
        this.topK = topK;
    }

    public int getChunkSizeChars() {
        return chunkSizeChars;
    }

    public void setChunkSizeChars(int chunkSizeChars) {
        this.chunkSizeChars = chunkSizeChars;
    }

    public int getChunkOverlapChars() {
        return chunkOverlapChars;
    }

    public void setChunkOverlapChars(int chunkOverlapChars) {
        this.chunkOverlapChars = chunkOverlapChars;
    }

    public List<String> getSeedUrls() {
        return seedUrls;
    }

    public void setSeedUrls(List<String> seedUrls) {
        this.seedUrls = seedUrls;
    }

    public RateLimit getRateLimit() {
        return rateLimit;
    }

    public void setRateLimit(RateLimit rateLimit) {
        this.rateLimit = rateLimit;
    }

    public Oracle getOracle() {
        return oracle;
    }

    public void setOracle(Oracle oracle) {
        this.oracle = oracle;
    }

    public Llm getLlm() {
        return llm;
    }

    public void setLlm(Llm llm) {
        this.llm = llm;
    }

    public Embeddings getEmbeddings() {
        return embeddings;
    }

    public void setEmbeddings(Embeddings embeddings) {
        this.embeddings = embeddings;
    }

    public static class RateLimit {
        private int capacity = 20;
        private int refillPerMinute = 12;

        public int getCapacity() {
            return capacity;
        }

        public void setCapacity(int capacity) {
            this.capacity = capacity;
        }

        public int getRefillPerMinute() {
            return refillPerMinute;
        }

        public void setRefillPerMinute(int refillPerMinute) {
            this.refillPerMinute = refillPerMinute;
        }
    }

    public static class Oracle {
        private String jdbcUrl = "";
        private String username = "";
        private String password = "";

        public String getJdbcUrl() {
            return jdbcUrl;
        }

        public void setJdbcUrl(String jdbcUrl) {
            this.jdbcUrl = jdbcUrl;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    public static class Llm {
        private String provider = "local";
        private String openaiApiKey = "";
        private String geminiApiKey = "";
        private String geminiModel = "gemini-2.5-flash";
        private String groqApiKey = "";
        private String groqModel = "llama-3.1-8b-instant";
        private String groqBaseUrl = "https://api.groq.com/openai/v1";

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }

        public String getOpenaiApiKey() {
            return openaiApiKey;
        }

        public void setOpenaiApiKey(String openaiApiKey) {
            this.openaiApiKey = openaiApiKey;
        }

        public String getGeminiApiKey() {
            return geminiApiKey;
        }

        public void setGeminiApiKey(String geminiApiKey) {
            this.geminiApiKey = geminiApiKey;
        }

        public String getGeminiModel() {
            return geminiModel;
        }

        public void setGeminiModel(String geminiModel) {
            this.geminiModel = geminiModel;
        }

        public String getGroqApiKey() {
            return groqApiKey;
        }

        public void setGroqApiKey(String groqApiKey) {
            this.groqApiKey = groqApiKey;
        }

        public String getGroqModel() {
            return groqModel;
        }

        public void setGroqModel(String groqModel) {
            this.groqModel = groqModel;
        }

        public String getGroqBaseUrl() {
            return groqBaseUrl;
        }

        public void setGroqBaseUrl(String groqBaseUrl) {
            this.groqBaseUrl = groqBaseUrl;
        }
    }

    public static class Embeddings {
        private String provider = "local";
        private int dimension = 64;
        private String geminiModel = "gemini-embedding-001";

        public String getProvider() {
            return provider;
        }

        public void setProvider(String provider) {
            this.provider = provider;
        }

        public int getDimension() {
            return dimension;
        }

        public void setDimension(int dimension) {
            this.dimension = dimension;
        }

        public String getGeminiModel() {
            return geminiModel;
        }

        public void setGeminiModel(String geminiModel) {
            this.geminiModel = geminiModel;
        }
    }
}
