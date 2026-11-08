/**
 * San Fermín Run - Hyperrealistic Asset Loader & Image Preprocessor
 * Loads authentic 8k RAW photographic Pamplona environments across the 5 official Encierro stages:
 * 1. Cuesta de Santo Domingo (Hornacina del Santo y Corrales)
 * 2. Plaza Consistorial (Ayuntamiento de Pamplona)
 * 3. Calle Mercaderes (Comercios históricos y pavimento pulido)
 * 4. Calle Estafeta (Cañón mítico de balconadas y reposteros)
 * 5. Telefónica y Plaza de Toros (Entrada de Encierro monumental y arboleda)
 */

import { CharacterAnimationSystem, MozoSpriteFrames } from './characterArt';

export interface ObstacleImages {
  barrier: HTMLImageElement;
  fallenRunner: HTMLImageElement;
  crates: HTMLImageElement;
  barrels: HTMLImageElement;
  banner: HTMLImageElement;
  companionSprint?: HTMLImageElement;
  companionStumble?: HTMLImageElement;
}

export interface GameAssets {
  skyline: HTMLImageElement;
  tramo1: HTMLImageElement; // Santo Domingo & Hornacina
  tramo2: HTMLImageElement; // Ayuntamiento de Pamplona
  tramo3: HTMLImageElement; // Calle Mercaderes
  tramo4: HTMLImageElement; // Calle Estafeta
  tramo5: HTMLImageElement; // Callejón y Entrada exterior
  tramo6: HTMLImageElement; // Ruedo de la Plaza de Toros & Gradas
  mozoCutout: HTMLCanvasElement;
  bullCutout: HTMLCanvasElement;
  barrelsCutout: HTMLCanvasElement;
  bannerCutout: HTMLCanvasElement;
  obstacleImages: ObstacleImages;
  characterAnim: CharacterAnimationSystem;
  isReady: boolean;
}

const SKYLINE_SRC = new URL('../assets/images/pamplona_sky_horizontal_1792666516001.jpg', import.meta.url).href;
const TRAMO1_SRC = new URL('../assets/images/tramo1_santodomingo_flat_1792744113356.jpg', import.meta.url).href;
const TRAMO2_SRC = new URL('../assets/images/tramo2_ayuntamiento_balconies_1793699351341.jpg', import.meta.url).href;
const TRAMO3_SRC = new URL('../assets/images/tramo3_mercaderes_balconies_1793698795483.jpg', import.meta.url).href;
const TRAMO4_SRC = new URL('../assets/images/tramo4_estafeta_closeup_1793700900709.jpg', import.meta.url).href;
const TRAMO5_SRC = new URL('../assets/images/tramo5_plazatoros_flat_1792744134735.jpg', import.meta.url).href;
const TRAMO6_SRC = new URL('../assets/images/tramo6_ruedo_master_1793696542533.jpg', import.meta.url).href;
const BULL_SRC = new URL('../assets/images/toro_bravo_1792665776831.jpg', import.meta.url).href;
const BARRELS_SRC = new URL('../assets/images/photo_wine_barrels_1792667290159.jpg', import.meta.url).href;
const BANNER_SRC = new URL('../assets/images/photo_festive_banner_1792667290292.jpg', import.meta.url).href;

// Clean photographic transparent PNG obstacles
const OBSTACLE_BARRIER_SRC = new URL('../assets/images/obstacles/obstacle_barrier.png', import.meta.url).href;
const OBSTACLE_FALLEN_RUNNER_SRC = new URL('../assets/images/obstacles/obstacle_fallen_runner.png', import.meta.url).href;
const OBSTACLE_CRATES_SRC = new URL('../assets/images/obstacles/obstacle_crates.png', import.meta.url).href;
const OBSTACLE_BARRELS_SRC = new URL('../assets/images/obstacles/obstacle_barrels.png', import.meta.url).href;
const OBSTACLE_BANNER_SRC = new URL('../assets/images/obstacles/obstacle_banner.png', import.meta.url).href;

