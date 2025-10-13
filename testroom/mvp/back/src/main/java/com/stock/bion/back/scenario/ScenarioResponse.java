package com.stock.bion.back.scenario;

import java.time.Instant;
import java.util.List;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ScenarioResponse {

    Long id;
    String title;
    List<Asset> features;
    List<Asset> steps;
    Instant createdAt;
    Instant updatedAt;

    @Value
    @Builder
    public static class Asset {

        String name;
        String content;
    }
}
