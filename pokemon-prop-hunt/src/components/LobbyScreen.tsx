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

  const localPlayer = players.get(playerId);
  const localRole = localPlayer?.role ?? 'pokemon';
  const connectedPlayers = useMemo(() => [...players.values()], [players]);

  const handleCreateRoom = () => {
    connect(makeRoomCode(), name || '트레이너');
  };

  const handleJoinRoom = () => {
    connect(joinCode || makeRoomCode(), name || '트레이너');
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

  if (phase !== 'lobby' && phase !== 'selecting') {
    return null;
  }

  if (!isConnected) {
    return (
      <div className="lobby-screen">
        <div className="lobby-bg-stars" />
        <div className="lobby-bg-ground" />
        <div className="lobby-bg-pokeball lobby-pb-1" />
        <div className="lobby-bg-pokeball lobby-pb-2" />
        <div className="lobby-bg-pokeball lobby-pb-3" />
        <div className="lobby-bg-pokeball lobby-pb-4" />
        <div className="lobby-bg-pokeball lobby-pb-5" />
        <div className="lobby-bg-pokeball lobby-pb-6" />

        <div className="lobby-center">
          <p className="lobby-subtitle">몬스터볼을 던져 포켓몬을 잡아라!</p>
          <h1 className="lobby-title">포켓몬<br />숨바꼭질</h1>

          <div className="lobby-card">
            <div className="lobby-field">
              <label htmlFor="player-name">트레이너 이름</label>
              <input id="player-name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="button" className="lobby-btn-primary" onClick={handleCreateRoom}>
              방 만들기
            </button>
            <div className="lobby-divider"><span>또는</span></div>
            <div className="lobby-join-row">
              <input
                value={joinCode}
                maxLength={4}
                placeholder="방 코드"
                onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              />
              <button type="button" className="lobby-btn-secondary" onClick={handleJoinRoom}>
                참가
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const readyCount = connectedPlayers.filter((p) => p.ready).length;
  const totalCount = connectedPlayers.length;

  return (
    <div className="lobby-screen">
      <div className="lobby-bg-stars" />
      <div className="lobby-bg-ground" />
      <div className="lobby-bg-pokeball lobby-pb-1" />
      <div className="lobby-bg-pokeball lobby-pb-3" />
      <div className="lobby-bg-pokeball lobby-pb-5" />

      <div className="room-main-card">
        <div className="room-header">
          <h1 className="lobby-title" style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 0 }}>포켓몬 숨바꼭질</h1>
          <div className="room-code-badge">
            <span className="room-code-label">방 코드</span>
            <span className="room-code-value">{roomCode}</span>
          </div>
        </div>

        <div className="room-layout">
          <div className="room-players">
            <h2>플레이어 <span className="room-player-count">{readyCount}/{totalCount} 준비</span></h2>
            <div className="player-list">
              {connectedPlayers.map((player) => (
                <div key={player.id} className={`player-row ${player.id === playerId ? 'is-me' : ''}`}>
                  <div className="player-row-left">
                    <span className="player-avatar">{player.name.charAt(0)}</span>
                    <span className="player-name">{player.name}</span>
                  </div>
                  <div className="player-row-tags">
                    <span className={`role-chip ${player.role}`}>
                      {player.role === 'trainer' ? '트레이너' : '포켓몬'}
                    </span>
                    <span className={`ready-chip ${player.ready ? 'is-ready' : ''}`}>
                      {player.ready ? '✓' : '···'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="room-controls">
              <button type="button" className={`lobby-btn-ready ${ready ? 'is-ready' : ''}`} onClick={handleToggleReady}>
                {ready ? '준비 취소' : '준비 완료'}
              </button>
              {isHost ? (
                <button type="button" className="lobby-btn-primary" onClick={startGame}>
                  게임 시작
                </button>
              ) : null}
              <button type="button" className="lobby-btn-ghost" onClick={disconnect}>
                나가기
              </button>
            </div>
          </div>

          <div className="room-selection">
            {localRole === 'pokemon' ? (
              <>
                <h2>포켓몬 선택</h2>
                <PokemonSelect selectedSpecies={selectedSpecies} onSelect={handleSelectSpecies} />
              </>
            ) : (
              <div className="trainer-status">
                <span className="trainer-status-icon">⚡</span>
                <span>당신은 <strong>트레이너</strong>입니다.<br />몬스터볼을 충전해서 던져 포켓몬을 잡으세요!</span>
              </div>
            )}
          </div>

          <div className="room-chat">
            <h2>채팅</h2>
            <div className="chat-log">
              {chat.map((message) => (
                <div key={`${message.timestamp}-${message.playerId}`} className="chat-message">
                  <strong>{message.playerName}:</strong> {message.text}
                </div>
              ))}
            </div>
            <div className="chat-input-row">
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
                className="lobby-btn-secondary"
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
