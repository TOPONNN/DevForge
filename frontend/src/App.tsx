import { useEffect, useRef, useState } from 'react';
import Crosshair from './components/Crosshair';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import LobbyScreen from './components/LobbyScreen';
import ResultScreen from './components/ResultScreen';
import { useKeyboard } from './hooks/useKeyboard';
import { useAppDispatch, useAppSelector } from './stores/hooks';
import { gameActions } from './stores/gameSlice';
import { soundManager } from './systems/sound';

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useKeyboard();
  const [pointerLocked, setPointerLocked] = useState(false);
  const dispatch = useAppDispatch();

  const phase = useAppSelector((state) => state.game.phase);
  const timeLeft = useAppSelector((state) => state.game.timeLeft);
  const prepTime = useAppSelector((state) => state.game.prepTime);
  const huntTime = useAppSelector((state) => state.game.huntTime);
  const isDisoriented = useAppSelector((state) => state.game.isDisoriented);

  useEffect(() => {
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === containerRef.current;
      setPointerLocked(locked);
      document.body.classList.toggle('pointer-locked', locked);
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.body.classList.remove('pointer-locked');
    };
  }, []);

  useEffect(() => {
    if (phase !== 'preparing' && phase !== 'hunting') {
      return;
    }
    const timer = window.setInterval(() => {
      dispatch(gameActions.tickTimer());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [dispatch, phase]);

  useEffect(() => {
    if (phase !== 'hunting') {
      return;
    }
    const timer = window.setInterval(() => {
      if (isDisoriented) {
        dispatch(gameActions.tickDisoriented(1));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [dispatch, isDisoriented, phase]);

  useEffect(() => {
    if (phase === 'preparing' && timeLeft <= 0) {
      dispatch(gameActions.setPhase('hunting'));
      dispatch(gameActions.setTimeLeft(huntTime));
      soundManager.play('round_start');
      return;
    }
    if (phase === 'hunting' && timeLeft <= 0) {
      dispatch(gameActions.setPhase('ended'));
      soundManager.play('round_end');
    }
  }, [dispatch, huntTime, phase, timeLeft]);

  useEffect(() => {
    if (phase === 'preparing' || phase === 'hunting') {
      soundManager.startBGM();
    } else {
      soundManager.stopBGM();
    }

    return () => {
      soundManager.stopBGM();
    };
  }, [phase]);

  const requestPointerLock = () => {
    if (phase === 'lobby' || phase === 'selecting') {
      return;
    }
    containerRef.current?.requestPointerLock();
  };

  const restartRound = () => {
    dispatch(gameActions.setPhase('preparing'));
    dispatch(gameActions.setTimeLeft(prepTime));
    dispatch(gameActions.resetRound());
  };

  return (
    <div className="app-root" ref={containerRef}>
      <LobbyScreen />
      <GameScene keysRef={keysRef} pointerLocked={pointerLocked} />
      <HUD pointerLocked={pointerLocked} />
      <Crosshair pointerLocked={pointerLocked} />

       {(phase === 'preparing' || phase === 'hunting') && !pointerLocked ? (
         <div className="click-to-play" role="button" tabIndex={0} onClick={requestPointerLock}>
           <div className="click-title">클릭하여 게임 입장</div>
           <div className="click-subtitle">WASD 이동 • Shift 달리기 • Space 점프/회피 • 좌클릭 꾹 눌러 던지기</div>
         </div>
       ) : null}

      {phase === 'ended' ? <ResultScreen onPlayAgain={restartRound} /> : null}
    </div>
  );
}

export default App;
