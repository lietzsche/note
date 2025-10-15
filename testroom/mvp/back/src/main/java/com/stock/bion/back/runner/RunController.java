package com.stock.bion.back.runner;

import com.stock.bion.back.result.TestResultRequest;
import com.stock.bion.back.result.TestResultService;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Validated
@RequiredArgsConstructor
@Slf4j
public class RunController {

    private final RunService runService;
    private final TestResultService testResultService;

    @PostMapping("/run")
    public ResponseEntity<RunResponse> execute(@RequestBody @Valid RunRequest request) {
        Instant startedAt = Instant.now();
        ResponseEntity<RunResponse> response = runService.execute(request);
        RunResponse body = response.getBody();
        long durationMs = Duration.between(startedAt, Instant.now()).toMillis();

        try {
            RunRequest.Metadata metadata = request.getMetadata();
            String scenarioTitle = extractScenarioTitle(metadata, request);

            TestResultRequest.TestResultRequestBuilder builder = TestResultRequest.builder()
                    .scenarioTitle(scenarioTitle)
                    .status(RunStatusResolver.resolveStatus(body))
                    .durationMs(durationMs)
                    .runId(UUID.randomUUID().toString())
                    .error(body != null ? body.getError() : null)
                    .httpStatus(response.getStatusCodeValue())
                    .stdout(body != null ? body.getStdout() : null)
                    .stderr(body != null ? body.getStderr() : null)
                    .report(body != null && body.getReport() != null ? body.getReport().toString() : null);

            if (metadata != null) {
                if (metadata.getScope() != null) {
                    builder.scope(metadata.getScope());
                }
                builder.serviceId(metadata.getServiceId());
                builder.scenarioId(metadata.getScenarioId());
                builder.serviceFullRun(metadata.getServiceFullRun());
            }

            testResultService.saveResult(builder.build());
        } catch (Exception ex) {
            log.warn("Failed to persist run result", ex);
        }

        return response;
    }

    private String extractScenarioTitle(RunRequest.Metadata metadata, RunRequest request) {
        if (metadata != null && metadata.getScenarioTitle() != null && !metadata.getScenarioTitle().isBlank()) {
            return metadata.getScenarioTitle();
        }
        if (!request.getFeatures().isEmpty()) {
            String name = request.getFeatures().get(0).getName();
            if (name != null && !name.isBlank()) {
                return name;
            }
        }
        return null;
    }
}
