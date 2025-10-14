package com.stock.bion.back.service;

import com.stock.bion.back.scenario.Scenario;
import com.stock.bion.back.scenario.ScenarioRepository;
import com.stock.bion.back.scenario.ScenarioRequest;
import com.stock.bion.back.scenario.ScenarioResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/services")
@Validated
@RequiredArgsConstructor
public class ServiceController {

    private final ServiceRepository serviceRepository;
    private final ScenarioRepository scenarioRepository;

    @GetMapping
    public List<ServiceResponse> findAll() {
        return serviceRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(this::toResponseWithCount)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ServiceResponse findById(@PathVariable Long id) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        return toResponseWithCount(svc);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceResponse create(@RequestBody @Valid ServiceRequest request) {
        if (serviceRepository.existsByNameIgnoreCase(request.getName())) {
            throw new IllegalArgumentException("Service name already exists");
        }
        Service saved = serviceRepository.save(Service.builder()
                .name(request.getName().trim())
                .description(request.getDescription())
                .build());
        return toResponseWithCount(saved);
    }

    @PutMapping("/{id}")
    public ServiceResponse update(@PathVariable Long id, @RequestBody @Valid ServiceRequest request) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        svc.setName(request.getName().trim());
        svc.setDescription(request.getDescription());
        Service saved = serviceRepository.save(svc);
        return toResponseWithCount(saved);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        if (!serviceRepository.existsById(id)) {
            throw new ServiceNotFoundException(id);
        }
        serviceRepository.deleteById(id);
    }

    @GetMapping("/{id}/scenarios")
    public List<ScenarioResponse> listScenarios(@PathVariable Long id) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        return scenarioRepository.findAllByServiceOrderByUpdatedAtDesc(svc).stream()
                .map(this::toScenarioResponse)
                .collect(Collectors.toList());
    }

    @PostMapping("/{id}/scenarios")
    @ResponseStatus(HttpStatus.CREATED)
    public ScenarioResponse createScenario(@PathVariable Long id, @RequestBody @Valid ScenarioRequest request) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        Scenario scenario = Scenario.builder()
                .title(request.getTitle() == null || request.getTitle().isBlank() ? "Untitled Scenario" : request.getTitle().trim())
                .features(request.getFeatures().stream().map(a -> new com.stock.bion.back.scenario.ScenarioAsset(a.getName(), a.getContent())).collect(Collectors.toList()))
                .steps(request.getSteps().stream().map(a -> new com.stock.bion.back.scenario.ScenarioAsset(a.getName(), a.getContent())).collect(Collectors.toList()))
                .build();
        scenario.setService(svc);
        Scenario saved = scenarioRepository.save(scenario);
        return toScenarioResponse(saved);
    }

    private ServiceResponse toResponseWithCount(Service svc) {
        long count = scenarioRepository.countByServiceId(svc.getId());
        return ServiceResponse.builder()
                .id(svc.getId())
                .name(svc.getName())
                .description(svc.getDescription())
                .createdAt(svc.getCreatedAt())
                .updatedAt(svc.getUpdatedAt())
                .scenarioCount(count)
                .build();
    }

    private ScenarioResponse toScenarioResponse(Scenario scenario) {
        return ScenarioResponse.builder()
                .id(scenario.getId())
                .title(scenario.getTitle())
                .features(scenario.getFeatures().stream().map(a -> ScenarioResponse.Asset.builder().name(a.getName()).content(a.getContent()).build()).collect(Collectors.toList()))
                .steps(scenario.getSteps().stream().map(a -> ScenarioResponse.Asset.builder().name(a.getName()).content(a.getContent()).build()).collect(Collectors.toList()))
                .createdAt(scenario.getCreatedAt())
                .updatedAt(scenario.getUpdatedAt())
                .build();
    }
}

