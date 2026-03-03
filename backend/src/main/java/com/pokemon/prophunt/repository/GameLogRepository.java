package com.pokemon.prophunt.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pokemon.prophunt.entity.GameLog;

public interface GameLogRepository extends JpaRepository<GameLog, Long> {

    List<GameLog> findByMemberId(Long memberId);
}
