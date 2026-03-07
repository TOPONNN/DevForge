import { useMemo } from 'react';
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

interface ResultScreenProps {
  onPlayAgain: () => void;
  onReturnToLobby?: () => void;
}

export default function ResultScreen({ onPlayAgain, onReturnToLobby }: ResultScreenProps) {
  const role = useGameStore((state) => state.role);
  const caughtPokemon = useGameStore((state) => state.caughtPokemon);
  const pokeballs = useGameStore((state) => state.pokeballs);
  const isCaught = useGameStore((state) => state.isCaught);
  const selectedSpecies = useGameStore((state) => state.selectedSpecies);

  const players = useNetworkStore((state) => state.players);

  const allPlayers = useMemo(() => [...players.values()], [players]);
  const totalPokemon = useMemo(() => allPlayers.filter((p) => p.role === 'pokemon').length, [allPlayers]);
  const caughtCount = caughtPokemon.length;
  const allCaught = totalPokemon > 0 && caughtCount >= totalPokemon;

  const trainerWin = role === 'trainer' ? allCaught : false;
  const pokemonWin = role === 'pokemon' ? !isCaught : false;

  const title = role === 'trainer'
    ? allCaught ? '포켓몬 마스터!' : '시간 종료!'
    : isCaught ? '잡혀버렸다!' : '생존 성공!';

  const subtitle = role === 'trainer'
    ? allCaught ? '모든 포켓몬을 잡았습니다!' : `포켓몬 ${caughtCount} / ${totalPokemon || '?'} 마리 포획`
    : isCaught ? '트레이너에게 잡혔습니다...' : '트레이너로부터 도망쳤습니다!';

  const isVictory = role === 'trainer' ? trainerWin : pokemonWin;

  const specKrName = selectedSpecies ? (KOREAN_NAMES[selectedSpecies.name] ?? selectedSpecies.name) : '알 수 없음';

  const caughtList = useMemo(() => {
    const names: { name: string; krName: string; playerName: string; color: string }[] = [];
    for (const id of caughtPokemon) {
      const player = players.get(id);
      if (player) {
        const specName = player.species?.name ?? 'Unknown';
        names.push({
          name: specName,
          krName: KOREAN_NAMES[specName] ?? specName,
          playerName: player.name,
          color: SPECIES_COLORS[specName] ?? '#fff',
        });
      }
    }
    return names;
  }, [caughtPokemon, players]);

  const survivorList = useMemo(() => {
    return allPlayers
      .filter((p) => p.role === 'pokemon' && !p.isCaught)
      .map((p) => {
        const specName = p.species?.name ?? 'Unknown';
        return {
          name: specName,
          krName: KOREAN_NAMES[specName] ?? specName,
          playerName: p.name,
          color: SPECIES_COLORS[specName] ?? '#fff',
        };
      });
  }, [allPlayers]);

  return (
    <div className="results-overlay">
      <div className={`results-card ${isVictory ? 'victory' : 'defeat'}`}>
        <div className={`results-banner ${isVictory ? 'victory' : 'defeat'}`}>
          <span className="results-banner-icon">{isVictory ? '★' : '✦'}</span>
          {isVictory ? '승리' : '패배'}
          <span className="results-banner-icon">{isVictory ? '★' : '✦'}</span>
        </div>
        <h2 className="results-title">{title}</h2>
        <p className="results-subtitle">{subtitle}</p>

        <div className="results-stats">
          {role === 'trainer' ? (
            <>
              <div className="stat-row">
                <span className="stat-label">포획한 포켓몬</span>
                <span className="stat-value">{caughtCount} / {totalPokemon || '?'}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">사용한 몬스터볼</span>
                <span className="stat-value">{10 - pokeballs}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">적중률</span>
                <span className="stat-value">
                  {(10 - pokeballs) > 0 ? `${Math.round((caughtCount / (10 - pokeballs)) * 100)}%` : '-'}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="stat-row">
                <span className="stat-label">나의 포켓몬</span>
                <span className="stat-value">{specKrName}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">상태</span>
                <span className={`stat-value ${isCaught ? 'caught-text' : 'survived-text'}`}>
                  {isCaught ? '포획됨' : '생존'}
                </span>
              </div>
            </>
          )}
        </div>

        {caughtList.length > 0 ? (
          <div className="results-section">
            <h3>잡은 포켓몬</h3>
            <div className="results-pokemon-list">
              {caughtList.map((entry) => (
                <div key={entry.playerName} className="results-pokemon-row caught-row-result">
                  <span className="species-dot" style={{ background: entry.color }} />
                  <span>{entry.krName}</span>
                  <span className="results-player-name">({entry.playerName})</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {survivorList.length > 0 ? (
          <div className="results-section">
            <h3>생존자</h3>
            <div className="results-pokemon-list">
              {survivorList.map((entry) => (
                <div key={entry.playerName} className="results-pokemon-row survivor-row">
                  <span className="species-dot" style={{ background: entry.color }} />
                  <span>{entry.krName}</span>
                  <span className="results-player-name">({entry.playerName})</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="results-buttons">
          <button type="button" className="results-play-again" onClick={onPlayAgain}>
            다시 하기
          </button>
          {onReturnToLobby ? (
            <button type="button" className="results-return-lobby" onClick={onReturnToLobby}>
              로비로 돌아가기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
