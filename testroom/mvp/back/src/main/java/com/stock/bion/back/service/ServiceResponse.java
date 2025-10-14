package com.stock.bion.back.service;

import java.time.Instant;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ServiceResponse {
    Long id;
    String name;
    String description;
    Instant createdAt;
    Instant updatedAt;
    long scenarioCount;
}

