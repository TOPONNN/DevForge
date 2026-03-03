package com.pokemon.prophunt.dto;

public record MemberResponse(
    Long id,
    String nickname,
    int totalGames,
    int totalWins,
    int totalCatches
) {
}
