package com.stock.bion.back.result;

import com.stock.bion.back.runner.RunScope;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RunScope scope;

    @Column(name = "service_id")
    private Long serviceId;

    private String serviceName;

    @Column(name = "scenario_id")
    private Long scenarioId;

    private String scenarioTitle;

    @Column(name = "service_full_run")
    private Boolean serviceFullRun;

    @Column(nullable = false)
    private String status;

    @Column(name = "duration_ms")
    private Long durationMs;

    private String reportUrl;

    @Column(name = "run_id", nullable = false, unique = true)
    private String runId;

    @Column(length = 2000)
    private String error;

    @Lob
    private String stdout;

    @Lob
    private String stderr;

    @Lob
    private String report;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
