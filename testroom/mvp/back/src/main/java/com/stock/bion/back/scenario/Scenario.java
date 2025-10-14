package com.stock.bion.back.scenario;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "scenarios")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Scenario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "scenario_features", joinColumns = @JoinColumn(name = "scenario_id"))
    @OrderColumn(name = "position")
    private List<ScenarioAsset> features = new ArrayList<>();

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "scenario_steps", joinColumns = @JoinColumn(name = "scenario_id"))
    @OrderColumn(name = "position")
    private List<ScenarioAsset> steps = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private com.stock.bion.back.service.Service service;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public void setTitle(String title) {
        this.title = title;
    }

    public void setFeatures(List<ScenarioAsset> features) {
        if (this.features == null) {
            this.features = new ArrayList<>();
        } else {
            this.features.clear();
        }
        this.features.addAll(features);
    }

    public void setSteps(List<ScenarioAsset> steps) {
        if (this.steps == null) {
            this.steps = new ArrayList<>();
        } else {
            this.steps.clear();
        }
        this.steps.addAll(steps);
    }

    public void setService(com.stock.bion.back.service.Service service) {
        this.service = service;
    }

    @PrePersist
    void onPersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
