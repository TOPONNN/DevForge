package com.pokemon.prophunt.service;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;

import com.pokemon.prophunt.config.RabbitMQConfig;
import com.pokemon.prophunt.dto.GameEventMessage;

@Service
public class GameEventProducer {

    private final RabbitTemplate rabbitTemplate;

    public GameEventProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishGameResult(Object gameResult) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.POKEMON_EXCHANGE,
            RabbitMQConfig.GAME_RESULTS_ROUTING_KEY,
            gameResult);
    }

    public void publishGameEvent(GameEventMessage event) {
        rabbitTemplate.convertAndSend(
            RabbitMQConfig.POKEMON_EXCHANGE,
            RabbitMQConfig.GAME_EVENTS_ROUTING_KEY,
            event);
    }
}
