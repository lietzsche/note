package com.stock.bion.back.runner;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class RunServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockWebServer mockWebServer;
    private RunService runService;

    @BeforeEach
    void setUp() throws IOException {
        mockWebServer = new MockWebServer();
        mockWebServer.start();
        String baseUrl = mockWebServer.url("/").toString();
        runService = new RunService(WebClient.builder(), baseUrl, Duration.ofSeconds(5));
    }

    @AfterEach
    void tearDown() throws IOException {
        mockWebServer.shutdown();
    }

    @Test
    void executeSendsPayloadAndParsesResponse() throws Exception {
        mockWebServer.enqueue(
                new MockResponse()
                        .setHeader("Content-Type", "application/json")
                        .setBody(
                                """
                                    {
                                      "stdout": "Scenario passed",
                                      "stderr": "",
                                      "report": { "passed": true }
                                    }
                                    """));

        RunRequest request =
                RunRequest.builder()
                        .features(
                                List.of(
                                        RunRequest.Asset.builder()
                                                .name("login.feature")
                                                .content("Feature: Login")
                                                .build()))
                        .steps(
                                List.of(
                                        RunRequest.Asset.builder()
                                                .name("steps.ts")
                                                .content("Given('user logs in', () => {})")
                                                .build()))
                        .build();

        RunResponse response = runService.execute(request);

        assertThat(response.getStdout()).contains("Scenario passed");

        RecordedRequest recordedRequest = mockWebServer.takeRequest();
        assertThat(recordedRequest.getMethod()).isEqualTo("POST");
        assertThat(recordedRequest.getPath()).isEqualTo("/run");

        JsonNode body = objectMapper.readTree(recordedRequest.getBody().readUtf8());
        assertThat(body.get("features").size()).isEqualTo(1);
        assertThat(body.get("steps").size()).isEqualTo(1);
        assertThat(body.get("features").get(0).get("content").asText()).isEqualTo("Feature: Login");
    }
}
