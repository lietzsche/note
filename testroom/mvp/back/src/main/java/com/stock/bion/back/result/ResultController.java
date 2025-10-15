package com.stock.bion.back.result;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ResultController {

    private final TestResultService testResultService;

    @GetMapping("/results")
    public List<TestResultResponse> listResults() {
        return testResultService.findAll();
    }

    @PostMapping("/results")
    public ResponseEntity<TestResultResponse> receiveResult(
            @Valid @RequestBody TestResultRequest request) {
        TestResultResponse response = testResultService.saveResult(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
