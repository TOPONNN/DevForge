import { useEffect, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';

const KOREAN_NAMES: Record<string, string> = {
  Bulbasaur: '이상해씨', Ivysaur: '이상해풀', Venusaur: '이상해꽃',
  Charmander: '파이리', Charmeleon: '리자드', Charizard: '리자몽',
  Squirtle: '꼬부기', Wartortle: '어니부기', Blastoise: '거북왕',
};

const SPECIES_COLORS: Record<string, string> = {
  Bulbasaur: '#2A9D8F', Ivysaur: '#1E8449', Venusaur: '#196F3D',
  Charmander: '#F77F00', Charmeleon: '#E74C3C', Charizard: '#D35400',
  Squirtle: '#5FA8D3', Wartortle: '#2E86C1', Blastoise: '#1A5276',
};

const formatTime = (time: number) => {
  const m = Math.floor(time / 60).toString().padStart(2, '0');
  const s = Math.floor(time % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function HUD({ pointerLocked }: { pointerLocked: boolean }) {
  const role = useGameStore((state) => state.role);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const toggleCameraMode = useGameStore((state) => state.toggleCameraMode);
  const phase = useGameStore((state) => state.phase);
  const timeLeft = useGameStore((state) => state.timeLeft);
  const pokeballs = useGameStore((state) => state.pokeballs);
  const throwPower = useGameStore((state) => state.throwPower);
  const isCharging = useGameStore((state) => state.isCharging);
  const caughtPokemon = useGameStore((state) => state.caughtPokemon);
  const selectedSpecies = useGameStore((state) => state.selectedSpecies);
  const dodgeCooldown = useGameStore((state) => state.dodgeCooldown);
  const isCaught = useGameStore((state) => state.isCaught);
  const trainerSanity = useGameStore((state) => state.trainerSanity);
  const pokemonHunger = useGameStore((state) => state.pokemonHunger);
  const isDisoriented = useGameStore((state) => state.isDisoriented);
  const catchAttemptResult = useGameStore((state) => state.catchAttemptResult);
  const clearCatchAttemptResult = useGameStore((state) => state.clearCatchAttemptResult);

  const players = useNetworkStore((state) => state.players);

  useEffect(() => {
    if (!catchAttemptResult) {
      return;
    }
    const timer = window.setTimeout(() => {
      clearCatchAttemptResult();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [catchAttemptResult, clearCatchAttemptResult]);

  const caughtEntries = useMemo(() => {
    const entries: { name: string; color: string }[] = [];
    for (const id of caughtPokemon) {
      const player = players.get(id);
      if (player) {
        const specName = player.species?.name ?? 'Unknown';
        entries.push({
          name: KOREAN_NAMES[specName] ?? specName,
          color: SPECIES_COLORS[specName] ?? '#fff',
        });
      }
    }
    return entries;
  }, [caughtPokemon, players]);

  const uncaughtPokemonCount = useMemo(() => {
    let total = 0;
    for (const player of players.values()) {
      if (player.role === 'pokemon' && !player.isCaught) {
        total += 1;
      }
    }
    return total;
  }, [players]);

  if (phase === 'lobby' || phase === 'selecting') {
    return null;
  }

  const timerLow = timeLeft < 30;
  const specKrName = selectedSpecies ? (KOREAN_NAMES[selectedSpecies.name] ?? selectedSpecies.name) : '포켓몬';
  const dodgeReady = dodgeCooldown <= 0;
  const dodgePct = dodgeReady ? 100 : Math.max(0, (1 - dodgeCooldown / 2) * 100);
  const sanityLow = trainerSanity < 30;
  const hungerLow = pokemonHunger < 30;
  const hungerCritical = pokemonHunger < 10;

  return (
    <div className={`hud-layer ${pointerLocked ? 'active' : ''}`}>
      <div className={`hud-top-center ${timerLow ? 'timer-critical' : ''}`}>
        <div className="hud-timer-row">
          <span className="hud-timer-icon">⏱</span>
          <span className="hud-timer-text">{formatTime(timeLeft)}</span>
        </div>
        {role === 'trainer' ? (
          <div className="penalty-meter-section">
            <div className="penalty-meter-label">
              <span>정신력</span>
              <span>{Math.round(trainerSanity)}%</span>
            </div>
            <div className="penalty-meter-track">
              <div
                className={`penalty-meter-fill sanity ${sanityLow ? 'critical' : ''}`}
                style={{ width: `${Math.max(0, Math.min(100, trainerSanity))}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {role === 'trainer' ? (
        <>
          <div className="hud-top-right trainer-caught-panel">
            <div className="hud-title">잡은 포켓몬</div>
            {caughtEntries.length === 0 ? (
              <div className="hud-empty">아직 없음</div>
            ) : (
              caughtEntries.map((entry) => (
                <div key={entry.name} className="caught-row">
                  <span className="caught-dot" style={{ background: entry.color }} />
                  <span>{entry.name}</span>
                </div>
              ))
            )}
          </div>

          <div className="hud-bottom-right pokeball-panel">
            <div className="hud-title">몬스터볼 <span className="hud-count">{pokeballs}/10</span></div>
            <div className="pokeball-icons">
              {Array.from({ length: 10 }).map((_, index) => (
                <span key={`pokeball-${index}`} className={`pokeball-icon ${index < pokeballs ? 'filled' : 'empty'}`}>
                  <span className="pb-top" />
                  <span className="pb-band" />
                  <span className="pb-dot" />
                </span>
              ))}
            </div>
          </div>

          {isCharging ? (
            <div className="hud-bottom-center throw-meter-panel">
              <div className="hud-title">던지기 파워</div>
              <div className="throw-meter-track">
                <div
                  className="throw-meter-fill"
                  style={{ width: `${Math.round(throwPower * 100)}%` }}
                />
              </div>
              <div className="throw-meter-pct">{Math.round(throwPower * 100)}%</div>
            </div>
          ) : null}

          <div className="hud-camera-mode" onClick={() => toggleCameraMode()} style={{
            position: 'fixed', bottom: '20px', left: '20px',
            background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '8px 16px',
            borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
            fontFamily: '"Noto Sans KR", sans-serif', userSelect: 'none',
            border: '1px solid rgba(255,255,255,0.2)', zIndex: 100,
          }}>
            📷 {cameraMode === 'first-person' ? '1인칭' : '3인칭'} (V)
          </div>
        </>
      ) : (
        <>
          <div className="hud-bottom-left pokemon-panel">
            <div className="hud-title">{specKrName}</div>
            <div className="pokemon-dodge-section">
              <span className="dodge-label">회피</span>
              <div className="dodge-bar-track">
                <div className={`dodge-bar-fill ${dodgeReady ? 'ready' : ''}`} style={{ width: `${dodgePct}%` }} />
              </div>
              <span className={`dodge-status ${dodgeReady ? 'ready' : ''}`}>{dodgeReady ? '준비' : `${dodgeCooldown.toFixed(1)}초`}</span>
            </div>

            <div className="penalty-meter-section hunger-section">
              <div className="penalty-meter-label">
                <span>배고픔</span>
                <span>{Math.round(pokemonHunger)}%</span>
              </div>
              <div className="penalty-meter-track">
                <div
                  className={`penalty-meter-fill hunger ${hungerLow ? 'critical' : ''}`}
                  style={{ width: `${Math.max(0, Math.min(100, pokemonHunger))}%` }}
                />
              </div>
              {hungerLow ? (
                <div className={`hunger-warning ${hungerCritical ? 'critical' : ''}`}>
                  {hungerCritical ? '꼬르륵...' : '배고프다...'}
                </div>
              ) : null}
            </div>
          </div>

          <div className="hud-top-right pokemon-count-panel">
            <div className="hud-title">남은 포켓몬</div>
            <div className="hud-value-big">{uncaughtPokemonCount}</div>
          </div>

          {isCaught ? (
            <div className="caught-overlay">
              <div className="caught-overlay-card">
                <span className="caught-overlay-icon">●</span>
                잡혔습니다!
              </div>
            </div>
          ) : null}
        </>
      )}

      {catchAttemptResult ? (
        <div className={`catch-result-banner ${catchAttemptResult.result}`}>
          {catchAttemptResult.result === 'caught' ? '잡았다!' : '이런! 도망쳤다!'}
        </div>
      ) : null}

      {role === 'trainer' && isDisoriented ? (
        <div className="disoriented-overlay-text">혼란!</div>
      ) : null}
    </div>
  );
}
