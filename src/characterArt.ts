/**
 * San Fermín Run - Photographic Spritesheet & Biomechanical Animation System
 *
 * Implements organic, photorealistic human running locomotion (Mozo) using
 * high-resolution running-cycle frames, athletic jump, ground slide, and stumble recovery,
 * with 100% opaque solid white linen attire and dynamic red faja ribbons,
 * while preserving the quadruped galloping locomotion for the Toro Bravo.
 */

export interface MozoPose {
  x: number;
  y: number;
  speed: number;
  isGrounded: boolean;
  isSliding: boolean;
  playerVy: number;
  stumbleTimer: number;
  runCycle: number;
  isTumbling?: boolean;
  tumbleRot?: number;
  airY?: number;
}

export interface ToroPose {
  x: number;
  y: number;
  distanceMeters: number;
  gallopCycle: number;
  speed: number;
}

export interface GroundImpactEffect {
  x: number;
  y: number;
  isBull: boolean;
}

export interface MozoSpriteFrames {
  run: HTMLImageElement[];
  jump: HTMLImageElement;
  slide: HTMLImageElement;
  stumble: HTMLImageElement;
}

export class CharacterAnimationSystem {
  // Photographic sprite frames for Mozo
  private mozoFrames: MozoSpriteFrames | null = null;
  private lastFootstepFrame: number = -1;

  // Photographic canvases for Toro Bravo (Black Herd)
  private bullBody: HTMLCanvasElement | null = null;
  private bullHead: HTMLCanvasElement | null = null;
  private bullForeleg: HTMLCanvasElement | null = null;
  private bullHindleg: HTMLCanvasElement | null = null;
  private bullTail: HTMLCanvasElement | null = null;

  // Photographic canvases for Toro Castaño / Colorado (Brown Bull in Calle Estafeta)
  private bullBodyBrown: HTMLCanvasElement | null = null;
  private bullHeadBrown: HTMLCanvasElement | null = null;
  private bullForelegBrown: HTMLCanvasElement | null = null;
  private bullHindlegBrown: HTMLCanvasElement | null = null;

  // Impact callback for ground dust / sparks
  public onGroundImpact?: (effect: GroundImpactEffect) => void;
  public facingLeft: boolean = false;

  // Pre-rendered photographic runner profiles for diverse street crowds
  private runnerProfiles: CanvasImageSource[][] = [];
  private runnerStumbleProfiles: CanvasImageSource[] = [];

  // Track previous cycle fractions to detect hoof plants per bull member in the herd
  private prevBullHoofDown: boolean[] = [false, false, false, false, false, false];

  constructor(
    mozoSource: MozoSpriteFrames | HTMLCanvasElement | any,
    bullCutout: HTMLCanvasElement
  ) {
    if ('run' in (mozoSource as any)) {
      this.mozoFrames = mozoSource as MozoSpriteFrames;
      this.initRunnerProfiles();
    }
    this.extractBullParts(bullCutout);
  }

  /**
   * Helper to extract a sub-region from a canvas with optional oval/soft masking
   */
  private createSubPart(
    src: HTMLCanvasElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    isOvalMask = false
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (isOvalMask) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(sw / 2, sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.restore();
    } else {
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    }

    return canvas;
  }

  /**
   * Deconstructs the high-resolution photographic Toro Bravo into articulated quadruped parts
   */
  private extractBullParts(master: HTMLCanvasElement) {
    // 1. Massive Torso & Muscular Flank (central mass anchor)
    // Torso ~ (220..710, 260..600)
    this.bullBody = this.createSubPart(master, 210, 260, 500, 340, true);
    this.bullBodyBrown = this.createBrownBullPart(this.bullBody, false);

    // 2. Terrifying Head, Morrillo Hump & Astifinos Horns
    // Head & horns ~ (530..980, 200..510)
    this.bullHead = this.createSubPart(master, 530, 200, 450, 310, true);
    this.bullHeadBrown = this.createBrownBullPart(this.bullHead, true);

    // 3. Front Galloping Foreleg
    // Foreleg ~ (460..640, 480..780)
    this.bullForeleg = this.createSubPart(master, 460, 480, 180, 300, true);
    this.bullForelegBrown = this.createBrownBullPart(this.bullForeleg, false);

    // 4. Rear Galloping Hindleg
    // Hindleg ~ (230..430, 480..760)
    this.bullHindleg = this.createSubPart(master, 230, 480, 200, 280, true);
    this.bullHindlegBrown = this.createBrownBullPart(this.bullHindleg, false);

    // 5. Whipping Tail with Black Tuft
    // Tail ~ (30..250, 340..660)
    this.bullTail = this.createSubPart(master, 30, 340, 220, 320, true);
  }

