/**
 * San Fermín Run - Realistic Cinematic 2D Arcade Engine
 * Realistic physics, anatomical procedural character motion, bull herd AI,
 * multi-layer parallax, lighting, camera shake, and collision detection.
 */

import { GameAssets } from './assets';
import { sound } from './audio';

export type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

export interface GameStats {
  distance: number; // in meters
  bestDistance: number;
  speedKmh: number;
  bullDistanceMeters: number; // e.g. 18m down to 0m
  adrenaline: number; // 0 to 100
  isAdrenalineActive: boolean;
  closeCalls: number;
  jumpCount: number;
  slideCount: number;
  currentTramoName: string; // e.g. "Cuesta de Santo Domingo", "Plaza Consistorial", etc.
}

export type ObstacleType = 'BARRIER' | 'BARRELS' | 'AWNING' | 'CRATES';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  passed: boolean;
  cleared: boolean;
  requiresSlide: boolean;
  dynamicState?: 'SPRINTING' | 'STUMBLING' | 'FALLEN';
  dynamicTimer?: number;
  warningText?: string;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
  vy: number;
}

export type StreetRunnerState = 'RUNNING' | 'OVERTAKEN' | 'TUMBLED';

export interface AmbientRunner {
  id: number;
  x: number;
  y: number;
  laneY: number;
  speed: number;
  scale: number;
  runCycle: number;
  state: StreetRunnerState;
  overtaken: boolean;
  tumbleTimer: number;
  tumbleRot: number;
  vy: number;
  airY: number;
  tumbleDir: number;
  calloutText?: string;
  calloutTimer: number;
  profileIndex: number;
  hasNewspaper: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation?: number;
  vRot?: number;
}

