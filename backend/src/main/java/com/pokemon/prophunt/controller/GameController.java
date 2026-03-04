package com.pokemon.prophunt.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pokemon.prophunt.dto.GameEventMessage;
import com.pokemon.prophunt.dto.GameResultRequest;
import com.pokemon.prophunt.dto.GameSessionResponse;
import com.pokemon.prophunt.service.GameEventProducer;
import com.pokemon.prophunt.service.GameService;
import com.pokemon.prophunt.service.RedisCacheService;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameService gameService;
    private final GameEventProducer gameEventProducer;
    private final RedisCacheService redisCacheService;

    public GameController(
        GameService gameService,
        GameEventProducer gameEventProducer,
        RedisCacheService redisCacheService
    ) {
        this.gameService = gameService;
        this.gameEventProducer = gameEventProducer;
        this.redisCacheService = redisCacheService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> saveGameResult(@Valid @RequestBody GameResultRequest request) {
        String sessionId = UUID.randomUUID().toString();

        Map<String, Object> sessionData = new HashMap<>();
        sessionData.put("roomCode", request.getRoomCode());
        sessionData.put("mapId", request.getMapId());
        sessionData.put("playerCount", request.getPlayerCount());
        sessionData.put("trainerWin", request.isTrainerWin());
        sessionData.put("duration", request.getDuration());
        sessionData.put("logs", new ArrayList<>(request.getLogs()));

        redisCacheService.cacheSession(sessionId, sessionData);
        redisCacheService.cacheRoomState(request.getRoomCode(), Map.of(
            "status", "COMPLETED",
            "sessionId", sessionId,
            "playerCount", request.getPlayerCount(),
            "trainerWin", request.isTrainerWin()));

        request.getLogs().stream()
            .filter(log -> log.getMemberId() != null)
            .forEach(log -> redisCacheService.updateLeaderboard(
                log.getMemberId().toString(),
                calculateScore(request.isTrainerWin(), log.getRole(), log.isCaught())));

        gameEventProducer.publishGameResult(request);

        GameEventMessage event = new GameEventMessage();
        event.setType("GAME_RESULT_QUEUED");
        event.setRoomId(request.getRoomCode());
        event.setTimestamp(java.time.LocalDateTime.now());
        event.setData(Map.of(
            "sessionId", sessionId,
            "playerCount", request.getPlayerCount()));
        gameEventProducer.publishGameEvent(event);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
            "status", "queued",
            "sessionId", sessionId,
            "message", "Game result queued for asynchronous processing"));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<GameSessionResponse>> getRecentGames(@RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(gameService.getRecentGames(limit));
    }

    private double calculateScore(boolean trainerWin, String role, boolean caught) {
        double score = caught ? 1.0d : 0.0d;
        if (trainerWin && "TRAINER".equalsIgnoreCase(role)) {
            score += 3.0d;
        }
        if (!trainerWin && "PROP".equalsIgnoreCase(role)) {
            score += 3.0d;
        }
        return score;
    }
}
