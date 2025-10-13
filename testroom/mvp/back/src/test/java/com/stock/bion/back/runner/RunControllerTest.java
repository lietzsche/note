package com.stock.bion.back.runner;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.stock.bion.back.security.JwtAuthenticationFilter;
import com.stock.bion.back.security.JwtTokenProvider;

@WebMvcTest(RunController.class)
@AutoConfigureMockMvc(addFilters = false)
class RunControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private RunService runService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void executeDelegatesToServiceAndReturnsResponse() throws Exception {
        RunResponse runResponse =
                RunResponse.builder()
                        .stdout("Scenario passed")
                        .stderr("")
                        .build();
        when(runService.execute(any(RunRequest.class))).thenReturn(runResponse);

        RunRequest request =
                RunRequest.builder()
                        .features(
                                List.of(
                                        RunRequest.Asset.builder()
                                                .content("Feature: Example")
                                                .build()))
                        .build();

        mockMvc.perform(
                        post("/api/run")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stdout").value("Scenario passed"));

        verify(runService).execute(any(RunRequest.class));
    }
}
