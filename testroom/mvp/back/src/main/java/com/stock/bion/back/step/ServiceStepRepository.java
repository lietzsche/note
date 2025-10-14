package com.stock.bion.back.step;

import com.stock.bion.back.service.Service;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceStepRepository extends JpaRepository<ServiceStep, Long> {
    List<ServiceStep> findAllByServiceOrderByUpdatedAtDesc(Service service);
    long countByServiceId(Long serviceId);
}

