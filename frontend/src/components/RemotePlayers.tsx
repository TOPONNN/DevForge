import { useNetworkStore } from '../stores/networkStore';
import PokemonCharacter from './PokemonCharacter';

export default function RemotePlayers() {
  const players = useNetworkStore((state) => state.players);
  const localId = useNetworkStore((state) => state.playerId);

  const remotePokemon = [...players.values()].filter(
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
