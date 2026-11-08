/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Zap,
  ArrowUp,
  ArrowDown,
  Trophy,
  Activity,
  Flame,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { loadGameAssets, GameAssets } from './game/assets';
import { SanFerminGame, GameStats, GameState } from './game/engine';
import { sound } from './game/audio';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<SanFerminGame | null>(null);

  const [assets, setAssets] = useState<GameAssets | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>('START');
  const [stats, setStats] = useState<GameStats>({
    distance: 0,
    bestDistance: 0,
    speedKmh: 35,
    bullDistanceMeters: 6.0,
    adrenaline: 40,
    isAdrenalineActive: false,
    closeCalls: 0,
    jumpCount: 0,
    slideCount: 0,
    currentTramoName: 'Cuesta de Santo Domingo',
  });

  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [isMozoFacingLeft, setIsMozoFacingLeft] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  const handleToggleOrientation = useCallback(() => {
    if (gameRef.current) {
      const newVal = gameRef.current.toggleMozoOrientation();
      setIsMozoFacingLeft(newVal);
    }
  }, []);

  // Initialize Assets
  useEffect(() => {
    let mounted = true;
    loadGameAssets((progress) => {
      if (mounted) setLoadingProgress(progress);
    })
      .then((loaded) => {
        if (mounted) {
          setAssets(loaded);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error(err);
          setLoadingError('No se pudieron cargar los recursos cinematográficos.');
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Game once Canvas and Assets are ready
  useEffect(() => {
    if (!assets || !canvasRef.current) return;

    const game = new SanFerminGame(canvasRef.current, assets);
    gameRef.current = game;

    game.onStatsUpdate = (newStats) => {
      setStats(newStats);
      if (newStats.distance > 0 && newStats.distance >= newStats.bestDistance && newStats.bestDistance > 0) {
        setIsNewRecord(true);
      }
    };

    game.onStateChange = (newState) => {
      setGameState(newState);
    };

    // Resize handling
    const handleResize = () => {
      game.resize();
    };
    window.addEventListener('resize', handleResize);

    // Global audio unlock on first user gesture
    const unlockAudio = () => {
      sound.ensureRunning();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });

    // Start main render loop
    const reqId = requestAnimationFrame(game.loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('click', unlockAudio);
      cancelAnimationFrame(reqId);
      game.stop();
    };
  }, [assets]);

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.code;
      sound.ensureRunning();

      if (key === 'Space' || key === 'ArrowUp' || key === 'KeyW') {
        e.preventDefault();
        if (gameState === 'START' || gameState === 'GAMEOVER') {
          handleStartGame();
        } else {
          gameRef.current?.handleJump();
        }
      } else if (key === 'ArrowDown' || key === 'KeyS') {
        e.preventDefault();
        gameRef.current?.handleSlide();
      } else if (key === 'KeyM') {
        handleToggleMute();
      } else if (key === 'KeyO') {
        handleToggleOrientation();
      } else if (key === 'KeyR' && gameState === 'GAMEOVER') {
        handleStartGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState]);

  // Touch Swipe Gesture Handlers
  const touchStartY = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    sound.ensureRunning();
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    sound.ensureRunning();
    const diffY = touchStartY.current - e.changedTouches[0].clientY;
    if (diffY > 40) {
      // Swiped UP -> Jump
      gameRef.current?.handleJump();
    } else if (diffY < -40) {
      // Swiped DOWN -> Slide
      gameRef.current?.handleSlide();
    }
  };

  const handleStartGame = () => {
    sound.ensureRunning();
    setIsNewRecord(false);
    gameRef.current?.start();
  };

  const handleToggleMute = useCallback(() => {
    const newState = sound.toggleMute();
    setIsMuted(newState);
  }, []);

  // Compute danger color and styling for close thrilling bull proximity
  const dangerRatio = Math.max(0, Math.min(1, 1 - (stats.bullDistanceMeters - 1.0) / 8.0));
  const isDangerCritical = stats.bullDistanceMeters < 3.2;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-stone-950 flex items-center justify-center select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 16:9 Game Container with Cinematic Border */}
      <div className="relative w-full h-full max-w-[177.78vh] max-h-[56.25vw] aspect-video bg-black shadow-2xl flex items-center justify-center overflow-hidden">
        {/* HTML5 Canvas Surface */}
        <canvas
          ref={canvasRef}
          className="w-full h-full block object-contain"
        />

        {/* Film grain & cinematic vignette overlay */}
        <div className="absolute inset-0 pointer-events-none cinematic-vignette film-grain" />

        {/* HUD - Active when PLAYING */}
        {gameState === 'PLAYING' && (
          <div className="absolute inset-0 pointer-events-none p-4 sm:p-6 flex flex-col justify-between">
            {/* Top Bar: Distance, Record, Speed, Danger Meter, Sound */}
            <div className="flex items-start justify-between gap-4">
              {/* Left: Distance, Speed & Authentic Tramo */}
              <div className="flex items-center gap-3 bg-stone-950/85 backdrop-blur-md px-4 py-2 rounded-xl border border-stone-800 shadow-xl pointer-events-auto">
                <div>
                  <div className="text-[10px] tracking-widest text-amber-500 font-semibold uppercase flex items-center gap-1">
                    <Activity className="w-3 h-3 text-red-500" /> Distancia
                  </div>
                  <div className="text-2xl sm:text-3xl font-stats font-bold text-white tracking-wider leading-none">
                    {stats.distance} <span className="text-xs text-stone-400 font-normal">M</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-stone-800 mx-1" />

                <div>
                  <div className="text-[10px] tracking-widest text-stone-400 font-semibold uppercase">
                    Velocidad
                  </div>
                  <div className="text-xl sm:text-2xl font-stats font-bold text-amber-200 tracking-wider leading-none">
                    {stats.speedKmh} <span className="text-xs text-stone-400 font-normal">KM/H</span>
                  </div>
                </div>

                <div className="h-8 w-px bg-stone-800 mx-1" />

                <div>
                  <div className="text-[9px] tracking-widest text-red-400 font-semibold uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Tramo
                  </div>
                  <div className="text-xs sm:text-sm font-cinematic font-bold text-stone-100 tracking-wide leading-tight truncate max-w-[130px] sm:max-w-[180px]">
                    {stats.currentTramoName}
                  </div>
                </div>

                {stats.bestDistance > 0 && (
                  <>
                    <div className="h-8 w-px bg-stone-800 mx-1 hidden md:block" />
                    <div className="hidden md:block">
                      <div className="text-[10px] tracking-widest text-stone-400 font-semibold uppercase flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-yellow-400" /> Récord
                      </div>
                      <div className="text-xl sm:text-2xl font-stats font-bold text-yellow-400 tracking-wider leading-none">
                        {stats.bestDistance} <span className="text-xs text-yellow-600 font-normal">M</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Center: Bull Proximity / Danger Gauge */}
              <div className="flex flex-col items-center max-w-[280px] w-full">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-200 flex items-center gap-1.5 shadow-lg ${
                    isDangerCritical
                      ? 'bg-red-600 text-white animate-pulse shadow-red-600/50'
                      : stats.bullDistanceMeters < 5.5
                      ? 'bg-amber-600 text-white shadow-amber-600/30'
                      : 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/60'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {isDangerCritical
                    ? `¡PELIGRO INMINENTE! ${stats.bullDistanceMeters.toFixed(1)} M`
                    : stats.bullDistanceMeters < 5.5
                    ? `¡A LAS ASTAS! ${stats.bullDistanceMeters.toFixed(1)} M`
                    : `DISTANCIA: ${stats.bullDistanceMeters.toFixed(1)} M`}
                </div>

                {/* Threat Progress Meter */}
                <div className="w-full bg-stone-900/90 border border-stone-800 h-2.5 rounded-full overflow-hidden mt-1.5 shadow-inner">
                  <div
                    className={`h-full transition-all duration-150 ${
                      isDangerCritical
                        ? 'bg-red-600'
                        : stats.bullDistanceMeters < 10
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, dangerRatio * 100)}%` }}
                  />
                </div>
              </div>

              {/* Right: Audio Mute & Mozo Orientation */}
              <div className="flex items-center gap-2 pointer-events-auto">

                {/* Orientation Toggle Button */}
                <button
                  onClick={handleToggleOrientation}
                  className="px-3 py-2 rounded-xl bg-stone-950/85 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white transition shadow-xl flex items-center gap-1.5"
                  title="Cambiar orientación del mozo (Tecla O)"
                >
                  <RotateCcw className={`w-4 h-4 ${isMozoFacingLeft ? 'text-amber-400 rotate-180' : 'text-stone-400'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline text-stone-300">
                    {isMozoFacingLeft ? 'Huida Izq' : 'Mirando Toro (Izq)'}
                  </span>
                </button>

                {/* Sound Mute Button */}
                <button
                  onClick={handleToggleMute}
                  className="p-2.5 rounded-xl bg-stone-950/85 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white transition shadow-xl"
                  title={isMuted ? 'Activar sonido' : 'Silenciar'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>

            {/* Bottom Mobile Action Buttons */}
            {gameState === 'PLAYING' && (
              <div className="flex items-end justify-between pointer-events-auto pb-2">
                {/* Slide Button */}
                <button
                  onClick={() => gameRef.current?.handleSlide()}
                  className="active:scale-95 transition flex items-center gap-3 bg-stone-900/90 hover:bg-stone-800 text-stone-100 font-bold px-7 py-4 rounded-2xl border border-stone-700 shadow-2xl backdrop-blur-md cursor-pointer"
                >
                  <ArrowDown className="w-6 h-6 text-amber-400" />
                  <div className="text-left">
                    <div className="text-sm font-cinematic uppercase tracking-wider">Deslizarse</div>
                    <div className="text-[10px] text-stone-400 font-normal">Flecha abajo / S</div>
                  </div>
                </button>

                {/* Jump Button */}
                <button
                  onClick={() => gameRef.current?.handleJump()}
                  className="active:scale-95 transition flex items-center gap-3 bg-red-600/95 hover:bg-red-500 text-white font-bold px-8 py-4 rounded-2xl border border-red-400 shadow-2xl shadow-red-950 backdrop-blur-md cursor-pointer"
                >
                  <ArrowUp className="w-6 h-6 text-white" />
                  <div className="text-left">
                    <div className="text-sm font-cinematic uppercase tracking-wider">Saltar</div>
                    <div className="text-[10px] text-red-200 font-normal">Espacio / Arriba</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Start Screen Overlay */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-stone-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            {/* Header / Subtitle */}
            <div className="text-xs sm:text-sm font-semibold tracking-widest text-red-500 uppercase mb-2 flex items-center gap-2">
              <span className="w-8 h-px bg-red-500" />
              Pamplona &bull; 7 de Julio &bull; 08:00 Horas
              <span className="w-8 h-px bg-red-500" />
            </div>

            {/* Cinematic Main Title */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-cinematic font-black tracking-wider text-stone-100 uppercase drop-shadow-2xl">
              San Fermín <span className="text-red-600">Run</span>
            </h1>

            <p className="text-xs sm:text-sm text-stone-300 max-w-xl mt-3 leading-relaxed">
              Recorrido oficial del encierro (1.200 m): Cuesta de Santo Domingo &bull; Plaza Consistorial &bull; Calle Mercaderes &bull; Calle Estafeta &bull; Callejón &bull; ¡Ruedo de la Plaza de Toros! Salta las barricas de vino y deslízate bajo los reposteros festivos.
            </p>

            {/* Control hints: 2 pure arcade buttons */}
            <div className="grid grid-cols-2 gap-4 my-6 max-w-md w-full text-left">
              <div className="bg-stone-900/90 border border-stone-800 p-3.5 rounded-xl">
                <div className="flex items-center gap-2 text-stone-200 text-sm font-semibold mb-1">
                  <ArrowUp className="w-4 h-4 text-red-400" /> Saltar
                </div>
                <div className="text-[11px] text-stone-400">Espacio, W o Flecha Arriba</div>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 p-3.5 rounded-xl">
                <div className="flex items-center gap-2 text-stone-200 text-sm font-semibold mb-1">
                  <ArrowDown className="w-4 h-4 text-amber-400" /> Deslizarse
                </div>
                <div className="text-[11px] text-stone-400">Flecha Abajo o S</div>
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={handleStartGame}
              disabled={!assets}
              className="group px-8 py-4 bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white font-cinematic font-bold tracking-widest text-lg sm:text-xl rounded-2xl shadow-2xl shadow-red-700/50 flex items-center gap-3 border border-red-400 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" />
              Comenzar Encierro
            </button>

            {stats.bestDistance > 0 && (
              <div className="mt-4 flex items-center gap-1.5 text-xs text-yellow-500 font-semibold tracking-wider">
                <Trophy className="w-4 h-4" />
                RÉCORD ACTUAL: {stats.bestDistance} METROS
              </div>
            )}
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-stone-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-700/60 text-red-400 text-xs font-semibold tracking-widest uppercase mb-2">
              <ShieldAlert className="w-4 h-4" /> Fin del Encierro
            </div>

            <h2 className="text-3xl sm:text-5xl font-cinematic font-black text-stone-100 uppercase tracking-wider">
              ¡Alcanzado por el <span className="text-red-600">Toro</span>!
            </h2>

            <div className="text-xs text-stone-300 font-semibold tracking-wide uppercase mt-1">
              Llegaste hasta: <span className="text-amber-400 font-bold">{stats.currentTramoName}</span>
            </div>

            {isNewRecord && (
              <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/20 border border-yellow-500 rounded-full text-yellow-400 font-bold text-xs tracking-wider animate-bounce">
                <Trophy className="w-4 h-4" /> ¡NUEVO RÉCORD PERSONAL!
              </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 max-w-xl w-full">
              <div className="bg-stone-900/90 border border-stone-800 p-3 rounded-xl">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider">Distancia</div>
                <div className="text-2xl sm:text-3xl font-stats font-bold text-white">
                  {stats.distance} <span className="text-xs text-stone-400 font-normal">m</span>
                </div>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 p-3 rounded-xl">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider">Récord</div>
                <div className="text-2xl sm:text-3xl font-stats font-bold text-yellow-400">
                  {stats.bestDistance} <span className="text-xs text-yellow-600 font-normal">m</span>
                </div>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 p-3 rounded-xl">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider">Velocidad Máx</div>
                <div className="text-2xl sm:text-3xl font-stats font-bold text-amber-300">
                  {stats.speedKmh} <span className="text-xs text-stone-400 font-normal">km/h</span>
                </div>
              </div>

              <div className="bg-stone-900/90 border border-stone-800 p-3 rounded-xl">
                <div className="text-[10px] text-stone-400 uppercase tracking-wider">Saltos & Slides</div>
                <div className="text-2xl sm:text-3xl font-stats font-bold text-stone-200">
                  {stats.jumpCount + stats.slideCount}
                </div>
              </div>
            </div>

            {/* Restart Button */}
            <button
              onClick={handleStartGame}
              className="px-8 py-4 bg-red-600 hover:bg-red-500 active:scale-95 transition-all text-white font-cinematic font-bold tracking-widest text-lg sm:text-xl rounded-2xl shadow-2xl shadow-red-700/50 flex items-center gap-3 border border-red-400 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              Correr de Nuevo
            </button>
            <div className="text-xs text-stone-500 mt-3">Pulsa Espacio o Enter para reiniciar</div>
          </div>
        )}

        {/* Initial Asset Loading State */}
        {!assets && (
          <div className="absolute inset-0 bg-stone-950 flex flex-col items-center justify-center p-6 text-center z-30">
            <h2 className="text-2xl sm:text-3xl font-cinematic font-bold text-stone-200 tracking-wider mb-2">
              San Fermín Run
            </h2>
            <p className="text-xs text-stone-400 mb-6">Cargando escenografía y modelos hiperrealistas de Pamplona...</p>

            <div className="w-64 bg-stone-800 h-2 rounded-full overflow-hidden border border-stone-700">
              <div
                className="bg-red-600 h-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-[11px] text-stone-500 mt-2 font-mono">{loadingProgress}%</div>

            {loadingError && (
              <div className="mt-4 text-xs text-red-400 bg-red-950/50 p-3 rounded-lg border border-red-800">
                {loadingError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
