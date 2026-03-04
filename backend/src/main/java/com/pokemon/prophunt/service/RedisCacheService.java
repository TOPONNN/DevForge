package com.pokemon.prophunt.service;

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.stereotype.Service;

@Service
public class RedisCacheService {

    private static final String SESSION_PREFIX = "session:";
    private static final String ROOM_STATE_PREFIX = "room:state:";
    private static final String LEADERBOARD_KEY = "leaderboard";
    private static final Duration SESSION_TTL = Duration.ofMinutes(30);
    private static final Duration ROOM_STATE_TTL = Duration.ofHours(2);

    private final RedisTemplate<String, Object> redisTemplate;

    public RedisCacheService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void cacheSession(String sessionId, Object data) {
        redisTemplate.opsForValue().set(sessionKey(sessionId), data, SESSION_TTL);
    }

    public Object getSession(String sessionId) {
        return redisTemplate.opsForValue().get(sessionKey(sessionId));
    }

    public void removeSession(String sessionId) {
        redisTemplate.delete(sessionKey(sessionId));
    }

    public void updateLeaderboard(String memberId, double score) {
        redisTemplate.opsForZSet().incrementScore(LEADERBOARD_KEY, memberId, score);
    }

    public List<Map<String, Object>> getTopPlayers(int count) {
        Set<ZSetOperations.TypedTuple<Object>> tuples = redisTemplate.opsForZSet()
            .reverseRangeWithScores(LEADERBOARD_KEY, 0, Math.max(count - 1L, 0L));

        if (tuples == null || tuples.isEmpty()) {
            return Collections.emptyList();
        }

        return tuples.stream()
            .map(tuple -> Map.of(
                "memberId", tuple.getValue(),
                "score", tuple.getScore() == null ? 0.0d : tuple.getScore()))
            .toList();
    }

    public void cacheRoomState(String roomId, Object state) {
        redisTemplate.opsForValue().set(roomStateKey(roomId), state, ROOM_STATE_TTL);
    }

    public Object getRoomState(String roomId) {
        return redisTemplate.opsForValue().get(roomStateKey(roomId));
    }

    public void removeRoomState(String roomId) {
        redisTemplate.delete(roomStateKey(roomId));
    }

    private String sessionKey(String sessionId) {
        return SESSION_PREFIX + sessionId;
    }

    private String roomStateKey(String roomId) {
        return ROOM_STATE_PREFIX + roomId;
    }
}
