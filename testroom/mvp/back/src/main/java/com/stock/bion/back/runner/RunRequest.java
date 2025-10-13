package com.stock.bion.back.runner;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RunRequest {

    @Builder.Default
    @NotEmpty
    @Valid
    private List<Asset> features = new ArrayList<>();

    @Builder.Default
    @Valid
    private List<Asset> steps = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Asset {

        private String name;

        @NotBlank
        private String content;
    }
}