const MOZO_RUN_SRCS = [
  new URL('../assets/images/mozo_frames/mozo_run_0.png', import.meta.url).href,
  new URL('../assets/images/mozo_frames/mozo_run_1.png', import.meta.url).href,
  new URL('../assets/images/mozo_frames/mozo_run_2.png', import.meta.url).href,
  new URL('../assets/images/mozo_frames/mozo_run_3.png', import.meta.url).href,
  new URL('../assets/images/mozo_frames/mozo_run_4.png', import.meta.url).href,
  new URL('../assets/images/mozo_frames/mozo_run_5.png', import.meta.url).href,
];
const MOZO_JUMP_SRC = new URL('../assets/images/mozo_frames/mozo_jump.png', import.meta.url).href;
const MOZO_SLIDE_SRC = new URL('../assets/images/mozo_frames/mozo_slide.png', import.meta.url).href;
const MOZO_STUMBLE_SRC = new URL('../assets/images/mozo_frames/mozo_stumble.png', import.meta.url).href;

const MOZO_TORSO_SRC = new URL('../assets/images/mozo_part_torso.png', import.meta.url).href;
const MOZO_LEG_FRONT_SRC = new URL('../assets/images/mozo_part_leg_front.png', import.meta.url).href;
const MOZO_LEG_REAR_SRC = new URL('../assets/images/mozo_part_leg_rear.png', import.meta.url).href;
const MOZO_MASTER_SRC = new URL('../assets/images/mozo_photo_master.png', import.meta.url).href;

// 2D Modular Skeletal Puppet Layers (Option 2)
const MOZO_PUPPET_TORSO_SRC = new URL('../assets/images/puppet/mozo_torso.png', import.meta.url).href;
const MOZO_PUPPET_ARM_REAR_SRC = new URL('../assets/images/puppet/mozo_arm_rear.png', import.meta.url).href;
const MOZO_PUPPET_ARM_FRONT_SRC = new URL('../assets/images/puppet/mozo_arm_front.png', import.meta.url).href;
const MOZO_PUPPET_LEG_REAR_SRC = new URL('../assets/images/puppet/mozo_leg_rear.png', import.meta.url).href;
const MOZO_PUPPET_LEG_FRONT_SRC = new URL('../assets/images/puppet/mozo_leg_front.png', import.meta.url).href;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    // Do NOT set crossOrigin on same-host or relative URLs to prevent iframe CORS blocking
    if (src.startsWith('http') && typeof window !== 'undefined' && !src.includes(window.location.host)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      console.warn(`Could not load ${src}, creating safe canvas fallback:`, err);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const c = canvas.getContext('2d');
        if (c) {
          c.fillStyle = '#3E2E20';
          c.fillRect(0, 0, 400, 400);
        }
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () => resolve(img);
        fallbackImg.src = canvas.toDataURL();
      } catch {
        resolve(img);
      }
    };
    img.src = src;
  });
}

/**
 * Creates a transparent cutout canvas by removing solid studio backgrounds
 * using edge color sampling and smooth alpha feathering.
 */
function createCutout(
  img: HTMLImageElement,
  isWhiteBg: boolean,
  customThresholdMin?: number,
  customThresholdMax?: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, img.naturalWidth || img.width || 100);
  canvas.height = Math.max(1, img.naturalHeight || img.height || 100);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  try {
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Sample top-left corner background color
    const sampleR = data[0];
    const sampleG = data[1];
    const sampleB = data[2];

    const minThreshold = customThresholdMin ?? (isWhiteBg ? 30 : 25);
    const maxThreshold = customThresholdMax ?? (isWhiteBg ? 65 : 55);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const dist = Math.sqrt(
        Math.pow(r - sampleR, 2) +
        Math.pow(g - sampleG, 2) +
        Math.pow(b - sampleB, 2)
      );

      if (dist < minThreshold) {
        data[i + 3] = 0; // Fully transparent
      } else if (dist < maxThreshold) {
        const alphaFactor = (dist - minThreshold) / (maxThreshold - minThreshold);
        data[i + 3] = Math.floor(data[i + 3] * alphaFactor);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('createCutout encountered canvas read error, drawing raw image fallback:', e);
    ctx.drawImage(img, 0, 0);
  }
  return canvas;
}

let loadedAssets: GameAssets | null = null;
let loadPromise: Promise<GameAssets> | null = null;

