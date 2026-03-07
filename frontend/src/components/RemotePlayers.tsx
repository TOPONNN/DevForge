import { useAppSelector } from '../stores/hooks';
import PokemonCharacter from './PokemonCharacter';

export default function RemotePlayers() {
  const players = useAppSelector((state) => state.network.players);
  const localId = useAppSelector((state) => state.network.playerId);

  const remotePokemon = Object.values(players).filter(
    (p) => p.id !== localId && p.role === 'pokemon' && !p.isCaught,
  );

  return (
    <>
      {remotePokemon.map((player) =>
        player.species ? (
          <PokemonCharacter
            key={player.id}
            id={player.id}
            name={player.name}
            species={player.species}
            position={player.position}
            rotation={player.rotation}
            isMoving={false}
            escaping={false}
            invulnerable={false}
            isCaught={player.isCaught}
          />
        ) : null,
      )}
    </>
  );
}