  /**
   * Generates authentic castaño / colorado (brown/reddish fighting bull) anatomy parts
   * while keeping the ivory astifinos horns sharp and clean.
   */
  private createBrownBullPart(source: HTMLCanvasElement, isHead = false): HTMLCanvasElement {
    const w = source.width;
    const h = source.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.drawImage(source, 0, 0);
    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 20) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;

        // If it's the head, protect the sharp astifinos horns:
        // Horns have bright ivory/slate tone (brightness > 135 and Math.abs(r - g) < 22)
        if (isHead && brightness > 135 && Math.abs(r - g) < 22) {
          continue; // keep ivory horns untouched!
        }

        // Transform dark bull coat into rich castaño / colorado (fighting bull reddish brown)
        const lum = brightness / 255;
        data[i] = Math.min(255, Math.floor(65 + lum * 140));      // Warm reddish-brown
        data[i + 1] = Math.min(255, Math.floor(28 + lum * 75));   // Amber midtones
        data[i + 2] = Math.min(255, Math.floor(14 + lum * 36));   // Deep warm undertones
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (err) {
      console.warn('Could not tint brown bull part:', err);
    }

    return canvas;
  }

  /**
   * Renders the organic, 100% solid, photographic Mozo Runner with unified anatomical anchoring
   */
  public renderMozo(ctx: CanvasRenderingContext2D, pose: MozoPose, groundY: number) {
    if (!this.mozoFrames || !this.mozoFrames.run || this.mozoFrames.run.length === 0) return;

    ctx.save();

    // Unified anatomical spine anchor on screen (solid center of mass)
    const anchorX = pose.x + 48;

    // Handle dramatic tumble when caught by charging bull
    if (pose.isTumbling) {
      const activeImg = this.mozoFrames.stumble || this.mozoFrames.run[0];
      const mozoScale = 0.268;
      const imgW = activeImg.naturalWidth || activeImg.width || 360;
      const imgH = activeImg.naturalHeight || activeImg.height || 570;
      const drawW = imgW * mozoScale;
      const drawH = imgH * mozoScale;
      const airY = pose.airY || 0;

      // 1. Shadow stays flat on the cobblestone street under the runner
      const shadowAltitude = Math.max(0, -airY);
      const shadowAlpha = Math.max(0.06, 0.44 - shadowAltitude * 0.003);
      const shadowScale = Math.max(0.35, 1 - shadowAltitude * 0.004);

      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(anchorX, groundY - 5, drawW * 0.38 * shadowScale, 6.5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Parabolic body translation and organic tumbling rotation around center of mass
      ctx.save();
      ctx.translate(anchorX, groundY + airY - drawH * 0.46);
      ctx.rotate(-(pose.tumbleRot || 0));
      ctx.drawImage(activeImg, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();

      ctx.restore();
      return;
    }

    // 1. Determine active action frame
    let activeImg: HTMLImageElement;
    let isSlide = false;
    let isAirborne = false;
    let frameIdx = 0;
    let frameFrac = 0;

    if (pose.isSliding) {
      activeImg = this.mozoFrames.slide;
      isSlide = true;
    } else if (!pose.isGrounded) {
      activeImg = this.mozoFrames.jump || this.mozoFrames.run[3];
      isAirborne = true;
    } else if (pose.stumbleTimer > 0) {
      activeImg = this.mozoFrames.stumble;
    } else {
      // 6-frame photographic running cycle
      const cycleNorm = ((pose.runCycle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const rawFrame = (cycleNorm / (Math.PI * 2)) * 6;
      frameIdx = Math.floor(rawFrame) % 6;
      frameFrac = rawFrame - Math.floor(rawFrame);
      activeImg = this.mozoFrames.run[frameIdx] || this.mozoFrames.run[0];

      // Ground impact detection for footstep sound and dust on foot plants
      if (frameIdx !== this.lastFootstepFrame) {
        if (frameIdx === 1 || frameIdx === 4) {
          this.onGroundImpact?.({ x: anchorX + 4, y: groundY, isBull: false });
        }
        this.lastFootstepFrame = frameIdx;
      }
    }

    // 2. Proportion & Scale
    // Running frames normalized to 360x570 (spine axis at x=170) -> scale 0.268 gives exact arcade height of ~148px
    const mozoScale = 0.268;

    // 3. Dynamic Drop Shadow on Cobblestones (anchored directly under anatomical spine axis)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    const shadowScale = Math.max(0.25, 1 - Math.abs(pose.y) / 280);
    const shadowWidth = isSlide ? 72 : (isAirborne ? 56 : 44) * shadowScale;
    ctx.beginPath();
    ctx.ellipse(
      anchorX + (isSlide || isAirborne ? 12 : 0),
      groundY - 5,
      shadowWidth,
      6.5 * shadowScale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // 4. Render Active Frame with exact anatomical anchoring
    if (isSlide) {
      // Low baseball slide skimming the cobblestones
      const slideScale = 0.145; // ~90px height (bottom 10px in ground), 119px width -> ~80px visible height
      const drawW = (activeImg.naturalWidth || activeImg.width || 824) * slideScale;
      const drawH = (activeImg.naturalHeight || activeImg.height || 626) * slideScale;
      const drawX = anchorX - 58;
      const drawY = groundY - drawH + 10;

      ctx.drawImage(activeImg, drawX, drawY, drawW, drawH);
    } else if (isAirborne) {
      // Compact airborne hurdle leap matching the exact ~80px visible profile of crouched posture
      const jumpScale = 0.128; // ~80px height, 107px width (exact visual match to crouched posture)
      const drawW = (activeImg.naturalWidth || activeImg.width || 824) * jumpScale;
      const drawH = (activeImg.naturalHeight || activeImg.height || 626) * jumpScale;

      // Aerodynamic flight tilt
      const dynamicTilt = Math.max(-0.14, Math.min(0.10, (pose.playerVy || 0) * 0.010 - 0.03));

      ctx.save();
      // Center translation on character's airborne mass
      ctx.translate(anchorX, groundY + pose.y - drawH * 0.45);
      ctx.rotate(dynamicTilt);
      ctx.drawImage(activeImg, -drawW * 0.48, -drawH * 0.52, drawW, drawH);
      ctx.restore();
    } else {
      // Normalized running frame (360x570, spine center at x=170)
      const imgW = activeImg.naturalWidth || activeImg.width || 360;
      const imgH = activeImg.naturalHeight || activeImg.height || 570;
      const drawW = imgW * mozoScale;
      const drawH = imgH * mozoScale;

      // Spine axis is at exactly 170px in normalized frame
      const spineOffsetX = 170 * mozoScale;

      // Harmonic vertical ground absorption (subtle natural shock absorption on cobblestones)
      const verticalBob = Math.sin(pose.runCycle * 2) * 1.6;
      const drawX = anchorX - spineOffsetX;
      const drawY = groundY - drawH + verticalBob;

      // Athletic forward lean proportionate to speed
      const bodyTilt = (pose.speed / 650) * 0.035;

      ctx.save();
      if (bodyTilt > 0) {
        ctx.translate(anchorX, groundY + verticalBob);
        ctx.rotate(bodyTilt);
        ctx.drawImage(activeImg, -spineOffsetX, -drawH, drawW, drawH);

        // Smooth cinematic frame blending on frame handoff to prevent strobe/scattering
        if (frameFrac > 0.65 && !pose.stumbleTimer) {
          const nextIdx = (frameIdx + 1) % 6;
          const nextImg = this.mozoFrames.run[nextIdx];
          if (nextImg && nextImg !== activeImg) {
            const blendAlpha = ((frameFrac - 0.65) / 0.35) * 0.28;
            ctx.save();
            ctx.globalAlpha = blendAlpha;
            ctx.drawImage(nextImg, -spineOffsetX, -drawH, drawW, drawH);
            ctx.restore();
          }
        }
      } else {
        ctx.drawImage(activeImg, drawX, drawY, drawW, drawH);
        if (frameFrac > 0.65 && !pose.stumbleTimer) {
          const nextIdx = (frameIdx + 1) % 6;
          const nextImg = this.mozoFrames.run[nextIdx];
          if (nextImg && nextImg !== activeImg) {
            const blendAlpha = ((frameFrac - 0.65) / 0.35) * 0.28;
            ctx.save();
            ctx.globalAlpha = blendAlpha;
            ctx.drawImage(nextImg, drawX, drawY, drawW, drawH);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Renders the fully articulated, quadruped galloping Toro Bravo
   */
  public renderToroBravo(
    ctx: CanvasRenderingContext2D,
    pose: ToroPose,
    groundY: number,
    bullScale: number = 0.76,
    bullIndex: number = 0,
    isBrown: boolean = false
  ) {
    if (!this.bullBody || !this.bullHead) return;

    ctx.save();

    const bullMasterScale = bullScale; // Configurable scale per herd member for 2.5D depth perspective

    const gallop = pose.gallopCycle;
    const dist = pose.distanceMeters;

    // 1. Quadruped Gallop Dynamics
    // A 600kg fighting bull gallops with an asymmetric rotary gallop:
    // Suspension (flight) -> Hind leg impact/propulsion -> Front leg strike & compression
    const verticalBounce = (Math.sin(gallop) * 9.5) / bullMasterScale;
    // Pitch: spine rocks forward when front hooves plant, back when rear pushes off
    const spinePitch = Math.sin(gallop + 0.4) * 0.11; // ~6 degrees

    const bullW = 230;
    const bullH = 175;
    const bullCenterX = pose.x + bullW * 0.48;
    const bullCenterY = groundY - 96 + verticalBounce;

    ctx.translate(bullCenterX, groundY);
    ctx.scale(bullMasterScale, bullMasterScale);
    ctx.translate(-bullCenterX, -groundY);

    // 2. Heavy Ground Shadow on Cobblestones (Squashes and stretches with vertical bounce)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    const shadowStretch = 1 + (verticalBounce / 30);
    ctx.beginPath();
    ctx.ellipse(
      bullCenterX + 10,
      groundY - 8,
      bullW * 0.44 * shadowStretch,
      12 / shadowStretch,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // 3. Leg Gallop Angles
    // Front and rear legs cycle through extension, strike, and push-off
    const frontLeadAngle = Math.sin(gallop) * 0.58;       // Lead front leg
    const frontTrailAngle = Math.sin(gallop + 0.8) * 0.52; // Off-side front leg
    const rearLeadAngle = Math.sin(gallop + Math.PI) * 0.62; // Driving rear leg
    const rearTrailAngle = Math.sin(gallop + Math.PI + 0.75) * 0.55;

    // Ground hoof impact detections
    const frontHoofDown = Math.sin(gallop) < -0.82;
    const rearHoofDown = Math.sin(gallop + Math.PI) < -0.82;

    const fIdx = (bullIndex % 3) * 2;
    const rIdx = fIdx + 1;
    if (frontHoofDown && !this.prevBullHoofDown[fIdx]) {
      this.onGroundImpact?.({ x: bullCenterX + 55 * bullMasterScale, y: groundY - 6, isBull: true });
    }
    if (rearHoofDown && !this.prevBullHoofDown[rIdx]) {
      this.onGroundImpact?.({ x: bullCenterX - 45 * bullMasterScale, y: groundY - 6, isBull: true });
    }
    this.prevBullHoofDown[fIdx] = frontHoofDown;
    this.prevBullHoofDown[rIdx] = rearHoofDown;

    // === LAYER 1: FAR LEGS (Background legs with darker shadow) ===
    ctx.save();
    ctx.filter = 'brightness(0.68) contrast(1.1)';
    // Far rear leg
    this.renderBovineLeg(ctx, bullCenterX - 55, bullCenterY + 12, rearTrailAngle, true, false, isBrown);
    // Far front leg
    this.renderBovineLeg(ctx, bullCenterX + 45, bullCenterY + 14, frontTrailAngle, false, false, isBrown);
    ctx.restore();

    // === LAYER 2: MASSIVE TORSO & TAIL ===
    ctx.save();
    ctx.translate(bullCenterX, bullCenterY);
    ctx.rotate(spinePitch);

    // Dynamic Sinuous Tail (Whips in the slipstream)
    this.renderBullTail(ctx, -bullW * 0.38, 5, gallop, isBrown);

    // Massive Torso / Ribcage
    const bodyW = 165;
    const bodyH = 120;
    const activeBody = (isBrown && this.bullBodyBrown) ? this.bullBodyBrown : this.bullBody;
    ctx.drawImage(activeBody, -bodyW * 0.55, -bodyH * 0.48, bodyW, bodyH);

    ctx.restore();

    // === LAYER 3: FOREGROUND LEGS ===
    // Near rear leg
    this.renderBovineLeg(ctx, bullCenterX - 40, bullCenterY + 16, rearLeadAngle, true, true, isBrown);
    // Near front leg
    this.renderBovineLeg(ctx, bullCenterX + 62, bullCenterY + 18, frontLeadAngle, false, true, isBrown);

    // === LAYER 4: HEAD, MENACING MORRILLO & SHARP ASTIFINOS HORNS ===
    ctx.save();
    // Neck joint anchor
    const neckX = bullCenterX + 55;
    const neckY = bullCenterY - 18;
    ctx.translate(neckX, neckY);

    // Head lunges down & forward on impact, heaves up during suspension
    // When bull gets close (< 8m), lowers head into terrifying ram/gore angle
    const proximityLunge = Math.max(0, (8.0 - dist) / 8.0) * 0.18;
    const headNod = -Math.cos(gallop) * 0.09 - proximityLunge;
    ctx.rotate(spinePitch + headNod);

    const headW = 145;
    const headH = 110;
    const activeHead = (isBrown && this.bullHeadBrown) ? this.bullHeadBrown : this.bullHead;
    ctx.drawImage(activeHead, -headW * 0.18, -headH * 0.52, headW, headH);

    // Flaring nostrils snorting condensation steam on gallop exhalations
    if (Math.sin(gallop) > 0.4) {
      this.renderNostrilSteam(ctx, headW * 0.72, headH * 0.12, gallop, isBrown);
    }

    ctx.restore();

    ctx.restore();
  }

  /**
   * Renders an articulated bovine leg (Front foreleg or rear hindleg)
   */
  private renderBovineLeg(
    ctx: CanvasRenderingContext2D,
    jointX: number,
    jointY: number,
    angle: number,
    isHind: boolean,
    isForeground: boolean,
    isBrown: boolean = false
  ) {
    const legImg = isHind
      ? (isBrown && this.bullHindlegBrown ? this.bullHindlegBrown : this.bullHindleg)
      : (isBrown && this.bullForelegBrown ? this.bullForelegBrown : this.bullForeleg);
    if (!legImg) return;

    ctx.save();
    ctx.translate(jointX, jointY);
    ctx.rotate(angle);

    const legW = isHind ? 48 : 42;
    const legH = isHind ? 76 : 74;

    // Draw photographic muscular leg segment
    ctx.drawImage(legImg, -legW * 0.45, 0, legW, legH);

    // Cloven hoof highlight
    ctx.fillStyle = isForeground ? '#1C1917' : '#0F0E0D';
    ctx.beginPath();
    ctx.ellipse(0, legH - 2, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders the whip-like tail of the fighting bull with harmonic delay
   */
  private renderBullTail(
    ctx: CanvasRenderingContext2D,
    originX: number,
    originY: number,
    gallop: number,
    isBrown: boolean = false
  ) {
    ctx.save();
    ctx.strokeStyle = isBrown ? '#5A2A14' : '#181716';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    const t1x = originX - 25;
    const t1y = originY + 15 + Math.sin(gallop * 1.8) * 8;
    const t2x = originX - 52;
    const t2y = originY + 38 + Math.cos(gallop * 1.8) * 16;

    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.quadraticCurveTo(t1x, t1y, t2x, t2y);
    ctx.stroke();

    // Hair tassel brush at tip
    ctx.fillStyle = isBrown ? '#3A180B' : '#11100F';
    ctx.beginPath();
    ctx.ellipse(t2x - 4, t2y + 4, 10, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders realistic hot breath condensation clouds pulsing from flared nostrils
   */
  private renderNostrilSteam(
    ctx: CanvasRenderingContext2D,
    snoutX: number,
    snoutY: number,
    gallop: number,
    isBrown: boolean = false
  ) {
    ctx.save();
    const alpha = 0.28 + Math.sin(gallop * 3) * 0.15;
    ctx.fillStyle = `rgba(245, 245, 245, ${alpha})`;

    // Puff 1
    ctx.beginPath();
    ctx.arc(snoutX + 8, snoutY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Puff 2 expanding
    ctx.beginPath();
    ctx.arc(snoutX + 18, snoutY - 2, 9, 0, Math.PI * 2);
    ctx.fill();

    // Puff 3 trailing
    ctx.beginPath();
    ctx.arc(snoutX + 30, snoutY - 5, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renders a companion street runner being overtaken or swept by the bull herd.
   */
  public renderStreetRunner(
    ctx: CanvasRenderingContext2D,
    runner: {
      x: number;
      y: number;
      laneY: number;
      scale: number;
      runCycle: number;
      state: 'RUNNING' | 'OVERTAKEN' | 'TUMBLED';
      tumbleRot: number;
      airY?: number;
      calloutText?: string;
      calloutTimer: number;
      profileIndex?: number;
      hasNewspaper?: boolean;
    },
    groundY: number
  ) {
    ctx.save();

    if (!this.mozoFrames) return;
    const runFrames = this.mozoFrames.run;
    if (!runFrames || runFrames.length === 0) return;

    const runnerGroundY = groundY + runner.laneY;
    const baseScale = 0.268 * runner.scale; // ~88-92% of player scale
    const profileIdx = (runner.profileIndex ?? 0) % (this.runnerProfiles.length || 1);

    if (runner.state === 'TUMBLED') {
      const activeImg = (this.runnerStumbleProfiles[profileIdx] || this.mozoFrames.stumble || runFrames[0]) as any;
      if (!activeImg) {
        ctx.restore();
        return;
      }
      const drawW = (activeImg.naturalWidth || activeImg.width || 360) * baseScale;
      const drawH = (activeImg.naturalHeight || activeImg.height || 570) * baseScale;
      const airY = runner.airY || 0; // negative when launched upward into the air

      // 1. Flat contact shadow on cobblestone street
      const shadowAltitude = Math.max(0, -airY);
      const shadowAlpha = Math.max(0.06, 0.32 - shadowAltitude * 0.003);
      const shadowScale = Math.max(0.4, 1 - shadowAltitude * 0.005);

      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.beginPath();
      ctx.ellipse(runner.x, runnerGroundY - 4, drawW * 0.36 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Parabolic body translation and organic tumbling rotation
      ctx.save();
      ctx.translate(runner.x, runnerGroundY + airY - drawH * 0.45);
      ctx.rotate(-runner.tumbleRot);
      ctx.drawImage(activeImg, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
      ctx.restore();

      ctx.restore();
      return;
    }

    // Normal running or overtaken state using assigned photographic profile
    const profileFrames = (this.runnerProfiles[profileIdx] || runFrames) as any[];
    const frameIdx = Math.floor(Math.abs(runner.runCycle * 1.6)) % profileFrames.length;
    const activeImg = profileFrames[frameIdx] || profileFrames[0];
    if (!activeImg) {
      ctx.restore();
      return;
    }

    const imgW = activeImg.naturalWidth || activeImg.width || 360;
    const imgH = activeImg.naturalHeight || activeImg.height || 570;
    const drawW = imgW * baseScale;
    const drawH = imgH * baseScale;
    const spineOffsetX = 170 * baseScale;

    // Contact drop shadow on cobblestones
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(runner.x, runnerGroundY - 4, drawW * 0.35, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Harmonic vertical bob
    const verticalBob = Math.sin(runner.runCycle * 2) * 1.5;

    ctx.save();
    // Slight anxious forward tilt
    ctx.translate(runner.x, runnerGroundY + verticalBob);
    ctx.rotate(0.06);
    ctx.drawImage(activeImg, -spineOffsetX, -drawH, drawW, drawH);

    // Optional rolled Pamplona newspaper in hand to gauge horns
    if (runner.hasNewspaper) {
      this.renderRunnerNewspaper(ctx, -spineOffsetX, drawW, drawH, runner.runCycle, runner.profileIndex);
    }
    ctx.restore();

    ctx.restore();
  }

  /**
   * Initializes photographic runner profiles at startup.
   * Creates authentic photographic variations (0: Classic original, 1: Rubio dorado, 2: Moreno azabache, 3: Pelirrojo cobrizo, 4: Canoso plateado)
   * by modulating hair pixel hues directly on offscreen canvases.
   * This guarantees 100% pixel-perfect biomechanical tracking and lighting without artificial vector overlays.
   */
  private initRunnerProfiles() {
    if (!this.mozoFrames || !this.mozoFrames.run || this.mozoFrames.run.length === 0) return;

    // Profile 0: Classic original mozo
    this.runnerProfiles = [this.mozoFrames.run];
    this.runnerStumbleProfiles = [this.mozoFrames.stumble || this.mozoFrames.run[0]];

    const modes: ('BLONDE' | 'BLACK' | 'RED' | 'GREY' | 'AFRO')[] = ['BLONDE', 'BLACK', 'RED', 'GREY', 'AFRO'];

    for (const mode of modes) {
      const tintedRun = this.createHairTintedFrames(this.mozoFrames.run, mode);
      const tintedStumble = this.createHairTintedFrames(
        [this.mozoFrames.stumble || this.mozoFrames.run[0]],
        mode
      )[0];

      this.runnerProfiles.push(tintedRun);
      this.runnerStumbleProfiles.push(tintedStumble);
    }
  }

  private createHairTintedFrames(
    sourceFrames: (HTMLImageElement | CanvasImageSource)[],
    mode: 'BLONDE' | 'BLACK' | 'RED' | 'GREY' | 'AFRO'
  ): HTMLCanvasElement[] {
    return sourceFrames.map((src) => {
      const img = src as HTMLImageElement;
      const w = img.naturalWidth || (img as any).width || 360;
      const h = img.naturalHeight || (img as any).height || 570;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas;

      ctx.drawImage(img as any, 0, 0);

      try {
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const maxHeadY = Math.floor(h * 0.24);
        const scanH = mode === 'AFRO' ? h : maxHeadY;

        for (let y = 0; y < scanH; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const a = data[idx + 3];
            if (a < 50) continue;

            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const brightness = (r + g + b) / 3;
            const maxC = Math.max(r, g, b);

            const isSkin = brightness > 125 || (r > 140 && r > g && g > b && r - b > 35);
            const isWhiteCloth = brightness > 185;
            const isRedScarf = r > 145 && r - g > 55;

            if (mode === 'AFRO') {
              // 1. Jet black hair in the head region
              if (y < maxHeadY) {
                const isHair = !isSkin && !isWhiteCloth && !isRedScarf && brightness >= 10 && brightness < 115 && maxC < 130;
                if (isHair) {
                  data[idx] = Math.floor(r * 0.32);
                  data[idx + 1] = Math.floor(g * 0.32);
                  data[idx + 2] = Math.floor(b * 0.38);
                  continue;
                }
              }

              // 2. Melanin rich dark skin tone across body (face, arms, hands, legs)
              // Protect white clothing and red festival scarf & sash
              const isCloth = brightness > 190 && maxC - Math.min(r, g, b) < 24;
              const isRed = r > 140 && r - g > 48;
              const isDarkShadow = brightness < 50;

              if (!isCloth && !isRed && !isDarkShadow) {
                const isBodySkin = (r > 125 && r > g && g >= b * 0.8 && r - b > 18) ||
                                   (brightness > 110 && brightness < 210 && r > b + 15);
                if (isBodySkin) {
                  const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
                  // Rich warm deep brown / dark bronze skin tone preserving natural lighting & shading
                  data[idx] = Math.min(255, Math.floor(45 + lum * 105));
                  data[idx + 1] = Math.min(255, Math.floor(28 + lum * 74));
                  data[idx + 2] = Math.min(255, Math.floor(18 + lum * 52));
                }
              }
            } else {
              const isHair = !isSkin && !isWhiteCloth && !isRedScarf && brightness >= 10 && brightness < 115 && maxC < 130;

              if (isHair) {
                const normB = brightness / 100;
                if (mode === 'BLONDE') {
                  data[idx] = Math.min(255, Math.floor(170 + normB * 70));
                  data[idx + 1] = Math.min(255, Math.floor(138 + normB * 65));
                  data[idx + 2] = Math.min(255, Math.floor(45 + normB * 45));
                } else if (mode === 'BLACK') {
                  data[idx] = Math.floor(r * 0.38);
                  data[idx + 1] = Math.floor(g * 0.38);
                  data[idx + 2] = Math.floor(b * 0.48);
                } else if (mode === 'RED') {
                  data[idx] = Math.min(255, Math.floor(165 + normB * 75));
                  data[idx + 1] = Math.min(255, Math.floor(65 + normB * 45));
                  data[idx + 2] = Math.min(255, Math.floor(25 + normB * 30));
                } else if (mode === 'GREY') {
                  const silver = Math.floor(brightness * 1.5 + 48);
                  data[idx] = Math.min(240, silver);
                  data[idx + 1] = Math.min(240, silver);
                  data[idx + 2] = Math.min(248, Math.floor(silver * 1.04));
                }
              }
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (err) {
        // Fallback gracefully if CORS restricts pixel read
        console.warn('Could not tint runner frame:', err);
      }

      return canvas;
    });
  }

  /**
   * Authentic rolled newspaper (Periódico de San Fermín) carried in hand
   * Traditional tool of Pamplona runners to measure the charging horns.
   */
  private renderRunnerNewspaper(
    ctx: CanvasRenderingContext2D,
    originX: number,
    drawW: number,
    drawH: number,
    cycle: number,
    profileIndex: number = 0
  ) {
    ctx.save();
    // Hand oscillation synchronized with run cycle
    const handSwing = Math.sin(cycle * 1.6);
    const handX = originX + drawW * 0.63 + handSwing * 4.5;
    const handY = -drawH + drawH * 0.52 - Math.abs(handSwing) * 4;

    ctx.translate(handX, handY);
    ctx.rotate(0.35 + handSwing * 0.18); // Angled forward pointing ahead

    // Rolled newspaper cylinder (El Periódico de San Fermín)
    const rollLength = drawH * 0.17;
    const rollRadius = drawH * 0.022;

    ctx.fillStyle = '#F8FAFC'; // Off-white newsprint paper
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-rollRadius, -rollLength * 0.5, rollRadius * 2, rollLength, rollRadius);
    ctx.fill();
    ctx.stroke();

    // Newspaper text lines printed on the rolled paper
    ctx.fillStyle = '#475569';
    const lines = 4;
    for (let i = 0; i < lines; i++) {
      const lineY = -rollLength * 0.35 + i * (rollLength * 0.22);
      ctx.fillRect(-rollRadius * 0.55, lineY, rollRadius * 1.1, 1.2);
    }

    // Runner's gripping fingers around the roll (matching profile skin tone)
    ctx.fillStyle = profileIndex === 5 ? '#6E432A' : '#E8BC96';
    ctx.beginPath();
    ctx.arc(0, 0, rollRadius * 1.05, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();

    ctx.restore();
  }
}
