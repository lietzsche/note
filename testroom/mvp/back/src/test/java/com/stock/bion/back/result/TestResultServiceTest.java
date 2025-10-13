package com.stock.bion.back.result;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TestResultServiceTest {

    @Mock
    private TestResultRepository repository;

    private TestResultService service;

    private final Instant fixedInstant = Instant.parse("2025-01-01T00:00:00Z");

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(fixedInstant, ZoneOffset.UTC);
        service = new TestResultService(repository, fixedClock);
    }

    @Test
    void saveResultPersistsEntityAndReturnsResponse() {
        TestResultRequest request =
                TestResultRequest.builder()
                        .status("PASSED")
                        .durationMs(1500L)
                        .reportUrl("http://example/report")
                        .runId("run-123")
                        .error(null)
                        .build();

        TestResult persisted =
                TestResult.builder()
                        .id(42L)
                        .status("PASSED")
                        .durationMs(1500L)
                        .reportUrl("http://example/report")
                        .runId("run-123")
                        .error(null)
                        .createdAt(fixedInstant)
                        .build();

        when(repository.save(any(TestResult.class))).thenReturn(persisted);

        TestResultResponse response = service.saveResult(request);

        ArgumentCaptor<TestResult> captor = ArgumentCaptor.forClass(TestResult.class);
        verify(repository).save(captor.capture());

        TestResult saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo("PASSED");
        assertThat(saved.getDurationMs()).isEqualTo(1500L);
        assertThat(saved.getRunId()).isEqualTo("run-123");
        assertThat(saved.getCreatedAt()).isEqualTo(fixedInstant);

        assertThat(response.getId()).isEqualTo(42L);
        assertThat(response.getStatus()).isEqualTo("PASSED");
        assertThat(response.getCreatedAt()).isEqualTo(fixedInstant);
    }
}
