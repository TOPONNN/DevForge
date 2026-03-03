package com.pokemon.prophunt.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pokemon.prophunt.entity.GameSession;

public interface GameSessionRepository extends JpaRepository<GameSession, Long> {
}