export async function loadGameAssets(onProgress?: (percent: number) => void): Promise<GameAssets> {
  if (loadedAssets) return loadedAssets;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      onProgress?.(10);
      const [
        skyline,
        tramo1,
        tramo2,
        tramo3,
        tramo4,
        tramo5,
        tramo6,
        bullRaw,
        barrelsRaw,
        bannerRaw,
        mozoRun0,
        mozoRun1,
        mozoRun2,
        mozoRun3,
        mozoRun4,
        mozoRun5,
        mozoJump,
        mozoSlide,
        mozoStumble,
        mozoTorso,
        mozoLegFront,
        mozoLegRear,
        mozoMaster,
        mozoPuppetTorso,
        mozoPuppetArmRear,
        mozoPuppetArmFront,
        mozoPuppetLegRear,
        mozoPuppetLegFront,
        obstacleBarrier,
        obstacleFallenRunner,
        obstacleCrates,
        obstacleBarrels,
        obstacleBanner,
      ] = await Promise.all([
        loadImage(SKYLINE_SRC),
        loadImage(TRAMO1_SRC),
        loadImage(TRAMO2_SRC),
        loadImage(TRAMO3_SRC),
        loadImage(TRAMO4_SRC),
        loadImage(TRAMO5_SRC),
        loadImage(TRAMO6_SRC),
        loadImage(BULL_SRC),
        loadImage(BARRELS_SRC),
        loadImage(BANNER_SRC),
        loadImage(MOZO_RUN_SRCS[0]),
        loadImage(MOZO_RUN_SRCS[1]),
        loadImage(MOZO_RUN_SRCS[2]),
        loadImage(MOZO_RUN_SRCS[3]),
        loadImage(MOZO_RUN_SRCS[4]),
        loadImage(MOZO_RUN_SRCS[5]),
        loadImage(MOZO_JUMP_SRC),
        loadImage(MOZO_SLIDE_SRC),
        loadImage(MOZO_STUMBLE_SRC),
        loadImage(MOZO_TORSO_SRC),
        loadImage(MOZO_LEG_FRONT_SRC),
        loadImage(MOZO_LEG_REAR_SRC),
        loadImage(MOZO_MASTER_SRC),
        loadImage(MOZO_PUPPET_TORSO_SRC),
        loadImage(MOZO_PUPPET_ARM_REAR_SRC),
        loadImage(MOZO_PUPPET_ARM_FRONT_SRC),
        loadImage(MOZO_PUPPET_LEG_REAR_SRC),
        loadImage(MOZO_PUPPET_LEG_FRONT_SRC),
        loadImage(OBSTACLE_BARRIER_SRC),
        loadImage(OBSTACLE_FALLEN_RUNNER_SRC),
        loadImage(OBSTACLE_CRATES_SRC),
        loadImage(OBSTACLE_BARRELS_SRC),
        loadImage(OBSTACLE_BANNER_SRC),
      ]);
      onProgress?.(65);

      // Extract photographic cutouts for bull and street obstacles
      const bullCutout = createCutout(bullRaw, true);
      const barrelsCutout = createCutout(barrelsRaw, false, 28, 60);
      const bannerCutout = createCutout(bannerRaw, false, 22, 50);

      // Clean photographic obstacle images
      const obstacleImages: ObstacleImages = {
        barrier: obstacleBarrier,
        fallenRunner: obstacleFallenRunner,
        crates: obstacleCrates,
        barrels: obstacleBarrels,
        banner: obstacleBanner,
      };

      // Mozo sprite frames
      const mozoFrames: MozoSpriteFrames = {
        run: [mozoRun0, mozoRun1, mozoRun2, mozoRun3, mozoRun4, mozoRun5],
        jump: mozoJump,
        slide: mozoSlide,
        stumble: mozoStumble,
      };

      // Create fallback canvas for mozoCutout
      const mozoCutout = document.createElement('canvas');
      mozoCutout.width = mozoMaster.naturalWidth || 386;
      mozoCutout.height = mozoMaster.naturalHeight || 503;
      const mCtx = mozoCutout.getContext('2d');
      if (mCtx) {
        mCtx.drawImage(mozoMaster, 0, 0);
      }

      // Initialize the character animation system with photographic running frames
      const characterAnim = new CharacterAnimationSystem(
        mozoFrames,
        bullCutout
      );
      onProgress?.(100);

      loadedAssets = {
        skyline,
        tramo1,
        tramo2,
        tramo3,
        tramo4,
        tramo5,
        tramo6,
        mozoCutout,
        bullCutout,
        barrelsCutout,
        bannerCutout,
        obstacleImages,
        characterAnim,
        isReady: true,
      };

      return loadedAssets;
    } catch (e) {
      console.error('Error loading hyperrealistic game assets:', e);
      throw e;
    }
  })();

  return loadPromise;
}
