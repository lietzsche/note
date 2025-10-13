package com.stock.bion.back.runner;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Validated
@RequiredArgsConstructor
public class RunController {

    private final RunService runService;

    @PostMapping("/run")
    public ResponseEntity<RunResponse> execute(@RequestBody @Valid RunRequest request) {
        RunResponse response = runService.execute(request);
        return new ResponseEntity<>(response, HttpStatus.OK);
    }
}
