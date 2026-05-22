package com.saikumar.assistant.service;

public interface EmbeddingService {

    float[] embed(String text);

    default float[] embedDocument(String text) {
        return embed(text);
    }

    default float[] embedQuery(String text) {
        return embed(text);
    }
}
