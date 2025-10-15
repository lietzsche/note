package com.stock.bion.back.result;

import com.stock.bion.back.runner.RunScope;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
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
        RunScope scope = request.getScope() == null ? RunScope.SCENARIO : request.getScope();
        TestResult result =
                TestResult.builder()
                        .scope(scope)
                        .serviceId(request.getServiceId())
                        .serviceName(request.getServiceName())
                        .scenarioId(request.getScenarioId())
                        .scenarioTitle(request.getScenarioTitle())
                        .serviceFullRun(request.getServiceFullRun())
                        .status(request.getStatus())
                        .durationMs(request.getDurationMs())
                        .reportUrl(request.getReportUrl())
                        .runId(request.getRunId())
                        .error(request.getError())
                        .stdout(request.getStdout())
                        .stderr(request.getStderr())
                        .report(request.getReport())
                        .httpStatus(request.getHttpStatus())
                        .createdAt(Instant.now(clock))
                        .build();

        TestResult saved = testResultRepository.save(result);
        log.info(
                "Stored test result for run {} with scope {} and status {}",
                saved.getRunId(),
                saved.getScope(),
                saved.getStatus());

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<TestResultResponse> findAll() {
        return testResultRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(this::toResponse)
                .toList();
    }

    private TestResultResponse toResponse(TestResult entity) {
        return TestResultResponse.builder()
                .id(entity.getId())
                .scope(entity.getScope())
                .serviceId(entity.getServiceId())
                .serviceName(entity.getServiceName())
                .scenarioId(entity.getScenarioId())
                .scenarioTitle(entity.getScenarioTitle())
                .serviceFullRun(entity.getServiceFullRun())
                .status(entity.getStatus())
                .durationMs(entity.getDurationMs())
                .reportUrl(entity.getReportUrl())
                .runId(entity.getRunId())
                .error(entity.getError())
                .httpStatus(entity.getHttpStatus())
                .stdout(entity.getStdout())
                .stderr(entity.getStderr())
                .report(entity.getReport())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
