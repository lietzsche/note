package com.stock.bion.back.scenario;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scenarios")
@Validated
@RequiredArgsConstructor
public class ScenarioController {

    private final ScenarioService scenarioService;

    @GetMapping
    public List<ScenarioResponse> findAll() {
        return scenarioService.findAll();
    }

    @GetMapping("/{id}")
    public ScenarioResponse findById(@PathVariable Long id) {
        return scenarioService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ScenarioResponse create(@Valid @RequestBody ScenarioRequest request) {
        return scenarioService.create(request);
    }

    @PutMapping("/{id}")
    public ScenarioResponse update(
            @PathVariable Long id, @Valid @RequestBody ScenarioRequest request) {
        return scenarioService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        scenarioService.delete(id);
    }

    @ExceptionHandler(ScenarioNotFoundException.class)
    public ResponseEntity<Void> handleNotFound() {
        return ResponseEntity.notFound().build();
    }
}
