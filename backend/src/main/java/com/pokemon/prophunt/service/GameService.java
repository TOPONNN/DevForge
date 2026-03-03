package com.pokemon.prophunt.service;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pokemon.prophunt.dto.GameSessionResponse;
import com.pokemon.prophunt.entity.GameLog;
import com.pokemon.prophunt.entity.GameSession;
import com.pokemon.prophunt.repository.GameLogRepository;
import com.pokemon.prophunt.repository.GameSessionRepository;

@Service
public class GameService {

    private final GameSessionRepository gameSessionRepository;
    private final GameLogRepository gameLogRepository;

    public GameService(GameSessionRepository gameSessionRepository, GameLogRepository gameLogRepository) {
        this.gameSessionRepository = gameSessionRepository;
        this.gameLogRepository = gameLogRepository;
    }

    @Transactional
    public GameSessionResponse saveGameResult(GameSession session, List<GameLog> logs) {
        GameSession savedSession = gameSessionRepository.save(session);
        for (GameLog log : logs) {
            log.setGameSession(savedSession);
        }
        gameLogRepository.saveAll(logs);
        return toResponse(savedSession);
    }

    @Transactional(readOnly = true)
    public List<GameSessionResponse> getRecentGames(int limit) {
        int pageSize = Math.max(limit, 1);
        return gameSessionRepository.findAll(PageRequest.of(0, pageSize, Sort.by(Sort.Direction.DESC, "createdAt")))
            .stream()
            .map(this::toResponse)
            .toList();
    }

    private GameSessionResponse toResponse(GameSession session) {
        return new GameSessionResponse(
            session.getId(),
            session.getRoomCode(),
            session.getMapId(),
            session.getPlayerCount(),
            session.isTrainerWin(),
            session.getDuration(),
            session.getCreatedAt());
    }
}
