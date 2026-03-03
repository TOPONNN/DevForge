package com.pokemon.prophunt.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.pokemon.prophunt.dto.GameResultRequest;
import com.pokemon.prophunt.dto.GameSessionResponse;
import com.pokemon.prophunt.entity.GameLog;
import com.pokemon.prophunt.entity.GameSession;
import com.pokemon.prophunt.entity.Member;
import com.pokemon.prophunt.repository.MemberRepository;
import com.pokemon.prophunt.service.GameService;
import com.pokemon.prophunt.service.MemberService;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/games")
public class GameController {

    private final GameService gameService;
    private final MemberService memberService;
    private final MemberRepository memberRepository;

    public GameController(GameService gameService, MemberService memberService, MemberRepository memberRepository) {
        this.gameService = gameService;
        this.memberService = memberService;
        this.memberRepository = memberRepository;
    }

    @PostMapping
    public ResponseEntity<GameSessionResponse> saveGameResult(@Valid @RequestBody GameResultRequest request) {
        GameSession gameSession = new GameSession();
        gameSession.setRoomCode(request.getRoomCode());
        gameSession.setMapId(request.getMapId());
        gameSession.setPlayerCount(request.getPlayerCount());
        gameSession.setTrainerWin(request.isTrainerWin());
        gameSession.setDuration(request.getDuration());

        List<GameLog> logs = new ArrayList<>();
        request.getLogs().forEach(logRequest -> {
            Member member = null;
            if (logRequest.getMemberId() != null) {
                member = memberRepository.findById(logRequest.getMemberId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));
            }
            GameLog gameLog = new GameLog();
            gameLog.setMember(member);
            gameLog.setPlayerName(logRequest.getPlayerName());
            gameLog.setRole(logRequest.getRole());
            gameLog.setSpecies(logRequest.getSpecies());
            gameLog.setCaught(logRequest.isCaught());
            logs.add(gameLog);
        });

        request.getLogs().stream()
            .filter(log -> log.getMemberId() != null)
            .forEach(log -> memberService.updateStats(log.getMemberId(), request.isTrainerWin(), log.isCaught() ? 1 : 0));

        return ResponseEntity.ok(gameService.saveGameResult(gameSession, logs));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<GameSessionResponse>> getRecentGames(@RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(gameService.getRecentGames(limit));
    }
}