export class SanFerminGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private assets: GameAssets;
  private state: GameState = 'START';
  private animId: number = 0;
  private lastTime: number = 0;

  // Camera & viewport
  private width: number = 1280;
  private height: number = 720;
  private groundY: number = 550;
  private screenShake: number = 0;
  private cameraBob: number = 0;

  // Background Parallax Offsets
  private bgSkyOffset: number = 0;
  private bgMidOffset: number = 0;
  private bgNearOffset: number = 0;
  private bgGroundOffset: number = 0;

  // Player (Mozo)
  private playerX: number = 640;
  private playerY: number = 0; // relative to ground
  private playerVy: number = 0;
  private isGrounded: boolean = true;
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private stumbleTimer: number = 0;
  private runCycleTime: number = 0;
  private isPlayerTumbling: boolean = false;
  private isPlayerTripped: boolean = false;
  private playerTumbleTimer: number = 0;
  private playerTumbleRot: number = 0;
  private playerTumbleDir: number = 1;
  private playerTumbleVy: number = 0;
  private playerTumbleAirY: number = 0;

  // Bull Herd (Manada de Toros Bravos)
  private bullOffsetMeters: number = 6.0; // Close thrill baseline distance behind player
  private bullGallopTime: number = 0;
  private bull0GallopTime: number = 0; // Phase-continuous gallop timer for breakaway lead bull
  private bullSnortTimer: number = 0;
  private bullTargetOffset: number = 6.0;
  private herdTime: number = 0; // Harmonic surge & lag time for organic pack behavior
  private estafetaSurgeBlend: number = 0; // Continuous time-damped lerp for Estafeta breakaway bull
  private hasTriggeredEstafetaRush: boolean = false; // Dramatic breakaway bull sound in Calle Estafeta
  private hasTriggeredPlazaRush: boolean = false; // Climax breakaway bull sound in Ruedo de la Plaza de Toros

  // Gameplay variables
  private distanceTraveled: number = 0; // in meters
  private currentSpeed: number = 385; // base speed in px/s (+20% global boost)
  private adrenaline: number = 40; // 0 - 100
  private isAdrenalineActive: boolean = false;
  private adrenalineTimer: number = 0;
  private closeCalls: number = 0;
  private jumpCount: number = 0;
  private slideCount: number = 0;
  private bestDistance: number = 0;

  // Entities & FX
  private obstacles: Obstacle[] = [];
  private nextObstacleDistance: number = 15; // in meters
  private nextObstacleId: number = 1;
  private particles: Particle[] = [];
  private confetti: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextFloatingTextId: number = 1;
  private ambientRunners: AmbientRunner[] = [];
  private nextRunnerId: number = 1;
  private runnerSpawnTimer: number = 5.0;
  private mercaderesCheerTimer: number = 0; // Balcony cheers timer in Calle Mercaderes

  // Callbacks for React HUD
  public onStatsUpdate?: (stats: GameStats) => void;
  public onStateChange?: (state: GameState) => void;

  constructor(canvas: HTMLCanvasElement, assets: GameAssets) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
    this.assets = assets;

    // Connect articulated character ground impact audio and particle physics
    if (this.assets.characterAnim) {
      this.assets.characterAnim.onGroundImpact = (effect) => {
        if (this.state !== 'PLAYING') return;
        if (effect.isBull) {
          const dangerProximity = Math.max(0, 1 - this.getClosestBullDistance() / 18);
          sound.playHoofBeat(0.4 + dangerProximity * 0.6);
          this.spawnDust(effect.x, effect.y, 4, true);
          this.spawnSparks(effect.x, effect.y, 3);
        } else if (this.isGrounded && !this.isSliding) {
          sound.playFootstep();
          this.spawnDust(effect.x, effect.y, 2, false);
        }
      };
    }

    // Load best distance
    const savedBest = localStorage.getItem('sanfermin_best_record');
    this.bestDistance = savedBest ? parseFloat(savedBest) : 0;

    this.resize();
    this.initConfetti();
  }

  public resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Use fixed logical aspect ratio (16:9) with crisp scaling
    const targetAspect = 16 / 9;
    let w = rect.width;
    let h = rect.height;

    if (w / h > targetAspect) {
      w = h * targetAspect;
    } else {
      h = w / targetAspect;
    }

    this.width = 1280;
    this.height = 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Road surface level
    this.groundY = 560;
    this.playerX = 640;
  }

  private initConfetti() {
    this.confetti = [];
    for (let i = 0; i < 35; i++) {
      this.confetti.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height * 0.6,
        vx: 15 + Math.random() * 25,
        vy: 15 + Math.random() * 25,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.4 ? '#E11D48' : '#FFFFFF', // Red & White San Fermín colors
        alpha: 0.6 + Math.random() * 0.4,
        decay: 0,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3,
      });
    }
  }

  public start() {
    sound.init();
    sound.ensureRunning();
    sound.playChupinazo();

    this.state = 'PLAYING';
    this.distanceTraveled = 0;
    this.currentSpeed = 385; // base starting speed (+20%)
    this.bullOffsetMeters = 6.0;
    this.bullTargetOffset = 6.0;
    this.herdTime = 0;
    this.bull0GallopTime = 0;
    this.estafetaSurgeBlend = 0;
    this.hasTriggeredEstafetaRush = false;
    this.hasTriggeredPlazaRush = false;
    this.mercaderesCheerTimer = 0;
    this.runnerSpawnTimer = 3.2; // Quick initial reinforcements
    this.adrenaline = 40;
    this.isAdrenalineActive = false;
    this.obstacles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.initAmbientRunners();
    this.nextObstacleDistance = 18;
    this.playerY = 0;
    this.playerVy = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.stumbleTimer = 0;
    this.isPlayerTumbling = false;
    this.isPlayerTripped = false;
    this.playerTumbleTimer = 0;
    this.playerTumbleRot = 0;
    this.playerTumbleDir = 1;
    this.playerTumbleVy = 0;
    this.playerTumbleAirY = 0;
    this.playerX = 640;
    this.closeCalls = 0;
    this.jumpCount = 0;
    this.slideCount = 0;

    this.onStateChange?.(this.state);
  }

  private getRunnerTramoConfig(): { maxRunners: number; spawnDelayMin: number; spawnDelayMax: number; pelotonSize: number } {
    const m = Math.floor(this.distanceTraveled) % 1200;
    if (m < 180) {
      // Tramo 1: Cuesta de Santo Domingo - Marea humana masiva de salida
      return { maxRunners: 16, spawnDelayMin: 2.8, spawnDelayMax: 3.8, pelotonSize: 4 + Math.floor(Math.random() * 3) }; // 4 to 6 mozos
    }
    if (m < 350) {
      // Tramo 2: Plaza Consistorial - Gran muchedumbre abriéndose en la plaza
      return { maxRunners: 12, spawnDelayMin: 3.4, spawnDelayMax: 4.5, pelotonSize: 3 + Math.floor(Math.random() * 3) }; // 3 to 5 mozos
    }
    if (m < 500) {
      // Tramo 3: Calle Mercaderes - Pelotones en curva
      return { maxRunners: 9, spawnDelayMin: 3.8, spawnDelayMax: 5.0, pelotonSize: 3 + Math.floor(Math.random() * 2) }; // 3 to 4 mozos
    }
    if (m < 750) {
      // Tramo 4: Calle Estafeta - Carrera de relevos veloz y estirada
      return { maxRunners: 7, spawnDelayMin: 4.2, spawnDelayMax: 5.5, pelotonSize: 2 + Math.floor(Math.random() * 2) }; // 2 to 3 mozos
    }
    // Tramo 5 y 6: Callejón de la Plaza y Ruedo de la Plaza de Toros - Corredores selectos
    return { maxRunners: 4, spawnDelayMin: 5.0, spawnDelayMax: 6.5, pelotonSize: 1 + Math.floor(Math.random() * 2) }; // 1 to 2 mozos
  }

  private initAmbientRunners() {
    this.ambientRunners = [];
    // Opening crowd wave down Cuesta de Santo Domingo: 14 mozos running ahead!
    this.spawnRunnerPeloton(this.playerX + 220, 3);
    this.spawnRunnerPeloton(this.playerX + 480, 4);
    this.spawnRunnerPeloton(this.playerX + 780, 4);
    this.spawnRunnerPeloton(this.playerX + 1140, 3);
  }

  private spawnRunnerPeloton(baseX: number = this.width + 120, forcedCount?: number) {
    const config = this.getRunnerTramoConfig();
    const count = forcedCount !== undefined ? forcedCount : config.pelotonSize;
    const lanes = [-16, -11, -7, -3, 2, 7].sort(() => Math.random() - 0.5);
    const baseGroupSpeed = Math.max(260, this.currentSpeed * (0.69 + Math.random() * 0.08));

    for (let i = 0; i < count; i++) {
      const laneY = lanes[i % lanes.length];
      const laneNorm = (laneY + 16) / 23; // 0 to 1
      const scale = 0.85 + laneNorm * 0.10; // 0.85 (back) to 0.95 (front)
      const xOffset = i * (35 + Math.random() * 28) + (Math.random() - 0.5) * 15;
      const speed = baseGroupSpeed + (Math.random() - 0.5) * 20;

      // Authentic Pamplona crowd diversity: photographic runner profiles
      // 0: Castaño clásico (original)
      // 1: Rubio dorado
      // 2: Moreno azabache
      // 3: Pelirrojo / Cobrizo
      // 4: Canoso plateado
      // 5: Corredor negro / afro (piel oscura y pelo negro)
      const profileIndex = Math.floor(Math.random() * 6);
      const hasNewspaper = Math.random() < 0.28; // ~28% portan periódico de Pamplona enrollado en mano

      this.ambientRunners.push({
        id: this.nextRunnerId++,
        x: baseX + xOffset,
        y: this.groundY + laneY,
        laneY,
        speed,
        scale,
        runCycle: Math.random() * 6,
        state: 'RUNNING',
        overtaken: false,
        tumbleTimer: 0,
        tumbleRot: 0,
        vy: 0,
        airY: 0,
        tumbleDir: 0,
        calloutTimer: 0,
        profileIndex,
        hasNewspaper,
      });
    }
  }

  public addFloatingText(x: number, y: number, text: string, color: string = '#10B981') {
    this.floatingTexts.push({
      id: this.nextFloatingTextId++,
      x,
      y,
      text,
      color,
      alpha: 1.0,
      scale: 1.0,
      vy: -50,
    });
  }

  public restart() {
    this.start();
  }

  // Input Handlers
  public handleJump() {
    if (this.state !== 'PLAYING' || this.isPlayerTumbling || this.isPlayerTripped) return;
    if (this.isGrounded && !this.isSliding && this.stumbleTimer <= 0) {
      this.isGrounded = false;
      this.playerVy = -780; // Crisp, athletic ballistic jump
      this.jumpCount++;
      sound.playJump();

      // Foot dust on jump takeoff
      this.spawnDust(this.playerX + 20, this.groundY - 10, 8);
    }
  }

  public handleSlide() {
    if (this.state !== 'PLAYING' || this.isPlayerTumbling || this.isPlayerTripped) return;
    if (this.isGrounded && !this.isSliding && this.stumbleTimer <= 0) {
      this.isSliding = true;
      this.slideTimer = 0.55; // slide duration in seconds
      this.slideCount++;
      sound.playSlide();

      // Stone friction dust trail and sparks
      this.spawnDust(this.playerX + 10, this.groundY - 5, 10);
      this.spawnSparks(this.playerX + 10, this.groundY - 5, 4);
    }
  }

  public handleAdrenalineSprint() {
    if (this.state !== 'PLAYING') return;
    if (this.adrenaline >= 80 && !this.isAdrenalineActive) {
      this.isAdrenalineActive = true;
      this.adrenalineTimer = 3.5; // 3.5 seconds burst
      this.adrenaline = 0;
      sound.playDash();

      // Safety distance boost
      this.bullTargetOffset = Math.min(15, this.bullTargetOffset + 4.5);
    }
  }

  private spawnDust(x: number, y: number, count: number = 6, isBull: boolean = false) {
    const m = this.distanceTraveled % 1200;
    const isSand = m >= 940 && m <= 1190;
    const dustColor = isSand ? '#E8C07D' : '#D7CBB5';

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: (isBull ? -1 : -1) * (60 + Math.random() * 120),
        vy: -20 - Math.random() * 40,
        size: isBull ? 5 + Math.random() * 8 : 3 + Math.random() * 5,
        color: dustColor,
        alpha: 0.7,
        decay: 1.4 + Math.random() * 0.8,
      });
    }
  }

  private spawnSparks(x: number, y: number, count: number = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 4,
        vx: -70 - Math.random() * 120,
        vy: -20 - Math.random() * 50,
        size: 1.5 + Math.random() * 2,
        color: Math.random() > 0.4 ? '#FBBF24' : '#F97316',
        alpha: 0.95,
        decay: 3.5 + Math.random() * 2.0,
      });
    }
  }

  private spawnObstacle() {
    // Authentic San Fermin encierro street obstacles (fences, wine barrels, crates, and elevated hanging banners)
    const pick = Math.random();
    let type: ObstacleType = 'BARRIER';

    if (pick < 0.28) {
      type = 'BARRIER'; // Iconic San Fermin wooden fence (jump)
    } else if (pick < 0.60) {
      type = 'AWNING'; // Festive street banner suspended overhead (slide)
    } else if (pick < 0.80) {
      type = 'BARRELS'; // Oak wine barrels from Navarra (jump)
    } else {
      type = 'CRATES'; // Mercado de Santo Domingo produce crates (jump)
    }

    let width = 72;
    let height = 84;
    let y = this.groundY - height;
    let requiresSlide = false;

    if (type === 'BARRIER') {
      // Authentic Pamplona double pine timber barrier
      width = 72;
      height = 84;
      y = this.groundY - height;
    } else if (type === 'BARRELS') {
      // Stacked oak wine barrels
      width = 70;
      height = 80;
      y = this.groundY - height;
    } else if (type === 'CRATES') {
      // Weathered produce crates from Mercado de Santo Domingo
      width = 68;
      height = 70;
      y = this.groundY - height;
    } else if (type === 'AWNING') {
      // Hanging festival banner suspended overhead across the street.
      // Elevated so the bottom of the sign is right at runner head level (groundY - 132).
      // The standing runner's head (height ~148px) collides if not ducking; sliding runner passes smoothly underneath.
      width = 112;
      height = 70;
      y = this.groundY - 202; // Bottom of banner at groundY - 132 (head height)
      requiresSlide = true;
    }

    this.obstacles.push({
      id: this.nextObstacleId++,
      type,
      x: this.width + 100,
      y,
      width,
      height,
      passed: false,
      cleared: false,
      requiresSlide,
      warningText: '¡AY!',
    });
  }

  private update(dt: number) {
    if (this.state !== 'PLAYING') {
      // Gentle idle animation in start / gameover
      this.runCycleTime += dt * 2;
      return;
    }

    // 0. Dramatic cinematic tumble & trample: bulls continue charging forward past the fallen runner!
    if (this.isPlayerTumbling) {
      this.playerTumbleTimer -= dt;
      this.playerTumbleRot += this.playerTumbleDir * dt * 4.4;

      // Ballistic parabolic trajectory with gravity and ground bounce
      this.playerTumbleVy += 540 * dt;
      this.playerTumbleAirY += this.playerTumbleVy * dt;
      if (this.playerTumbleAirY > 0) {
        this.playerTumbleAirY = 0;
        this.playerTumbleVy = -this.playerTumbleVy * 0.22;
        if (Math.random() < 0.45) {
          this.spawnDust(this.playerX + 48, this.groundY - 5, 4, false);
        }
      }

      // Fallen runner loses ground momentum and stays on the cobblestones
      this.playerX -= 60 * dt;

      // The manada NEVER stops: 600kg bulls maintain full charging gallop speed towards the arena!
      // In tumble, bulls accelerate forward (decreasing bullOffsetMeters into large negative values)
      this.bullOffsetMeters -= dt * 18.0; // Bulls surge past at ~18m/s (65 km/h)
      this.bullGallopTime += dt * 14;
      this.bull0GallopTime += dt * 14;
      this.herdTime += dt;

      // Ground vibrations and heavy hoofbeats as bulls sweep past
      if (Math.random() < 0.35) {
        sound.playHoofBeat(0.9);
      }
      // Dust clouds kicked up behind the galloping herd
      if (Math.random() < 0.5) {
        const kickX = this.getBullScreenX(0) + Math.random() * 200;
        this.spawnDust(kickX, this.groundY - 5, 8, true);
      }

      // Decelerate background scrolling to a smooth stop while herd sweeps away
      this.currentSpeed = Math.max(0, this.currentSpeed - dt * 280);
      const pxMoved = this.currentSpeed * dt;
      this.bgGroundOffset = (this.bgGroundOffset + pxMoved * 1.0) % 2000;

      // Camera shake decay (gradually subsiding after herd moves into distance)
      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - dt * 14);
      }

      // Update floating texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.alpha -= dt * 0.85;
        if (ft.alpha <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update Confetti ribbons
      for (const c of this.confetti) {
        c.x -= (this.currentSpeed * 0.35 + c.vx) * dt;
        c.y += c.vy * dt;
        if (c.rotation !== undefined && c.vRot !== undefined) {
          c.rotation += c.vRot * dt;
        }
        if (c.y > this.height) {
          c.y = -10;
          c.x = Math.random() * this.width;
        }
        if (c.x < -20) {
          this.confetti.splice(this.confetti.indexOf(c), 1);
        }
      }

      // Transition to GAMEOVER modal ONLY after herd has completely passed and surged ahead
      if (this.playerTumbleTimer <= 0) {
        this.isPlayerTumbling = false;
        this.state = 'GAMEOVER';
        sound.playGameOver();
        this.onStateChange?.(this.state);
      }
      return;
    }

    // 0b. Obstacle trip: runner stumbles and slides forward on the ground with momentum while herd closes in
    if (this.isPlayerTripped) {
      // Runner is grounded and in stumble/derrape pose
      this.stumbleTimer = 1.0;
      this.isGrounded = true;
      this.playerY = 0;
      this.playerVy = 0;

      // Inertial ground friction smoothly decelerates runner
      this.currentSpeed = Math.max(90, this.currentSpeed - dt * 260);
      const pxMoved = this.currentSpeed * dt;
      this.distanceTraveled += pxMoved / 40;

      // Parallax Background scrolling continues organically
      this.bgSkyOffset += pxMoved * 0.08;
      this.bgMidOffset += pxMoved * 0.45;
      this.bgNearOffset += pxMoved * 0.75;
      this.bgGroundOffset = (this.bgGroundOffset + pxMoved * 1.0) % 2000;

      // Obstacles shift backward naturally with runner momentum
      for (const obs of this.obstacles) {
        obs.x -= pxMoved;
      }

      // Stone friction sparks & dust trail under stumbling runner
      if (Math.random() < 0.65) {
        this.spawnDust(this.playerX + 35, this.groundY - 4, 3, false);
        this.spawnSparks(this.playerX + 35, this.groundY - 4, 2);
      }

      // Bull herd rapidly closes the remaining distance at charging gallop (~55+ km/h vs our slowing mozo)
      this.bullOffsetMeters -= dt * 11.5;
      this.bullGallopTime += dt * 14;
      this.bull0GallopTime += dt * 14;
      this.herdTime += dt;

      // Camera shake decay
      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - dt * 25);
      }

      // Check if foremost bull reaches the sliding/stumbling runner -> Full bovine trample!
      const closestBullMeters = this.getClosestBullDistance();
      if (closestBullMeters <= 0.75) {
        this.isPlayerTripped = false;
        this.triggerTumble('¡ARROLLADO POR LA MANADA!');
      }

      // Update floating texts
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.alpha -= dt * 0.85;
        if (ft.alpha <= 0) {
          this.floatingTexts.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update Confetti ribbons
      for (const c of this.confetti) {
        c.x -= (this.currentSpeed * 0.35 + c.vx) * dt;
        c.y += c.vy * dt;
        if (c.rotation !== undefined && c.vRot !== undefined) {
          c.rotation += c.vRot * dt;
        }
        if (c.y > this.height) {
          c.y = -10;
          c.x = Math.random() * this.width;
        }
        if (c.x < -20) {
          c.x = this.width + 20;
        }
      }

      return;
    }

    // Speed progression: 385 px/s (35 km/h) up to 660 px/s (59 km/h) (+20% global boost)
    const baseTargetSpeed = Math.min(660, 385 + this.distanceTraveled * 0.54);
    const speedMultiplier = this.isAdrenalineActive ? 1.4 : (this.stumbleTimer > 0 ? 0.65 : 1.0);
    this.currentSpeed = baseTargetSpeed * speedMultiplier;

    const pxMoved = this.currentSpeed * dt;
    // 1 meter = approx 40 pixels on screen
    const metersMoved = pxMoved / 40;
    this.distanceTraveled += metersMoved;

    // Check if new record
    if (this.distanceTraveled > this.bestDistance) {
      this.bestDistance = Math.floor(this.distanceTraveled);
      localStorage.setItem('sanfermin_best_record', String(this.bestDistance));
    }

    // Parallax Background scrolling
    this.bgSkyOffset += pxMoved * 0.08;
    this.bgMidOffset += pxMoved * 0.45;
    this.bgNearOffset += pxMoved * 0.75;
    this.bgGroundOffset = (this.bgGroundOffset + pxMoved * 1.0) % 2000;

    // Adrenaline mechanics
    if (this.isAdrenalineActive) {
      this.adrenalineTimer -= dt;
      if (this.adrenalineTimer <= 0) {
        this.isAdrenalineActive = false;
      }
    } else {
      // Passively build adrenaline
      this.adrenaline = Math.min(100, this.adrenaline + dt * 4.5);
    }

    // Mozo Jump Physics
    if (!this.isGrounded) {
      this.playerY += this.playerVy * dt;
      this.playerVy += 2100 * dt; // Gravity
      if (this.playerY >= 0) {
        this.playerY = 0;
        this.playerVy = 0;
        this.isGrounded = true;
        sound.playFootstep();
        this.spawnDust(this.playerX + 25, this.groundY, 4);
      }
    } else {
      // Natural athletic stride cadence - paced with weight and grounded momentum
      this.runCycleTime += dt * (this.currentSpeed / 88);
    }

    // Slide timer
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (Math.random() < 0.5) {
        this.spawnDust(this.playerX + 30, this.groundY - 5, 2);
        this.spawnSparks(this.playerX + 25, this.groundY - 4, 1);
      }
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // Stumble timer
    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= dt;
    }

    // Obstacle Spawning
    if (this.distanceTraveled >= this.nextObstacleDistance) {
      this.spawnObstacle();
      // Next obstacle in 16 to 30 meters (well calibrated for faster reaction pace)
      this.nextObstacleDistance = this.distanceTraveled + 16 + Math.random() * 14;
    }

    // Update Obstacles & Collision Check
    const playerHitbox = this.getPlayerHitbox();

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= pxMoved;

      // Check collision with fair play margins
      if (!obs.cleared && !obs.passed) {
        const marginX = 8;
        const marginY = 6;
        const obsHitboxX = obs.x + marginX;
        const obsHitboxW = Math.max(10, obs.width - marginX * 2);

        const xOverlap =
          playerHitbox.x < obsHitboxX + obsHitboxW &&
          playerHitbox.x + playerHitbox.width > obsHitboxX;

        if (obs.requiresSlide) {
          // Overhead street banner at head height
          if (xOverlap) {
            if (this.isSliding) {
              // Successfully ducked & slid under banner!
              obs.cleared = true;
              this.bullTargetOffset = Math.min(10.0, this.bullTargetOffset + 0.65);
            } else {
              // Standing or jumping runner collides head-on with street banner -> Halted and tripped!
              obs.passed = true;
              this.triggerTrip('¡TROPIEZO CON PANCARTA!');
            }
          }
        } else {
          // Ground hurdle obstacle (BARRIER, BARRELS, CRATES)
          const obsHitboxY = obs.y + marginY;
          const obsHitboxH = Math.max(10, obs.height - marginY);

          const overlaps =
            xOverlap &&
            playerHitbox.y < obsHitboxY + obsHitboxH &&
            playerHitbox.y + playerHitbox.height > obsHitboxY;

          if (overlaps) {
            if (!this.isGrounded && playerHitbox.y + playerHitbox.height < obs.y + 18) {
              // Clean jump over!
              obs.cleared = true;
              this.bullTargetOffset = Math.min(10.0, this.bullTargetOffset + 0.65);
            } else {
              // Obstacle collision -> Immediately halted and tripped on cobblestones!
              obs.passed = true;
              const obsName =
                obs.type === 'BARRIER'
                  ? '¡TROPIEZO CON VALLA!'
                  : obs.type === 'BARRELS'
                  ? '¡TROPIEZO CON BARRILES!'
                  : '¡TROPIEZO CON CAJAS!';
              this.triggerTrip(obsName);
            }
          }
        }
      }

      // Passed without hit reward
      if (!obs.passed && obs.x + obs.width < playerHitbox.x) {
        obs.passed = true;
        // Reward dodging: keep bulls at bay
        this.bullTargetOffset = Math.min(10.0, this.bullTargetOffset + 0.35);
      }

      // Remove offscreen obstacles
      if (obs.x < -150) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update floating action text popups
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 0.85;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Periodically spawn authentic Pamplona runner pelotons ahead with tramo-based cadence
    this.runnerSpawnTimer -= dt;
    if (this.runnerSpawnTimer <= 0) {
      const config = this.getRunnerTramoConfig();
      this.runnerSpawnTimer = config.spawnDelayMin + Math.random() * (config.spawnDelayMax - config.spawnDelayMin);
      if (this.ambientRunners.length < config.maxRunners) {
        this.spawnRunnerPeloton(this.width + 100, config.pelotonSize);
      }
    }

    // Update Street Runners (overtaking & herd sweeping dynamics)
    const herd = this.getHerdMembers();
    const leadingBullFrontX = Math.max(...herd.map((b) => b.screenX + 170));

    for (let i = this.ambientRunners.length - 1; i >= 0; i--) {
      const ar = this.ambientRunners[i];

      if (ar.state === 'TUMBLED') {
        ar.tumbleTimer -= dt;
        ar.tumbleRot += (ar.tumbleDir > 0 ? 1 : -1) * dt * 4.2;

        // Ballistic parabolic trajectory with gravity and ground bounce
        ar.vy += 500 * dt;
        ar.airY += ar.vy * dt;
        if (ar.airY > 0) {
          ar.airY = 0;
          ar.vy = -ar.vy * 0.22;
          if (Math.random() < 0.4) {
            this.spawnDust(ar.x, this.groundY + ar.laneY, 3, false);
          }
        }

        // Swept backwards by the charging manada, tumbling outward toward barricades
        ar.x -= (this.currentSpeed * 0.95 + 130) * dt;
        ar.y += ar.tumbleDir * dt * 26;

        if (ar.x < -200 || ar.tumbleTimer <= -1.2) {
          this.ambientRunners.splice(i, 1);
          continue;
        }
      } else {
        const relativeSpeed = ar.speed - this.currentSpeed;
        ar.x += relativeSpeed * dt;
        ar.runCycle += dt * (ar.speed / 75);

        if (ar.calloutTimer > 0) {
          ar.calloutTimer -= dt;
        }

        // 1. Overtaken by Player (at normal pace, no obstacle collision needed)
        if (!ar.overtaken && this.playerX > ar.x - 20) {
          ar.overtaken = true;
          ar.state = 'OVERTAKEN';

          // Rewarding natural overtake cleanly without visual text clutter
          this.adrenaline = Math.min(100, this.adrenaline + 4);
        }

        // 2. Swept by the charging Bull Herd ("se los lleva la manada")
        if (ar.x <= leadingBullFrontX + 10) {
          ar.state = 'TUMBLED';
          ar.tumbleTimer = 1.1;
          ar.tumbleDir = ar.laneY < -8 ? -1 : 1;
          ar.vy = -180 - Math.random() * 60; // Tossed upward in a dramatic parabolic arc
          ar.airY = 0;

          // Impact cloud & hoof sparks in their respective lane
          this.spawnDust(ar.x + 25, this.groundY + ar.laneY, 14, true);
          this.spawnSparks(ar.x + 25, this.groundY + ar.laneY, 6);
          sound.playStumble();
          this.screenShake = Math.max(this.screenShake, 7);
        }

        if (ar.x < -250) {
          this.ambientRunners.splice(i, 1);
          continue;
        }
      }
    }

    // Toro Bravo AI & Pursuit Dynamics
    // Ferocious herd slowly and inexorably creeps forward
    this.bullTargetOffset = Math.max(1.5, this.bullTargetOffset - dt * 0.12);

    // Smooth lerp to target distance
    this.bullOffsetMeters += (this.bullTargetOffset - this.bullOffsetMeters) * (dt * 2.4);
    this.herdTime += dt;

    // Breakaway Bull dramatic surge dynamics:
    // 1. Calle Estafeta (500m - 750m)
    // 2. Ruedo de la Plaza de Toros climax (950m - 1185m)
    const m = this.distanceTraveled % 1200;
    const isEstafetaZone = m >= 495 && m <= 745;
    const isPlazaZone = m >= 950 && m <= 1185;
    const isSurgeZone = isEstafetaZone || isPlazaZone;
    const targetSurge = isSurgeZone ? 1.0 : 0.0;
    // Asymmetric smooth lerping: aggressive surge forward (lerp rate 2.2), smooth natural fallback (lerp rate 1.4)
    const surgeRate = targetSurge > this.estafetaSurgeBlend ? 2.2 : 1.4;
    this.estafetaSurgeBlend += (targetSurge - this.estafetaSurgeBlend) * Math.min(1.0, dt * surgeRate);

    // Continuous gallop timers: general herd and independent phase-continuous lead bull
    this.bullGallopTime += dt * 11;
    this.bull0GallopTime += dt * (11 + this.estafetaSurgeBlend * 3.2);

    const closestBullMeters = this.getClosestBullDistance();

    // Bull Gallop & Hoof Beats
    if (Math.sin(this.bullGallopTime) > 0.9) {
      const dangerProximity = Math.max(0, 1 - closestBullMeters / 9);
      sound.playHoofBeat(0.5 + dangerProximity * 0.5);
      const bullScreenX = this.getBullScreenX(closestBullMeters);
      this.spawnDust(bullScreenX + 110, this.groundY - 15, 4, true);
    }

    // Bull Snort occasionally
    this.bullSnortTimer += dt;
    if (this.bullSnortTimer > 3.8 + Math.random() * 2.5) {
      this.bullSnortTimer = 0;
      sound.playBullSnort();
    }

    // Estafeta Breakaway Bull dramatic surge cue (500m to 750m)
    if (isEstafetaZone) {
      if (!this.hasTriggeredEstafetaRush) {
        this.hasTriggeredEstafetaRush = true;
        sound.playBullSnort();
        this.screenShake = 14;
      }
    } else if (m < 480 || (m > 760 && m < 930)) {
      this.hasTriggeredEstafetaRush = false;
    }

    // Plaza de Toros Ruedo Climax surge cue (950m to 1185m)
    if (isPlazaZone) {
      if (!this.hasTriggeredPlazaRush) {
        this.hasTriggeredPlazaRush = true;
        sound.playBullSnort();
        this.screenShake = 16;
      }
    } else if (m < 930 || m > 1195) {
      this.hasTriggeredPlazaRush = false;
    }

    // Danger rumble & screen shake if foremost bull is close (< 3.8m outside Estafeta, or in Estafeta surge)
    const isUnderPressure = closestBullMeters < 3.8 || (this.estafetaSurgeBlend > 0.6 && !this.isAdrenalineActive);
    if (isUnderPressure) {
      const tensionShake = this.estafetaSurgeBlend > 0.6 ? 2.8 : (3.8 - closestBullMeters) * 2.2;
      this.screenShake = Math.max(this.screenShake, tensionShake);
      if (Math.random() < 0.1) {
        sound.playHeartbeat();
      }
      this.closeCalls++;
    }

    // Dramatic bull collision: Leading bull horns reach the mozo!
    if (closestBullMeters <= 0.75 && !this.isPlayerTumbling) {
      this.triggerTumble('¡COGIDA POR EL TORO!');
    }

    // Decay screen shake
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Dynamic Camera Bob
    this.cameraBob = Math.sin(this.runCycleTime * 2) * 2.5;

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= p.decay * dt;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Confetti ribbons
    for (const c of this.confetti) {
      c.x -= (this.currentSpeed * 0.35 + c.vx) * dt;
      c.y += c.vy * dt;
      if (c.rotation !== undefined && c.vRot !== undefined) {
        c.rotation += c.vRot * dt;
      }
      if (c.y > this.height) {
        c.y = -10;
        c.x = Math.random() * this.width;
      }
      if (c.x < -20) {
        c.x = this.width + 20;
      }
    }

    // Audio crowd excitement factors
    const speedFactor = Math.min(1, Math.max(0, (this.currentSpeed - 385) / 275));
    const dangerFactor = Math.max(0, 1 - closestBullMeters / 15);

    // Multi-tramo Street Fiesta sound intensity progression (Option 2)
    // - Santo Domingo (0-180m): 0.25 (anticipation, distant party, echoes)
    // - Plaza Consistorial (180-350m): 0.65 (crowd thickens, brass music clear)
    // - Calle Mercaderes (350-500m): 0.90 (high festive excitement in narrow passage)
    // - Calle Estafeta (500-750m): 0.85 (heart of the run, echoing balconies)
    // - Callejón de la Plaza (750-950m): 0.92 (corridor buildup before the arena)
    // - Ruedo de la Plaza de Toros (950-1200m): 1.00 (maximum celebration & grand arena clamor)
    let tramoIntensity = 0.25;
    if (m < 180) {
      // Santo Domingo: starts subtle at 0.20, ramps to 0.45 nearing Consistorial
      tramoIntensity = 0.20 + (m / 180) * 0.25;
    } else if (m < 350) {
      // Plaza Consistorial: 0.45 ramps to 0.75
      tramoIntensity = 0.45 + ((m - 180) / 170) * 0.30;
    } else if (m < 500) {
      // Calle Mercaderes: 0.75 to 0.90
      tramoIntensity = 0.75 + ((m - 350) / 150) * 0.15;
    } else if (m < 750) {
      // Calle Estafeta: maintains 0.85 with natural variation
      tramoIntensity = 0.85 + Math.sin(m * 0.05) * 0.05;
    } else if (m < 950) {
      // Callejón: ramps from 0.85 to 0.95 approaching the arena
      tramoIntensity = 0.85 + ((m - 750) / 200) * 0.10;
    } else {
      // Plaza de Toros (950m - 1200m): 1.0 climax!
      tramoIntensity = 1.0;
    }

    // Periodic festive crowd cheers along the course (faster in intense zones)
    this.mercaderesCheerTimer -= dt;
    if (this.mercaderesCheerTimer <= 0) {
      this.mercaderesCheerTimer = (1.2 + Math.random() * 1.8) / Math.max(0.4, tramoIntensity);
      sound.playCrowdCheer(tramoIntensity);
    }

    sound.updateCrowdExcitement(speedFactor, dangerFactor, tramoIntensity);

    // Push HUD Stats
    this.onStatsUpdate?.({
      distance: Math.floor(this.distanceTraveled),
      bestDistance: this.bestDistance,
      speedKmh: Math.round((this.currentSpeed / 40) * 3.6),
      bullDistanceMeters: Math.max(0, Math.round(closestBullMeters * 10) / 10),
      adrenaline: Math.round(this.adrenaline),
      isAdrenalineActive: this.isAdrenalineActive,
      closeCalls: this.closeCalls,
      jumpCount: this.jumpCount,
      slideCount: this.slideCount,
      currentTramoName: this.getCurrentTramoName(),
    });
  }

  public triggerTrip(causeText: string) {
    if (this.isPlayerTripped || this.isPlayerTumbling || this.state !== 'PLAYING') return;
    this.isPlayerTripped = true;
    this.currentSpeed = Math.max(170, this.currentSpeed * 0.52); // Inertial slide/derrape, not a dead freeze!
    this.isSliding = false;
    this.stumbleTimer = 2.0; // Stumble pose at ground level
    this.playerY = 0;
    this.playerVy = 0;
    this.isGrounded = true;
    this.screenShake = 14; // Initial trip impact shake
    sound.playStumble();

    // Ground stumble dust puff & friction sparks
    this.spawnDust(this.playerX + 48, this.groundY - 5, 16, false);
    this.spawnSparks(this.playerX + 48, this.groundY - 5, 8);
    this.addFloatingText(this.playerX + 35, this.groundY - 140, causeText, '#F59E0B');
  }

  public triggerTumble(causeText: string) {
    if (this.isPlayerTumbling || this.state !== 'PLAYING') return;
    this.isPlayerTumbling = true;
    this.isPlayerTripped = false;
    this.playerTumbleTimer = 2.4; // 2.4s cinematic sequence: bulls trample and charge forward off-screen before game over modal
    this.playerTumbleDir = Math.random() < 0.5 ? 1 : -1;
    this.playerTumbleVy = -260; // Catapulted into the air in a dramatic parabolic arc
    this.playerTumbleAirY = 0;
    this.playerTumbleRot = 0;
    this.isSliding = false;
    this.isGrounded = false;
    this.screenShake = 34; // Heavy impact camera shake
    sound.playStumble();
    sound.playBullSnort();

    // Impact cloud & hoof sparks on collision point
    this.spawnDust(this.playerX + 48, this.groundY - 10, 24, true);
    this.spawnSparks(this.playerX + 48, this.groundY - 10, 12);
    this.addFloatingText(this.playerX + 45, this.groundY - 165, causeText, '#EF4444');
  }

  public getCurrentTramoName(): string {
    const m = Math.floor(this.distanceTraveled) % 1200;
    if (m < 180) return 'Cuesta de Santo Domingo';
    if (m < 350) return 'Plaza Consistorial';
    if (m < 500) return 'Calle Mercaderes';
    if (m < 750) return 'Calle Estafeta';
    if (m < 950) return 'Callejón de la Plaza';
    return 'Ruedo de la Plaza de Toros';
  }

  public toggleMozoOrientation(): boolean {
    if (this.assets.characterAnim) {
      this.assets.characterAnim.facingLeft = !this.assets.characterAnim.facingLeft;
      return this.assets.characterAnim.facingLeft;
    }
    return false;
  }

  public setMozoFacingLeft(facingLeft: boolean) {
    if (this.assets.characterAnim) {
      this.assets.characterAnim.facingLeft = facingLeft;
    }
  }

  public getMozoFacingLeft(): boolean {
    return this.assets.characterAnim ? this.assets.characterAnim.facingLeft : false;
  }

  private getPlayerHitbox() {
    // Athletic proportions: Full height to head ~144px, Width ~45px
    const x = this.playerX + 25;
    const y = this.isSliding ? this.groundY - 45 : this.groundY - 144 + this.playerY;
    const width = this.isSliding ? 75 : 45;
    const height = this.isSliding ? 45 : 144;
    return { x, y, width, height };
  }

  /**
   * Breakaway Surge blend factor (0 to 1).
   * Active in:
   * 1. Calle Estafeta (500m - 750m)
   * 2. Ruedo de la Plaza de Toros (950m - 1185m)
   * The lead bull sprints right behind the runner ("respirando en el cogote"), then smoothly
   * decelerates back with the pack upon exiting each zone.
   * Driven by continuous time-damped lerping for 100% fluid movement.
   */
  public getEstafetaSurgeBlend(): number {
    return this.estafetaSurgeBlend;
  }

  /**
   * Computes the exact distance of the lead bull (Bull 0), including Estafeta & Plaza surge dynamics.
   */
  public getBull0Distance(minDistanceLimit: number = 0): number {
    const t = this.herdTime;
    const surge0 = Math.sin(t * 0.72) * 1.5 + Math.cos(t * 0.36) * 0.7;
    const regularDist0 = Math.max(minDistanceLimit, this.bullOffsetMeters - surge0);
    const estafetaBlend = this.estafetaSurgeBlend;

    if (estafetaBlend > 0 && !this.isPlayerTumbling && !this.isPlayerTripped) {
      // In Calle Estafeta (500-750m) & Ruedo de la Plaza (950-1185m):
      // Closes right up behind the runner ("respirando en el cogote").
      // With bullScreenX = playerX - 90 - dist * 28 and horn tips reaching bullScreenX + 242px:
      // At 5.65m: horn tips are at playerX - 6.2px, exactly 16px behind runner's spine (playerX + 10px).
      // Zero clipping, zero overtaking!
      // Synchronized stride vibration based on lead bull's continuous gallop cycle:
      const gallopStrideSync = Math.sin(this.bull0GallopTime * 2) * 0.05;
      const adrenalineBuffer = this.isAdrenalineActive ? 2.8 : 0;
      const neckBreathingDist = 5.65 + gallopStrideSync + adrenalineBuffer;
      return regularDist0 * (1 - estafetaBlend) + neckBreathingDist * estafetaBlend;
    }
    return regularDist0;
  }

  /**
   * Distance in meters of the foremost bull in the herd (closest to player).
   */
  public getClosestBullDistance(): number {
    const t = this.herdTime;
    const dist0 = this.getBull0Distance(0);
    const surge1 = Math.sin(t * 0.61 + 2.3) * 2.1 + Math.sin(t * 0.28) * 0.8;
    const dist1 = Math.max(0, this.bullOffsetMeters + 0.8 - surge1);

    return Math.min(dist0, dist1);
  }

  /**
   * Computes dynamic positions, scales, and desynchronized strides for the full 6-bull herd.
   * Regulated San Fermín Encierro herd dynamics:
   * - Tramo 1 (Cuesta de Santo Domingo, 0-180m): Full pack of 6 bulls charging in tight formation.
   * - Tramo 2 (Plaza Consistorial, 180-350m): 5 bulls in main pack; 6th bull begins trailing back.
   * - Tramo 3 (Calle Mercaderes, 350-500m): 4 bulls in lead pack; 5th bull strings out behind.
   * - Tramo 4 (Calle Estafeta, 500-750m): Breakaway lead bull sprints right at runner's neck!
   * - Tramo 5/6 (Callejón & Ruedo, 750-1200m): Herd regroups, 2 lead bulls charging into the arena.
   * Returns sorted by laneY (background first, foreground last) for authentic 2.5D visual occlusion.
   */
  public getHerdMembers(): {
    index: number;
    distanceMeters: number;
    screenX: number;
    laneY: number;
    scale: number;
    gallopCycle: number;
  }[] {
    const t = this.herdTime;
    const m = this.distanceTraveled % 1200;

    // Organic harmonic surges (incommensurate wave frequencies so position swaps never loop monotonously)
    const surge1 = Math.sin(t * 0.61 + 2.3) * 2.1 + Math.sin(t * 0.28) * 0.8;
    const surge2 = Math.sin(t * 0.84 + 4.6) * 1.8 + Math.cos(t * 0.44) * 0.7;
    const surge3 = Math.cos(t * 0.68 + 1.2) * 1.6 + Math.sin(t * 0.39) * 0.6;
    const surge4 = Math.sin(t * 0.77 + 3.1) * 1.9 + Math.cos(t * 0.52) * 0.8;
    const surge5 = Math.cos(t * 0.58 + 5.0) * 1.7 + Math.sin(t * 0.33) * 0.7;

    // Smoothstep progression helper for seamless herd stringing-out without abrupt pop-in/pop-out
    const smoothLag = (start: number, end: number, val: number): number => {
      if (val <= start) return 0;
      if (val >= end) return 1;
      const p = (val - start) / (end - start);
      return p * p * (3 - 2 * p);
    };

    // Calculate natural string-out distance offsets per bull as tramos advance
    // Bull 5 strings out in Plaza Consistorial (> 180m)
    const lag5 = 3.6 + smoothLag(180, 270, m) * 24.0;
    // Bull 4 strings out in Calle Mercaderes (> 350m)
    const lag4 = 2.9 + smoothLag(350, 440, m) * 24.0;
    // Bull 3 strings out in Calle Estafeta (> 500m)
    const lag3 = 2.2 + smoothLag(500, 600, m) * 24.0;
    // Bull 2 strings out in Callejón de la Plaza (> 750m)
    const lag2 = 1.5 + smoothLag(750, 850, m) * 24.0;

    // In normal running bulls don't pass player (min 0). During tumble/trample, herd charges forward past the fallen runner off-screen!
    const minDistanceLimit = this.isPlayerTumbling ? -50 : (this.isPlayerTripped ? -8 : 0);
    const dist0 = this.getBull0Distance(minDistanceLimit);
    const dist1 = Math.max(minDistanceLimit, this.bullOffsetMeters + 0.8 - surge1);
    const dist2 = Math.max(minDistanceLimit, this.bullOffsetMeters + lag2 - surge2);
    const dist3 = Math.max(minDistanceLimit, this.bullOffsetMeters + lag3 - surge3);
    const dist4 = Math.max(minDistanceLimit, this.bullOffsetMeters + lag4 - surge4);
    const dist5 = Math.max(minDistanceLimit, this.bullOffsetMeters + lag5 - surge5);

    const estafetaSurgeBlend = this.getEstafetaSurgeBlend();

    const allMembers = [
      {
        index: 0,
        distanceMeters: dist0,
        screenX: this.getBullScreenX(dist0),
        laneY: 0, // Midground directly tracking runner
        scale: 0.76 * (0.98 + estafetaSurgeBlend * 0.05), // Powerful presence when right at runner's back
        gallopCycle: this.bull0GallopTime, // Continuous phase without skips or strobe jitter
      },
      {
        index: 1,
        distanceMeters: dist1,
        screenX: this.getBullScreenX(dist1),
        laneY: -10, // Back lane
        scale: 0.76 * 0.93,
        gallopCycle: this.bullGallopTime + 1.85,
      },
      {
        index: 2,
        distanceMeters: dist2,
        screenX: this.getBullScreenX(dist2),
        laneY: 10, // Front lane
        scale: 0.76 * 1.04,
        gallopCycle: this.bullGallopTime + 3.70,
      },
      {
        index: 3,
        distanceMeters: dist3,
        screenX: this.getBullScreenX(dist3),
        laneY: -5, // Mid-back lane
        scale: 0.76 * 0.95,
        gallopCycle: this.bullGallopTime + 5.10,
      },
      {
        index: 4,
        distanceMeters: dist4,
        screenX: this.getBullScreenX(dist4),
        laneY: 5, // Mid-front lane
        scale: 0.76 * 1.01,
        gallopCycle: this.bullGallopTime + 2.50,
      },
      {
        index: 5,
        distanceMeters: dist5,
        screenX: this.getBullScreenX(dist5),
        laneY: -13, // Far back lane
        scale: 0.76 * 0.91,
        gallopCycle: this.bullGallopTime + 4.30,
      },
    ];

    // Only render bulls currently in camera range (screenX > -260px)
    const visibleMembers = allMembers.filter((m) => m.screenX > -260);

    // Sort by depth (laneY ascending: back lane first, front lane last)
    return visibleMembers.sort((a, b) => a.laneY - b.laneY);
  }

  private getBullScreenX(customDistance?: number): number {
    const pxPerMeter = 28;
    const dist = customDistance !== undefined ? customDistance : this.bullOffsetMeters;
    return this.playerX - 90 - dist * pxPerMeter;
  }

  // Master Render Pass
  public render() {
    const ctx = this.ctx;
    ctx.save();

    // Screen Shake & Camera Bob offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
    }
    ctx.translate(shakeX, shakeY + this.cameraBob);

    // 1. Far Horizontal Skyline (Pamplona Cathedral Spires & Sunrise)
    this.renderSkyline();

    // 2. Rich Varied 2D Scenery (5 Official Encierro Stages in pure flat frontal elevation)
    this.renderVariedStreetScenery();

    // 3. Flat Horizontal Cobblestone Road (Clean open street, no barricades)
    this.renderCobblestoneGround();

    // 3b. Street Runners on Cobblestones (Mozos being overtaken or swept)
    this.renderAmbientRunners();

    // 4. Obstacles (Festive Wine Barrels, Elevated Banners, Market Crates)
    this.renderObstacles();

    // 5. Bull Herd & Threatening Shadows Behind
    this.renderToroBravo();

    // 6. Protagonist Mozo Runner
    this.renderMozo();

    // 7. Foreground Dust & Particles
    this.renderParticles();

    // 8. Floating Festive Red & White Ribbons / Confetti
    this.renderConfetti();

    // 9. Floating Action Feedback Popups ("¡SALTO ÉPICO!", etc.)
    this.renderFloatingTexts();

    // 10. Cinematic Lighting & Morning Sun Flare
    this.renderCinematicAtmosphere();

    ctx.restore();
  }

  private renderSkyline() {
    const ctx = this.ctx;
    const img = this.assets.skyline;
    if (!img) return;

    // Distant horizontal skyline with cathedral spires in flat silhouette
    const scale = (this.height * 0.6) / (img.naturalHeight || 720);
    const drawWidth = (img.naturalWidth || 1280) * scale;
    const drawHeight = (img.naturalHeight || 720) * scale;
    const offset = -(this.bgSkyOffset * 0.15) % drawWidth;

    ctx.drawImage(img, offset, 0, drawWidth, drawHeight);
    if (offset + drawWidth < this.width) {
      ctx.drawImage(img, offset + drawWidth, 0, drawWidth, drawHeight);
    }

    // Warm morning golden dawn haze
    const gradient = ctx.createLinearGradient(0, 0, 0, this.groundY * 0.7);
    gradient.addColorStop(0, 'rgba(255, 175, 75, 0.2)');
    gradient.addColorStop(0.5, 'rgba(255, 140, 50, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height * 0.6);
  }

  private renderVariedStreetScenery() {
    const ctx = this.ctx;
    const tramos = [
      { name: 'Cuesta de Santo Domingo', start: 0, end: 180, img: this.assets.tramo1, scale: 1.0, yOffset: 0 },
      { name: 'Plaza Consistorial', start: 180, end: 350, img: this.assets.tramo2, scale: 1.13, yOffset: 0 },
      { name: 'Calle Mercaderes', start: 350, end: 500, img: this.assets.tramo3, scale: 1.0, yOffset: 0 },
      { name: 'Calle Estafeta', start: 500, end: 750, img: this.assets.tramo4, scale: 1.0, yOffset: 0 },
      { name: 'Callejón de la Plaza', start: 750, end: 950, img: this.assets.tramo5, scale: 1.0, yOffset: 0 },
      { name: 'Ruedo de la Plaza de Toros', start: 950, end: 1200, img: this.assets.tramo6, scale: 1.0, yOffset: 0 },
    ];
    const TOTAL_METERS = 1200;
    const currentMeter = this.distanceTraveled % TOTAL_METERS;

    // Find active tramo according to real runner distance
    let activeIndex = 0;
    for (let i = 0; i < tramos.length; i++) {
      if (currentMeter >= tramos[i].start && currentMeter < tramos[i].end) {
        activeIndex = i;
        break;
      }
    }

    const currentTramo = tramos[activeIndex];
    const nextIndex = (activeIndex + 1) % tramos.length;
    const nextTramo = tramos[nextIndex];

    const segHeight = this.groundY;

    // Helper to draw a continuous horizontal tiled layer across the full canvas
    const drawTiled = (tramo: typeof tramos[0], alpha: number) => {
      const img = tramo.img;
      if (!img || alpha <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha));

      const scale = tramo.scale || 1.0;
      const yOffset = tramo.yOffset || 0;
      const h = Math.round(segHeight * scale);
      const w = Math.round(h * (16 / 9));
      const scrollX = -(this.bgMidOffset * 0.45) % w;

      let x = scrollX;
      if (x > 0) x -= w;
      while (x < this.width + w) {
        ctx.drawImage(img, x, yOffset, w, h);
        x += w;
      }
      ctx.restore();
    };

    // Transition zone: smooth 25-meter cross-fade at the end of each tramo
    const transitionZoneMeters = 25;
    const transitionStart = currentTramo.end - transitionZoneMeters;

    if (currentMeter >= transitionStart) {
      const progress = (currentMeter - transitionStart) / transitionZoneMeters;
      drawTiled(currentTramo, 1.0);
      drawTiled(nextTramo, progress);
    } else {
      drawTiled(currentTramo, 1.0);
    }
  }

  private renderCobblestoneGround() {
    const ctx = this.ctx;
    const roadY = this.groundY - 12;
    const roadHeight = this.height - roadY;

    // Completely flat horizontal road (zero perspective depth, clean open street)
    const grad = ctx.createLinearGradient(0, roadY, 0, this.height);
    grad.addColorStop(0, '#383532'); // Top curb granite
    grad.addColorStop(0.08, '#4A4642');
    grad.addColorStop(0.2, '#2E2B29');
    grad.addColorStop(1, '#1A1918');

    ctx.fillStyle = grad;
    ctx.fillRect(0, roadY, this.width, roadHeight);

    // Granite curb stone running perfectly horizontal
    ctx.fillStyle = '#5A5652';
    ctx.fillRect(0, roadY, this.width, 4);
    ctx.fillStyle = '#22201E';
    ctx.fillRect(0, roadY + 4, this.width, 2);

    // Horizontal rows of worn Pamplona cobblestones
    ctx.save();
    const rowHeight = 22;
    const colWidth = 36;
    let rowIndex = 0;

    for (let y = roadY + 8; y < this.height; y += rowHeight) {
      rowIndex++;
      const rowOffset = (rowIndex % 2 === 0 ? colWidth / 2 : 0);
      const startX = -((this.bgGroundOffset + rowOffset) % colWidth);

      // Horizontal mortar line
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, y + rowHeight - 2, this.width, 2);

      // Vertical stone joint lines (pure vertical, zero tilt, zero depth)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1.5;
      for (let x = startX; x < this.width + colWidth; x += colWidth) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rowHeight - 2);
        ctx.stroke();
      }
    }

    // Pamplona white encierro guide line running completely horizontal
    ctx.strokeStyle = 'rgba(250, 248, 240, 0.6)';
    ctx.lineWidth = 4;
    ctx.setLineDash([35, 25]);
    ctx.lineDashOffset = this.bgGroundOffset * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, roadY + 42);
    ctx.lineTo(this.width, roadY + 42);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Golden Arena / Albero Sand of the Pamplona Plaza de Toros (Tramo 6: 950m - 1200m)
    const m = this.distanceTraveled % 1200;
    let arenaBlend = 0;
    if (m >= 930 && m <= 1200) {
      if (m < 960) {
        arenaBlend = (m - 930) / 30; // Blend into arena
      } else if (m > 1175) {
        arenaBlend = 1 - (m - 1175) / 25; // Blend out back to cobblestones
      } else {
        arenaBlend = 1;
      }
    }

    if (arenaBlend > 0) {
      ctx.save();
      ctx.globalAlpha = arenaBlend;

      // Warm golden albero sand gradient
      const arenaGrad = ctx.createLinearGradient(0, roadY, 0, this.height);
      arenaGrad.addColorStop(0, '#E8C07D'); // Sunlit golden surface
      arenaGrad.addColorStop(0.15, '#DDAF64');
      arenaGrad.addColorStop(0.5, '#C89445');
      arenaGrad.addColorStop(1, '#966723'); // Compacted deep albero
      ctx.fillStyle = arenaGrad;
      ctx.fillRect(0, roadY, this.width, roadHeight);

      // Red wooden bullring barrier base rim
      ctx.fillStyle = '#B91C1C';
      ctx.fillRect(0, roadY, this.width, 4);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, roadY + 4, this.width, 2);

      // Raked concentric arena sand texture grooves
      ctx.fillStyle = 'rgba(160, 105, 30, 0.25)';
      const sandRakeStep = 14;
      for (let y = roadY + 8; y < this.height; y += sandRakeStep) {
        ctx.fillRect(0, y, this.width, 1.5);
      }

      // Regulatory concentric white chalk circles of Pamplona Bullring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(0, roadY + 38);
      ctx.lineTo(this.width, roadY + 38);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, roadY + 74);
      ctx.lineTo(this.width, roadY + 74);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderObstacles() {
    const ctx = this.ctx;
    const obsImgs = this.assets.obstacleImages;

    for (const obs of this.obstacles) {
      if (obs.x + obs.width < -100 || obs.x > this.width + 100) continue;

      ctx.save();

      // Realistic volumetric contact shadow on Pamplona cobblestones
      if (!obs.requiresSlide) {
        ctx.save();
        const shadowGrad = ctx.createRadialGradient(
          obs.x + obs.width * 0.52 + 4,
          this.groundY - 3,
          2,
          obs.x + obs.width * 0.52 + 4,
          this.groundY - 3,
          obs.width * 0.52 + 6
        );
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
        shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.30)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;

        ctx.beginPath();
        const shadowH = 9;
        ctx.ellipse(
          obs.x + obs.width * 0.52 + 4,
          this.groundY - 3,
          obs.width * 0.52 + 6,
          shadowH,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }

      // Render 100% photographic transparent sprites
      if (obs.type === 'BARRIER') {
        const img = obsImgs?.barrier;
        if (img) {
          ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
        } else {
          ctx.fillStyle = '#6B4C2A';
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
      } else if (obs.type === 'BARRELS') {
        const img = obsImgs?.barrels || this.assets.barrelsCutout;
        if (img) {
          ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
        }
      } else if (obs.type === 'CRATES') {
        const img = obsImgs?.crates;
        if (img) {
          ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
        }
      } else if (obs.type === 'AWNING') {
        const img = obsImgs?.banner || this.assets.bannerCutout;
        if (img) {
          // Draw hanging festival banner
          ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);

          // Draw realistic hanging hemp ropes extending across the street towards upper balconies
          ctx.save();
          ctx.strokeStyle = '#8B6A45';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          // Rope to the left building/balcony
          ctx.moveTo(obs.x + 8, obs.y + 10);
          ctx.quadraticCurveTo(obs.x - 35, obs.y - 35, obs.x - 100, obs.y - 75);
          // Rope to the right building/balcony
          ctx.moveTo(obs.x + obs.width - 8, obs.y + 10);
          ctx.quadraticCurveTo(obs.x + obs.width + 35, obs.y - 35, obs.x + obs.width + 100, obs.y - 75);
          ctx.stroke();

          // Highlight thread on ropes
          ctx.strokeStyle = 'rgba(235, 215, 185, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.restore();
    }
  }

  private renderToroBravo() {
    const herd = this.getHerdMembers();

    if (this.assets.characterAnim) {
      // Render in depth order (background lane first, foreground lane last)
      for (const bull of herd) {
        this.assets.characterAnim.renderToroBravo(
          this.ctx,
          {
            x: bull.screenX,
            y: 0,
            distanceMeters: bull.distanceMeters,
            gallopCycle: bull.gallopCycle,
            speed: this.currentSpeed,
          },
          this.groundY + bull.laneY,
          bull.scale,
          bull.index
        );
      }
      return;
    }

    // Static fallback if animation system unavailable
    const ctx = this.ctx;
    const canvas = this.assets.bullCutout;
    if (!canvas) return;

    for (const bull of herd) {
      const bullW = 220 * (bull.scale / 0.76);
      const bullH = 175 * (bull.scale / 0.76);
      const gallopBounce = Math.sin(bull.gallopCycle) * 6;
      const bullY = this.groundY + bull.laneY - bullH + 15 + gallopBounce;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(bull.screenX + bullW * 0.55 + 15, this.groundY + bull.laneY - 8, bullW * 0.45, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(canvas, bull.screenX, bullY, bullW, bullH);
      ctx.restore();
    }
  }

  private renderMozo() {
    if (this.assets.characterAnim) {
      this.assets.characterAnim.renderMozo(
        this.ctx,
        {
          x: this.playerX,
          y: this.playerY,
          speed: this.currentSpeed,
          isGrounded: this.isGrounded,
          isSliding: this.isSliding,
          playerVy: this.playerVy,
          stumbleTimer: this.stumbleTimer,
          runCycle: this.runCycleTime,
          isTumbling: this.isPlayerTumbling,
          tumbleRot: this.playerTumbleRot,
          airY: this.playerTumbleAirY,
        },
        this.groundY
      );

      // Warning text when stumbling (only if not tumbled)
      if (this.stumbleTimer > 0 && !this.isPlayerTumbling) {
        this.ctx.fillStyle = '#EF4444';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.fillText('¡CUIDADO!', this.playerX + 25, this.groundY - 165 + this.playerY);
      }
      return;
    }

    // Static fallback if animation system unavailable
    const ctx = this.ctx;
    const canvas = this.assets.mozoCutout;
    if (!canvas) return;

    const mozoW = 125;
    const mozoH = 155;

    if (this.isPlayerTumbling) {
      ctx.save();
      ctx.translate(this.playerX + 55, this.groundY + this.playerTumbleAirY - mozoH * 0.45);
      ctx.rotate(-this.playerTumbleRot);
      ctx.drawImage(canvas, -mozoW * 0.5, -mozoH * 0.5, mozoW, mozoH);
      ctx.restore();
      return;
    }

    const mozoY = this.groundY - mozoH + 18 + this.playerY;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(this.playerX + 55, this.groundY - 6, 45, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(canvas, this.playerX, mozoY, mozoW, mozoH);
    ctx.restore();
  }

  private renderParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderConfetti() {
    const ctx = this.ctx;
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      if (c.rotation !== undefined) {
        ctx.rotate(c.rotation);
      }
      ctx.fillStyle = c.color;
      ctx.globalAlpha = c.alpha;
      // Elongated festival ribbon
      ctx.fillRect(-c.size, -c.size / 2, c.size * 2, c.size);
      ctx.restore();
    }
  }

  private renderAmbientRunners() {
    const ctx = this.ctx;
    // Sort by depth (laneY ascending: back lane first, front lane last)
    const sortedRunners = [...this.ambientRunners].sort((a, b) => a.laneY - b.laneY);

    if (this.assets.characterAnim) {
      for (const ar of sortedRunners) {
        if (ar.x < -180 || ar.x > this.width + 120) continue;
        this.assets.characterAnim.renderStreetRunner(ctx, ar, this.groundY);
      }
      return;
    }

    // Fallback if character animation unavailable
    const img = this.assets.mozoCutout;
    if (!img) return;

    for (const ar of this.ambientRunners) {
      if (ar.x < -100 || ar.x > this.width + 100) continue;
      ctx.save();
      const w = Math.round(75 * ar.scale);
      const h = Math.round(98 * ar.scale);
      const y = ar.y - h;
      ctx.drawImage(img, ar.x, y, w, h);
      ctx.restore();
    }
  }

  private renderFloatingTexts() {
    const ctx = this.ctx;
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = '900 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Thick dark outline for readability over cobblestones
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);

      // Bright fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private renderCinematicAtmosphere() {
    const ctx = this.ctx;

    // 1. Low Morning Sun Vignette & Ambient Glow
    const sunGrad = ctx.createRadialGradient(
      this.width * 0.85,
      100,
      10,
      this.width * 0.85,
      100,
      this.width * 0.9
    );
    sunGrad.addColorStop(0, 'rgba(255, 230, 180, 0.22)');
    sunGrad.addColorStop(0.3, 'rgba(255, 180, 100, 0.08)');
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. High Danger Red Edge Pulse when foremost bull is critically close (< 3.5m)
    const closestBullMeters = this.getClosestBullDistance();
    if (closestBullMeters < 3.5 && this.state === 'PLAYING') {
      const dangerIntensity = Math.min(0.55, (3.5 - closestBullMeters) * 0.18);
      const pulse = (Math.sin(Date.now() / 120) + 1) * 0.5;
      const redVignette = ctx.createRadialGradient(
        this.width / 2,
        this.height / 2,
        this.width * 0.35,
        this.width / 2,
        this.height / 2,
        this.width * 0.65
      );
      redVignette.addColorStop(0, 'rgba(220, 38, 38, 0)');
      redVignette.addColorStop(1, `rgba(220, 38, 38, ${dangerIntensity * (0.6 + pulse * 0.4)})`);
      ctx.fillStyle = redVignette;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 3. Subtle Cinema Scope letterbox vignette borders
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, this.width, 16);
    ctx.fillRect(0, this.height - 16, this.width, 16);
  }

  // Animation Loop
  public loop = (time: number) => {
    if (!this.lastTime) this.lastTime = time;
    const dt = Math.min(0.05, (time - this.lastTime) / 1000); // Clamp dt to prevent frame spikes
    this.lastTime = time;

    this.update(dt);
    this.render();

    this.animId = requestAnimationFrame(this.loop);
  };

  public stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = 0;
    }
  }

  public getState(): GameState {
    return this.state;
  }
}
