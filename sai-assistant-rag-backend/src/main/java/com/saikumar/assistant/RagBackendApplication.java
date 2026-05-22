package com.saikumar.assistant;

import com.saikumar.assistant.config.AssistantProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AssistantProperties.class)
public class RagBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(RagBackendApplication.class, args);
    }
}
