import { useMemo, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import PokemonSelect from './PokemonSelect';
import type { PokemonSpecies } from '../types/game';

const CHANNELS = [
  { id: 1, name: '채널 1', desc: '초보자 채널', emoji: '🌱' },
  { id: 2, name: '채널 2', desc: '일반 채널', emoji: '⚡' },
  { id: 3, name: '채널 3', desc: '고수 채널', emoji: '🔥' },
  { id: 4, name: '채널 4', desc: '자유 채널', emoji: '🌟' },
];

const MAP_OPTS = [
  { id: 'nature', name: '자연맵', gradient: 'linear-gradient(135deg, #2a9d8f, #55efc4)' },
  { id: 'city', name: '도시맵', gradient: 'linear-gradient(135deg, #457b9d, #74b9ff)' },
  { id: 'desert', name: '사막맵', gradient: 'linear-gradient(135deg, #e17055, #ffeaa7)' },
];

const MAX_PLAYER_OPTS = [4, 6, 8, 10, 12];

function mapGradient(mapId: string) {
  const found = MAP_OPTS.find((m) => m.id === mapId);
  return found ? found.gradient : 'linear-gradient(135deg, #ffeaa7, #fbc531)';
}

export default function LobbyScreen() {
  const phase = useGameStore((s) => s.phase);
  const selectedSpecies = useGameStore((s) => s.selectedSpecies);
  const selectSpecies = useGameStore((s) => s.selectSpecies);

  const roomCode = useNetworkStore((s) => s.roomCode);
  const playerId = useNetworkStore((s) => s.playerId);
  const players = useNetworkStore((s) => s.players);
  const isConnected = useNetworkStore((s) => s.isConnected);
  const isHost = useNetworkStore((s) => s.isHost);
  const chat = useNetworkStore((s) => s.chat);
  const disconnect = useNetworkStore((s) => s.disconnect);
  const sendReady = useNetworkStore((s) => s.sendReady);
  const sendSpeciesSelect = useNetworkStore((s) => s.sendSpeciesSelect);
  const sendChat = useNetworkStore((s) => s.sendChat);
  const startGame = useNetworkStore((s) => s.startGame);

  // New lobby actions
  const channel = useNetworkStore((s) => s.channel);
  const rooms = useNetworkStore((s) => s.rooms);
  const connectLobby = useNetworkStore((s) => s.connectLobby);
  const disconnectLobby = useNetworkStore((s) => s.disconnectLobby);
  const createRoom = useNetworkStore((s) => s.createRoom);
  const joinRoom = useNetworkStore((s) => s.joinRoom);
  const addBot = useNetworkStore((s) => s.addBot);
  const removeBot = useNetworkStore((s) => s.removeBot);

  const [name, setName] = useState('트레이너');
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<'main' | 'channels' | 'rooms'>('main');

  // Create room modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('포켓몬 숨바꼭질');
  const [newRoomPw, setNewRoomPw] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState(8);
  const [newMapId, setNewMapId] = useState('nature');

  // Password prompt
  const [pwPrompt, setPwPrompt] = useState<{ roomCode: string; show: boolean }>({ roomCode: '', show: false });
  const [pwInput, setPwInput] = useState('');

  const localPlayer = players.get(playerId);
  const localRole = localPlayer?.role ?? 'pokemon';
  const connectedPlayers = useMemo(() => [...players.values()], [players]);

  const handleToggleReady = () => {
    const next = !ready;
    setReady(next);
    sendReady(next);
  };

  const handleSelectSpecies = (species: PokemonSpecies) => {
    selectSpecies(species);
    sendSpeciesSelect(species.name);
  };

  const handleStartClicked = () => {
    setView('channels');
  };

  const handleSelectChannel = (ch: number) => {
    connectLobby(ch);
    setView('rooms');
  };

  const handleBackToChannels = () => {
    disconnectLobby();
    setView('channels');
  };

  const handleRoomCardClick = (room: (typeof rooms)[0]) => {
    if (room.locked) {
      setPwPrompt({ roomCode: room.roomCode, show: true });
      setPwInput('');
    } else {
      joinRoom(room.roomCode, name || '트레이너');
    }
  };

  const handlePwSubmit = () => {
    joinRoom(pwPrompt.roomCode, name || '트레이너', pwInput);
    setPwPrompt({ roomCode: '', show: false });
    setPwInput('');
  };

  const handleCreateSubmit = () => {
    createRoom({
      roomName: newRoomName || '포켓몬 숨바꼭질',
      password: newRoomPw || undefined,
      maxPlayers: newMaxPlayers,
      mapId: newMapId,
      channel,
      playerName: name || '트레이너',
    });
    setShowCreateModal(false);
  };

  if (phase !== 'lobby' && phase !== 'selecting') {
    return null;
  }

  // ── MAIN SCREEN ──────────────────────────────────────────────
  if (!isConnected && view === 'main') {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-warm-gradient" />
        <div className="lobby-bg-pattern" />
        <div className="lobby-center">
          <p className="lobby-subtitle">몬스터볼을 던져 포켓몬을 잡아라!</p>
          <h1 className="lobby-title">포켓몬<br />숨바꼭질</h1>
          <div className="lobby-main-panel">
            <input
              className="lobby-name-input"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="트레이너 이름"
            />
            <button type="button" className="lobby-btn-start" onClick={handleStartClicked}>
              시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CHANNEL SELECT ──────────────────────────────────────────
  if (!isConnected && view === 'channels') {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-warm-gradient" />
        <div className="lobby-bg-pattern" />
        <div className="channel-container">
          <div className="channel-panel">
            <div className="channel-header">
              <button type="button" className="lobby-btn-brown channel-back-btn" onClick={() => setView('main')}>
                ← 뒤로
              </button>
              <h2 className="channel-title">채널 선택</h2>
            </div>
            <div className="channel-grid">
              {CHANNELS.map((ch) => (
                <div key={ch.id} className="channel-card" onClick={() => handleSelectChannel(ch.id)}>
                  <div className="channel-card-icon">{ch.emoji}</div>
                  <div className="channel-card-name">{ch.name}</div>
                  <div className="channel-card-desc">{ch.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ROOM LIST ───────────────────────────────────────────────
  if (!isConnected && view === 'rooms') {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-warm-gradient" />
        <div className="lobby-bg-pattern" />
        <div className="room-list-container">
          <div className="room-list-panel">
            <div className="room-list-sidebar">
              <button type="button" className="lobby-btn-brown" onClick={handleBackToChannels}>
                ← 채널선택
              </button>
              <div className="sidebar-divider" />
              <button type="button" className="lobby-btn-brown" onClick={() => setShowCreateModal(true)}>
                방 만들기
              </button>
              <div className="sidebar-join">
                <input
                  className="room-code-input"
                  value={joinCode}
                  maxLength={4}
                  placeholder="방 코드"
                  onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                />
                <button
                  type="button"
                  className="lobby-btn-brown-outline"
                  onClick={() => joinRoom(joinCode, name || '트레이너')}
                >
                  참가
                </button>
              </div>
            </div>
            <div className="room-list-main">
              <div className="room-list-header">
                <h2>방 목록</h2>
                <span className="room-list-count">총 {rooms.length}개의 방</span>
              </div>
              {rooms.length === 0 ? (
                <div className="room-empty">
                  <div className="room-empty-icon">🎮</div>
                  <p>아직 방이 없습니다.<br />방을 만들어보세요!</p>
                </div>
              ) : (
                <div className="room-grid">
                  {rooms.map((room) => (
                    <div key={room.roomCode} className="room-card" onClick={() => handleRoomCardClick(room)}>
                      <div className="room-card-thumb" style={{ background: mapGradient(room.mapId) }}>
                        <div className="thumb-icon" />
                      </div>
                      <div className="room-card-info">
                        <div className="room-card-top">
                          <span className="room-card-name">{room.roomName}</span>
                          {room.locked && <span className="room-card-lock">🔒</span>}
                        </div>
                        <div className="room-card-bottom">
                          <span className={`room-status ${room.status === '게임중' ? 'is-playing' : 'is-waiting'}`}>
                            {room.status}
                          </span>
                          <span className="room-players-count">{room.current}/{room.max}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="panel-wood-floor" />
          </div>
        </div>

        {/* Create Room Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">방 만들기</h2>
              <div className="modal-field">
                <label className="modal-label">방 이름</label>
                <input
                  className="lobby-name-input"
                  value={newRoomName}
                  maxLength={30}
                  onChange={(e) => setNewRoomName(e.target.value)}
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">비밀번호</label>
                <input
                  className="lobby-name-input"
                  value={newRoomPw}
                  maxLength={30}
                  placeholder="비밀번호 (선택)"
                  onChange={(e) => setNewRoomPw(e.target.value)}
                />
              </div>
              <div className="modal-field">
                <label className="modal-label">최대 인원</label>
                <div className="modal-btn-group">
                  {MAX_PLAYER_OPTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`modal-opt-btn ${newMaxPlayers === n ? 'active' : ''}`}
                      onClick={() => setNewMaxPlayers(n)}
                    >
                      {n}명
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-field">
                <label className="modal-label">맵 선택</label>
                <div className="modal-map-grid">
                  {MAP_OPTS.map((m) => (
                    <div
                      key={m.id}
                      className={`modal-map-card ${newMapId === m.id ? 'active' : ''}`}
                      onClick={() => setNewMapId(m.id)}
                    >
                      <div className="modal-map-preview" style={{ background: m.gradient }} />
                      <span className="modal-map-name">{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="lobby-btn-brown" onClick={handleCreateSubmit}>
                  방 만들기
                </button>
                <button type="button" className="lobby-btn-ghost-warm" onClick={() => setShowCreateModal(false)}>
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Prompt */}
        {pwPrompt.show && (
          <div className="modal-overlay" onClick={() => setPwPrompt({ roomCode: '', show: false })}>
            <div className="modal-panel modal-small" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">비밀번호 입력</h2>
              <div className="modal-field">
                <input
                  className="lobby-name-input"
                  type="password"
                  value={pwInput}
                  placeholder="비밀번호를 입력하세요"
                  onChange={(e) => setPwInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePwSubmit(); }}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="lobby-btn-brown" onClick={handlePwSubmit}>
                  입장
                </button>
                <button type="button" className="lobby-btn-ghost-warm" onClick={() => setPwPrompt({ roomCode: '', show: false })}>
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── ROOM DETAIL (connected) ─────────────────────────────────
  const readyCount = connectedPlayers.filter((p) => p.ready).length;
  const totalCount = connectedPlayers.length;

  return (
    <div className="lobby-screen">
      <div className="lobby-bg-warm-gradient" />
      <div className="lobby-bg-pattern" />

      <div className="room-detail-panel">
        <div className="room-detail-header">
          <h1 className="room-detail-title">포켓몬 숨바꼭질</h1>
          <div className="room-code-badge-warm">
            <span className="room-code-label-warm">방 코드</span>
            <span className="room-code-value-warm">{roomCode}</span>
          </div>
        </div>

        <div className="room-detail-layout">
          <div className="room-detail-players">
            <h2>플레이어 <span className="room-player-count-warm">{readyCount}/{totalCount} 준비</span></h2>
            <div className="player-list-warm">
              {connectedPlayers.map((player) => (
                <div key={player.id} className={`player-row-warm ${player.id === playerId ? 'is-me' : ''}`}>
                  <div className="player-row-left-warm">
                    <span className="player-avatar-warm">
                      {player.id.startsWith('bot-') || player.isBot ? '🤖' : player.name.charAt(0)}
                    </span>
                    <span className="player-name-warm">{player.name}</span>
                  </div>
                  <div className="player-row-tags-warm">
                    <span className={`role-chip-warm ${player.role}`}>
                      {player.role === 'trainer' ? '트레이너' : '포켓몬'}
                    </span>
                    {(player.id.startsWith('bot-') || player.isBot) && isHost ? (
                      <button
                        type="button"
                        className="bot-remove-btn"
                        onClick={() => removeBot(player.id)}
                      >
                        제거
                      </button>
                    ) : (
                      <span className={`ready-chip-warm ${player.ready ? 'is-ready' : ''}`}>
                        {player.ready ? '✓' : '···'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {isHost && (
              <button type="button" className="lobby-btn-brown-outline bot-add-btn" onClick={addBot}>
                🤖 봇 추가
              </button>
            )}
            <div className="room-detail-controls">
              <button type="button" className={`lobby-btn-ready-warm ${ready ? 'is-ready' : ''}`} onClick={handleToggleReady}>
                {ready ? '준비 취소' : '준비 완료'}
              </button>
              {isHost ? (
                <button type="button" className="lobby-btn-start-warm" onClick={startGame}>
                  게임 시작
                </button>
              ) : null}
              <button type="button" className="lobby-btn-ghost-warm" onClick={disconnect}>
                나가기
              </button>
            </div>
          </div>

          <div className="room-detail-selection">
            {localRole === 'pokemon' ? (
              <>
                <h2>포켓몬 선택</h2>
                <PokemonSelect selectedSpecies={selectedSpecies} onSelect={handleSelectSpecies} />
              </>
            ) : (
              <div className="trainer-status-warm">
                <span className="trainer-status-icon">⚡</span>
                <span>당신은 <strong>트레이너</strong>입니다.<br />몬스터볼을 던져 포켓몬을 잡으세요!</span>
              </div>
            )}
          </div>

          <div className="room-detail-chat">
            <h2>채팅</h2>
            <div className="chat-log-warm">
              {chat.map((message) => (
                <div key={`${message.timestamp}-${message.playerId}`} className="chat-message-warm">
                  <strong>{message.playerName}:</strong> {message.text}
                </div>
              ))}
            </div>
            <div className="chat-input-row-warm">
              <input
                value={chatInput}
                placeholder="메시지 입력..."
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendChat(chatInput);
                    setChatInput('');
                  }
                }}
              />
              <button
                type="button"
                className="lobby-btn-brown"
                onClick={() => {
                  sendChat(chatInput);
                  setChatInput('');
                }}
              >
                보내기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
