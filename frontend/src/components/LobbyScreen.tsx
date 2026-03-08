import { useEffect, useMemo, useState } from 'react';
import { gameActions } from '../stores/gameSlice';
import {
  addBot,
  connectChannelLobby,
  connectLobby,
  createRoom,
  disconnect,
  disconnectChannelLobby,
  disconnectLobby,
  joinRoom,
  removeBot,
  sendChat,
  sendPokeballCount,
  sendReady,
  sendRoleSelect,
  sendSpeciesSelect,
  startGame,
} from '../stores/networkSlice';
import { useAppDispatch, useAppSelector } from '../stores/hooks';
import PokemonSelect from './PokemonSelect';
import LobbyBackground3D from './LobbyBackground3D';
import RolePreview3D from './RolePreview3D';
import type { PokemonSpecies } from '../types/game';

const CHANNELS = [
  { id: 1, name: '태초마을' },
  { id: 2, name: '상록숲' },
  { id: 3, name: '달맞이산' },
  { id: 4, name: '보라타운' },
];

const MAX_PLAYER_OPTS = [4, 6, 8, 10, 12];
const POKEBALL_OPTIONS = [5, 10, 15, 20, 25, 30];

export default function LobbyScreen() {
  const dispatch = useAppDispatch();
  const phase = useAppSelector((s) => s.game.phase);
  const selectedSpecies = useAppSelector((s) => s.game.selectedSpecies);
  const pokeballs = useAppSelector((s) => s.game.pokeballs);

  const roomCode = useAppSelector((s) => s.network.roomCode);
  const playerId = useAppSelector((s) => s.network.playerId);
  const players = useAppSelector((s) => s.network.players);
  const isConnected = useAppSelector((s) => s.network.isConnected);
  const isHost = useAppSelector((s) => s.network.isHost);
  const chat = useAppSelector((s) => s.network.chat);

  const channel = useAppSelector((s) => s.network.channel);
  const rooms = useAppSelector((s) => s.network.rooms);
  const channelCounts = useAppSelector((s) => s.network.channelCounts);

  const [name, setName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [ready, setReady] = useState(false);
  const [pokeballCount, setPokeballCountLocal] = useState(pokeballs);
  const [view, setView] = useState<'main' | 'nickname' | 'channels' | 'rooms'>('main');

  // Create room modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('포켓몬 숨바꼭질');
  const [newRoomPw, setNewRoomPw] = useState('');
  const [newRoomIsPublic, setNewRoomIsPublic] = useState(true);
  const [newMaxPlayers, setNewMaxPlayers] = useState(8);

  // Password prompt
  const [pwPrompt, setPwPrompt] = useState<{ roomCode: string; show: boolean }>({ roomCode: '', show: false });
  const [pwInput, setPwInput] = useState('');

  const localPlayer = players[playerId];
  const localRole = localPlayer?.role ?? 'pokemon';
  const connectedPlayers = useMemo(() => Object.values(players), [players]);

  // Auto-connect/disconnect channel lobby WS when on channels view
  useEffect(() => {
    if (view === 'channels' && !isConnected) {
      dispatch(connectChannelLobby());
      return () => {
        dispatch(disconnectChannelLobby());
      };
    }
  }, [dispatch, isConnected, view]);

  useEffect(() => {
    setPokeballCountLocal(pokeballs);
  }, [pokeballs]);

  const handleToggleReady = () => {
    const next = !ready;
    setReady(next);
    dispatch(sendReady(next));
  };

  const handleSelectSpecies = (species: PokemonSpecies) => {
    dispatch(gameActions.selectSpecies(species));
    dispatch(sendSpeciesSelect(species.name));
  };

  const handleSelectPokeballCount = (count: number) => {
    setPokeballCountLocal(count);
    dispatch(gameActions.setPokeballCount(count));
    dispatch(sendPokeballCount(count));
  };

  const handleSelectChannel = (ch: number) => {
    dispatch(connectLobby(ch));
    setView('rooms');
  };

  const handleGoToChannels = () => {
    if (!name.trim()) {
      alert('1글자 이상 입력해주세요');
      return;
    }
    setView('channels');
  };

  const handleBackToChannels = () => {
    dispatch(disconnectLobby());
    setView('channels');
  };

  const handleRoomCardClick = (room: (typeof rooms)[0]) => {
    if (room.locked) {
      setPwPrompt({ roomCode: room.roomCode, show: true });
      setPwInput('');
    } else {
      dispatch(joinRoom(room.roomCode, name || '트레이너'));
    }
  };

  const handlePwSubmit = () => {
    dispatch(joinRoom(pwPrompt.roomCode, name || '트레이너', pwInput));
    setPwPrompt({ roomCode: '', show: false });
    setPwInput('');
  };

  const handleCreateSubmit = () => {
    if (!newRoomName.trim()) {
      alert('방 제목을 1글자 이상 입력해주세요');
      return;
    }
    if (newRoomPw && newRoomIsPublic) {
      alert('비밀방 설정을 해주세요.');
      return;
    }
    console.log('[LobbyScreen] handleCreateSubmit createRoom payload:', {
      roomName: newRoomName || '포켓몬 숨바꼭질',
      password: newRoomPw || undefined,
      maxPlayers: newMaxPlayers,
      mapId: 'nature',
      channel,
      playerName: name || '트레이너',
    });
    dispatch(createRoom({
      roomName: newRoomName || '포켓몬 숨바꼭질',
      password: newRoomPw || undefined,
      maxPlayers: newMaxPlayers,
      mapId: 'nature',
      channel,
      playerName: name || '트레이너',
    }));
    setShowCreateModal(false);
    setNewRoomName('포켓몬 숨바꼭질');
    setNewRoomPw('');
    setNewRoomIsPublic(true);
  };

  const changeMakeRoomFlag = () => {
    setShowCreateModal(!showCreateModal);
    setNewRoomName('포켓몬 숨바꼭질');
    setNewRoomPw('');
    setNewRoomIsPublic(true);
  };

  if (phase !== 'lobby' && phase !== 'selecting') {
    return null;
  }

  // ── MAIN SCREEN ──────────────────────────────────────────────
  if (!isConnected && view === 'main') {
    return (
      <>
        <LobbyBackground3D />
        <section className="lobby-screen lobby-main-screen">
          <p className="main-title-sub">포켓몬을 찾아서 잡아라!</p>
          <h1 className="main-title">포켓몬 숨바꼭질</h1>
          <div className="main-guest-wrap">
            <button type="button" className="lobby-guest-btn btn-animation" onClick={() => setView('nickname')}>
              Guest
            </button>
          </div>
        </section>
      </>
    );
  }

  // ── NICKNAME SCREEN ─────────────────────────────────────────
  if (!isConnected && view === 'nickname') {
    return (
      <>
        <LobbyBackground3D />
        <section className="lobby-screen lobby-nickname-screen">
          <button type="button" className="lobby-back-btn" onClick={() => setView('main')}>←</button>
          <div className="login-panel">
            <img className="login-header-img" src="/images/text_login_guest.png" alt="" />
            <div className="login-nickname-row">
              <img className="login-nickname-label" src="/images/text_nickname.png" alt="" />
              <input
                className="login-nickname-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGoToChannels();
                }}
              />
            </div>
            <div className="login-submit-wrap">
              <button
                type="button"
                className="lobby-guest-btn btn-animation"
                onClick={handleGoToChannels}
              >
                Guest
              </button>
            </div>
          </div>
        </section>
      </>
    );
  }

  // ── CHANNEL SELECT ──────────────────────────────────────────
  if (!isConnected && view === 'channels') {
    return (
      <>
        <LobbyBackground3D />
        <section className="lobby-screen lobby-channel-screen">
          <button type="button" className="lobby-back-btn" onClick={() => setView('nickname')}>←</button>
          <div className="channel-outer-panel">
            <img className="channel-title-img" src="/images/text_channel_select.png" alt="" />
            <div className="channel-grid">
              {CHANNELS.map((ch) => (
                <div
                  key={ch.id}
                  className="channel-card"
                  onClick={() => handleSelectChannel(ch.id)}
                >
                  <p className="channel-card-name">{ch.name} ({ch.id}채널)</p>
                  <p className="channel-card-count">{channelCounts[ch.id] ?? 0}/100</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  // ── ROOM LIST ───────────────────────────────────────────────
  if (!isConnected && view === 'rooms') {
    return (
      <>
        <LobbyBackground3D />
        <section className="lobby-screen">
        <div className="room-list-outer">
          {/* Sidebar */}
          <div className="room-list-sidebar">
            <p
              className="sidebar-btn"
              onClick={handleBackToChannels}
            >
              ← 채널선택
            </p>
            <p
              className="sidebar-btn"
              onClick={changeMakeRoomFlag}
            >
              방 만들기
            </p>
          </div>

          {/* Room Cards */}
          <div className="room-list-main">
            {rooms.length === 0 ? (
              <div className="room-empty">
                <p>방이 없습니다. 방을 만들어보세요!</p>
              </div>
            ) : (
              rooms.map((room, index) => (
                <div
                  key={room.roomCode}
                  className="room-card"
                  onClick={() => handleRoomCardClick(room)}
                >
                  <div className="room-card-thumb">
                    <img className="room-card-thumb-img" src="/images/map-Rich.png" alt="" />
                  </div>
                  <div className="room-card-info">
                    <div className="room-card-title-row">
                      <div className="room-card-title-text">
                        <p className="room-card-name">
                          {index + 1}.{room.roomName}
                        </p>
                        {room.locked && (
                          <img className="room-card-lock-icon" src="/images/icon_lobby_lock.png" alt="" />
                        )}
                      </div>
                    </div>
                    <div className="room-card-bottom">
                      {room.status === '게임중' ? (
                        <img src="/images/text_lobby_game.png" className="room-status-img" alt="" />
                      ) : (
                        <img src="/images/text_lobby_wait.png" className="room-status-img" alt="" />
                      )}
                      <p className="room-players-count">{room.current}/{room.max}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Create Room Modal */}
        {showCreateModal && (
          <div className="modal-overlay-ref">
            <div className="modal-panel-ref">
              <p className="modal-title-ref">방 만들기</p>
              <div className="modal-field-ref">
                <p className="modal-label-ref">방 이름 : </p>
                <input
                  className="modal-input-ref"
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                />
              </div>
              <div className="modal-field-ref">
                <p className="modal-label-ref">방 비밀번호 : </p>
                <input
                  className="modal-input-ref"
                  type="password"
                  value={newRoomPw}
                  onChange={(e) => setNewRoomPw(e.target.value)}
                />
              </div>
              <div className="modal-checkbox-row">
                <p>비밀방</p>
                <div
                  className={`modal-checkbox ${!newRoomIsPublic ? 'checked' : ''}`}
                  onClick={() => setNewRoomIsPublic(!newRoomIsPublic)}
                />
              </div>
              <div className="modal-field-ref">
                <p className="modal-label-ref">최대 인원</p>
                <div className="modal-maxplayer-group">
                  {MAX_PLAYER_OPTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`modal-maxplayer-btn ${newMaxPlayers === n ? 'active' : ''}`}
                      onClick={() => setNewMaxPlayers(n)}
                    >
                      {n}명
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-actions-ref">
                <div className="modal-action-btn" onClick={handleCreateSubmit}>
                  <p>방 만들기</p>
                </div>
                <div className="modal-action-btn" onClick={changeMakeRoomFlag}>
                  <p>취소</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Password Prompt */}
        {pwPrompt.show && (
          <div className="modal-overlay-ref">
            <div className="modal-panel-ref modal-pw">
              <p className="modal-title-ref">비밀번호입력</p>
              <input
                className="modal-pw-input"
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePwSubmit();
                }}
              />
              <div className="modal-actions-ref">
                <div className="modal-action-btn" onClick={handlePwSubmit}>
                  <p>방 입장하기</p>
                </div>
                <div className="modal-action-btn" onClick={() => setPwPrompt({ roomCode: '', show: false })}>
                  <p>취소하기</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      </>
    );
  }

  // ── ROOM DETAIL (connected) ─────────────────────────────────
  const readyCount = connectedPlayers.filter((p) => p.ready).length;
  const totalCount = connectedPlayers.length;

  return (
    <>
      <LobbyBackground3D />
      <section className="lobby-screen">
      <div className="room-detail-panel">
        <div className="room-detail-header">
          <h1 className="room-detail-title">포켓몬 숨바꼭질</h1>
          <div className="room-code-badge">
            <span className="room-code-label">방 코드</span>
            <span className="room-code-value">{roomCode}</span>
          </div>
        </div>

        <div className="room-detail-layout">
          <div className="room-detail-players">
            <h2>플레이어 <span className="room-player-count">{readyCount}/{totalCount} 준비</span></h2>
            <div className="room-detail-player-scroll">
              <div className="player-list">
                {connectedPlayers.map((player) => (
                  <div key={player.id} className={`player-row ${player.id === playerId ? 'is-me' : ''}`}>
                    <div className="player-row-left">
                      <span className="player-avatar">
                        {player.id.startsWith('bot-') || player.isBot ? '🤖' : player.name.charAt(0)}
                      </span>
                      <span className="player-name">{player.name}</span>
                    </div>
                    <div className="player-row-tags">
                      <span className={`role-chip ${player.role}`}>
                        {player.role === 'trainer' ? '트레이너' : '포켓몬'}
                      </span>
                      {(player.id.startsWith('bot-') || player.isBot) && isHost ? (
                        <button
                          type="button"
                          className="bot-remove-btn"
                          onClick={() => dispatch(removeBot(player.id))}
                        >
                          제거
                        </button>
                      ) : (
                        <span className={`ready-chip ${player.ready ? 'is-ready' : ''}`}>
                          {player.ready ? '✓' : '···'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {isHost && (
              <button type="button" className="bot-add-btn" onClick={() => dispatch(addBot())}>
                🤖 봇 추가
              </button>
            )}
            <div className="room-detail-controls">
              <button type="button" className={`btn-ready ${ready ? 'is-ready' : ''}`} onClick={handleToggleReady}>
                {ready ? '준비 취소' : '준비 완료'}
              </button>
              {isHost && (
                <button type="button" className="btn-start-game" onClick={() => dispatch(startGame())}>
                  게임 시작
                </button>
              )}
              <button type="button" className="btn-leave" onClick={() => dispatch(disconnect())}>
                나가기
              </button>
            </div>
          </div>

          <div className="room-detail-center">
            <div className="room-detail-selection">
              <h2>역할 선택</h2>
              <div className="role-select-group">
                <button
                  type="button"
                  className={`role-select-btn ${localRole === 'trainer' ? 'active' : ''}`}
                  onClick={() => dispatch(sendRoleSelect('trainer'))}
                >
                  트레이너 (잡는 사람)
                </button>
                <button
                  type="button"
                  className={`role-select-btn ${localRole === 'pokemon' ? 'active' : ''}`}
                  onClick={() => dispatch(sendRoleSelect('pokemon'))}
                >
                  포켓몬 (숨는 사람)
                </button>
              </div>

              {localRole === 'pokemon' ? (
                <>
                  <h2>포켓몬 선택</h2>
                  <PokemonSelect selectedSpecies={selectedSpecies} onSelect={handleSelectSpecies} />
                </>
              ) : (
                <div className="trainer-status">
                  <span>당신은 <strong>트레이너</strong>입니다.<br />몬스터볼을 던져 포켓몬을 잡으세요!</span>
                  <div className="trainer-pokeball-row">
                    <span className="trainer-pokeball-label">시작 몬스터볼</span>
                    <div className="trainer-pokeball-options">
                      {POKEBALL_OPTIONS.map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={`modal-maxplayer-btn ${pokeballCount === count ? 'active' : ''}`}
                          onClick={() => handleSelectPokeballCount(count)}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="room-detail-sidebar">
            <div className="room-detail-preview">
              <h2>미리보기</h2>
              <RolePreview3D role={localRole} speciesName={localRole === 'pokemon' ? selectedSpecies?.name : undefined} />
            </div>

            <div className="room-detail-chat">
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
                      dispatch(sendChat(chatInput));
                      setChatInput('');
                    }
                  }}
                />
                <button
                  type="button"
                  className="chat-send-btn"
                  onClick={() => {
                    dispatch(sendChat(chatInput));
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
    </section>
    </>
  );
}
