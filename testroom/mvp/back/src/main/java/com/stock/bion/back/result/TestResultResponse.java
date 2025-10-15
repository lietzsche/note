package com.stock.bion.back.result;

import com.stock.bion.back.runner.RunScope;
import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TestResultResponse {

    Long id;
    RunScope scope;
    Long serviceId;
    String serviceName;
    Long scenarioId;
    String scenarioTitle;
    Boolean serviceFullRun;
    String status;
    Long durationMs;
    String reportUrl;
    String runId;
    String error;
    Integer httpStatus;
    String stdout;
    String stderr;
    String report;
    Instant createdAt;
}
