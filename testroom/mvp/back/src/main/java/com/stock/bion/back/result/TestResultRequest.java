package com.stock.bion.back.result;

import com.stock.bion.back.runner.RunScope;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TestResultRequest {

    @Builder.Default
    RunScope scope = RunScope.SCENARIO;

    Long serviceId;

    String serviceName;

    Long scenarioId;

    String scenarioTitle;

    Boolean serviceFullRun;

    @NotBlank
    String status;

    @NotNull
    @PositiveOrZero
    Long durationMs;

    String reportUrl;

    @NotBlank
    String runId;

    String error;

    Integer httpStatus;

    String stdout;

    String stderr;

    String report;
}
