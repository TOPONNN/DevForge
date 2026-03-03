package com.pokemon.prophunt.dto;

public record RoomResponse(
    String roomCode,
    String roomName,
    boolean locked,
    int maxPlayers,
    int current,
    String mapId,
    String status,
    String channel
) {
}
