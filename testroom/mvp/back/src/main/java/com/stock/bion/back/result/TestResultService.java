package com.stock.bion.back.result;

import java.time.Clock;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class TestResultService {

    private final TestResultRepository testResultRepository;
    private final Clock clock;

    @Transactional
    public TestResultResponse saveResult(TestResultRequest request) {
        TestResult result =
                TestResult.builder()
                        .status(request.getStatus())
                        .durationMs(request.getDurationMs())
                        .reportUrl(request.getReportUrl())
                        .runId(request.getRunId())
                        .error(request.getError())
                        .createdAt(Instant.now(clock))
                        .build();

        TestResult saved = testResultRepository.save(result);
        log.info("Stored test result for run {} with status {}", saved.getRunId(), saved.getStatus());

        return toResponse(saved);
    }

    private TestResultResponse toResponse(TestResult entity) {
        return TestResultResponse.builder()
                .id(entity.getId())
                .status(entity.getStatus())
                .durationMs(entity.getDurationMs())
                .reportUrl(entity.getReportUrl())
                .runId(entity.getRunId())
                .error(entity.getError())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
