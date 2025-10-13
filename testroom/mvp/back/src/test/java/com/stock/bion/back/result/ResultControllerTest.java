package com.stock.bion.back.result;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.stock.bion.back.security.JwtAuthenticationFilter;
import com.stock.bion.back.security.JwtTokenProvider;

@WebMvcTest(ResultController.class)
@AutoConfigureMockMvc(addFilters = false)
class ResultControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TestResultService testResultService;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void receiveResultReturnsCreatedAndDelegatesToService() throws Exception {
        TestResultResponse response =
                TestResultResponse.builder()
                        .id(5L)
                        .status("PASSED")
                        .durationMs(2000L)
                        .reportUrl("http://example/report.json")
                        .runId("run-42")
                        .error(null)
                        .createdAt(Instant.parse("2025-01-01T00:00:00Z"))
                        .build();

        when(testResultService.saveResult(any(TestResultRequest.class))).thenReturn(response);

        TestResultRequest request =
                TestResultRequest.builder()
                        .status("PASSED")
                        .durationMs(2000L)
                        .reportUrl("http://example/report.json")
                        .runId("run-42")
                        .error(null)
                        .build();

        mockMvc.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5L))
                .andExpect(jsonPath("$.status").value("PASSED"))
                .andExpect(jsonPath("$.reportUrl").value("http://example/report.json"));

        verify(testResultService).saveResult(any(TestResultRequest.class));
    }

    @Test
    void receiveResultReturnsBadRequestWhenMandatoryFieldsMissing() throws Exception {
        String invalidPayload =
                """
                {
                  "durationMs": 1000,
                  "reportUrl": "http://example/report.json",
                  "error": "failure"
                }
                """;

        mockMvc.perform(
                        post("/api/results")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(invalidPayload))
                .andExpect(status().isBadRequest());
    }
}
