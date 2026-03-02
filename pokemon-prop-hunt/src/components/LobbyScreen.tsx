import { useMemo, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import PokemonSelect from './PokemonSelect';
import type { PokemonSpecies } from '../types/game';

const makeRoomCode = () => String(Math.floor(1000 + Math.random() * 9000));

export default function LobbyScreen() {
  const phase = useGameStore((state) => state.phase);
  const selectedSpecies = useGameStore((state) => state.selectedSpecies);
  const selectSpecies = useGameStore((state) => state.selectSpecies);

  const roomCode = useNetworkStore((state) => state.roomCode);
  const playerId = useNetworkStore((state) => state.playerId);
  const players = useNetworkStore((state) => state.players);
  const isConnected = useNetworkStore((state) => state.isConnected);
  const isHost = useNetworkStore((state) => state.isHost);
  const chat = useNetworkStore((state) => state.chat);
  const connect = useNetworkStore((state) => state.connect);
  const disconnect = useNetworkStore((state) => state.disconnect);
  const sendReady = useNetworkStore((state) => state.sendReady);
  const sendSpeciesSelect = useNetworkStore((state) => state.sendSpeciesSelect);
  const sendChat = useNetworkStore((state) => state.sendChat);
  const startGame = useNetworkStore((state) => state.startGame);

  const [name, setName] = useState('트레이너');
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<'main' | 'rooms'>('main');

  const localPlayer = players.get(playerId);
  const localRole = localPlayer?.role ?? 'pokemon';
  const connectedPlayers = useMemo(() => [...players.values()], [players]);

  const handleCreateRoom = () => {
    connect(makeRoomCode(), name || '트레이너');
  };

  const handleJoinRoom = (code: string) => {
    connect(code || makeRoomCode(), name || '트레이너');
  };

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
    setView('rooms');
  };

  if (phase !== 'lobby' && phase !== 'selecting') {
    return null;
  }

  const mockRooms = [
    { id: '1001', name: '1. 초보만 오세요', status: '대기중', current: 3, max: 12, locked: false },
    { id: '2456', name: '2. 포켓몬 숨바꼭질', status: '게임중', current: 12, max: 12, locked: false },
    { id: '7788', name: '3. 비밀방', status: '대기중', current: 1, max: 8, locked: true },
    { id: '9901', name: '4. 같이 하실분', status: '대기중', current: 5, max: 10, locked: false },
  ];

  if (!isConnected) {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-warm-gradient" />
        <div className="lobby-bg-pattern" />

        {view === 'main' ? (
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
        ) : (
          <div className="room-list-container">
            <div className="room-list-panel">
              <div className="room-list-sidebar">
                <button type="button" className="lobby-btn-brown" onClick={() => setView('main')}>
                  ← 채널선택
                </button>
                <div className="sidebar-divider" />
                <button type="button" className="lobby-btn-brown" onClick={handleCreateRoom}>
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
                  <button type="button" className="lobby-btn-brown-outline" onClick={() => handleJoinRoom(joinCode)}>
                    참가
                  </button>
                </div>
              </div>
              <div className="room-list-main">
                <div className="room-list-header">
                  <h2>방 목록</h2>
                  <span className="room-list-count">총 {mockRooms.length}개의 방</span>
                </div>
                <div className="room-grid">
                  {mockRooms.map((room) => (
                    <div key={room.id} className="room-card" onClick={() => handleJoinRoom(room.id)}>
                      <div className="room-card-thumb">
                        <div className="thumb-icon" />
                      </div>
                      <div className="room-card-info">
                        <div className="room-card-top">
                          <span className="room-card-name">{room.name}</span>
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
              </div>
              <div className="panel-wood-floor" />
            </div>
          </div>
        )}
      </div>
    );
  }

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
                    <span className="player-avatar-warm">{player.name.charAt(0)}</span>
                    <span className="player-name-warm">{player.name}</span>
                  </div>
                  <div className="player-row-tags-warm">
                    <span className={`role-chip-warm ${player.role}`}>
                      {player.role === 'trainer' ? '트레이너' : '포켓몬'}
                    </span>
                    <span className={`ready-chip-warm ${player.ready ? 'is-ready' : ''}`}>
                      {player.ready ? '✓' : '···'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
