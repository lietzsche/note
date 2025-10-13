package com.stock.bion.back.result;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TestResultResponse {

    Long id;
    String status;
    Long durationMs;
    String reportUrl;
    String runId;
    String error;
    Instant createdAt;
}
