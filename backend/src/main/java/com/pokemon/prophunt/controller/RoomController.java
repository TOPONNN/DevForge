package com.pokemon.prophunt.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.pokemon.prophunt.dto.RoomCreateRequest;
import com.pokemon.prophunt.dto.RoomJoinRequest;
import com.pokemon.prophunt.dto.RoomResponse;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final Map<String, RoomState> rooms = new ConcurrentHashMap<>();

    @PostMapping
    public ResponseEntity<RoomResponse> createRoom(@Valid @RequestBody RoomCreateRequest request) {
        String roomCode = generateRoomCode();
        RoomState state = new RoomState(
            roomCode,
            request.getRoomName(),
            request.getPassword(),
            request.getMaxPlayers(),
            0,
            request.getMapId(),
            "WAITING",
            request.getChannel());
        rooms.put(roomCode, state);
        return ResponseEntity.ok(toResponse(state));
    }

    @GetMapping
    public ResponseEntity<List<RoomResponse>> listRooms() {
        List<RoomResponse> responses = rooms.values().stream()
            .map(this::toResponse)
            .toList();
        return ResponseEntity.ok(responses);
    }

    @PostMapping("/{roomCode}/join")
    public ResponseEntity<RoomResponse> joinRoom(@PathVariable String roomCode, @RequestBody(required = false) RoomJoinRequest request) {
        RoomState state = rooms.get(roomCode);
        if (state == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found");
        }
        if (state.isLocked()) {
            String password = request == null ? null : request.getPassword();
            if (password == null || !password.equals(state.password())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid room password");
            }
        }
        if (state.current() >= state.maxPlayers()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room is full");
        }

        RoomState updated = new RoomState(
            state.roomCode(),
            state.roomName(),
            state.password(),
            state.maxPlayers(),
            state.current() + 1,
            state.mapId(),
            state.current() + 1 >= state.maxPlayers() ? "FULL" : "WAITING",
            state.channel());

        rooms.put(roomCode, updated);
        return ResponseEntity.ok(toResponse(updated));
    }

    private String generateRoomCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
    }

    private RoomResponse toResponse(RoomState state) {
        return new RoomResponse(
            state.roomCode(),
            state.roomName(),
            state.isLocked(),
            state.maxPlayers(),
            state.current(),
            state.mapId(),
            state.status(),
            state.channel());
    }

    private record RoomState(
        String roomCode,
        String roomName,
        String password,
        int maxPlayers,
        int current,
        String mapId,
        String status,
        String channel
    ) {
        boolean isLocked() {
            return password != null && !password.isBlank();
        }
    }
}
