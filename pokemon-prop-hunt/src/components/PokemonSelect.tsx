import { POKEMON_SPECIES, type PokemonSpecies } from '../types/game';

const KOREAN_NAMES: Record<string, string> = {
  Pikachu: '피카츄',
  Charmander: '파이리',
  Bulbasaur: '이상해씨',
  Squirtle: '꼬부기',
  Eevee: '이브이',
  Snorlax: '잠만보',
  Jigglypuff: '푸린',
  Mew: '뮤',
  Magikarp: '잉어킹',
  Marill: '마릴',
  Porygon: '폴리곤',
  Magnemite: '코일',
  Bellsprout: '모다피',
};

interface PokemonSelectProps {
  selectedSpecies: PokemonSpecies | null;
  onSelect: (species: PokemonSpecies) => void;
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="poke-stat-row">
      <span className="poke-stat-label">{label}</span>
      <div className="poke-stat-track">
        <div className="poke-stat-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="poke-stat-num">{value.toFixed(1)}</span>
    </div>
  );
}

export default function PokemonSelect({ selectedSpecies, onSelect }: PokemonSelectProps) {
  return (
    <div className="pokemon-select-grid">
      {POKEMON_SPECIES.map((species) => {
        const selected = selectedSpecies?.name === species.name;
        const krName = KOREAN_NAMES[species.name] ?? species.name;
        return (
          <button
            key={species.name}
            type="button"
            className={`pokemon-card ${selected ? 'selected' : ''}`}
            onClick={() => onSelect(species)}
          >
            <div className="pokemon-card-top">
              <span className="pokemon-card-avatar">
                <img src={`/icons/${species.name.toLowerCase()}.svg`} alt={species.name} />
              </span>
              <div className="pokemon-card-info">
                <span className="pokemon-card-name">{krName}</span>
                <span className="pokemon-card-name-en">{species.name}</span>
              </div>
            </div>
            <div className="pokemon-card-stats">
              <StatBar label="속도" value={species.speed} max={8} color={species.color} />
              <StatBar label="포획 난이도" value={species.catchDifficulty * 10} max={10} color="#e63946" />
            </div>
            {selected && <div className="pokemon-card-check">✓</div>}
          </button>
        );
      })}
    </div>
  );
}
