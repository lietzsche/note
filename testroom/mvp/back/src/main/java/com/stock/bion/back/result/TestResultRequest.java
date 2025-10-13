package com.stock.bion.back.result;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TestResultRequest {

    @NotBlank
    String status;

    @NotNull
    @PositiveOrZero
    Long durationMs;

    String reportUrl;

    @NotBlank
    String runId;

    String error;
}
