package com.stock.bion.back.service;

import com.stock.bion.back.scenario.Scenario;
import com.stock.bion.back.scenario.ScenarioRepository;
import com.stock.bion.back.scenario.ScenarioRequest;
import com.stock.bion.back.scenario.ScenarioResponse;
import com.stock.bion.back.runner.RunRequest;
import com.stock.bion.back.runner.RunResponse;
import com.stock.bion.back.runner.RunService;
import com.stock.bion.back.step.ServiceStep;
import com.stock.bion.back.step.ServiceStepRepository;
import com.stock.bion.back.step.ServiceStepRequest;
import com.stock.bion.back.step.ServiceStepResponse;
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
    private final ServiceStepRepository stepRepository;
    private final RunService runService;

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

    @PutMapping("/{id}/scenarios/{scenarioId}")
    public ScenarioResponse updateScenario(
            @PathVariable Long id,
            @PathVariable Long scenarioId,
            @RequestBody @Valid ScenarioRequest request) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        Scenario scenario = scenarioRepository.findById(scenarioId)
                .orElseThrow(() -> new com.stock.bion.back.scenario.ScenarioNotFoundException(scenarioId));
        if (scenario.getService() == null || !scenario.getService().getId().equals(svc.getId())) {
            throw new com.stock.bion.back.scenario.ScenarioNotFoundException(scenarioId);
        }

        scenario.setTitle(request.getTitle() == null || request.getTitle().isBlank()
                ? scenario.getTitle()
                : request.getTitle().trim());
        scenario.setFeatures(request.getFeatures().stream()
                .map(a -> new com.stock.bion.back.scenario.ScenarioAsset(a.getName(), a.getContent()))
                .collect(java.util.stream.Collectors.toList()));
        // Steps are managed at service-level; allow but overwrite to provided (often empty)
        scenario.setSteps(request.getSteps().stream()
                .map(a -> new com.stock.bion.back.scenario.ScenarioAsset(a.getName(), a.getContent()))
                .collect(java.util.stream.Collectors.toList()));

        Scenario saved = scenarioRepository.save(scenario);
        return toScenarioResponse(saved);
    }

    @PostMapping("/{id}/run")
    public ResponseEntity<RunResponse> runAllSteps(
            @PathVariable Long id,
            @RequestBody(required = false) ServiceRunRequest request
    ) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        // Load scenarios once (for features fallback and legacy steps fallback)
        var scenarios = scenarioRepository.findAllByServiceOrderByUpdatedAtDesc(svc);

        // Prefer Service-level step library if present; otherwise fallback to scenarios' steps
        var serviceSteps = stepRepository.findAllByServiceOrderByUpdatedAtDesc(svc);
        java.util.List<RunRequest.Asset> allSteps;
        if (!serviceSteps.isEmpty()) {
            var stepIndex = new java.util.LinkedHashMap<String, RunRequest.Asset>();
            serviceSteps.forEach(s -> {
                String content = s.getContent() == null ? "" : s.getContent().trim();
                String key = Integer.toHexString(content.hashCode());
                stepIndex.putIfAbsent(key, RunRequest.Asset.builder().name(s.getName()).content(s.getContent()).build());
            });
            allSteps = new java.util.ArrayList<>(stepIndex.values());
        } else {
            var stepIndex = new java.util.LinkedHashMap<String, RunRequest.Asset>();
            scenarios.stream()
                    .flatMap(sc -> sc.getSteps().stream())
                    .forEach(a -> {
                        String content = a.getContent() == null ? "" : a.getContent().trim();
                        String key = Integer.toHexString(content.hashCode());
                        stepIndex.putIfAbsent(key, RunRequest.Asset.builder().name(a.getName()).content(a.getContent()).build());
                    });
            allSteps = new java.util.ArrayList<>(stepIndex.values());
        }

        // Features policy:
        // - If request contains features -> use exactly those (single scenario run).
        // - Else -> use all features from this service (run all scenarios).
        java.util.List<RunRequest.Asset> features;
        if (request != null && request.getFeatures() != null && !request.getFeatures().isEmpty()) {
            features = request.getFeatures();
        } else {
            features = scenarios.stream()
                    .flatMap(sc -> sc.getFeatures().stream())
                    .map(a -> RunRequest.Asset.builder().name(a.getName()).content(a.getContent()).build())
                    .toList();
        }

        RunRequest merged = RunRequest.builder()
                .features(features)
                .steps(allSteps)
                .build();

        return runService.execute(merged);
    }

    // Step Library CRUD
    @GetMapping("/{id}/steps")
    public java.util.List<ServiceStepResponse> listSteps(@PathVariable Long id) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        return stepRepository.findAllByServiceOrderByUpdatedAtDesc(svc).stream()
                .map(this::toStepResponse)
                .toList();
    }

    @PostMapping("/{id}/steps")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceStepResponse createStep(@PathVariable Long id, @RequestBody @Valid ServiceStepRequest request) {
        Service svc = serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        ServiceStep saved = stepRepository.save(ServiceStep.builder()
                .service(svc)
                .name(request.getName())
                .content(request.getContent())
                .build());
        return toStepResponse(saved);
    }

    @PutMapping("/{id}/steps/{stepId}")
    public ServiceStepResponse updateStep(@PathVariable Long id, @PathVariable Long stepId, @RequestBody @Valid ServiceStepRequest request) {
        serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        ServiceStep step = stepRepository.findById(stepId).orElseThrow(() -> new IllegalArgumentException("Step not found: " + stepId));
        step.setName(request.getName());
        step.setContent(request.getContent());
        return toStepResponse(stepRepository.save(step));
    }

    @DeleteMapping("/{id}/steps/{stepId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStep(@PathVariable Long id, @PathVariable Long stepId) {
        serviceRepository.findById(id).orElseThrow(() -> new ServiceNotFoundException(id));
        if (!stepRepository.existsById(stepId)) {
            throw new IllegalArgumentException("Step not found: " + stepId);
        }
        stepRepository.deleteById(stepId);
    }

    private ServiceStepResponse toStepResponse(ServiceStep step) {
        return ServiceStepResponse.builder()
                .id(step.getId())
                .name(step.getName())
                .content(step.getContent())
                .createdAt(step.getCreatedAt())
                .updatedAt(step.getUpdatedAt())
                .build();
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

