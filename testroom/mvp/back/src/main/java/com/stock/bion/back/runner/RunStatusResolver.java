package com.stock.bion.back.runner;

import com.fasterxml.jackson.databind.JsonNode;

public final class RunStatusResolver {

    private RunStatusResolver() {}

    public static String resolveStatus(RunResponse response) {
        if (response == null) {
            return "FAILED";
        }

        if (hasText(response.getError())) {
            return "FAILED";
        }

        JsonNode report = response.getReport();
        if (report != null && report.isArray()) {
            boolean anyUndefined = false;
            for (JsonNode feature : report) {
                JsonNode elements = feature.path("elements");
                if (!elements.isArray()) {
                    continue;
                }
                for (JsonNode scenario : elements) {
                    boolean scenarioFailed = inspectSteps(scenario.path("steps"));
                    if (scenarioFailed) {
                        return "FAILED";
                    }
                    if (inspectHooks(scenario.path("before")) || inspectHooks(scenario.path("after"))) {
                        return "FAILED";
                    }
                    anyUndefined = anyUndefined || hasUndefinedStep(scenario.path("steps"));
                }
            }
            if (anyUndefined) {
                return "UNDEFINED";
            }
            return "PASSED";
        }

        return "COMPLETED";
    }

    private static boolean inspectSteps(JsonNode steps) {
        if (!steps.isArray()) {
            return false;
        }
        for (JsonNode step : steps) {
            String status = step.path("result").path("status").asText("");
            if ("failed".equalsIgnoreCase(status)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasUndefinedStep(JsonNode steps) {
        if (!steps.isArray()) {
            return false;
        }
        for (JsonNode step : steps) {
            String status = step.path("result").path("status").asText("");
            if ("undefined".equalsIgnoreCase(status) || "pending".equalsIgnoreCase(status)) {
                return true;
            }
        }
        return false;
    }

    private static boolean inspectHooks(JsonNode hooks) {
        if (!hooks.isArray()) {
            return false;
        }
        for (JsonNode hook : hooks) {
            String status = hook.path("result").path("status").asText("");
            if ("failed".equalsIgnoreCase(status)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}

