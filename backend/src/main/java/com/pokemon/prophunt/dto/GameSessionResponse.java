package com.pokemon.prophunt.dto;

import java.time.LocalDateTime;

public record GameSessionResponse(
    Long id,
    String roomCode,
    String mapId,
    int playerCount,
    boolean trainerWin,
    int duration,
    LocalDateTime createdAt
) {
}
