package com.pokemon.prophunt.dto;

import java.util.ArrayList;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class GameResultRequest {

    @NotBlank
    private String roomCode;

    @NotBlank
    private String mapId;

    @Min(1)
    private int playerCount;

    private boolean trainerWin;

    @Min(0)
    private int duration;

    @Valid
    @NotNull
    private List<GameLogRequest> logs = new ArrayList<>();

    public String getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(String roomCode) {
        this.roomCode = roomCode;
    }

    public String getMapId() {
        return mapId;
    }

    public void setMapId(String mapId) {
        this.mapId = mapId;
    }

    public int getPlayerCount() {
        return playerCount;
    }

    public void setPlayerCount(int playerCount) {
        this.playerCount = playerCount;
    }

    public boolean isTrainerWin() {
        return trainerWin;
    }

    public void setTrainerWin(boolean trainerWin) {
        this.trainerWin = trainerWin;
    }

    public int getDuration() {
        return duration;
    }

    public void setDuration(int duration) {
        this.duration = duration;
    }

    public List<GameLogRequest> getLogs() {
        return logs;
    }

    public void setLogs(List<GameLogRequest> logs) {
        this.logs = logs;
    }
}
