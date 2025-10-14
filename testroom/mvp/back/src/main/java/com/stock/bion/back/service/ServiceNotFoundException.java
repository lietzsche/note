package com.stock.bion.back.service;

public class ServiceNotFoundException extends RuntimeException {
    public ServiceNotFoundException(Long id) {
        super("Service not found: " + id);
    }
}

