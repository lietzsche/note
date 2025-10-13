package com.stock.bion.back.runner;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

@Service
public class RunService {

    private final WebClient webClient;
    private final Duration timeout;

    public RunService(
            WebClient.Builder webClientBuilder,
            @Value("${runner.url}") String runnerBaseUrl,
            @Value("${runner.timeout:300s}") Duration timeout) {
        this.webClient = webClientBuilder
                .baseUrl(runnerBaseUrl)
                .exchangeStrategies(builder -> builder
                        .codecs(configurer ->
                                configurer.defaultCodecs().maxInMemorySize(16 * 1024 * 1024)) // 16MB로 증가
                        .build())
                .build();
        this.timeout = timeout.isZero() ? Duration.ofSeconds(300) : timeout;
    }

    public ResponseEntity<RunResponse> execute(RunRequest request) {
        try {
            return webClient
                    .post()
                    .uri("/run")
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(request)
                    .exchangeToMono(response ->
                            response
                                    .bodyToMono(RunResponse.class)
                                    .defaultIfEmpty(new RunResponse())
                                    .map(body -> {
                                        if (response.statusCode().isError() && (body.getError() == null || body.getError().isBlank())) {
                                            body.setError(response.statusCode().toString());
                                        }
                                        return ResponseEntity.status(response.statusCode()).body(body);
                                    }))
                    .timeout(timeout)
                    .block(timeout.plusSeconds(5));
        } catch (RuntimeException ex) {
            throw new RunnerClientException("Failed to invoke runner service", ex);
        }
    }
}
