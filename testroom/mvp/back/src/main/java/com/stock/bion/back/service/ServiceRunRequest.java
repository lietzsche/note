package com.stock.bion.back.service;

import com.stock.bion.back.runner.RunRequest;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceRunRequest {
    private List<RunRequest.Asset> features;
    private RunRequest.Metadata metadata;
}

