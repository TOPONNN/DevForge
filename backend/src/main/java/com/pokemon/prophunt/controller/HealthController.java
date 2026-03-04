package com.pokemon.prophunt.controller;

import java.util.Map;
import java.util.LinkedHashMap;

import org.springframework.amqp.rabbit.connection.Connection;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final StringRedisTemplate stringRedisTemplate;
    private final ConnectionFactory rabbitConnectionFactory;

    public HealthController(StringRedisTemplate stringRedisTemplate, ConnectionFactory rabbitConnectionFactory) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.rabbitConnectionFactory = rabbitConnectionFactory;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        String redisStatus = checkRedis();
        String rabbitStatus = checkRabbitMq();
        String overallStatus = "up".equals(redisStatus) && "up".equals(rabbitStatus) ? "ok" : "degraded";

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", overallStatus);
        response.put("service", "pokemon-prophunt-backend");
        response.put("redis", redisStatus);
        response.put("rabbitmq", rabbitStatus);
        return ResponseEntity.ok(response);
    }

    private String checkRedis() {
        try {
            String pong = stringRedisTemplate.execute((RedisCallback<String>) connection -> connection.ping());
            return "PONG".equalsIgnoreCase(pong) ? "up" : "down";
        } catch (Exception ex) {
            return "down";
        }
    }

    private String checkRabbitMq() {
        try (Connection connection = rabbitConnectionFactory.createConnection()) {
            return connection.isOpen() ? "up" : "down";
        } catch (Exception ex) {
            return "down";
        }
    }
}
