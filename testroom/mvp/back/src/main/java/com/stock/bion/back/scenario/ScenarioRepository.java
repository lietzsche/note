package com.stock.bion.back.scenario;

import com.stock.bion.back.service.Service;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ScenarioRepository extends JpaRepository<Scenario, Long> {
    List<Scenario> findAllByServiceOrderByUpdatedAtDesc(Service service);
    long countByServiceId(Long serviceId);
}
