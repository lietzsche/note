package com.stock.bion.back.scenario;

public class ScenarioNotFoundException extends RuntimeException {

    public ScenarioNotFoundException(Long id) {
        super("Scenario not found: " + id);
    }
}
