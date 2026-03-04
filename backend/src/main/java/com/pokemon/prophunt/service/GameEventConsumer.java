package com.pokemon.prophunt.service;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

import com.pokemon.prophunt.config.RabbitMQConfig;
import com.pokemon.prophunt.dto.GameResultRequest;
import com.pokemon.prophunt.entity.GameLog;
import com.pokemon.prophunt.entity.GameSession;
import com.pokemon.prophunt.entity.Member;
import com.pokemon.prophunt.repository.MemberRepository;

@Service
public class GameEventConsumer {

    private static final Logger logger = LoggerFactory.getLogger(GameEventConsumer.class);

    private final GameService gameService;
    private final MemberService memberService;
    private final MemberRepository memberRepository;

    public GameEventConsumer(
        GameService gameService,
        MemberService memberService,
        MemberRepository memberRepository
    ) {
        this.gameService = gameService;
        this.memberService = memberService;
        this.memberRepository = memberRepository;
    }

    @RabbitListener(queues = RabbitMQConfig.GAME_RESULTS_QUEUE)
    public void processGameResult(GameResultRequest request) {
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
                member = memberRepository.findById(logRequest.getMemberId()).orElse(null);
            }

            GameLog gameLog = new GameLog();
            gameLog.setMember(member);
            gameLog.setPlayerName(logRequest.getPlayerName());
            gameLog.setRole(logRequest.getRole());
            gameLog.setSpecies(logRequest.getSpecies());
            gameLog.setCaught(logRequest.isCaught());
            logs.add(gameLog);

            if (logRequest.getMemberId() != null && member != null) {
                memberService.updateStats(logRequest.getMemberId(), request.isTrainerWin(), logRequest.isCaught() ? 1 : 0);
            }
        });

        gameService.saveGameResult(gameSession, logs);
    }

    @RabbitListener(queues = RabbitMQConfig.GAME_EVENTS_QUEUE)
    public void processGameEvent(Object event) {
        logger.info("Received game event: {}", event);
    }
}
