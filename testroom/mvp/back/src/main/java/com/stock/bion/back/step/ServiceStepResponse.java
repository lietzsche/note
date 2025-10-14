package com.stock.bion.back.step;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ServiceStepResponse {
    Long id;
    String name;
    String content;
    Instant createdAt;
    Instant updatedAt;
}

