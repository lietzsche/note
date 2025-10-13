package com.stock.bion.back.scenario;

import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ScenarioService {

    private static final String UNTITLED = "Untitled Scenario";

    private final ScenarioRepository scenarioRepository;

    @Transactional
    public ScenarioResponse create(ScenarioRequest request) {
        Scenario scenario =
                Scenario.builder()
                        .title(resolveTitle(request, UNTITLED))
                        .features(mapAssets(request.getFeatures()))
                        .steps(mapAssets(request.getSteps()))
                        .build();

        Scenario saved = scenarioRepository.save(scenario);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<ScenarioResponse> findAll() {
        return scenarioRepository.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ScenarioResponse findById(Long id) {
        Scenario scenario =
                scenarioRepository
                        .findById(id)
                        .orElseThrow(() -> new ScenarioNotFoundException(id));
        return toResponse(scenario);
    }

    @Transactional
    public ScenarioResponse update(Long id, ScenarioRequest request) {
        Scenario scenario =
                scenarioRepository
                        .findById(id)
                        .orElseThrow(() -> new ScenarioNotFoundException(id));

        scenario.setTitle(resolveTitle(request, scenario.getTitle()));
        scenario.setFeatures(mapAssets(request.getFeatures()));
        scenario.setSteps(mapAssets(request.getSteps()));

        Scenario saved = scenarioRepository.save(scenario);
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long id) {
        if (!scenarioRepository.existsById(id)) {
            throw new ScenarioNotFoundException(id);
        }
        scenarioRepository.deleteById(id);
    }

    private ScenarioResponse toResponse(Scenario scenario) {
        return ScenarioResponse.builder()
                .id(scenario.getId())
                .title(scenario.getTitle())
                .features(
                        scenario.getFeatures().stream()
                                .map(asset -> ScenarioResponse.Asset.builder()
                                        .name(asset.getName())
                                        .content(asset.getContent())
                                        .build())
                                .collect(Collectors.toList()))
                .steps(
                        scenario.getSteps().stream()
                                .map(asset -> ScenarioResponse.Asset.builder()
                                        .name(asset.getName())
                                        .content(asset.getContent())
                                        .build())
                                .collect(Collectors.toList()))
                .createdAt(scenario.getCreatedAt())
                .updatedAt(scenario.getUpdatedAt())
                .build();
    }

    private List<ScenarioAsset> mapAssets(List<ScenarioRequest.Asset> assets) {
        return assets.stream()
                .map(asset -> ScenarioAsset.builder()
                        .name(asset.getName())
                        .content(asset.getContent())
                        .build())
                .collect(Collectors.toList());
    }

    private String resolveTitle(ScenarioRequest request, String fallback) {
        if (StringUtils.hasText(request.getTitle())) {
            return request.getTitle().trim();
        }
        if (!request.getFeatures().isEmpty()
                && StringUtils.hasText(request.getFeatures().get(0).getName())) {
            return request.getFeatures().get(0).getName().trim();
        }
        return fallback;
    }
}
