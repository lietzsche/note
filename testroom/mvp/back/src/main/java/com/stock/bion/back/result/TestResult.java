package com.stock.bion.back.result;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "test_results")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String status;

    @Column(name = "duration_ms")
    private Long durationMs;

    private String reportUrl;

    @Column(name = "run_id")
    private String runId;

    @Column(length = 2000)
    private String error;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
