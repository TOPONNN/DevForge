package com.pokemon.prophunt.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String POKEMON_EXCHANGE = "pokemon.exchange";
    public static final String GAME_RESULTS_QUEUE = "game.results";
    public static final String GAME_EVENTS_QUEUE = "game.events";
    public static final String GAME_RESULTS_ROUTING_KEY = "game.results";
    public static final String GAME_EVENTS_ROUTING_KEY = "game.events";

    @Bean
    public TopicExchange pokemonExchange() {
        return new TopicExchange(POKEMON_EXCHANGE);
    }

    @Bean
    public Queue gameResultsQueue() {
        return new Queue(GAME_RESULTS_QUEUE, true);
    }

    @Bean
    public Queue gameEventsQueue() {
        return new Queue(GAME_EVENTS_QUEUE, true);
    }

    @Bean
    public Binding gameResultsBinding(Queue gameResultsQueue, TopicExchange pokemonExchange) {
        return BindingBuilder.bind(gameResultsQueue).to(pokemonExchange).with("game.results.#");
    }

    @Bean
    public Binding gameEventsBinding(Queue gameEventsQueue, TopicExchange pokemonExchange) {
        return BindingBuilder.bind(gameEventsQueue).to(pokemonExchange).with("game.events.#");
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
