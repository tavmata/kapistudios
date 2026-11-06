/**
 * ===========================================================================
 * Procedural Monster Renderer & Locomotion Kinematics Bundle
 * Exported: 2026-11-04T03:37:04.278Z
 * Monsters Included: Salamander, Dragon, Frost Elemental, Giant Rat, Skeleton, Giant Spider, Slime, Wolf, Frost Troll, Goblin, Kobold, Void Terror
 *
 * Self-contained procedural HTML5 Canvas renderer with complete walking,
 * locomotion kinematics, directional turning, attack warning zones,
 * and animation logic. Zero external dependencies required.
 * ===========================================================================
 */

// ---------------------------------------------------------------------------
// 1. Math, Radial Gradients & Inline Hashing Utilities
// ---------------------------------------------------------------------------
// helpers.js - Math, Hashing & Canvas Gradient Utilities for Monster Rendering

/**
 * Zero-allocation inline hashing function to eliminate transient string allocations during seed generation.
 * @param {string|number} idStr
 * @returns {number}
 */
export function computeFastSeed(idStr) {
  if (!idStr) return 0;
  const str = String(idStr);
  const len = str.length;
  let seed = 0;
  const start = len > 4 ? len - 4 : 0;
  for (let i = start; i < len; i++) {
    seed = ((seed << 5) - seed) + str.charCodeAt(i);
    seed |= 0;
  }
  return Math.abs(seed);
}

/**
 * Safely creates a radial gradient, preventing canvas crash on NaN or negative radii.
 * @param {CanvasRenderingContext2D} targetCtx
 * @param {number} x0
 * @param {number} y0
 * @param {number} r0
 * @param {number} x1
 * @param {number} y1
 * @param {number} r1
 * @returns {CanvasGradient|null}
 */
export function safeCreateRadialGradient(targetCtx, x0, y0, r0, x1, y1, r1) {
  if (
    !targetCtx ||
    !Number.isFinite(x0) ||
    !Number.isFinite(y0) ||
    !Number.isFinite(r0) ||
    !Number.isFinite(x1) ||
    !Number.isFinite(y1) ||
    !Number.isFinite(r1) ||
    r0 < 0 ||
    r1 <= 0
  ) {
    return null;
  }
  try {
    return targetCtx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Procedural Ground Attack Warning Zone System
// ---------------------------------------------------------------------------
// attackArea.js - Minimalist Monster Attack Area Warning Zone System
// Designed for clean visual clarity in 2MMORPG and top-down RPG games.
//
// DESIGN PRINCIPLES:
// 1. Pure Warning Zone: Renders only the clean danger zone footprint without
//    heavy contours, borders, or cluttering textures.
// 2. Clear Time-To-Impact: Smooth, flat progress fill clearly communicates
//    the charging attack area.
// 3. No Textures or Hatching: Zero diagonal hatch lines, crosshairs, chevrons,
//    or ticks to keep the ground surface clean and uncluttered.
// 4. Instant Strike Confirmation: Clean impact flash at 100% completion
//    followed by rapid dissipation.
// 5. Multi-Shape MMO Support: Circle (AoE/Slam), Cone (Cleave/Breath),
//    Line (Dash/Runway), and Donut (Inner Safe Zone, Outer Danger).



/**
 * Standard Thematic Visual Palettes for Monster Attacks
 */
export const ATTACK_AREA_THEMES = Object.freeze({
  void: Object.freeze({
    id: "void",
    primary: "#d946ef",
    secondary: "#c084fc",
    deep: "#3b0764",
    core: "#ffffff",
    ticks: "#e879f9",
    fillBase: "rgba(147, 51, 234, 0.22)",
    fillProgress: "rgba(217, 70, 239, 0.46)",
    contrast: "rgba(15, 4, 30, 0.95)",
    hatch: "rgba(232, 121, 249, 0.18)",
    flash: "#f5d0fe"
  }),
  frost: Object.freeze({
    id: "frost",
    primary: "#38bdf8",
    secondary: "#0284c7",
    deep: "#082f49",
    core: "#ffffff",
    ticks: "#7dd3fc",
    fillBase: "rgba(2, 132, 199, 0.20)",
    fillProgress: "rgba(56, 189, 248, 0.44)",
    contrast: "rgba(3, 15, 38, 0.95)",
    hatch: "rgba(186, 230, 253, 0.18)",
    flash: "#e0f2fe"
  }),
  fire: Object.freeze({
    id: "fire",
    primary: "#f97316",
    secondary: "#ef4444",
    deep: "#7f1d1d",
    core: "#fef08a",
    ticks: "#fb923c",
    fillBase: "rgba(220, 38, 38, 0.22)",
    fillProgress: "rgba(249, 115, 22, 0.48)",
    contrast: "rgba(30, 5, 2, 0.95)",
    hatch: "rgba(253, 186, 116, 0.20)",
    flash: "#fef08a"
  }),
  poison: Object.freeze({
    id: "poison",
    primary: "#22c55e",
    secondary: "#16a34a",
    deep: "#14532d",
    core: "#fef08a",
    ticks: "#4ade80",
    fillBase: "rgba(21, 128, 61, 0.22)",
    fillProgress: "rgba(34, 197, 94, 0.46)",
    contrast: "rgba(5, 25, 10, 0.95)",
    hatch: "rgba(134, 239, 172, 0.18)",
    flash: "#dcfce7"
  }),
  physical: Object.freeze({
    id: "physical",
    primary: "#ef4444",
    secondary: "#b91c1c",
    deep: "#450a0a",
    core: "#fef08a",
    ticks: "#f87171",
    fillBase: "rgba(185, 28, 28, 0.22)",
    fillProgress: "rgba(239, 68, 68, 0.46)",
    contrast: "rgba(25, 5, 5, 0.95)",
    hatch: "rgba(252, 165, 165, 0.18)",
    flash: "#fee2e2"
  }),
  arcane: Object.freeze({
    id: "arcane",
    primary: "#06b6d4",
    secondary: "#0891b2",
    deep: "#164e63",
    core: "#ffffff",
    ticks: "#22d3ee",
    fillBase: "rgba(8, 145, 178, 0.22)",
    fillProgress: "rgba(6, 182, 212, 0.46)",
    contrast: "rgba(4, 20, 28, 0.95)",
    hatch: "rgba(165, 243, 252, 0.18)",
    flash: "#cffafe"
  })
});

/**
 * Resolves a visual palette theme from string name or custom palette object.
 */
export function resolveAttackTheme(themeInput, isEnraged = false) {
  let theme = null;
  if (typeof themeInput === "string") {
    const key = themeInput.toLowerCase();
    if (key.includes("void") || key.includes("terror") || key.includes("devourer") || key.includes("gazer") || key.includes("shadow")) {
      theme = ATTACK_AREA_THEMES.void;
    } else if (key.includes("frost") || key.includes("ice") || key.includes("glacial") || key.includes("troll") || key.includes("blizzard")) {
      theme = ATTACK_AREA_THEMES.frost;
    } else if (key.includes("fire") || key.includes("magma") || key.includes("pyro") || key.includes("meteor")) {
      theme = ATTACK_AREA_THEMES.fire;
    } else if (key.includes("poison") || key.includes("toxic") || key.includes("acid") || key.includes("spider") || key.includes("rat") || key.includes("sugarcane") || (key.includes("cane") && !key.includes("arcane")) || key.includes("spriggan")) {
      theme = (key.includes("charred") || key.includes("scorch")) ? ATTACK_AREA_THEMES.fire : ATTACK_AREA_THEMES.poison;
    } else if (key.includes("arcane") || key.includes("lightning") || key.includes("shock") || key.includes("geyser")) {
      theme = ATTACK_AREA_THEMES.arcane;
    } else {
      theme = ATTACK_AREA_THEMES.physical;
    }
  } else if (themeInput && typeof themeInput === "object") {
    theme = themeInput;
  } else {
    theme = ATTACK_AREA_THEMES.physical;
  }

  if (isEnraged) {
    return {
      ...theme,
      primary: "#ef4444",
      secondary: "#dc2626",
      ticks: "#fef08a",
      fillBase: "rgba(220, 38, 38, 0.28)",
      fillProgress: "rgba(239, 68, 68, 0.54)",
      contrast: "rgba(30, 2, 2, 0.95)",
      hatch: "rgba(254, 240, 138, 0.25)",
      flash: "#ffffff"
    };
  }

  return theme;
}

/**
 * Kept for interface compatibility; no contours drawn.
 */
export function strokeFairBoundary(ctx, pathFn, options = {}) {
  // Contours removed for clean warning zone appearance
}

/**
 * Kept for interface compatibility; no hatching textures drawn.
 */
export function drawHazardHatchLines(ctx, width, height, color, spacing = 22, offset = 0) {
  // Textures removed for clean warning zone appearance
}

/**
 * -------------------------------------------------------------
 * 1. CIRCLE / AOE DISK ATTACK AREA (Ground Slam, Meteor, Nova, Void Zone)
 * -------------------------------------------------------------
 * Clean warning zone with zero contours and zero textures.
 */
export function drawCircleAttackArea(ctx, centerX, centerY, params = {}) {
  const {
    radius = 64,
    progress = 0, // 0.0 to 1.0 (windup), > 1.0 = strike/dissipate
    theme: themeParam = "physical",
    isEnraged = false,
    isometricRatio = 0.65 // 2MMORPG top-down ground perspective ratio
  } = params;

  if (radius <= 0) return;

  const theme = resolveAttackTheme(themeParam, isEnraged);
  const clampedP = Math.min(1.0, Math.max(0, progress));
  const isStrike = progress >= 1.0 || (params.isStrike === true);
  const strikeP = isStrike ? Math.min(1.0, (params.strikeProgress !== undefined ? params.strikeProgress : (progress - 1.0) / 0.35)) : 0;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(1.0, isometricRatio);

  // 1. Base Danger Warning Zone Fill
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2);
  ctx.fillStyle = theme.fillBase;
  ctx.fill();

  // 2. Windup Progress Fill (Clean expanding area fill)
  if (!isStrike) {
    const waveR = radius * clampedP;
    if (waveR > 0.5) {
      ctx.beginPath();
      ctx.ellipse(0, 0, waveR, waveR, 0, 0, Math.PI * 2);
      ctx.fillStyle = theme.fillProgress;
      ctx.fill();
    }
  }

  // 3. Strike Resolution (Clean instant flash of the warning zone)
  if (isStrike) {
    const flashAlpha = Math.max(0, 1.0 - strikeP);
    if (flashAlpha > 0.02) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.7})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * -------------------------------------------------------------
 * 2. CONE / CLEAVE / SECTOR ATTACK AREA (Breath, Frontal Cleave, Swipe)
 * -------------------------------------------------------------
 * Clean sector warning zone with zero contours and zero textures.
 */
export function drawConeAttackArea(ctx, originX, originY, params = {}) {
  const {
    radius = 90,
    angle = 0, // facing direction in radians
    arc = Math.PI * 0.55, // sector spread
    progress = 0,
    theme: themeParam = "physical",
    isEnraged = false
  } = params;

  if (radius <= 0 || arc <= 0) return;

  const theme = resolveAttackTheme(themeParam, isEnraged);
  const clampedP = Math.min(1.0, Math.max(0, progress));
  const isStrike = progress >= 1.0 || (params.isStrike === true);
  const strikeP = isStrike ? Math.min(1.0, (params.strikeProgress !== undefined ? params.strikeProgress : (progress - 1.0) / 0.35)) : 0;
  const halfArc = arc * 0.5;

  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angle);

  const drawConePath = (c) => {
    c.moveTo(0, 0);
    c.arc(0, 0, radius, -halfArc, halfArc);
    c.closePath();
  };

  // 1. Base Danger Warning Zone Fill
  ctx.beginPath();
  drawConePath(ctx);
  ctx.fillStyle = theme.fillBase;
  ctx.fill();

  // 2. Windup Progress Fill (Clean expanding sector wave from origin to radius)
  if (!isStrike && clampedP > 0) {
    const curR = radius * clampedP;
    if (curR > 0.5) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, curR, -halfArc, halfArc);
      ctx.closePath();
      ctx.fillStyle = theme.fillProgress;
      ctx.fill();
    }
  }

  // 3. Strike Resolution (Clean instant flash of the warning zone)
  if (isStrike) {
    const flashAlpha = Math.max(0, 1.0 - strikeP);
    if (flashAlpha > 0.02) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.7})`;
      ctx.beginPath();
      drawConePath(ctx);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * -------------------------------------------------------------
 * 3. LINE / RUNWAY / RECTANGLE ATTACK AREA (Dash, Charge, Beam, Projectile Lane)
 * -------------------------------------------------------------
 * Clean rectangular warning zone with zero contours and zero textures.
 */
export function drawLineAttackArea(ctx, originX, originY, params = {}) {
  const {
    length = 180,
    width = 46,
    angle = 0,
    progress = 0,
    theme: themeParam = "physical",
    isEnraged = false
  } = params;

  if (length <= 0 || width <= 0) return;

  const theme = resolveAttackTheme(themeParam, isEnraged);
  const clampedP = Math.min(1.0, Math.max(0, progress));
  const isStrike = progress >= 1.0 || (params.isStrike === true);
  const strikeP = isStrike ? Math.min(1.0, (params.strikeProgress !== undefined ? params.strikeProgress : (progress - 1.0) / 0.35)) : 0;
  const halfW = width * 0.5;

  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angle);

  // 1. Base Danger Warning Zone Fill
  ctx.beginPath();
  ctx.rect(0, -halfW, length, width);
  ctx.fillStyle = theme.fillBase;
  ctx.fill();

  // 2. Windup Progress Fill (Clean advancing rectangular area)
  if (!isStrike) {
    const waveLen = length * clampedP;
    if (waveLen > 0) {
      ctx.fillStyle = theme.fillProgress;
      ctx.fillRect(0, -halfW, waveLen, width);
    }
  }

  // 3. Strike Resolution (Clean instant flash of the warning zone)
  if (isStrike) {
    const flashAlpha = Math.max(0, 1.0 - strikeP);
    if (flashAlpha > 0.02) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.7})`;
      ctx.beginPath();
      ctx.rect(0, -halfW, length, width);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * -------------------------------------------------------------
 * 4. DONUT / RING ATTACK AREA (Inner Safe Zone, Outer Danger)
 * -------------------------------------------------------------
 * Clean ring warning zone with zero contours and zero textures.
 */
export function drawDonutAttackArea(ctx, centerX, centerY, params = {}) {
  const {
    radius = 120, // outer danger radius
    innerRadius = 45, // inner safe zone radius
    progress = 0,
    theme: themeParam = "void",
    isEnraged = false,
    isometricRatio = 0.65
  } = params;

  if (radius <= 0 || innerRadius >= radius) return;

  const theme = resolveAttackTheme(themeParam, isEnraged);
  const clampedP = Math.min(1.0, Math.max(0, progress));
  const isStrike = progress >= 1.0 || (params.isStrike === true);
  const strikeP = isStrike ? Math.min(1.0, (params.strikeProgress !== undefined ? params.strikeProgress : (progress - 1.0) / 0.35)) : 0;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(1.0, isometricRatio);

  const drawDonutPath = (c) => {
    c.arc(0, 0, radius, 0, Math.PI * 2, false);
    c.arc(0, 0, innerRadius, 0, Math.PI * 2, true);
  };

  // 1. Base Danger Warning Zone Fill
  ctx.beginPath();
  drawDonutPath(ctx);
  ctx.fillStyle = theme.fillBase;
  ctx.fill();

  // 2. Windup Progress Fill (Clean collapsing ring)
  if (!isStrike) {
    const dangerWidth = (radius - innerRadius) * clampedP;
    const curInner = radius - dangerWidth;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
    ctx.arc(0, 0, curInner, 0, Math.PI * 2, true);
    ctx.fillStyle = theme.fillProgress;
    ctx.fill();
  }

  // 3. Strike Resolution (Clean instant flash of the warning zone)
  if (isStrike) {
    const flashAlpha = Math.max(0, 1.0 - strikeP);
    if (flashAlpha > 0.02) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.7})`;
      ctx.beginPath();
      drawDonutPath(ctx);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * -------------------------------------------------------------
 * 5. MASTER DISPATCHER: drawAttackArea
 * -------------------------------------------------------------
 */
export function drawAttackArea(ctx, originX, originY, params = {}) {
  const shape = (params.shape || "circle").toLowerCase();

  if (shape === "cone" || shape === "cleave" || shape === "sector" || shape === "breath") {
    return drawConeAttackArea(ctx, originX, originY, params);
  }

  if (shape === "line" || shape === "rect" || shape === "corridor" || shape === "dash" || shape === "runway") {
    return drawLineAttackArea(ctx, originX, originY, params);
  }

  if (shape === "donut" || shape === "ring" || shape === "safe_center") {
    return drawDonutAttackArea(ctx, originX, originY, params);
  }

  // Default to Circle / AoE
  return drawCircleAttackArea(ctx, originX, originY, params);
}

/**
 * -------------------------------------------------------------
 * 6. ENTITY ATTACK AREA AUTO-HOOK: drawEntityAttackArea
 * -------------------------------------------------------------
 * Inspects any entity during attack windup or casting
 * and renders its clean warning zone on the ground beneath/ahead of it.
 */
export function drawEntityAttackArea(ctx, ent, x, y) {
  if (!ent) return;
  if (ent.showAttackZone === false || ent.showZone === false || ent.showAttackArea === false) return;

  const isAttacking = !!(ent.isAttacking || ent.currentCast || ent.showZonePreview || ent.loopZonePreview);
  if (!isAttacking) return;

  const type = (ent.type || "").toLowerCase();
  const facingAngle = typeof ent.facingAngle === "number" ? ent.facingAngle : 0;
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (ent._lastAreaRenderFrame && Math.abs(nowMs - ent._lastAreaRenderFrame) < 2) {
    return;
  }
  ent._lastAreaRenderFrame = nowMs;

  let progress = 0;
  let duration = ent.attackDuration || 500;
  if (ent.currentCast) {
    if (typeof ent.currentCast.progress === "number") {
      progress = ent.currentCast.progress;
    } else if (ent.currentCast.duration > 0) {
      duration = ent.currentCast.duration;
      const start = ent.currentCast.startTime || nowMs;
      progress = Math.min(1.0, Math.max(0, (nowMs - start) / duration));
    }
  } else if (ent.attackStart || ent.lastAttackTime || ent.attackTime) {
    const start = ent.attackStart || ent.lastAttackTime || ent.attackTime;
    progress = Math.min(1.0, Math.max(0, (nowMs - start) / duration));
  }

  const isBoss = type.startsWith("boss_") || type.includes("king") || type.includes("chieftain") || type.includes("giant") || type.includes("colossus") || type.includes("leviathan");
  const isEnraged = !!ent.isEnraged || (ent.hp && ent.maxHp && ent.hp <= ent.maxHp * 0.45);

  const customShape = ent.customShape && ent.customShape !== "auto" ? ent.customShape : null;
  const customTheme = ent.customTheme && ent.customTheme !== "auto" ? ent.customTheme : null;

  // Base parameters
  let shape = customShape || "circle";
  let theme = customTheme || "physical";
  let radius = ent.customRadius || ent.attackRadius || (isBoss ? 80 : 50);
  let innerRadius = ent.customInnerRadius || (isBoss ? 40 : 25);
  let length = ent.customRadius ? ent.customRadius * 2 : (isBoss ? 190 : 140);
  let width = ent.customWidth || (isBoss ? 56 : 42);
  let arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.5 : Math.PI * 0.55;
  let targetX = x;
  let targetY = y;
  let effectiveAngle = facingAngle;

  if (!customShape) {
    if (type.includes("spider") || type.includes("weaver") || type.includes("tarantula") || type.includes("broodmother") || type.includes("stalker")) {
      theme = "poison";
      shape = "circle";
      radius = isBoss ? 78 : 48;
      const offsetDist = isBoss ? 58 : 44;
      targetX = x + Math.cos(facingAngle) * offsetDist;
      targetY = y + Math.sin(facingAngle) * offsetDist;
    } else if ((type.includes("troll") || type.includes("jotunn") || type.includes("giant")) && !type.includes("spider")) {
      theme = "frost";
      if (ent.isBreathingFrost) {
        shape = "cone";
        radius = isBoss ? 140 : 100;
        arc = Math.PI * 0.55;
        targetX = x;
        targetY = y;
      } else {
        shape = "circle";
        radius = isBoss ? 90 : 60;
        const offsetDist = isBoss ? 50 : 36;
        targetX = x + Math.cos(facingAngle) * offsetDist;
        targetY = y + Math.sin(facingAngle) * offsetDist;
      }
    } else if (type.includes("slime")) {
      theme = "poison";
      if (type.includes("boss") || ent.isDashing) {
        shape = "line";
        length = isBoss ? 200 : 160;
        width = isBoss ? 60 : 46;
        targetX = x;
        targetY = y;
      } else {
        shape = "circle";
        radius = isBoss ? 75 : 44;
        targetX = x;
        targetY = y;
      }
    } else if (
      type.includes("elemental") ||
      type.includes("wisp") ||
      type.includes("tempest") ||
      type.includes("warden") ||
      type.includes("monarch")
    ) {
      theme = "frost";
      const atkType = ent.attackType || ent.elementalAttackType || "spire";
      if (atkType === "nova") {
        shape = "circle";
        radius = isBoss ? 95 : 65;
        targetX = x;
        targetY = y;
      } else if (atkType === "vortex" || atkType === "blizzard") {
        shape = "donut";
        radius = isBoss ? 110 : 78;
        targetX = x;
        targetY = y;
      } else if (atkType === "wiggle") {
        shape = "circle";
        radius = 38;
        targetX = x;
        targetY = y;
      } else if (atkType === "breath" || atkType === "funnel") {
        shape = "cone";
        radius = isBoss ? 130 : 90;
        arc = Math.PI * 0.52;
        targetX = x;
        targetY = y;
      } else {
        shape = "line";
        length = isBoss ? 190 : 135;
        width = isBoss ? 48 : 34;
        targetX = x;
        targetY = y;
      }
    } else if (type.includes("wolf")) {
      theme = "physical";
      shape = "line";
      length = isBoss ? 190 : 130;
      width = isBoss ? 56 : 42;
      targetX = x;
      targetY = y;
    } else if (type.includes("goblin")) {
      if (type.includes("archer")) {
        shape = "line";
        length = 220;
        width = 28;
        targetX = x;
        targetY = y;
      } else {
        shape = "cone";
        radius = isBoss ? 78 : 54;
        arc = Math.PI * 0.52;
        targetX = x;
        targetY = y;
      }
    } else if (
      type.includes("skeleton") ||
      type.includes("samba") ||
      type.includes("passista") ||
      type.includes("malandro") ||
      type.includes("mestre")
    ) {
      theme = "physical";
      const isThrust = ent.attackType === "thrust" || ent.skeletonAttackType === "thrust" ||
        (!ent.attackType && !ent.skeletonAttackType && (type === "skeleton" || type.includes("passista") || type.includes("malandro") || !type.includes("boss")));
      if (isThrust) {
        // Precise directional rapier thrust extending forward from the skeleton
        shape = "line";
        length = isBoss ? 150 : 105;
        width = isBoss ? 38 : 26;
        targetX = x;
        targetY = y;
      } else {
        // Frontal directional sabre cleave arc extending ahead of the skeleton
        shape = "cone";
        radius = isBoss ? 92 : 64;
        arc = isBoss ? Math.PI * 0.50 : Math.PI * 0.40;
        targetX = x;
        targetY = y;
      }
    } else if (type.includes("void") || type.includes("terror") || type.includes("gazer") || type.includes("devourer")) {
      theme = (type.includes("devourer") ? "physical" : type.includes("gazer") ? "frost" : "void");
      const voidAtk = (ent.voidAttackType || ent.attackType || "spin").toLowerCase();
      if (voidAtk === "beam" || voidAtk === "void_beam" || voidAtk === "rift" || voidAtk === "null_ray") {
        shape = "line";
        length = ent.customRadius ? ent.customRadius * 2.4 : (isBoss ? 260 : 180);
        width = ent.customWidth || (isBoss ? 54 : 38);
        targetX = x;
        targetY = y;
        effectiveAngle = facingAngle;
      } else if (voidAtk === "slam" || voidAtk === "cleave" || voidAtk === "thrash") {
        shape = "cone";
        radius = ent.customRadius || (isBoss ? 135 : 90);
        arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.5 : (isBoss ? Math.PI * 0.58 : Math.PI * 0.48);
        targetX = x;
        targetY = y;
        effectiveAngle = facingAngle;
      } else if (voidAtk === "singularity" || voidAtk === "black_hole" || voidAtk === "collapse" || voidAtk === "gravity_well") {
        shape = "donut";
        radius = ent.customRadius || (isBoss ? 120 : 85);
        innerRadius = ent.customRadius ? ent.customRadius * 0.32 : (isBoss ? 38 : 26);
        targetX = x;
        targetY = y;
      } else if (voidAtk === "nova" || voidAtk === "supernova" || voidAtk === "cataclysm") {
        shape = "circle";
        radius = ent.customRadius || (isBoss ? 125 : 85);
        targetX = x;
        targetY = y;
      } else if (voidAtk === "skewer" || voidAtk === "pierce" || voidAtk === "barrage") {
        shape = "line";
        length = ent.customRadius ? ent.customRadius * 1.8 : (isBoss ? 200 : 140);
        width = ent.customWidth || (isBoss ? 42 : 30);
        targetX = x;
        targetY = y;
        effectiveAngle = facingAngle;
      } else if (voidAtk === "spin" || voidAtk === "whirlwind") {
        shape = "circle";
        radius = ent.customRadius || (isBoss ? 96 : 68);
        targetX = x;
        targetY = y;
      } else {
        shape = "circle";
        radius = ent.customRadius || (isBoss ? 80 : 56);
        const offsetDist = isBoss ? 62 : 46;
        targetX = x + Math.cos(facingAngle) * offsetDist;
        targetY = y + Math.sin(facingAngle) * offsetDist;
      }
    } else if (type.includes("rat") || type.includes("vermin")) {
      theme = "poison";
      const ratAtk = ent.ratAttackType || ent.attackType;
      if (ratAtk === "surge" || isBoss) {
        shape = "circle";
        radius = isBoss ? 85 : 68;
        targetX = x;
        targetY = y;
      } else {
        shape = "line";
        length = isBoss ? 150 : 105;
        width = isBoss ? 44 : 32;
        targetX = x;
        targetY = y;
      }
    } else if (type.includes("dragon") || type.includes("drake") || type.includes("wyrm")) {
      theme = (type.includes("frost") || type.includes("ice") || type.includes("wyrm")) ? "frost" :
              (type.includes("void") || type.includes("abyss") || type.includes("shadow")) ? "void" :
              (type.includes("emerald") || type.includes("forest") || type.includes("toxic")) ? "poison" : "fire";
      const dragAtk = ent.dragonAttackType || ent.attackType;
      if (dragAtk === "tail_swipe" || dragAtk === "swipe") {
        shape = "cone";
        radius = isBoss ? 120 : 85;
        arc = Math.PI * 0.75;
        targetX = x;
        targetY = y;
      } else if (dragAtk === "wing_buffet" || dragAtk === "buffet" || dragAtk === "roar" || dragAtk === "dragon_roar") {
        shape = "circle";
        radius = isBoss ? 130 : 95;
        targetX = x;
        targetY = y;
      } else {
        // Dragon Breath Cone - Dynamically follows dragon's head motion, lunge, hover bob, and sweep
        shape = "cone";
        const bp = getDragonBreathAreaParams(ent, x, y, facingAngle, {}, nowMs);
        radius = bp.radius;
        arc = bp.arc;
        targetX = bp.originX;
        targetY = bp.originY;
        effectiveAngle = bp.angle;
      }
    } else if (type.includes("kobold")) {
      theme = "physical";
      const koboldAtk = ent.koboldAttackType || ent.attackType || "strike";
      if (koboldAtk === "excavate" || koboldAtk === "tunnel" || koboldAtk === "trench") {
        // Forward excavation tunnel trench corridor
        shape = "line";
        length = ent.customRadius ? ent.customRadius * 2 : (isBoss ? 160 : 120);
        width = ent.customWidth || (isBoss ? 42 : 30);
        targetX = x;
        targetY = y;
        effectiveAngle = facingAngle;
      } else if (koboldAtk === "slam" || koboldAtk === "quakepick") {
        // Pickaxe ground slam impact circle ahead of the kobold
        shape = "circle";
        radius = ent.customRadius || (isBoss ? 66 : 46);
        const offsetDist = isBoss ? 52 : 36;
        targetX = x + Math.cos(facingAngle) * offsetDist;
        targetY = y + Math.sin(facingAngle) * offsetDist;
      } else {
        // Frontal pickaxe cleave sector arc extending ahead of the kobold in facing direction
        shape = "cone";
        radius = ent.customRadius || (isBoss ? 85 : 62);
        arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.5 : (isBoss ? Math.PI * 0.52 : Math.PI * 0.46);
        targetX = x;
        targetY = y;
        effectiveAngle = facingAngle;
      }
    } else if (type.includes("salamander") || type.includes("axolotl") || type.includes("proteus")) {
      const sp = getSalamanderAttackAreaParams(ent, x, y, facingAngle, {}, nowMs);
      theme = sp.theme;
      shape = sp.shape;
      radius = sp.radius;
      arc = sp.arc;
      targetX = sp.originX;
      targetY = sp.originY;
      effectiveAngle = sp.angle;
    }
  } else {
    // If a directional shape was selected manually in studio, check if dragon or salamander cone
    if (shape === "line" || shape === "cone") {
      if (shape === "cone" && (type.includes("dragon") || type.includes("drake") || type.includes("wyrm"))) {
        const bp = getDragonBreathAreaParams(ent, x, y, facingAngle, {}, nowMs);
        radius = ent.customRadius || bp.radius;
        arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.5 : bp.arc;
        targetX = bp.originX;
        targetY = bp.originY;
        effectiveAngle = bp.angle;
      } else if (shape === "cone" && (type.includes("salamander") || type.includes("axolotl") || type.includes("proteus"))) {
        const sp = getSalamanderAttackAreaParams(ent, x, y, facingAngle, {}, nowMs);
        radius = ent.customRadius || sp.radius;
        arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.5 : sp.arc;
        targetX = sp.originX;
        targetY = sp.originY;
        effectiveAngle = sp.angle;
      } else {
        targetX = x;
        targetY = y;
      }
    } else {
      // Symmetrical AoE (circle, donut): centered at entity or frontal offset
      targetX = x;
      targetY = y;
    }
  }

  const isoRatio = (ent.isIsometric === false) ? 1.0 : (typeof ent.isometricRatio === "number" ? ent.isometricRatio : 0.65);

  // Draw the clean warning zone
  drawAttackArea(ctx, targetX, targetY, {
    shape,
    radius,
    innerRadius,
    length,
    width,
    arc,
    angle: effectiveAngle,
    progress,
    theme,
    isEnraged,
    isometricRatio: isoRatio,
    nowMs
  });
}

/**
 * Resolves exact dragon breath cone area parameters matching the dragon's head motion, lunge, hover bob, and sweep
 */
export function getDragonBreathAreaParams(ent = {}, x = 0, y = 0, facingAngle = 0, cfg = {}, nowMsOverride = null) {
  const type = (ent.type || cfg.id || "dragon").toLowerCase();
  const isBoss = !!(cfg.isBoss || type.includes("boss") || type.includes("sovereign") || type.includes("colossal") || type.includes("pyregorged"));
  const scale = cfg.scale || (isBoss ? 1.95 : 1.35);
  const isSlowed = !!ent.isSlowed;
  const speedMult = isSlowed ? 0.45 : 1.0;
  const nowMs = nowMsOverride !== null ? nowMsOverride : (typeof performance !== "undefined" ? performance.now() : Date.now());
  const seed = ent._seed || 42;

  // Hover bob in Y
  const hoverBob = Math.sin(nowMs * 0.0035 * speedMult + seed) * (isBoss ? 4.5 : 3.5);

  // Attack state and progress
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  let attackProgress = 0;
  if (ent.currentCast && ent.currentCast.duration > 0) {
    const elapsed = Math.max(0, nowMs - (ent.currentCast.startTime || nowMs));
    attackProgress = Math.min(1, elapsed / ent.currentCast.duration);
    isAttacking = true;
  } else if (isAttacking) {
    const animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
    const dur = (ent.attackDuration && ent.attackDuration > 0) ? ent.attackDuration : 650;
    attackProgress = Math.min(1, (nowMs - animStart) / dur);
    if (attackProgress >= 1) isAttacking = false;
  } else if (ent.showZonePreview || ent.loopZonePreview) {
    isAttacking = true;
    attackProgress = ((nowMs * 0.00085 + seed * 0.1) % 1);
  }

  // Attack lunge and head sweep yaw
  let attackLungeDist = 0;
  let headYaw = 0;

  if (isAttacking) {
    if (attackProgress < 0.28) {
      // Windup: pulls back, gathers breath
      const p = attackProgress / 0.28;
      attackLungeDist = -6 * p;
      headYaw = Math.sin(p * Math.PI) * 0.04;
    } else if (attackProgress < 0.82) {
      // Strike & sustained firebreath: lunges forward and sweeps head side-to-side
      const p = (attackProgress - 0.28) / 0.54;
      attackLungeDist = 14 * Math.sin(Math.min(1, p * 1.8) * Math.PI * 0.5);
      // Fluid head sweep across the cleave
      headYaw = Math.sin(p * Math.PI * 2) * (isBoss ? 0.16 : 0.14);
    } else {
      // Dissipation: returns to neutral
      const p = (attackProgress - 0.82) / 0.18;
      attackLungeDist = 14 * (1 - p);
      headYaw = (1 - p) * Math.sin(Math.PI * 2) * (isBoss ? 0.16 : 0.14);
    }
  } else {
    // Idle gentle head sway
    headYaw = Math.sin(nowMs * 0.003 + seed) * 0.02;
  }

  // Exact head anchor and snout coordinates in dragon space
  const neckTipY = Math.sin(headYaw) * 4;
  const snoutLocalX = 22 + Math.cos(headYaw) * 24;
  const snoutLocalY = neckTipY + Math.sin(headYaw) * 24;

  const scaledSnoutX = snoutLocalX * scale;
  const scaledSnoutY = snoutLocalY * scale;

  const cosF = Math.cos(facingAngle);
  const sinF = Math.sin(facingAngle);

  const bodyX = x + cosF * attackLungeDist;
  const bodyY = (y + hoverBob) + sinF * attackLungeDist;

  const originX = bodyX + cosF * scaledSnoutX - sinF * scaledSnoutY;
  const originY = bodyY + sinF * scaledSnoutX + cosF * scaledSnoutY;

  const headAngle = facingAngle + headYaw;

  const radius = ent.customRadius || ent.attackRadius || (isBoss ? 180 : 135);
  const arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.5 : Math.PI * 0.48;

  return {
    originX,
    originY,
    radius,
    arc,
    angle: headAngle,
    headYaw,
    neckTipY,
    hoverBob,
    attackLungeDist,
    attackProgress,
    scale,
    isBoss
  };
}

/**
 * Resolves exact salamander attack area parameters matching head motion, lunge, snout apex, and tail kinematics.
 * Ensures the visual attack effect and the ground attack warning zone share the identical area.
 */
export function getSalamanderAttackAreaParams(ent = {}, x = 0, y = 0, facingAngle = 0, cfg = {}, nowMsOverride = null) {
  const type = (ent.type || cfg.id || "fire_salamander").toLowerCase();
  const isBoss = !!(cfg.isBoss || type.includes("boss") || type.includes("magma") || type.includes("colossal") || type.includes("behemoth"));
  const scale = cfg.scale || (isBoss ? 1.85 : 1.25);
  const nowMs = nowMsOverride !== null ? nowMsOverride : (typeof performance !== "undefined" ? performance.now() : Date.now());
  const seed = ent._seed || 42;

  // Attack state and progress
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  let attackProgress = 0;
  if (ent.currentCast && ent.currentCast.duration > 0) {
    const elapsed = Math.max(0, nowMs - (ent.currentCast.startTime || nowMs));
    attackProgress = Math.min(1, elapsed / ent.currentCast.duration);
    isAttacking = true;
  } else if (isAttacking) {
    const animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
    const dur = (ent.attackDuration && ent.attackDuration > 0) ? ent.attackDuration : 600;
    attackProgress = Math.min(1, (nowMs - animStart) / dur);
    if (attackProgress >= 1) isAttacking = false;
  } else if (ent.showZonePreview || ent.loopZonePreview) {
    isAttacking = true;
    attackProgress = ((nowMs * 0.00085 + seed * 0.1) % 1);
  }

  const salAtk = ent.salamanderAttackType || ent.attackType || "breath";
  const theme = (type.includes("toxic") || type.includes("poison")) ? "poison" :
                (type.includes("axolotl") || type.includes("proteus")) ? "frost" : "fire";

  // Head lunge calculation identical to drawSalamander kinematics
  let headLungeX = 0;
  if (isAttacking) {
    if (salAtk === "tail_whip" || salAtk === "whip") {
      headLungeX = 0;
    } else if (salAtk === "gill_flare" || salAtk === "ember_burst" || salAtk === "flare") {
      headLungeX = Math.sin(attackProgress * Math.PI) * 3;
    } else {
      if (attackProgress < 0.35) {
        headLungeX = -(attackProgress / 0.35) * 4;
      } else {
        const forward = (attackProgress - 0.35) / 0.65;
        headLungeX = -4 + Math.sin(forward * Math.PI) * 9;
      }
    }
  }

  let originX = x;
  let originY = y;
  let angle = facingAngle;
  let shape = "cone";
  let radius = ent.customRadius || ent.attackRadius;
  let arc = Math.PI * 0.44;

  if (salAtk === "tail_whip" || salAtk === "whip") {
    shape = "cone";
    radius = radius || (isBoss ? 115 : 75);
    arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.6 : Math.PI * 0.85;
    originX = x;
    originY = y;
    angle = facingAngle + Math.PI;
  } else if (salAtk === "ember_burst" || salAtk === "gill_flare" || salAtk === "flare" || (isBoss && salAtk === "slam")) {
    shape = "circle";
    radius = radius || (isBoss ? 95 : 65);
    originX = x;
    originY = y;
    arc = Math.PI * 2;
  } else {
    // Breath / Spit / Bubble Surge Cone:
    // Snout apex in local coordinates:
    // headBaseX = (14 + headLungeX), snout apex = headW = (isBoss ? 20 : 13.5).
    shape = "cone";
    radius = radius || (isBoss ? 130 : 90);
    arc = ent.customWidth ? (ent.customWidth / 60) * Math.PI * 0.5 : Math.PI * 0.42;

    const snoutLocalX = 14 + headLungeX + (isBoss ? 18 : 12.5);
    const scaledSnoutDist = snoutLocalX * scale;

    const cosF = Math.cos(facingAngle);
    const sinF = Math.sin(facingAngle);

    originX = x + cosF * scaledSnoutDist;
    originY = y + sinF * scaledSnoutDist;
    angle = facingAngle;
  }

  return {
    originX,
    originY,
    radius,
    arc,
    angle,
    shape,
    theme,
    salAtk,
    headLungeX,
    attackProgress,
    isAttacking,
    scale,
    isBoss
  };
}

// ---------------------------------------------------------------------------
// 3. Monster Offsets & Health Bar UI System
// ---------------------------------------------------------------------------
// mobUi.js - Monster Nameplates, Offsets & Health Bar UI Systems

const _DEFAULT_OFFSETS = Object.freeze({ hpOffset: 65, nameOffset: 85 });
const _MOB_OFFSETS_CACHE = {
  "ice_elemental": Object.freeze({ hpOffset: 85, nameOffset: 102 }),
  "frost_elemental": Object.freeze({ hpOffset: 76, nameOffset: 94 }),
  "frost_wisp": Object.freeze({ hpOffset: 56, nameOffset: 72 }),
  "frost_tempest": Object.freeze({ hpOffset: 84, nameOffset: 104 }),
  "cryo_warden": Object.freeze({ hpOffset: 92, nameOffset: 112 }),
  "glacial_colossus": Object.freeze({ hpOffset: 118, nameOffset: 138 }),
  "boss_frost_monarch": Object.freeze({ hpOffset: 145, nameOffset: 168 }),
  "magma_elemental": Object.freeze({ hpOffset: 85, nameOffset: 102 }),
  "boss_crystal_weaver": Object.freeze({ hpOffset: 130, nameOffset: 150 }),
  "boss_frost_giant": Object.freeze({ hpOffset: 165, nameOffset: 185 }),
  "jotunn": Object.freeze({ hpOffset: 165, nameOffset: 185 }),
  "boss_obsidian_golem": Object.freeze({ hpOffset: 145, nameOffset: 165 }),
  "boss_void_terror": Object.freeze({ hpOffset: 125, nameOffset: 145 }),
  "void_terror": Object.freeze({ hpOffset: 95, nameOffset: 115 }),
  "boss_void_devourer": Object.freeze({ hpOffset: 120, nameOffset: 140 }),
  "void_devourer": Object.freeze({ hpOffset: 92, nameOffset: 112 }),
  "void_null_gazer": Object.freeze({ hpOffset: 88, nameOffset: 108 }),
  "null_gazer": Object.freeze({ hpOffset: 88, nameOffset: 108 }),
  "void_spawn": Object.freeze({ hpOffset: 55, nameOffset: 72 }),
  "boss_singularity_colossus": Object.freeze({ hpOffset: 135, nameOffset: 155 }),
  "boss_abyssal_tidecaller": Object.freeze({ hpOffset: 140, nameOffset: 160 }),
  "elite_knight": Object.freeze({ hpOffset: 102, nameOffset: 122 }),
  "elite_archer": Object.freeze({ hpOffset: 102, nameOffset: 122 }),
  "player": Object.freeze({ hpOffset: 95, nameOffset: 115 }),
  "boss_goblin_king": Object.freeze({ hpOffset: 145, nameOffset: 165 }),
  "boss_goblin": Object.freeze({ hpOffset: 120, nameOffset: 140 }),
  "goblin_brute": Object.freeze({ hpOffset: 98, nameOffset: 116 }),
  "goblin_warrior": Object.freeze({ hpOffset: 95, nameOffset: 115 }),
  "goblin_archer": Object.freeze({ hpOffset: 82, nameOffset: 100 }),
  "goblin": Object.freeze({ hpOffset: 78, nameOffset: 96 }),
  "kobold": Object.freeze({ hpOffset: 70, nameOffset: 88 }),
  "kobold_miner": Object.freeze({ hpOffset: 72, nameOffset: 90 }),

  "boss_slime": Object.freeze({ hpOffset: 135, nameOffset: 155 }),
  "boss_wolf": Object.freeze({ hpOffset: 135, nameOffset: 155 }),
  "slime_heavy": Object.freeze({ hpOffset: 88, nameOffset: 106 }),
  "wolf_alpha": Object.freeze({ hpOffset: 88, nameOffset: 106 }),
  "slime": Object.freeze({ hpOffset: 65, nameOffset: 82 }),
  "wolf": Object.freeze({ hpOffset: 75, nameOffset: 92 }),
  "corrupted_wolf": Object.freeze({ hpOffset: 75, nameOffset: 92 }),
  "dire_wolf": Object.freeze({ hpOffset: 75, nameOffset: 92 }),
  "rat": Object.freeze({ hpOffset: 52, nameOffset: 68 }),
  "sewer_rat": Object.freeze({ hpOffset: 52, nameOffset: 68 }),
  "shadow_rat": Object.freeze({ hpOffset: 52, nameOffset: 68 }),
  "albino_rat": Object.freeze({ hpOffset: 52, nameOffset: 68 }),
  "dire_rat": Object.freeze({ hpOffset: 65, nameOffset: 82 }),
  "armored_rat": Object.freeze({ hpOffset: 65, nameOffset: 82 }),
  "boss_rat_king": Object.freeze({ hpOffset: 110, nameOffset: 130 }),
  "frost_troll": Object.freeze({ hpOffset: 72, nameOffset: 90 }),
  "frost_troll_shaman": Object.freeze({ hpOffset: 96, nameOffset: 118 }),
  "frost_troll_warrior": Object.freeze({ hpOffset: 90, nameOffset: 110 }),
  "snow_troll": Object.freeze({ hpOffset: 80, nameOffset: 98 }),
  "tundra_troll": Object.freeze({ hpOffset: 84, nameOffset: 104 }),
  "glacial_troll": Object.freeze({ hpOffset: 86, nameOffset: 106 }),
  "crystal_troll": Object.freeze({ hpOffset: 88, nameOffset: 108 }),
  "glass_troll": Object.freeze({ hpOffset: 72, nameOffset: 90 }),
  "boss_frost_troll": Object.freeze({ hpOffset: 155, nameOffset: 175 }),
  "skeleton": Object.freeze({ hpOffset: 64, nameOffset: 82 }),
  "skeleton_mestre": Object.freeze({ hpOffset: 68, nameOffset: 86 }),
  "skeleton_malandro": Object.freeze({ hpOffset: 60, nameOffset: 78 }),
  "elite_knight": Object.freeze({ hpOffset: 70, nameOffset: 88 }),
  "boss_samba_king": Object.freeze({ hpOffset: 96, nameOffset: 116 }),
  "giant_cave_spider": Object.freeze({ hpOffset: 82, nameOffset: 102 }),
  "spider_weaver": Object.freeze({ hpOffset: 82, nameOffset: 102 }),
  "cave_spider": Object.freeze({ hpOffset: 80, nameOffset: 100 }),
  "spider": Object.freeze({ hpOffset: 80, nameOffset: 100 }),
  "boss_broodmother": Object.freeze({ hpOffset: 115, nameOffset: 135 }),
  "toxic_tarantula": Object.freeze({ hpOffset: 85, nameOffset: 105 }),
  "void_stalker": Object.freeze({ hpOffset: 82, nameOffset: 102 }),
  "dragon": Object.freeze({ hpOffset: 105, nameOffset: 125 }),
  "dragon_whelp": Object.freeze({ hpOffset: 65, nameOffset: 82 }),
  "elder_dragon": Object.freeze({ hpOffset: 135, nameOffset: 155 }),
  "fire_drake": Object.freeze({ hpOffset: 105, nameOffset: 125 }),
  "frost_wyrm": Object.freeze({ hpOffset: 108, nameOffset: 128 }),
  "void_drake": Object.freeze({ hpOffset: 106, nameOffset: 126 }),
  "emerald_drake": Object.freeze({ hpOffset: 105, nameOffset: 125 }),
  "boss_dragon": Object.freeze({ hpOffset: 155, nameOffset: 178 }),
  "salamander": Object.freeze({ hpOffset: 66, nameOffset: 84 }),
  "fire_salamander": Object.freeze({ hpOffset: 66, nameOffset: 84 }),
  "boss_magma_salamander": Object.freeze({ hpOffset: 110, nameOffset: 132 }),
  "axolotl": Object.freeze({ hpOffset: 64, nameOffset: 82 }),
  "toxic_salamander": Object.freeze({ hpOffset: 65, nameOffset: 83 }),
  "cave_proteus": Object.freeze({ hpOffset: 64, nameOffset: 82 }),
  "sugarcane": Object.freeze({ hpOffset: 74, nameOffset: 92 }),
  "sugarcane_stalker": Object.freeze({ hpOffset: 74, nameOffset: 92 }),
  "boss_sugarcane_colossus": Object.freeze({ hpOffset: 125, nameOffset: 148 }),
  "sweet_sap_spriggan": Object.freeze({ hpOffset: 62, nameOffset: 80 }),
  "charred_cane_horror": Object.freeze({ hpOffset: 75, nameOffset: 94 }),
};

export function getMobUiOffsets(ent) {
  if (!ent || !ent.type) return _DEFAULT_OFFSETS;
  const type = ent.type.toLowerCase();
  const direct = _MOB_OFFSETS_CACHE[type];
  if (direct) return direct;

  if (type.includes("sugarcane") || (type.includes("cane") && !type.includes("arcane")) || type.includes("spriggan")) {
    return (type.startsWith("boss") || type.includes("colossus") || type.includes("golem"))
      ? _MOB_OFFSETS_CACHE["boss_sugarcane_colossus"]
      : (type.includes("spriggan") || type.includes("wisp"))
      ? _MOB_OFFSETS_CACHE["sweet_sap_spriggan"]
      : (type.includes("charred") || type.includes("scorch"))
      ? _MOB_OFFSETS_CACHE["charred_cane_horror"]
      : _MOB_OFFSETS_CACHE["sugarcane_stalker"];
  }

  if (type.includes("salamander") || type.includes("axolotl") || type.includes("proteus")) {
    return (type.startsWith("boss") || type.includes("magma") || type.includes("colossal")) ? _MOB_OFFSETS_CACHE["boss_magma_salamander"] : _MOB_OFFSETS_CACHE["salamander"];
  }

  if (type.includes("colossus") || type.includes("singularity")) return _MOB_OFFSETS_CACHE["boss_singularity_colossus"];
  if (type.includes("terror") || type === "boss_void") return type.startsWith("boss") ? _MOB_OFFSETS_CACHE["boss_void_terror"] : _MOB_OFFSETS_CACHE["void_terror"];
  if (type.includes("devourer")) return type.startsWith("boss") ? _MOB_OFFSETS_CACHE["boss_void_devourer"] : _MOB_OFFSETS_CACHE["void_devourer"];
  if (type.includes("gazer")) return _MOB_OFFSETS_CACHE["void_null_gazer"];
  if (type.includes("spawn") || type.includes("larva")) return _MOB_OFFSETS_CACHE["void_spawn"];
  if (type.startsWith("boss_goblin")) return _MOB_OFFSETS_CACHE["boss_goblin"];
  if (type.includes("warrior")) return _MOB_OFFSETS_CACHE["goblin_warrior"];
  if (type.startsWith("goblin")) return _MOB_OFFSETS_CACHE["goblin"];
  if (type.includes("kobold")) return _MOB_OFFSETS_CACHE["kobold_miner"];

  if (type.startsWith("boss_samba") || type.includes("samba_king") || (type.includes("skeleton") && type.includes("boss"))) return _MOB_OFFSETS_CACHE["boss_samba_king"];
  if (type.includes("mestre") || type.includes("bateria")) return _MOB_OFFSETS_CACHE["skeleton_mestre"];
  if (type.includes("malandro")) return _MOB_OFFSETS_CACHE["skeleton_malandro"];
  if (type.includes("knight")) return _MOB_OFFSETS_CACHE["elite_knight"];
  if (type.includes("skeleton") || type.includes("samba") || type.includes("passista")) return _MOB_OFFSETS_CACHE["skeleton"];
  if (type.includes("broodmother") || (type.includes("spider") && type.includes("boss"))) return _MOB_OFFSETS_CACHE["boss_broodmother"];
  if (type.includes("tarantula")) return _MOB_OFFSETS_CACHE["toxic_tarantula"];
  if (type.includes("stalker")) return _MOB_OFFSETS_CACHE["void_stalker"];
  if (type.includes("spider") || type.includes("weaver")) return _MOB_OFFSETS_CACHE["giant_cave_spider"];
  if ((type.includes("giant") && !type.includes("spider")) || (type.includes("troll") && type.startsWith("boss"))) return _MOB_OFFSETS_CACHE["boss_frost_troll"];
  if (type.includes("shaman") || type.includes("mystic") || type.includes("witchdoctor")) return _MOB_OFFSETS_CACHE["frost_troll_shaman"];
  if (type.includes("warrior") || type.includes("armored")) return _MOB_OFFSETS_CACHE["frost_troll_warrior"];
  if (type.includes("snow") || type.includes("polar") || type.includes("yeti")) return _MOB_OFFSETS_CACHE["snow_troll"];
  if (type.includes("tundra") || type.includes("mountain")) return _MOB_OFFSETS_CACHE["tundra_troll"];
  if (type.includes("glacial") || type.includes("berserker")) return _MOB_OFFSETS_CACHE["glacial_troll"];
  if (type.includes("crystal")) return _MOB_OFFSETS_CACHE["crystal_troll"];
  if (type.includes("troll")) return _MOB_OFFSETS_CACHE["frost_troll"];
  if (type.includes("rat") || type.includes("vermin")) return (type.startsWith("boss") || type.includes("king")) ? _MOB_OFFSETS_CACHE["boss_rat_king"] : _MOB_OFFSETS_CACHE["rat"];
  if (type.includes("monarch") || type.includes("archon")) return _MOB_OFFSETS_CACHE["boss_frost_monarch"];
  if (type.includes("colossus") && (type.includes("glacial") || type.includes("frost") || type.includes("ice"))) return _MOB_OFFSETS_CACHE["glacial_colossus"];
  if (type.includes("warden") || type.includes("monolith")) return _MOB_OFFSETS_CACHE["cryo_warden"];
  if (type.includes("tempest") || type.includes("vortex")) return _MOB_OFFSETS_CACHE["frost_tempest"];
  if (type.includes("wisp")) return _MOB_OFFSETS_CACHE["frost_wisp"];
  if (type.includes("elemental") && (type.includes("frost") || type.includes("ice") || type.includes("cryo"))) return _MOB_OFFSETS_CACHE["frost_elemental"];
  
  if (type.includes("dragon") || type.includes("drake") || type.includes("wyrm")) {
    return (type.startsWith("boss") || type.includes("sovereign") || type.includes("colossal")) ? _MOB_OFFSETS_CACHE["boss_dragon"] : _MOB_OFFSETS_CACHE["dragon"];
  }
  
  
  if (type.includes("salamander") || type.includes("axolotl") || type.includes("proteus")) {
    return (type.startsWith("boss") || type.includes("magma") || type.includes("colossal")) ? _MOB_OFFSETS_CACHE["boss_magma_salamander"] : _MOB_OFFSETS_CACHE["salamander"];
  }

  return _DEFAULT_OFFSETS;
}

export function drawEntityHP(ctx, ent, screenX, screenY, offset = null) {
  if (typeof window !== "undefined" && typeof window.shouldShowMobHpBar === "function" && !window.shouldShowMobHpBar(ent)) return;
  if (!ent || !ent.maxHp) return;

  // Resolve entity UI offset so the life bar floats cleanly above towering headdresses and plumes
  const mobOffsets = getMobUiOffsets(ent);
  let effectiveOffset = offset;
  if (effectiveOffset === null || effectiveOffset === undefined || effectiveOffset === 28) {
    effectiveOffset = mobOffsets ? mobOffsets.hpOffset : 62;
  }
    if (ent.displayHp === undefined) ent.displayHp = ent.hp;
    // Smooth interpolator for health bar changes (reduces jumpiness)
    ent.displayHp += (ent.hp - ent.displayHp) * 0.15;

    const hpPercent = Math.max(0, ent.displayHp / ent.maxHp);
    const barW = 34;
    const barH = 5;
    const barX = screenX - barW / 2;
    const barY = screenY - effectiveOffset;

    // Rare (aura) mobs are marked by their body rendering (see modules/render/rareMobLook.js), not text.

    // Status Effect Visual Effects (Stun Orbit Stars)
    if (ent.buffs && (ent.buffs.stunned || ent.buffs.stun)) {
      ctx.save();
      const rot = (Date.now() * 0.006) % (Math.PI * 2);
      ctx.strokeStyle = "#f1c40f";
      ctx.fillStyle = "#ffe082";
      ctx.lineWidth = 1.5;
      for (let sIdx = 0; sIdx < 3; sIdx++) {
        const sa = rot + (sIdx * Math.PI * 2) / 3;
        const starX = screenX + Math.cos(sa) * 16;
        const starY = barY - 10 + Math.sin(sa) * 5;
        ctx.beginPath();
        ctx.arc(starX, starY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dark background with black stroke border
    ctx.fillStyle = "rgba(15, 15, 15, 0.85)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, barH + 1);

    const myId = (typeof GameState !== "undefined" && GameState) ? GameState.myId : (typeof window !== "undefined" && window.GameState ? window.GameState.myId : null);

    if (ent.type === "player" && myId && ent.id === myId) {
      ctx.fillStyle = hpPercent < 0.25 ? "#e67e22" : "#2ecc71";
    } else if (ent.isPet) {
      ctx.fillStyle = (myId && ent.ownerId === myId) ? "#3498db" : "#2980b9";
    } else {
      ctx.fillStyle = hpPercent < 0.3 ? "#c0392b" : "#e74c3c";
    }

    const fillW = Math.max(0, Math.min(barW, barW * hpPercent));
    if (fillW > 0) {
      ctx.fillRect(barX, barY, fillW, barH);
    }

    if (ent.healShield > 0) {
      const shieldPercent = ent.healShield / ent.maxHp;
      ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
      const startX = barX + fillW;
      const shieldWidth = Math.min(barW - fillW, barW * shieldPercent);
      if (shieldWidth > 0) {
        ctx.fillRect(startX, barY, shieldWidth, barH);
      }
    }

    if (ent.maxMana) {
      const manaPercent = Math.max(0, ent.mana / ent.maxMana);
      const manaY = barY + barH + 2;
      const manaH = 3;
      ctx.fillStyle = "rgba(15, 15, 15, 0.85)";
      ctx.fillRect(barX, manaY, barW, manaH);
      ctx.strokeRect(barX - 0.5, manaY - 0.5, barW + 1, manaH + 1);
      ctx.fillStyle = "#3498db";
      ctx.fillRect(barX, manaY, barW * manaPercent, manaH);
    }

    if (ent.currentCast && ent.currentCast.duration > 0) {
      const elapsed = Math.max(0, Date.now() - (ent.currentCast.startTime || Date.now()));
      const castPercent = Math.min(1, elapsed / ent.currentCast.duration);
      const castY = barY + barH + (ent.maxMana ? 5 : 2);
      const castH = 3;
      ctx.fillStyle = "rgba(15, 15, 15, 0.85)";
      ctx.fillRect(barX, castY, barW, castH);
      ctx.strokeRect(barX - 0.5, castY - 0.5, barW + 1, castH + 1);
      ctx.fillStyle = "#f1c40f"; // Yellow color for cast bar
      ctx.fillRect(barX, castY, barW * castPercent, castH);
    }

    // Local player Dodge / Stamina Micro-Bar (Minimalist HUD)
    if (ent.type === "player" && myId && ent.id === myId) {
      const nowMs = Date.now();
      const dodgeCd = window.localDodgeCooldownAt || 0;
      const isDodgeOnCd = dodgeCd > nowMs;
      const totalDodgeCd = 1500;

      if (isDodgeOnCd) {
        const remaining = dodgeCd - nowMs;
        const progress = Math.max(0, Math.min(1, 1 - (remaining / totalDodgeCd)));
        let dodgeExtraY = ent.maxMana ? 5 : 2;
        if (ent.currentCast && ent.currentCast.duration > 0) dodgeExtraY += 5;
        const dodgeY = barY + barH + dodgeExtraY;
        const dodgeH = 2.5;

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(barX, dodgeY, barW, dodgeH);
        ctx.strokeStyle = "rgba(2, 132, 199, 0.5)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX - 0.5, dodgeY - 0.5, barW + 1, dodgeH + 1);

        const dodgeFillW = Math.max(0, Math.min(barW, barW * progress));
        if (dodgeFillW > 0) {
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(barX, dodgeY, dodgeFillW, dodgeH);
        }
      }
    }

    if (ent.class === "assassin" && myId && ent.id === myId) {
      const maxCombo = 5;
      const combo = ent.comboPoints || 0;
      const dotRadius = 1.5;
      const spacing = 5;
      const startX = screenX - (maxCombo * spacing) / 2 + spacing / 2;
      for (let i = 0; i < maxCombo; i++) {
        ctx.beginPath();
        ctx.arc(
          startX + i * spacing,
          screenY - effectiveOffset + 11,
          dotRadius,
          0,
          Math.PI * 2,
        );
        if (i < combo) {
          ctx.fillStyle = "#9b59b6";
          ctx.fill();
        } else {
          ctx.strokeStyle = "#555";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
}


// ---------------------------------------------------------------------------
// Procedural Particle & Limb Explosion VFX Engine
// ---------------------------------------------------------------------------
export const monsterParticles = [];

export function spawnParticle(p) {
  monsterParticles.push({
    x: p.x,
    y: p.y,
    vx: p.vx || 0,
    vy: p.vy || 0,
    color: Array.isArray(p.color) ? p.color[Math.floor(Math.random() * p.color.length)] : (p.color || "#ffffff"),
    size: p.size || 3,
    life: 0,
    maxLife: p.maxLife || 1.0,
    gravity: p.gravity || 0,
    drag: p.drag || 0.98,
    shrink: !!p.shrink,
    style: p.style || "circle",
    accentColor: p.accentColor
  });
}

export function updateAndDrawParticles(ctx, dt = 0.016) {
  for (let i = monsterParticles.length - 1; i >= 0; i--) {
    const p = monsterParticles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      monsterParticles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= Math.pow(p.drag, dt * 60);
    p.vy *= Math.pow(p.drag, dt * 60);

    const progress = p.life / p.maxLife;
    const alpha = Math.max(0, 1 - progress);
    const currentSize = p.shrink ? p.size * (1 - progress) : p.size;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, currentSize), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

if (typeof window !== "undefined") {
  window.spawnParticle = spawnParticle;
}

// ---------------------------------------------------------------------------
// 4. Procedural Monster Renderers
// ---------------------------------------------------------------------------
// --- Family: Salamander ---
// salamanders.js - Procedural Lineless Salamander & Amphibious Entity Renderer



/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * Monsters must never have baked-in dark circular shapes emulating ground shadows.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

// Visual archetypes for the Salamander family
export const SALAMANDER_VARIANTS = Object.freeze({
  fire_salamander: Object.freeze({
    id: "fire_salamander",
    label: "Fire Salamander (Pyre Scales & Flame Dorsal Spine)",
    scale: 1.25,
    isBoss: false,
    hasGills: false,
    hasVolcanicPlates: false,
    hasSpottedBlotches: true,
    hasTranslucentSkin: false,
    bodyBase: "#18181b",
    bodySecondary: "#27272a",
    bellyColor: "#3f3f46",
    blotchColor: "#f59e0b",
    blotchCore: "#fef08a",
    blotchEdge: "#ea580c",
    eyeColor: "#facc15",
    pupilColor: "#09090b",
    dorsalFinColor: "#f97316",
    dorsalFinGlow: "rgba(249, 115, 22, 0.45)",
    clawColor: "#09090b",
    breathTheme: "fire",
    particleStyle: "fire_ember",
    auraGlow: "rgba(245, 158, 11, 0.28)",
    particleColors: ["#fef08a", "#f59e0b", "#f97316", "#ef4444"]
  }),
  boss_magma_salamander: Object.freeze({
    id: "boss_magma_salamander",
    label: "Colossal Magma Salamander (Molten Volcanic Core Boss)",
    scale: 1.85,
    isBoss: true,
    hasGills: false,
    hasVolcanicPlates: true,
    hasSpottedBlotches: false,
    hasTranslucentSkin: false,
    bodyBase: "#140a08",
    bodySecondary: "#2a120c",
    bellyColor: "#431407",
    blotchColor: "#ff7800",
    blotchCore: "#ffea79",
    blotchEdge: "#b91c1c",
    eyeColor: "#ff0033",
    pupilColor: "#ffea79",
    dorsalFinColor: "#f97316",
    dorsalFinGlow: "rgba(255, 100, 0, 0.65)",
    clawColor: "#1c1917",
    breathTheme: "fire",
    particleStyle: "magma_rock",
    auraGlow: "rgba(239, 68, 68, 0.40)",
    particleColors: ["#ffffff", "#fef08a", "#f97316", "#ef4444", "#7f1d1d"]
  }),
  axolotl: Object.freeze({
    id: "axolotl",
    label: "Cavern Axolotl (Frilled Feather Gills & Bubble Surge)",
    scale: 1.20,
    isBoss: false,
    hasGills: true,
    hasVolcanicPlates: false,
    hasSpottedBlotches: false,
    hasTranslucentSkin: true,
    bodyBase: "#fbcfe8",
    bodySecondary: "#f472b6",
    bellyColor: "#fdf2f8",
    blotchColor: "#ec4899",
    blotchCore: "#fbcfe8",
    blotchEdge: "#db2777",
    eyeColor: "#1e1b4b",
    pupilColor: "#0f172a",
    eyeHighlight: "#ffffff",
    gillStemColor: "#db2777",
    gillFilamentColor: "#f43f5e",
    gillGlowColor: "rgba(244, 63, 94, 0.50)",
    dorsalFinColor: "rgba(244, 114, 182, 0.65)",
    dorsalFinGlow: "rgba(244, 114, 182, 0.35)",
    clawColor: "#f472b6",
    breathTheme: "frost",
    particleStyle: "bubble_pearl",
    auraGlow: "rgba(244, 114, 182, 0.32)",
    particleColors: ["#ffffff", "#fdf2f8", "#fbcfe8", "#38bdf8", "#7dd3fc"]
  }),
  toxic_salamander: Object.freeze({
    id: "toxic_salamander",
    label: "Toxic Spotted Salamander (Aposematic Blotches & Poison Pores)",
    scale: 1.22,
    isBoss: false,
    hasGills: false,
    hasVolcanicPlates: false,
    hasSpottedBlotches: true,
    hasTranslucentSkin: false,
    bodyBase: "#022c22",
    bodySecondary: "#064e3b",
    bellyColor: "#0f766e",
    blotchColor: "#a3e635",
    blotchCore: "#ecfccb",
    blotchEdge: "#65a30d",
    eyeColor: "#eab308",
    pupilColor: "#022c22",
    dorsalFinColor: "#84cc16",
    dorsalFinGlow: "rgba(163, 230, 53, 0.40)",
    clawColor: "#022c22",
    breathTheme: "poison",
    particleStyle: "toxic_droplet",
    auraGlow: "rgba(163, 230, 53, 0.30)",
    particleColors: ["#ecfccb", "#bef264", "#84cc16", "#22c55e", "#10b981"]
  }),
  cave_proteus: Object.freeze({
    id: "cave_proteus",
    label: "Bioluminescent Cave Proteus (Translucent Subterranean)",
    scale: 1.28,
    isBoss: false,
    hasGills: true,
    hasVolcanicPlates: false,
    hasSpottedBlotches: false,
    hasTranslucentSkin: true,
    bodyBase: "#f1f5f9",
    bodySecondary: "#e2e8f0",
    bellyColor: "#f8fafc",
    blotchColor: "#38bdf8",
    blotchCore: "#e0f2fe",
    blotchEdge: "#0284c7",
    eyeColor: "#94a3b8",
    pupilColor: "#64748b",
    eyeHighlight: "#ffffff",
    gillStemColor: "#e11d48",
    gillFilamentColor: "#f43f5e",
    gillGlowColor: "rgba(244, 63, 94, 0.55)",
    dorsalFinColor: "rgba(148, 163, 184, 0.55)",
    dorsalFinGlow: "rgba(56, 189, 248, 0.38)",
    clawColor: "#cbd5e1",
    breathTheme: "arcane",
    particleStyle: "biolum_spore",
    auraGlow: "rgba(56, 189, 248, 0.35)",
    particleColors: ["#ffffff", "#e0f2fe", "#7dd3fc", "#38bdf8", "#0284c7"]
  })
});

/**
 * Resolves configuration object for any salamander type string
 */
export function resolveSalamanderConfig(type = "") {
  const lower = (type || "").toLowerCase();
  if (lower.includes("boss") || lower.includes("magma") || lower.includes("behemoth") || lower.includes("volcanic") || lower.includes("titan")) {
    return SALAMANDER_VARIANTS.boss_magma_salamander;
  }
  if (lower.includes("axolotl") || lower.includes("cavern_axolotl") || lower.includes("water")) {
    return SALAMANDER_VARIANTS.axolotl;
  }
  if (lower.includes("toxic") || lower.includes("poison") || lower.includes("spotted") || lower.includes("venom")) {
    return SALAMANDER_VARIANTS.toxic_salamander;
  }
  if (lower.includes("proteus") || lower.includes("cave") || lower.includes("olm") || lower.includes("blind") || lower.includes("subterranean")) {
    return SALAMANDER_VARIANTS.cave_proteus;
  }
  return SALAMANDER_VARIANTS.fire_salamander;
}

/**
 * Triggers a lineless procedural death explosion for salamanders
 * Produces severed amphibian paws with splayed toes, articulated segmented
 * undulating tail pieces, cranium with gill frills/horns, and elemental particles.
 * @param {Object} ce - Combat entity
 */
export function triggerSalamanderDeathExplosion(ce) {
  if (!ce || ce._salamanderExploded) return;
  ce._salamanderExploded = true;

  const cfg = resolveSalamanderConfig(ce.type);
  const isBoss = cfg.isBoss;
  const isGilled = cfg.hasGills;

  if (typeof spawnParticle === "function") {
    // 1. Amphibian Sprawled Paws with Splayed Toes
    for (let p = 0; p < 4; p++) {
      const angle = (p / 4) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 120 + Math.random() * 90;
      spawnParticle({
        x: (ce.x || 0) + Math.cos(angle) * 10,
        y: (ce.y || 0) + Math.sin(angle) * 10,
        vx: Math.cos(angle) * speed,
        vy: -90 - Math.random() * 110,
        color: cfg.bodySecondary,
        accentColor: cfg.clawColor,
        size: isBoss ? 8 : 5.5,
        maxLife: 2.1,
        drag: 0.94,
        style: "salamander_paw",
        gravity: 210,
        shrink: true
      });
    }

    // 2. Segmented Sinewy Tail Pieces
    const tailSegments = isBoss ? 4 : 3;
    for (let t = 0; t < tailSegments; t++) {
      const tAngle = Math.PI + (Math.random() - 0.5) * 1.2;
      const tSpeed = 100 + Math.random() * 80;
      spawnParticle({
        x: (ce.x || 0) - 10 + Math.cos(tAngle) * 8,
        y: (ce.y || 0) + Math.sin(tAngle) * 8,
        vx: Math.cos(tAngle) * tSpeed,
        vy: -80 - Math.random() * 90,
        color: cfg.bodyBase,
        accentColor: cfg.dorsalFinColor,
        size: isBoss ? 12 : 7.5,
        maxLife: 2.3,
        drag: 0.94,
        style: "salamander_tail",
        gravity: 200,
        shrink: true
      });
    }

    // 3. Cranium with Glossy Eyes & External Gills / Magma Spikes
    spawnParticle({
      x: (ce.x || 0) + 10,
      y: (ce.y || 0) - 4,
      vx: 60 + Math.random() * 50,
      vy: -130 - Math.random() * 60,
      color: cfg.bodySecondary,
      accentColor: isGilled ? cfg.gillStemColor : cfg.blotchColor,
      size: isBoss ? 14 : 9.5,
      maxLife: 2.4,
      drag: 0.95,
      style: "salamander_head",
      gravity: 220,
      shrink: true
    });

    // 4. Characteristic Elemental & Dermal Burst
    const burstCount = isBoss ? 24 : 14;
    for (let b = 0; b < burstCount; b++) {
      const bAngle = Math.random() * Math.PI * 2;
      const bSpeed = 60 + Math.random() * 140;
      spawnParticle({
        x: (ce.x || 0) + (Math.random() - 0.5) * 16,
        y: (ce.y || 0) + (Math.random() - 0.5) * 14,
        vx: Math.cos(bAngle) * bSpeed,
        vy: Math.sin(bAngle) * bSpeed - 40,
        color: cfg.particleColors[b % cfg.particleColors.length],
        accentColor: cfg.blotchCore,
        size: 3.5 + Math.random() * 4.5,
        maxLife: 1.4 + Math.random() * 0.8,
        drag: 0.92,
        style: "circle",
        gravity: cfg.breathTheme === "fire" ? -30 : 120,
        shrink: true
      });
    }
  }
}

/**
 * Universal Salamander Entity Master Renderer
 * Features:
 * - Lineless, soft volumetric rendering with multi-stop radial and linear lighting.
 * - Sinuous undulating spine and tail with lateral sinusoidal trotting wave.
 * - Sprawled 4-legged amphibian gait with articulated knees, ankles, and 4/5 splayed toes.
 * - Broad flattened amphibian cranium with soft-rounded snout, nostrils, and luminous eyes.
 * - External branching feathery gills for Axolotl and Cave Proteus with live animated water flutter.
 * - Igneous volcanic rock plates with glowing magma fissures for Magma Boss.
 * - Aposematic warning spots and wet dermal sheen for Toxic Salamander.
 * - Dynamic attack modes: Magma Spit / Breath, Tail Whip Cleave, and Gill Flare shockwave.
 * - Zero solid shadow discs.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {Object} ent
 * @param {boolean} isShadowPass
 */
export function drawSalamanderEntity(ctx, x, y, ent, isShadowPass = false) {
  if (!ctx || !ent || isShadowPass) return;

  const cfg = resolveSalamanderConfig(ent.type);
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  const seed = ent._seed || computeFastSeed(ent.id || "salamander");

  // Determine facing direction & locomotion
  const facingAngle = typeof ent.facingAngle === "number" ? ent.facingAngle : (typeof ent.angle === "number" ? ent.angle : 0);
  const isMoving = !!(ent.moving || ent.isMoving || (ent.speed && ent.speed > 3));
  const isSlowed = !!ent.isSlowed;
  const speedMult = isSlowed ? 0.45 : 1.0;

  // Manage walk cycle phase
  if (ent._walkPhase === undefined) ent._walkPhase = 0;
  if (isMoving) {
    const cycleSpeed = 0.0075 * speedMult;
    ent._walkPhase = (ent._walkPhase + cycleSpeed * 16) % (Math.PI * 2);
  }

  // Compute synchronized attack area parameters matching head motion, snout apex, and tail kinematics
  const attackParams = getSalamanderAttackAreaParams(ent, x, y, facingAngle, cfg, nowMs);
  const hitFlash = ent.lastHitTime && (nowMs - ent.lastHitTime < 140);

  // Render Salamander Body
  ctx.save();
  ctx.translate(x, y);

  if (hitFlash) {
    ctx.filter = "brightness(2.2) saturate(0.2)";
  }

  drawSalamander(ctx, 0, 0, ent, cfg, {
    facingAngle,
    walkPhase: ent._walkPhase || 0,
    isMoving,
    attackProgress: attackParams.attackProgress,
    isAttacking: attackParams.isAttacking,
    attackType: attackParams.salAtk,
    headLungeX: attackParams.headLungeX,
    nowMs,
    seed
  });

  ctx.restore();

  // Render Visual Attack Effect sharing the EXACT SAME area, origin, radius, and arc as the warning zone
  if (attackParams.isAttacking) {
    drawSalamanderVisualAttackEffect(ctx, attackParams, cfg, nowMs, seed);
  }
}

/**
 * Core procedural salamander drawing routine
 */
export function drawSalamander(ctx, x, y, ent, cfg, animState) {
  const {
    facingAngle,
    walkPhase,
    isMoving,
    attackProgress,
    isAttacking,
    attackType,
    nowMs,
    seed
  } = animState;

  const isBoss = cfg.isBoss;
  const isGilled = cfg.hasGills;
  const scale = cfg.scale * (isBoss ? 1.0 : 1.0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Align with facing angle so salamander heads along facing angle
  ctx.rotate(facingAngle);

  // Lateral spinal wave motion
  const spineSine = isMoving ? Math.sin(walkPhase) : Math.sin(nowMs * 0.002 + seed) * 0.15;
  const spineCos = isMoving ? Math.cos(walkPhase) : Math.cos(nowMs * 0.002 + seed) * 0.15;

  let tailWhipOffset = 0;
  let headLungeX = 0;
  let jawDrop = 0;
  let gillPulse = 1.0;

  if (isAttacking) {
    if (attackType === "tail_whip" || attackType === "whip") {
      if (attackProgress < 0.4) {
        tailWhipOffset = (attackProgress / 0.4) * -1.2;
      } else {
        const snap = (attackProgress - 0.4) / 0.6;
        tailWhipOffset = -1.2 + Math.sin(snap * Math.PI) * 2.5;
      }
    } else if (attackType === "gill_flare" || attackType === "ember_burst" || attackType === "flare") {
      gillPulse = 1.0 + Math.sin(attackProgress * Math.PI) * 0.75;
      headLungeX = Math.sin(attackProgress * Math.PI) * 3;
    } else {
      if (attackProgress < 0.35) {
        headLungeX = -(attackProgress / 0.35) * 4;
        jawDrop = (attackProgress / 0.35) * 0.5;
      } else {
        const forward = (attackProgress - 0.35) / 0.65;
        headLungeX = -4 + Math.sin(forward * Math.PI) * 9;
        jawDrop = 0.5 + Math.sin(forward * Math.PI) * 0.5;
      }
    }
  }

  // Locomotion feet offsets: diagonal pair gait
  const legSwing1 = isMoving ? Math.sin(walkPhase) * 6 : 0;
  const legSwing2 = isMoving ? -Math.sin(walkPhase) * 6 : 0;
  const legLift1 = isMoving ? Math.max(0, Math.cos(walkPhase)) * 2.5 : 0;
  const legLift2 = isMoving ? Math.max(0, -Math.cos(walkPhase)) * 2.5 : 0;

  // 1. Draw Tail
  drawSalamanderTail(ctx, cfg, {
    spineSine,
    walkPhase,
    tailWhipOffset,
    isMoving,
    nowMs,
    seed
  });

  // 2. Draw Rear Limbs
  drawSalamanderHindLimbs(ctx, cfg, {
    legSwing1,
    legSwing2,
    legLift1,
    legLift2,
    spineSine
  });

  // 3. Draw Main Torso
  drawSalamanderTorso(ctx, cfg, {
    spineSine,
    nowMs,
    seed,
    gillPulse
  });

  // 4. Draw Fore Limbs
  drawSalamanderForeLimbs(ctx, cfg, {
    legSwing1,
    legSwing2,
    legLift1,
    legLift2,
    spineSine
  });

  // 5. Draw Head
  drawSalamanderHead(ctx, cfg, {
    headLungeX,
    jawDrop,
    gillPulse,
    spineSine,
    isAttacking,
    attackType,
    attackProgress,
    nowMs,
    seed
  });

  ctx.restore();
}

/**
 * Draws the undulating segmented salamander tail with dorsal/ventral fin keel
 */
function drawSalamanderTail(ctx, cfg, anim) {
  const { spineSine, walkPhase, tailWhipOffset, isMoving, nowMs, seed } = anim;
  const segCount = cfg.isBoss ? 7 : 5;
  const baseLen = cfg.isBoss ? 48 : 34;

  ctx.save();
  ctx.translate(-14, 0);

  let curX = 0;
  let curY = 0;

  const points = [{ x: 0, y: 0, width: cfg.isBoss ? 16 : 11 }];

  for (let i = 1; i <= segCount; i++) {
    const t = i / segCount;
    const waveDelay = walkPhase - i * 0.55;
    const tailAngle = (isMoving ? Math.sin(waveDelay) * (0.35 + t * 0.45) : Math.sin(nowMs * 0.0025 - i * 0.4 + seed) * 0.18) + (tailWhipOffset * t * 1.2);
    const segDist = (baseLen / segCount) * (1.0 - t * 0.15);

    curX -= Math.cos(tailAngle) * segDist;
    curY += Math.sin(tailAngle) * segDist;

    const segWidth = (cfg.isBoss ? 16 : 11) * (1.0 - t * 0.82);
    points.push({ x: curX, y: curY, width: Math.max(1.8, segWidth), angle: tailAngle });
  }

  // Draw Keel / Dorsal Fin beneath tail core
  ctx.save();
  ctx.fillStyle = cfg.dorsalFinColor;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y - points[0].width * 0.55);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const finHeight = p.width * (cfg.hasGills ? 1.6 : 1.25);
    ctx.lineTo(p.x, p.y - finHeight * 0.5);
  }
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    const finHeight = p.width * (cfg.hasGills ? 1.6 : 1.25);
    ctx.lineTo(p.x, p.y + finHeight * 0.5);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw Tail Muscular Core Segment by Segment
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    ctx.save();
    const grad = ctx.createLinearGradient(p0.x, p0.y - p0.width, p0.x, p0.y + p0.width);
    grad.addColorStop(0, cfg.bodySecondary);
    grad.addColorStop(0.35, cfg.bodyBase);
    grad.addColorStop(0.75, cfg.bellyColor);
    grad.addColorStop(1, cfg.bodySecondary);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y - p0.width * 0.5);
    ctx.lineTo(p1.x, p1.y - p1.width * 0.5);
    ctx.lineTo(p1.x, p1.y + p1.width * 0.5);
    ctx.lineTo(p0.x, p0.y + p0.width * 0.5);
    ctx.closePath();
    ctx.fill();

    // Dorsal highlight sheen along the spine
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = Math.max(0.7, p0.width * 0.18);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y - p0.width * 0.15);
    ctx.lineTo(p1.x, p1.y - p1.width * 0.15);
    ctx.stroke();

    // Characteristic blotches on tail
    if (cfg.hasSpottedBlotches && i % 2 === 1) {
      ctx.fillStyle = cfg.blotchColor;
      ctx.beginPath();
      ctx.ellipse(p1.x, p1.y - p1.width * 0.1, p1.width * 0.35, p1.width * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cfg.blotchCore;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y - p1.width * 0.1, p1.width * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Magma Volcanic Scutes on boss tail
    if (cfg.hasVolcanicPlates && i < points.length - 2) {
      ctx.fillStyle = "#1c1917";
      ctx.beginPath();
      ctx.moveTo(p1.x + 2, p1.y - p1.width * 0.4);
      ctx.lineTo(p1.x - 2, p1.y - p1.width * 0.75);
      ctx.lineTo(p1.x - 4, p1.y - p1.width * 0.3);
      ctx.closePath();
      ctx.fill();

      // Glowing magma seam
      ctx.strokeStyle = cfg.blotchColor;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y - p1.width * 0.3);
      ctx.lineTo(p1.x - 2, p1.y - p1.width * 0.65);
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws the muscular hind limbs with articulated knees, hocks, and 5 splayed toes
 */
function drawSalamanderHindLimbs(ctx, cfg, anim) {
  const { legSwing1, legSwing2, legLift1, legLift2, spineSine } = anim;
  const isBoss = cfg.isBoss;
  const hipX = -12;
  const hipSpreadY = isBoss ? 13 : 9;

  // Left Hind Limb
  drawSalamanderLeg(ctx, cfg, {
    rootX: hipX,
    rootY: -hipSpreadY,
    kneeOffsetX: -4 + legSwing1,
    kneeOffsetY: -(hipSpreadY + (isBoss ? 11 : 8)),
    footOffsetX: -2 + legSwing1 * 1.2,
    footOffsetY: -(hipSpreadY + (isBoss ? 17 : 13)) + legLift1,
    isForeleg: false,
    isLeft: true
  });

  // Right Hind Limb
  drawSalamanderLeg(ctx, cfg, {
    rootX: hipX,
    rootY: hipSpreadY,
    kneeOffsetX: -4 + legSwing2,
    kneeOffsetY: hipSpreadY + (isBoss ? 11 : 8),
    footOffsetX: -2 + legSwing2 * 1.2,
    footOffsetY: hipSpreadY + (isBoss ? 17 : 13) - legLift2,
    isForeleg: false,
    isLeft: false
  });
}

/**
 * Draws the muscular fore limbs with articulated elbows and 4 splayed toes
 */
function drawSalamanderForeLimbs(ctx, cfg, anim) {
  const { legSwing1, legSwing2, legLift1, legLift2, spineSine } = anim;
  const isBoss = cfg.isBoss;
  const shoulderX = 8;
  const shoulderSpreadY = isBoss ? 14 : 9.5;

  // Left Fore Limb
  drawSalamanderLeg(ctx, cfg, {
    rootX: shoulderX,
    rootY: -shoulderSpreadY,
    kneeOffsetX: 3 + legSwing2,
    kneeOffsetY: -(shoulderSpreadY + (isBoss ? 11 : 7.5)),
    footOffsetX: 7 + legSwing2 * 1.2,
    footOffsetY: -(shoulderSpreadY + (isBoss ? 16 : 12)) + legLift2,
    isForeleg: true,
    isLeft: true
  });

  // Right Fore Limb
  drawSalamanderLeg(ctx, cfg, {
    rootX: shoulderX,
    rootY: shoulderSpreadY,
    kneeOffsetX: 3 + legSwing1,
    kneeOffsetY: shoulderSpreadY + (isBoss ? 11 : 7.5),
    footOffsetX: 7 + legSwing1 * 1.2,
    footOffsetY: shoulderSpreadY + (isBoss ? 16 : 12) - legLift1,
    isForeleg: true,
    isLeft: false
  });
}

/**
 * Draws a single sprawled articulated limb with knee/elbow and splayed toes
 */
function drawSalamanderLeg(ctx, cfg, params) {
  const { rootX, rootY, kneeOffsetX, kneeOffsetY, footOffsetX, footOffsetY, isForeleg, isLeft } = params;
  const isBoss = cfg.isBoss;
  const thighThick = isBoss ? 6.5 : 4.2;
  const shinThick = isBoss ? 4.8 : 3.0;

  const kneeX = rootX + kneeOffsetX;
  const kneeY = kneeOffsetY;
  const footX = rootX + footOffsetX;
  const footY = footOffsetY;

  ctx.save();

  // Upper segment (Thigh / Upper Arm)
  ctx.strokeStyle = cfg.bodyBase;
  ctx.lineWidth = thighThick;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rootX, rootY);
  ctx.lineTo(kneeX, kneeY);
  ctx.stroke();

  // Highlight along upper arm
  ctx.strokeStyle = cfg.bodySecondary;
  ctx.lineWidth = thighThick * 0.55;
  ctx.beginPath();
  ctx.moveTo(rootX, rootY - (isLeft ? 0.8 : -0.8));
  ctx.lineTo(kneeX, kneeY - (isLeft ? 0.8 : -0.8));
  ctx.stroke();

  // Lower segment (Forearm / Crus)
  ctx.strokeStyle = cfg.bodyBase;
  ctx.lineWidth = shinThick;
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();

  // Subtle limb highlight
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = Math.max(0.6, shinThick * 0.3);
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();

  // Splayed Toes:
  // Forelegs have 4 digits; Hind legs have 5 digits
  const toeCount = isForeleg ? 4 : 5;
  const footAngle = Math.atan2(footY - kneeY, footX - kneeX);
  const toeLen = isBoss ? 5.8 : 3.8;
  const spreadArc = Math.PI * 0.55;

  ctx.fillStyle = cfg.clawColor;
  ctx.strokeStyle = cfg.bodyBase;
  ctx.lineWidth = isBoss ? 1.8 : 1.2;
  ctx.lineCap = "round";

  for (let d = 0; d < toeCount; d++) {
    const toeOffset = (d / (toeCount - 1) - 0.5) * spreadArc;
    const tAng = footAngle + (isLeft ? -toeOffset : toeOffset) + (isLeft ? -0.2 : 0.2);
    const toeEndX = footX + Math.cos(tAng) * toeLen;
    const toeEndY = footY + Math.sin(tAng) * toeLen;

    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(toeEndX, toeEndY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(toeEndX, toeEndY, isBoss ? 1.3 : 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws the salamander torso with costal grooves and volumetric cylindrical lighting
 */
function drawSalamanderTorso(ctx, cfg, anim) {
  const { spineSine, nowMs, seed, gillPulse } = anim;
  const isBoss = cfg.isBoss;
  const torsoHalfW = isBoss ? 14 : 9.5;

  ctx.save();

  const bendY = spineSine * (isBoss ? 2.8 : 1.8);

  const bodyGrad = ctx.createRadialGradient(-3, bendY, 2, 0, bendY, torsoHalfW * 1.3);
  bodyGrad.addColorStop(0, cfg.bodySecondary);
  bodyGrad.addColorStop(0.55, cfg.bodyBase);
  bodyGrad.addColorStop(0.85, cfg.bellyColor);
  bodyGrad.addColorStop(1, cfg.bodyBase);

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(12, bendY * 0.5 - torsoHalfW * 0.72);
  ctx.quadraticCurveTo(0, bendY - torsoHalfW, -14, bendY * 0.9 - torsoHalfW * 0.65);
  ctx.quadraticCurveTo(-18, bendY, -14, bendY * 0.9 + torsoHalfW * 0.65);
  ctx.quadraticCurveTo(0, bendY + torsoHalfW, 12, bendY * 0.5 + torsoHalfW * 0.72);
  ctx.quadraticCurveTo(16, bendY * 0.4, 12, bendY * 0.5 - torsoHalfW * 0.72);
  ctx.closePath();
  ctx.fill();

  // Costal Grooves (amphibian rib creases)
  const grooveCount = isBoss ? 6 : 5;
  for (let g = 0; g < grooveCount; g++) {
    const gx = -10 + g * (22 / (grooveCount - 1));
    const gy = bendY * (1 - (gx / 18) * 0.3);
    const gHalfH = torsoHalfW * (1.0 - Math.abs(gx) / 22 * 0.28);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(gx, gy - gHalfH * 0.85);
    ctx.lineTo(gx, gy + gHalfH * 0.85);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(gx + 0.8, gy - gHalfH * 0.8);
    ctx.lineTo(gx + 0.8, gy + gHalfH * 0.8);
    ctx.stroke();
  }

  // Dorsal Specular Sheen
  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = isBoss ? 2.0 : 1.4;
  ctx.beginPath();
  ctx.moveTo(12, bendY * 0.4 - 1.2);
  ctx.quadraticCurveTo(0, bendY - 1.2, -14, bendY * 0.8 - 1.0);
  ctx.stroke();

  // Translucent internal organ glow for Cave Proteus / Axolotl
  if (cfg.hasTranslucentSkin) {
    const organGrad = ctx.createRadialGradient(-2, bendY, 1, -2, bendY, isBoss ? 8 : 5.5);
    organGrad.addColorStop(0, cfg.isBoss ? "rgba(255, 100, 100, 0.45)" : "rgba(244, 63, 94, 0.35)");
    organGrad.addColorStop(1, "rgba(244, 63, 94, 0)");
    ctx.fillStyle = organGrad;
    ctx.beginPath();
    ctx.ellipse(-2, bendY, isBoss ? 7 : 5, isBoss ? 4.5 : 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Variant-specific dorsal decorations:
  if (cfg.hasSpottedBlotches) {
    const blotchDefs = [
      { x: -8, yOff: -5.5, rx: 3.2, ry: 2.4, ang: 0.2 },
      { x: -8, yOff: 5.5, rx: 3.0, ry: 2.2, ang: -0.1 },
      { x: -1, yOff: -6.2, rx: 4.0, ry: 2.8, ang: -0.2 },
      { x: 0, yOff: 6.0, rx: 3.8, ry: 2.6, ang: 0.15 },
      { x: 6, yOff: -4.8, rx: 3.2, ry: 2.2, ang: 0.3 },
      { x: 6, yOff: 4.8, rx: 3.0, ry: 2.0, ang: -0.25 }
    ];

    for (const b of blotchDefs) {
      const bx = b.x;
      const by = bendY + b.yOff;
      ctx.fillStyle = cfg.blotchEdge;
      ctx.beginPath();
      ctx.ellipse(bx, by, b.rx, b.ry, b.ang, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = cfg.blotchColor;
      ctx.beginPath();
      ctx.ellipse(bx, by, b.rx * 0.72, b.ry * 0.72, b.ang, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = cfg.blotchCore;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(0.7, b.rx * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (cfg.hasVolcanicPlates) {
    const plateCount = 4;
    for (let p = 0; p < plateCount; p++) {
      const px = -9 + p * 6.5;
      const py = bendY;
      const pW = 5.5;
      const pH = 7.5;

      ctx.fillStyle = "#1c1917";
      ctx.beginPath();
      ctx.moveTo(px - pW * 0.5, py - pH * 0.5);
      ctx.lineTo(px + pW * 0.5, py - pH * 0.6);
      ctx.lineTo(px + pW * 0.6, py + pH * 0.6);
      ctx.lineTo(px - pW * 0.5, py + pH * 0.5);
      ctx.closePath();
      ctx.fill();

      const pulseMagma = Math.sin(nowMs * 0.005 + p * 1.2) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(249, 115, 22, ${pulseMagma})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px - pW * 0.4, py - pH * 0.3);
      ctx.lineTo(px + pW * 0.3, py + pH * 0.3);
      ctx.stroke();

      ctx.strokeStyle = `rgba(254, 240, 138, ${pulseMagma})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(px - pW * 0.3, py - pH * 0.2);
      ctx.lineTo(px + pW * 0.2, py + pH * 0.2);
      ctx.stroke();
    }
  }

  // Dorsal fin
  if (cfg.dorsalFinColor && !cfg.hasVolcanicPlates) {
    ctx.fillStyle = cfg.dorsalFinColor;
    ctx.beginPath();
    ctx.moveTo(8, bendY - 1.5);
    ctx.quadraticCurveTo(0, bendY - 3.5, -12, bendY - 1.8);
    ctx.quadraticCurveTo(0, bendY + 0.5, 8, bendY - 1.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws the salamander head, jaws, glowing eyes, nostrils, and gills/spikes
 */
function drawSalamanderHead(ctx, cfg, anim) {
  const { headLungeX, jawDrop, gillPulse, spineSine, isAttacking, attackType, attackProgress, nowMs, seed } = anim;
  const isBoss = cfg.isBoss;
  const isGilled = cfg.hasGills;
  const headBaseX = 14 + headLungeX;
  const headW = isBoss ? 20 : 13.5;
  const headH = isBoss ? 18 : 12.5;

  ctx.save();
  ctx.translate(headBaseX, spineSine * 1.0);

  // 1. External Branching Gills
  if (isGilled) {
    drawExternalGills(ctx, cfg, {
      gillPulse,
      nowMs,
      seed,
      isAttacking
    });
  } else if (cfg.hasVolcanicPlates) {
    drawVolcanicHorns(ctx, cfg, { nowMs });
  }

  // 2. Head Cranium Structure
  const headGrad = ctx.createRadialGradient(2, 0, 1, 0, 0, headH * 1.1);
  headGrad.addColorStop(0, cfg.bodySecondary);
  headGrad.addColorStop(0.65, cfg.bodyBase);
  headGrad.addColorStop(0.9, cfg.bellyColor);
  headGrad.addColorStop(1, cfg.bodyBase);

  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.moveTo(-2, -headH * 0.55);
  ctx.quadraticCurveTo(6, -headH * 0.62, headW * 0.7, -headH * 0.32);
  ctx.quadraticCurveTo(headW, 0, headW * 0.7, headH * 0.32);
  ctx.quadraticCurveTo(6, headH * 0.62, -2, headH * 0.55);
  ctx.quadraticCurveTo(-4, 0, -2, -headH * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = isBoss ? 1.6 : 1.0;
  ctx.beginPath();
  ctx.moveTo(0, -headH * 0.4);
  ctx.quadraticCurveTo(headW * 0.6, -headH * 0.3, headW * 0.85, 0);
  ctx.stroke();

  // 3. Mouth slit / Gentle smile or wide gaping jaw during attack
  ctx.save();
  if (jawDrop > 0.05) {
    ctx.fillStyle = cfg.breathTheme === "fire" ? "#7f1d1d" : (cfg.breathTheme === "poison" ? "#14532d" : "#be185d");
    ctx.beginPath();
    ctx.moveTo(headW * 0.25, -headH * 0.15 * jawDrop);
    ctx.quadraticCurveTo(headW * 0.7, -headH * 0.25 * jawDrop, headW * 0.95, 0);
    ctx.quadraticCurveTo(headW * 0.7, headH * 0.25 * jawDrop, headW * 0.25, headH * 0.15 * jawDrop);
    ctx.closePath();
    ctx.fill();

    const throatGrad = ctx.createRadialGradient(headW * 0.4, 0, 0, headW * 0.4, 0, isBoss ? 8 : 5);
    throatGrad.addColorStop(0, cfg.breathTheme === "fire" ? "#fef08a" : (cfg.breathTheme === "poison" ? "#bef264" : "#ffffff"));
    throatGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = throatGrad;
    ctx.beginPath();
    ctx.arc(headW * 0.4, 0, isBoss ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.38)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(headW * 0.35, -headH * 0.35);
    ctx.quadraticCurveTo(headW * 0.9, 0, headW * 0.35, headH * 0.35);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Nostril Pores
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.beginPath();
  ctx.arc(headW * 0.82, -headH * 0.14, isBoss ? 1.0 : 0.65, 0, Math.PI * 2);
  ctx.arc(headW * 0.82, headH * 0.14, isBoss ? 1.0 : 0.65, 0, Math.PI * 2);
  ctx.fill();

  // 5. Specular Glossy Amphibian Eyes
  const eyeX = headW * 0.32;
  const eyeYOffset = headH * 0.48;
  const eyeRadius = isBoss ? 3.6 : 2.4;

  for (const sign of [-1, 1]) {
    const ey = sign * eyeYOffset;

    ctx.fillStyle = cfg.bodySecondary;
    ctx.beginPath();
    ctx.arc(eyeX, ey, eyeRadius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cfg.eyeColor;
    ctx.beginPath();
    ctx.arc(eyeX, ey, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cfg.pupilColor;
    ctx.beginPath();
    if (cfg.breathTheme === "fire") {
      ctx.ellipse(eyeX, ey, eyeRadius * 0.35, eyeRadius * 0.85, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(eyeX, ey, eyeRadius * 0.65, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX + eyeRadius * 0.28, ey - eyeRadius * 0.28, eyeRadius * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws the magnificent feathery external gills for Axolotl and Cave Proteus
 */
function drawExternalGills(ctx, cfg, anim) {
  const { gillPulse, nowMs, seed, isAttacking } = anim;
  const isBoss = cfg.isBoss;

  const gillStems = [
    { baseAngle: -Math.PI * 0.62, length: isBoss ? 18 : 12, branchCount: 6, phaseOff: 0.0 },
    { baseAngle: -Math.PI * 0.82, length: isBoss ? 21 : 14, branchCount: 7, phaseOff: 1.1 },
    { baseAngle: -Math.PI * 1.02, length: isBoss ? 16 : 11, branchCount: 5, phaseOff: 2.2 }
  ];

  ctx.save();
  ctx.translate(0, 0);

  for (const sign of [-1, 1]) {
    for (let g = 0; g < gillStems.length; g++) {
      const stem = gillStems[g];
      const flutter = Math.sin(nowMs * 0.004 + stem.phaseOff + seed) * (isAttacking ? 0.35 : 0.18);
      const angle = (sign === -1 ? stem.baseAngle : -stem.baseAngle) + flutter * sign;
      const len = stem.length * gillPulse;

      const startX = -2;
      const startY = sign * (g * 3.2 + 4.5);

      const endX = startX + Math.cos(angle) * len;
      const endY = startY + Math.sin(angle) * len;

      ctx.strokeStyle = cfg.gillStemColor;
      ctx.lineWidth = isBoss ? 2.6 : 1.8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo((startX + endX) * 0.5 + flutter * 5, (startY + endY) * 0.5, endX, endY);
      ctx.stroke();

      const branches = stem.branchCount;
      ctx.strokeStyle = cfg.gillFilamentColor;
      ctx.lineWidth = isBoss ? 1.4 : 0.95;

      for (let b = 1; b <= branches; b++) {
        const bt = b / (branches + 1);
        const bx = startX + (endX - startX) * bt;
        const by = startY + (endY - startY) * bt;

        const bWave = Math.sin(nowMs * 0.007 + b * 0.8 + seed) * 0.25;
        const bLen = (isBoss ? 7.5 : 5.0) * (1.0 - bt * 0.35) * gillPulse;

        for (const side of [-1, 1]) {
          const bAngle = angle + (Math.PI * 0.45 * side) + bWave;
          const fx = bx + Math.cos(bAngle) * bLen;
          const fy = by + Math.sin(bAngle) * bLen;

          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(fx, fy);
          ctx.stroke();
        }
      }

      if (isAttacking || cfg.hasTranslucentSkin) {
        ctx.fillStyle = cfg.gillGlowColor;
        ctx.beginPath();
        ctx.arc(endX, endY, (isBoss ? 3.0 : 2.0) * gillPulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * Draws volcanic obsidian horn spikes for Magma Salamander Boss
 */
function drawVolcanicHorns(ctx, cfg, anim) {
  const { nowMs } = anim;
  ctx.save();
  const horns = [
    { startX: -2, startY: -11, len: 14, angle: -Math.PI * 0.75 },
    { startX: -2, startY: 11, len: 14, angle: Math.PI * 0.75 },
    { startX: 4, startY: -12, len: 10, angle: -Math.PI * 0.65 },
    { startX: 4, startY: 12, len: 10, angle: Math.PI * 0.65 }
  ];

  for (const h of horns) {
    const tipX = h.startX + Math.cos(h.angle) * h.len;
    const tipY = h.startY + Math.sin(h.angle) * h.len;

    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.moveTo(h.startX - 3, h.startY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(h.startX + 3, h.startY);
    ctx.closePath();
    ctx.fill();

    const pulse = Math.sin(nowMs * 0.006 + h.startX) * 0.4 + 0.6;
    ctx.strokeStyle = `rgba(249, 115, 22, ${pulse})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(h.startX, h.startY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws visual attack effects that share the EXACT SAME area, origin, radius, and arc
 * as the ground attack warning zone.
 */
export function drawSalamanderVisualAttackEffect(ctx, attackParams, cfg, nowMs, seed) {
  const { originX, originY, angle, radius, arc, shape, salAtk, attackProgress } = attackParams;
  if (!attackProgress || attackProgress <= 0 || attackProgress >= 1) return;

  const isBoss = cfg.isBoss;
  const halfArc = (arc || Math.PI * 0.44) * 0.5;

  // Attack intensity envelope: surges up, sustains, then dissolves cleanly
  let intensity = 0;
  if (attackProgress < 0.25) {
    intensity = attackProgress / 0.25;
  } else if (attackProgress < 0.8) {
    intensity = 1.0;
  } else {
    intensity = (1.0 - attackProgress) / 0.2;
  }
  if (intensity <= 0.01) return;

  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angle);

  if (shape === "circle" || salAtk === "ember_burst" || salAtk === "gill_flare" || salAtk === "flare") {
    // -------------------------------------------------------------
    // CIRCULAR SHOCKWAVE & RADIAL FLARE (Matches Warning Circle Area)
    // -------------------------------------------------------------
    const currentRadius = radius * Math.min(1.0, attackProgress * 1.3);
    const alpha = intensity * 0.75;

    // Outer shockwave ring
    ctx.strokeStyle = cfg.blotchColor;
    ctx.lineWidth = isBoss ? 3.0 : 2.0;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner bright core pulse
    const circleGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentRadius);
    circleGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    circleGrad.addColorStop(0.35, cfg.blotchCore || "#fef08a");
    circleGrad.addColorStop(0.7, cfg.blotchColor || "#f97316");
    circleGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = circleGrad;
    ctx.globalAlpha = alpha * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Radial motes within circle radius
    const moteCount = isBoss ? 20 : 12;
    for (let m = 0; m < moteCount; m++) {
      const mAngle = (m / moteCount) * Math.PI * 2 + (Math.sin(nowMs * 0.005 + m) * 0.2);
      const mDist = currentRadius * (0.4 + ((m * 17) % 5) * 0.12);
      ctx.fillStyle = cfg.particleColors[m % cfg.particleColors.length];
      ctx.globalAlpha = alpha * 0.9;
      ctx.beginPath();
      ctx.arc(Math.cos(mAngle) * mDist, Math.sin(mAngle) * mDist, isBoss ? 2.8 : 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (salAtk === "tail_whip" || salAtk === "whip") {
    // -------------------------------------------------------------
    // TAIL WHIP CLEAVE SLASH ARC (Matches Warning Cone Area)
    // -------------------------------------------------------------
    const currentRadius = radius;
    const sweepProgress = Math.min(1.0, Math.max(0, (attackProgress - 0.25) / 0.55));
    const sweepAngle = -halfArc + sweepProgress * arc;

    // Glowing crescent blade wave filling the sector arc
    ctx.strokeStyle = cfg.dorsalFinColor || "#f97316";
    ctx.lineWidth = isBoss ? 4.5 : 3.0;
    ctx.globalAlpha = intensity * 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius * 0.92, -halfArc, halfArc);
    ctx.stroke();

    // Leading slash edge
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = isBoss ? 2.5 : 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius * 0.92, sweepAngle - 0.25, sweepAngle + 0.25);
    ctx.stroke();

    // Trailing crescent wash
    const slashGrad = ctx.createRadialGradient(0, 0, currentRadius * 0.4, 0, 0, currentRadius);
    slashGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    slashGrad.addColorStop(0.7, cfg.blotchColor);
    slashGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = slashGrad;
    ctx.globalAlpha = intensity * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, currentRadius, -halfArc, halfArc);
    ctx.closePath();
    ctx.fill();
  } else {
    // -------------------------------------------------------------
    // CONE BREATH STREAM / SPIT / BUBBLE SURGE (Matches Warning Cone Area)
    // -------------------------------------------------------------
    const currentRadius = radius * Math.min(1.0, attackProgress * 1.4);

    // 1. Plume fill filling the EXACT sector arc of the warning zone
    const plumeGrad = ctx.createRadialGradient(0, 0, 2, currentRadius * 0.5, 0, currentRadius);
    if (cfg.breathTheme === "fire") {
      plumeGrad.addColorStop(0, "#ffffff");
      plumeGrad.addColorStop(0.25, cfg.blotchCore || "#fef08a");
      plumeGrad.addColorStop(0.65, cfg.blotchColor || "#f97316");
      plumeGrad.addColorStop(0.9, cfg.blotchEdge || "#dc2626");
      plumeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else if (cfg.breathTheme === "frost") {
      plumeGrad.addColorStop(0, "#ffffff");
      plumeGrad.addColorStop(0.28, "rgba(224, 242, 254, 0.9)");
      plumeGrad.addColorStop(0.65, "rgba(125, 211, 252, 0.7)");
      plumeGrad.addColorStop(0.9, "rgba(56, 189, 248, 0.4)");
      plumeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else {
      plumeGrad.addColorStop(0, "#ffffff");
      plumeGrad.addColorStop(0.25, cfg.blotchCore || "#ecfccb");
      plumeGrad.addColorStop(0.65, cfg.blotchColor || "#84cc16");
      plumeGrad.addColorStop(0.9, cfg.blotchEdge || "#15803d");
      plumeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    }

    ctx.fillStyle = plumeGrad;
    ctx.globalAlpha = intensity * 0.85;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, currentRadius, -halfArc, halfArc);
    ctx.closePath();
    ctx.fill();

    // 2. High-energy sinuous plasma / bubble streams fanning across the exact arc
    const streamCount = 5;
    for (let s = 0; s < streamCount; s++) {
      const frac = (s / (streamCount - 1)) - 0.5; // -0.5 to +0.5
      const sAngle = frac * (arc * 0.82);
      ctx.beginPath();
      ctx.moveTo(0, 0);

      const steps = 10;
      for (let st = 1; st <= steps; st++) {
        const t = st / steps;
        const d = currentRadius * t;
        const wave = Math.sin(nowMs * 0.02 - t * 8 + s * 1.5 + seed) * (t * 8 * intensity);
        const a = sAngle + wave / (d + 16);
        ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }

      ctx.strokeStyle = (s % 2 === 0) ? (cfg.blotchCore || "#ffffff") : (cfg.blotchColor || "#f97316");
      ctx.lineWidth = isBoss ? 2.4 : 1.6;
      ctx.globalAlpha = intensity * 0.75;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // 3. Concussive wavefront shockwave arcs sweeping forward across the exact cone
    const waveCount = 2;
    for (let w = 0; w < waveCount; w++) {
      const waveProg = ((nowMs * 0.0035 + w * 0.5 + seed * 0.1) % 1.0);
      const waveR = currentRadius * waveProg;
      const waveAlpha = Math.sin(waveProg * Math.PI) * intensity * 0.65;
      if (waveR > 8 && waveAlpha > 0.02) {
        ctx.beginPath();
        ctx.arc(0, 0, waveR, -halfArc * 0.95, halfArc * 0.95);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = waveAlpha;
        ctx.stroke();
      }
    }

    // 4. Element motes / bubbles filling the exact cone
    if (cfg.breathTheme === "frost") {
      const bubbleCount = isBoss ? 16 : 10;
      for (let b = 0; b < bubbleCount; b++) {
        const bFrac = (((b * 19.3 + seed * 5.1) % 100) / 100) - 0.5;
        const bAngle = bFrac * (arc * 0.9);
        const bProg = ((nowMs * 0.003 * (0.8 + (b % 4) * 0.1) + b * 0.13) % 1.0);
        const bDist = bProg * currentRadius;
        const bx = Math.cos(bAngle) * bDist;
        const by = Math.sin(bAngle) * bDist;
        const bRadius = (isBoss ? 4.5 : 3.0) * (0.7 + (b % 3) * 0.35);

        ctx.fillStyle = "rgba(186, 230, 253, 0.55)";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.0;
        ctx.globalAlpha = Math.sin(bProg * Math.PI) * intensity;
        ctx.beginPath();
        ctx.arc(bx, by, bRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(bx - bRadius * 0.3, by - bRadius * 0.3, bRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const moteCount = isBoss ? 22 : 14;
      for (let m = 0; m < moteCount; m++) {
        const mFrac = (((m * 23.7 + seed * 9.3) % 100) / 100) - 0.5;
        const mAngle = mFrac * (arc * 0.88);
        const mProg = ((nowMs * 0.0035 * (0.8 + (m % 3) * 0.15) + m * 0.15) % 1.0);
        const mDist = mProg * currentRadius;
        const mx = Math.cos(mAngle) * mDist;
        const my = Math.sin(mAngle) * mDist;

        ctx.fillStyle = cfg.particleColors[m % cfg.particleColors.length];
        ctx.globalAlpha = Math.sin(mProg * Math.PI) * intensity;
        ctx.beginPath();
        ctx.arc(mx, my, (isBoss ? 3.0 : 2.0) * (1 - mProg * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

// --- Family: Dragon ---
// dragons.js - Procedural Lineless Dragon Entity Master Renderer



/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * Monsters must never have baked-in dark circular shapes emulating ground shadows.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

export const DRAGON_VARIANTS = Object.freeze({
  fire_drake: Object.freeze({
    id: "fire_drake",
    label: "Pyre Drake (Crimson Scales & Flame Breath)",
    scale: 1.35,
    isBoss: false,
    scalePrimary: "#7f1d1d",
    scaleSecondary: "#b91c1c",
    scaleHighlight: "#ef4444",
    scaleShadow: "#2e0505",
    bellyPrimary: "#d97706",
    bellySecondary: "#fbbf24",
    hornColor: "#05070a",
    hornHighlight: "#1e2530",
    dorsalSpineColor: "#f59e0b",
    dorsalSpineShadow: "#78350f",
    dorsalSpineHighlight: "#fef08a",
    wingMembrane1: "rgba(185, 28, 28, 0.90)",
    wingMembrane2: "rgba(127, 29, 29, 0.96)",
    wingMembraneInner: "rgba(249, 115, 22, 0.42)",
    wingVeinGlow: "#f97316",
    wingVeinCore: "#fef08a",
    wingBoneHighlight: "#fca5a5",
    wingClawColor: "#05070a",
    eyeColor: "#facc15",
    breathCore: "#ffffff",
    breathMid: "#f97316",
    breathEdge: "#dc2626",
    auraGlow: "rgba(239, 68, 68, 0.28)",
    emberColors: ["#fef08a", "#f97316", "#ef4444", "#dc2626", "#ffffff"]
  }),
  boss_dragon: Object.freeze({
    id: "boss_dragon",
    label: "Colossal Pyregorged Dragon (Four-Horned Sovereign Boss)",
    scale: 1.95,
    isBoss: true,
    scalePrimary: "#450a0a",
    scaleSecondary: "#991b1b",
    scaleHighlight: "#f87171",
    scaleShadow: "#1a0303",
    bellyPrimary: "#ea580c",
    bellySecondary: "#fdba74",
    hornColor: "#030406",
    hornHighlight: "#171c24",
    dorsalSpineColor: "#fbbf24",
    dorsalSpineShadow: "#854d0e",
    dorsalSpineHighlight: "#fef08a",
    wingMembrane1: "rgba(153, 27, 27, 0.92)",
    wingMembrane2: "rgba(69, 10, 10, 0.98)",
    wingMembraneInner: "rgba(234, 88, 12, 0.50)",
    wingVeinGlow: "#ea580c",
    wingVeinCore: "#ffedd5",
    wingBoneHighlight: "#fecaca",
    wingClawColor: "#030406",
    eyeColor: "#fbbf24",
    breathCore: "#ffffff",
    breathMid: "#ea580c",
    breathEdge: "#991b1b",
    auraGlow: "rgba(249, 115, 22, 0.35)",
    emberColors: ["#fef08a", "#fdba74", "#ea580c", "#b91c1c", "#ffffff"]
  }),
  frost_wyrm: Object.freeze({
    id: "frost_wyrm",
    label: "Elder Frost Wyrm (Glacial Scales & Ice Mist)",
    scale: 1.45,
    isBoss: false,
    scalePrimary: "#075985",
    scaleSecondary: "#0284c7",
    scaleHighlight: "#38bdf8",
    scaleShadow: "#021c2c",
    bellyPrimary: "#7dd3fc",
    bellySecondary: "#e0f2fe",
    hornColor: "#04070c",
    hornHighlight: "#18202c",
    dorsalSpineColor: "#7dd3fc",
    dorsalSpineShadow: "#03496e",
    dorsalSpineHighlight: "#ffffff",
    wingMembrane1: "rgba(2, 132, 199, 0.88)",
    wingMembrane2: "rgba(7, 89, 133, 0.96)",
    wingMembraneInner: "rgba(186, 230, 253, 0.45)",
    wingVeinGlow: "#38bdf8",
    wingVeinCore: "#ffffff",
    wingBoneHighlight: "#e0f2fe",
    wingClawColor: "#04070c",
    eyeColor: "#38bdf8",
    breathCore: "#ffffff",
    breathMid: "#38bdf8",
    breathEdge: "#0284c7",
    auraGlow: "rgba(56, 189, 248, 0.28)",
    emberColors: ["#ffffff", "#e0f2fe", "#7dd3fc", "#38bdf8", "#0284c7"]
  }),
  void_drake: Object.freeze({
    id: "void_drake",
    label: "Abyssal Void Dragon (Obsidian Scales & Cosmic Breath)",
    scale: 1.45,
    isBoss: false,
    isVoid: true,
    scalePrimary: "#080417",
    scaleSecondary: "#1a0b36",
    scaleHighlight: "#7c3aed",
    scaleShadow: "#020108",
    bellyPrimary: "#2e1065",
    bellySecondary: "#c084fc",
    hornColor: "#030208",
    hornHighlight: "#1c182c",
    dorsalSpineColor: "#d946ef",
    dorsalSpineShadow: "#581c87",
    dorsalSpineHighlight: "#00f0ff",
    wingMembrane1: "rgba(46, 16, 101, 0.94)",
    wingMembrane2: "rgba(8, 4, 23, 0.98)",
    wingMembraneInner: "rgba(217, 70, 239, 0.50)",
    wingVeinGlow: "#d946ef",
    wingVeinCore: "#00f0ff",
    wingBoneHighlight: "#e9d5ff",
    wingClawColor: "#030208",
    eyeColor: "#00f0ff",
    breathCore: "#ffffff",
    breathMid: "#00f0ff",
    breathEdge: "#7e22ce",
    auraGlow: "rgba(217, 70, 239, 0.38)",
    emberColors: ["#ffffff", "#00f0ff", "#f5d0fe", "#d946ef", "#7c3aed", "#38bdf8"]
  }),
  emerald_drake: Object.freeze({
    id: "emerald_drake",
    label: "Emerald Forest Dragon (Jade Scales & Toxic Spit)",
    scale: 1.35,
    isBoss: false,
    scalePrimary: "#064e3b",
    scaleSecondary: "#059669",
    scaleHighlight: "#34d399",
    scaleShadow: "#022118",
    bellyPrimary: "#b45309",
    bellySecondary: "#fbbf24",
    hornColor: "#040705",
    hornHighlight: "#16201b",
    dorsalSpineColor: "#fbbf24",
    dorsalSpineShadow: "#78350f",
    dorsalSpineHighlight: "#fef08a",
    wingMembrane1: "rgba(5, 150, 105, 0.88)",
    wingMembrane2: "rgba(6, 78, 59, 0.96)",
    wingMembraneInner: "rgba(52, 211, 153, 0.42)",
    wingVeinGlow: "#10b981",
    wingVeinCore: "#d1fae5",
    wingBoneHighlight: "#a7f3d0",
    wingClawColor: "#040705",
    eyeColor: "#a3e635",
    breathCore: "#ffffff",
    breathMid: "#10b981",
    breathEdge: "#047857",
    auraGlow: "rgba(16, 185, 129, 0.28)",
    emberColors: ["#ffffff", "#d1fae5", "#34d399", "#10b981", "#f59e0b"]
  })
});

/**
 * Triggers a cataclysmic dragon death explosion with severed scales,
 * shattered horns, fractured wing bones, burst of dragonfire embers,
 * and smoky thermal dissipation.
 *
 * @param {Object} ce - Entity state object
 */
export function triggerDragonDeathExplosion(ce) {
  if (!ce || ce._dragonExploded) return;
  ce._dragonExploded = true;

  const type = (ce.type || "dragon").toLowerCase();
  const isBoss = type.includes("boss") || type.includes("sovereign") || type.includes("colossal");
  const isFrost = type.includes("frost") || type.includes("ice") || type.includes("wyrm");
  const isVoid = type.includes("void") || type.includes("abyss") || type.includes("shadow");
  const isEmerald = type.includes("emerald") || type.includes("forest") || type.includes("jade");

  const cfg = resolveDragonConfig(type);
  const primaryScale = cfg.scalePrimary;
  const darkScale = cfg.scaleSecondary;
  const hornColor = cfg.hornColor;
  const hornHighlight = cfg.hornHighlight;
  const wingVein = cfg.wingVeinGlow;
  const boneHighlight = cfg.wingBoneHighlight;
  const emberPalette = cfg.emberColors;

  if (typeof spawnParticle === "function") {
    // 1. Shattered Dragon Horn Shards
    const hornCount = isBoss ? 6 : 4;
    for (let h = 0; h < hornCount; h++) {
      const angle = (h / hornCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 120 + Math.random() * 140;
      spawnParticle({
        x: ce.x + Math.cos(angle) * 12,
        y: ce.y + Math.sin(angle) * 12,
        vx: Math.cos(angle) * speed,
        vy: -110 - Math.random() * 130,
        color: hornColor,
        accentColor: hornHighlight,
        size: isBoss ? 11 : 7.5,
        maxLife: 2.2,
        drag: 0.94,
        style: "dragon_horn",
        gravity: 240,
        shrink: true
      });
    }

    // 2. Severed Dragon Wing Membrane Fragments with Pulsing Vein Traces
    const wingCount = isBoss ? 9 : 6;
    for (let w = 0; w < wingCount; w++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 130;
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 16,
        y: ce.y + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: -90 - Math.random() * 110,
        color: cfg.wingMembrane1,
        accentColor: wingVein,
        size: isBoss ? 15 : 10.5,
        maxLife: 2.4,
        drag: 0.93,
        style: "dragon_wing",
        gravity: 210,
        shrink: true
      });
    }

    // 3. Fractured Wing Bone Spars & Articulated Knuckles
    const boneCount = isBoss ? 8 : 5;
    for (let b = 0; b < boneCount; b++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 14,
        y: ce.y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: -100 - Math.random() * 90,
        color: darkScale,
        accentColor: boneHighlight,
        size: isBoss ? 9.5 : 6.5,
        maxLife: 2.1,
        drag: 0.94,
        style: "dragon_wing_bone",
        gravity: 230,
        shrink: true
      });
    }

    // 3. Heavy Armored Scale Plates
    const scaleCount = isBoss ? 14 : 8;
    for (let s = 0; s < scaleCount; s++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 150;
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 14,
        y: ce.y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: -80 - Math.random() * 100,
        color: primaryScale,
        accentColor: hornHighlight,
        size: isBoss ? 7.5 : 5,
        maxLife: 1.8,
        drag: 0.95,
        style: "dragon_scale",
        gravity: 260,
        shrink: true
      });
    }

    // 4. Cataclysm Dragonfire Embers & Radiant Flame Nova
    const emberCount = isBoss ? 60 : 36;
    for (let m = 0; m < emberCount; m++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 200;
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 12,
        y: ce.y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        color: emberPalette,
        size: 2.5 + Math.random() * 4.5,
        maxLife: 1.1 + Math.random() * 0.8,
        drag: 0.92,
        gravity: 50,
        shrink: true,
        style: "circle"
      });
    }

    // 5. Thermal Core Implosion Flash
    spawnParticle({
      x: ce.x,
      y: ce.y,
      vx: 0,
      vy: -15,
      color: emberPalette[0],
      size: isBoss ? 34 : 24,
      maxLife: 0.55,
      drag: 0.88,
      gravity: 0,
      shrink: true,
      style: "circle"
    });
  }
}

/**
 * Resolves dragon variant configuration from entity type
 */
function resolveDragonConfig(typeStr) {
  const type = (typeStr || "dragon").toLowerCase();
  if (type.includes("boss") || type.includes("sovereign") || type.includes("colossal") || type.includes("pyregorged")) {
    return DRAGON_VARIANTS.boss_dragon;
  }
  if (type.includes("frost") || type.includes("ice") || type.includes("wyrm") || type.includes("glacial")) {
    return DRAGON_VARIANTS.frost_wyrm;
  }
  if (type.includes("void") || type.includes("abyss") || type.includes("shadow")) {
    return DRAGON_VARIANTS.void_drake;
  }
  if (type.includes("emerald") || type.includes("forest") || type.includes("jade") || type.includes("toxic")) {
    return DRAGON_VARIANTS.emerald_drake;
  }
  return DRAGON_VARIANTS.fire_drake;
}

/**
 * Draws a symmetrical draconic wing in local coordinates.
 * Side: -1 for Left wing (Y < 0), +1 for Right wing (Y > 0)
 */
/**
 * Draws a majestic, articulated draconic wing in local coordinates.
 * Side: -1 for Left wing (Y < 0), +1 for Right wing (Y > 0)
 *
 * Features:
 * - Dynamic multi-joint kinematics: shoulder pivot, flexing elbow, articulated wrist, and trailing wave finger phalanges
 * - Subsurface scattering membrane with individual catenary scalloped bays and soft translucent inner glow
 * - Backlit glowing vascular networks and variant-specific pulsating capillary webs
 * - Volumetric lineless skeletal spars: humerus, olecranon elbow spur, carpal knuckle, raptorial thumb claw, and terminal claw barbs
 * - Aerodynamic wingtip vortices and concussive shockwave arcs during Wing Buffet attack
 */
function drawDragonWing(ctx, side, flapAngle, cfg, nowMs = 0, seed = 0, isAttacking = false, attackMode = "breath", attackProgress = 0, chestSwayY = 0) {
  ctx.save();

  // 1. ANCHOR & DYNAMIC FLIGHT KINEMATICS
  // Anchor to shoulder girdle with independent elevation and lateral clearance from torso flank (side * 13)
  const shoulderX = 2;
  const shoulderY = side * 13.0 + chestSwayY * 0.85;
  ctx.translate(shoulderX, shoulderY);

  const isBoss = !!cfg.isBoss;
  const isBuffet = isAttacking && (attackMode === "wing_buffet" || attackMode === "buffet");
  const isRoar = isAttacking && (attackMode === "roar" || attackMode === "dragon_roar");
  const isBreath = isAttacking && (attackMode === "breath" || attackMode === "flame");

  // Dynamic shoulder shrug and micro-flutter
  const shoulderShrug = Math.sin(nowMs * 0.0045 + seed * 2 + side) * 0.035;
  const shoulderLeadLag = Math.cos(nowMs * 0.006 + seed) * 0.03;

  // Base rotation and camber.
  // CRITICAL: We scale Y by `side`, meaning local +Y is ALWAYS OUTWARD away from the body for both wings!
  let bankAngle = (0.12 + flapAngle * 0.35) + shoulderShrug;
  let camberScaleY = 0.95 + Math.cos(flapAngle) * 0.15;
  let camberScaleX = 1.0 + shoulderLeadLag;

  if (isBuffet) {
    const buffetKick = Math.sin(attackProgress * Math.PI * 6);
    bankAngle = (0.08 + buffetKick * 0.45);
    camberScaleY = 0.95 + Math.abs(buffetKick) * 0.25;
    camberScaleX = 1.05 + Math.sin(attackProgress * Math.PI) * 0.10;
  } else if (isRoar) {
    bankAngle = 0.25 + Math.sin(nowMs * 0.008) * 0.06;
    camberScaleY = 1.10;
  } else if (isBreath) {
    bankAngle = 0.06 + Math.sin(nowMs * 0.01) * 0.04;
    camberScaleY = 0.96;
  }

  ctx.rotate(side * bankAngle);
  ctx.scale(camberScaleX, side * camberScaleY);

  // In this local frame:
  // X = forward (+X) and backward (-X)
  // Y = ALWAYS outward (+Y) away from the dragon's body!
  const baseSpan = isBoss ? 74 : 62;
  const wingExtension = 1.0 + flapAngle * 0.12;
  const fingerSpread = 1.0 + flapAngle * 0.15;

  // 2. ARTICULATED SKELETAL JOINT COORDINATES
  // Humerus extends outward and slightly back to elbow:
  const elbowX = -4 - flapAngle * 2.5;
  const elbowY = 25 * wingExtension;
  const olecranonSpurX = elbowX - 8.0;
  const olecranonSpurY = elbowY - 2.0;

  // Forearm extends outward and forward to carpus (wrist):
  const carpalX = 10 + flapAngle * 3.5;
  const carpalY = 48 * wingExtension;

  // Alar Thumb Claw (Digit I / Pollex) projecting forward from carpus
  const thumbBaseX = carpalX - 2.0;
  const thumbBaseY = carpalY - 1.5;
  const thumbTipX = carpalX + 11.0;
  const thumbTipY = carpalY + 4.5;
  const thumbBarbX = carpalX + 1.5;
  const thumbBarbY = carpalY + 4.5;
  const bossThumbTipX = carpalX + 8.0;
  const bossThumbTipY = carpalY + 9.5;

  // Sinuous harmonic wave flex lag for finger tips
  const lagPhase = nowMs * 0.006 + seed;
  const lag1 = Math.sin(lagPhase - 0.25) * 0.12;
  const lag2 = Math.sin(lagPhase - 0.45) * 0.16;
  const lag3 = Math.sin(lagPhase - 0.65) * 0.20;
  const lag4 = Math.sin(lagPhase - 0.85) * 0.24;

  // 4 Elongated Finger Struts (Phalanges):
  // Digit II (Primary leading wingtip - aerodynamic forward-lateral apex)
  const k1X = carpalX + 12;
  const k1Y = carpalY + 12 * fingerSpread;
  const f1X = carpalX + 22 + lag1 * 4;
  const f1Y = carpalY + (baseSpan * 0.36) * fingerSpread; // ~68-75 outward!

  // Digit III (Outer main span apex - maximum lateral reach into negative space)
  const k2X = carpalX - 3.0;
  const k2Y = carpalY + 16 * fingerSpread;
  const f2X = carpalX + 2.0 + lag2 * 4;
  const f2Y = carpalY + (baseSpan * 0.44) * fingerSpread; // ~75-84 outward!

  // Digit IV (Mid trailing strut)
  const k3X = carpalX - 16.0;
  const k3Y = carpalY + 12 * fingerSpread;
  const f3X = carpalX - 22.0 + lag3 * 5;
  const f3Y = carpalY + (baseSpan * 0.28) * fingerSpread; // ~62-68 outward!

  // Digit V (Inner trailing strut)
  const k4X = carpalX - 26.0;
  const k4Y = carpalY + 5 * fingerSpread;
  const f4X = carpalX - 38.0 + lag4 * 5;
  const f4Y = carpalY + (baseSpan * 0.08) * fingerSpread; // ~48-54 outward!

  // Anatomical Axillary Flank Anchor (Plagiopatagium insertion directly into lateral ribcage)
  // Deep insertion point leaving generous negative space behind wing for hindleg
  const flankRootX = -8.0;
  const flankRootY = 3.5;

  // 3. MULTI-CATENARY SCALLOPED MEMBRANE WEBBING
  ctx.beginPath();
  ctx.moveTo(0, 0); // Shoulder socket origin
  // Propatagium leading edge camber to elbow and carpus
  ctx.quadraticCurveTo(elbowX * 0.4 - 2, elbowY * 0.5, elbowX, elbowY);
  ctx.quadraticCurveTo((elbowX + carpalX) * 0.5 + 2, (elbowY + carpalY) * 0.5 - 2, carpalX, carpalY);
  // Leading edge spar along Digit II to primary wingtip
  ctx.quadraticCurveTo(k1X, k1Y, f1X, f1Y);

  // Scallop 1: Bay between Digit II and Digit III
  const sc1X = (f1X + f2X) * 0.5 - 5;
  const sc1Y = (f1Y + f2Y) * 0.5 - 7 * wingExtension;
  ctx.quadraticCurveTo(sc1X, sc1Y, f2X, f2Y);

  // Scallop 2: Bay between Digit III and Digit IV
  const sc2X = (f2X + f3X) * 0.5 - 5;
  const sc2Y = (f2Y + f3Y) * 0.5 - 8 * wingExtension;
  ctx.quadraticCurveTo(sc2X, sc2Y, f3X, f3Y);

  // Scallop 3: Bay between Digit IV and Digit V
  const sc3X = (f3X + f4X) * 0.5 - 5;
  const sc3Y = (f3Y + f4Y) * 0.5 - 7 * wingExtension;
  ctx.quadraticCurveTo(sc3X, sc3Y, f4X, f4Y);

  // Scallop 4: Plagiopatagium inner trailing bay curving deeply into the axillary flank root
  const sc4X = (f4X + flankRootX) * 0.5 - 4;
  const sc4Y = (f4Y + flankRootY) * 0.5 - 9 * wingExtension;
  ctx.quadraticCurveTo(sc4X, sc4Y, flankRootX, flankRootY);

  // Fleshy muscular patagial fold attaching along the ribcage flank directly into the shoulder socket
  ctx.quadraticCurveTo(flankRootX * 0.4, flankRootY * 0.5, 0, 0);
  ctx.closePath();

  // Multi-stop leathery membrane gradient
  const webGrad = ctx.createLinearGradient(0, 0, 0, baseSpan * 1.1);
  webGrad.addColorStop(0, cfg.scalePrimary);
  webGrad.addColorStop(0.25, cfg.wingMembrane2);
  webGrad.addColorStop(0.75, cfg.wingMembrane1);
  webGrad.addColorStop(1, cfg.scaleSecondary);
  ctx.fillStyle = webGrad;
  ctx.fill();

  // 4. SUBSURFACE SCATTERING & TRANSLUCENT INNER POCKET GLOW
  const innerGlowColor = cfg.wingMembraneInner || "rgba(255, 255, 255, 0.16)";
  ctx.save();
  const pocketCenters = [
    { x: (carpalX + f1X + f2X) / 3, y: (carpalY + f1Y + f2Y) / 3, r: 16 },
    { x: (carpalX + f2X + f3X) / 3, y: (carpalY + f2Y + f3Y) / 3, r: 18 },
    { x: (carpalX + f3X + f4X) / 3, y: (carpalY + f3Y + f4Y) / 3, r: 16 },
    { x: (carpalX + f4X + flankRootX) / 3, y: (carpalY + f4Y + flankRootY) / 3, r: 14 }
  ];

  for (let p = 0; p < pocketCenters.length; p++) {
    const pc = pocketCenters[p];
    const pGrad = ctx.createRadialGradient(pc.x, pc.y, 1, pc.x, pc.y, pc.r);
    pGrad.addColorStop(0, innerGlowColor);
    pGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.05)");
    pGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(pc.x, pc.y, pc.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cosmic Constellation Star Glints on Abyssal Void Dragon Membrane
  if (cfg.id === "void_drake" || cfg.isVoid) {
    const starCount = 14;
    for (let st = 0; st < starCount; st++) {
      const bayIdx = st % pocketCenters.length;
      const pc = pocketCenters[bayIdx];
      const angle = (st * 1.9 + seed) % (Math.PI * 2);
      const dist = ((st * 7.7 + seed * 2) % (pc.r * 0.75));
      const sx = pc.x + Math.cos(angle) * dist;
      const sy = pc.y + Math.sin(angle) * dist;
      const twinkle = Math.sin(nowMs * 0.004 + st * 1.7 + seed) * 0.5 + 0.5;
      const starAlpha = 0.35 + twinkle * 0.65;
      const starColor = (st % 3 === 0) ? "#00f0ff" : (st % 3 === 1) ? "#ffffff" : "#e879f9";

      ctx.fillStyle = starColor;
      ctx.globalAlpha = starAlpha;
      const starR = (st % 2 === 0) ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.moveTo(sx, sy - starR * 2.2);
      ctx.lineTo(sx + starR * 0.4, sy);
      ctx.lineTo(sx + starR * 2.2, sy);
      ctx.lineTo(sx, sy + starR * 0.4);
      ctx.lineTo(sx, sy + starR * 2.2);
      ctx.lineTo(sx - starR * 0.4, sy);
      ctx.lineTo(sx - starR * 2.2, sy);
      ctx.lineTo(sx, sy - starR * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // 5. BACKLIT GLOWING VASCULAR NETWORK & PULSING ELEMENTAL VEINS
  const veinGlowColor = cfg.wingVeinGlow || cfg.scaleHighlight;
  const veinCoreColor = cfg.wingVeinCore || "#ffffff";
  const veinPulse = 0.72 + Math.sin(nowMs * 0.0045 + seed) * 0.28;

  ctx.save();
  ctx.lineCap = "round";

  // A. Main Arterial Conduits
  ctx.strokeStyle = veinGlowColor;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.50 * veinPulse;

  ctx.beginPath();
  ctx.moveTo(carpalX + 6, carpalY + 6);
  ctx.quadraticCurveTo(sc1X + 4, sc1Y + 10, sc1X + 2, sc1Y + 2);
  ctx.moveTo(carpalX - 2, carpalY + 6);
  ctx.quadraticCurveTo(sc2X + 3, sc2Y + 12, sc2X + 2, sc2Y + 2);
  ctx.moveTo(carpalX - 10, carpalY + 4);
  ctx.quadraticCurveTo(sc3X + 3, sc3Y + 10, sc3X + 1, sc3Y + 2);
  ctx.moveTo(carpalX - 16, carpalY + 2);
  ctx.quadraticCurveTo(sc4X + 2, sc4Y + 8, sc4X + 1, sc4Y + 2);
  ctx.stroke();

  // B. Secondary Dendritic Capillaries
  ctx.lineWidth = 0.75;
  ctx.globalAlpha = 0.35 * veinPulse;
  ctx.beginPath();
  ctx.moveTo(carpalX + 10, carpalY + 12);
  ctx.lineTo(k1X - 2, k1Y - 4);
  ctx.moveTo(sc1X + 3, sc1Y + 6);
  ctx.lineTo(f2X + 3, f2Y - 6);
  ctx.moveTo(carpalX + 1, carpalY + 14);
  ctx.lineTo(k2X - 3, k2Y - 5);
  ctx.moveTo(sc2X + 2, sc2Y + 7);
  ctx.lineTo(f3X + 4, f3Y - 5);
  ctx.moveTo(carpalX - 8, carpalY + 10);
  ctx.lineTo(k3X - 2, k3Y - 4);
  ctx.moveTo(sc3X + 2, sc3Y + 6);
  ctx.lineTo(f4X + 4, f4Y - 4);
  ctx.stroke();

  // C. Luminous Core Highlights
  ctx.strokeStyle = veinCoreColor;
  ctx.lineWidth = 0.55;
  ctx.globalAlpha = 0.75 * veinPulse;
  ctx.beginPath();
  ctx.moveTo(carpalX + 6, carpalY + 6);
  ctx.quadraticCurveTo(sc1X + 4, sc1Y + 10, sc1X + 2, sc1Y + 4);
  ctx.moveTo(carpalX - 2, carpalY + 6);
  ctx.quadraticCurveTo(sc2X + 3, sc2Y + 12, sc2X + 2, sc2Y + 4);
  ctx.stroke();
  ctx.restore();

  // 6. VOLUMETRIC SKELETAL SPAR ARMATURE (LINELESS 3D CHITIN/BONE)
  const boneHighlight = cfg.wingBoneHighlight || cfg.scaleHighlight;
  const rootWidth = isBoss ? 11.5 : 8.5;
  const elbowWidth = isBoss ? 6.5 : 5.0;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Tangent normal vector along humerus bone
  const dxH = elbowX - 0;
  const dyH = elbowY - 0;
  // Bolt Opt: Math.hypot Function Call Elimination - Replaced Math.hypot(a, b) with Math.sqrt(a*a + b*b) to eliminate V8 overhead in hot render loop.
  const lenH = Math.sqrt(dxH * dxH + dyH * dyH) || 1;
  const nxH = -dyH / lenH;
  const nyH = dxH / lenH;

  // 1. Muscular Humerus Arm Mass
  ctx.beginPath();
  ctx.moveTo(0 + nxH * (rootWidth * 0.5), 0 + nyH * (rootWidth * 0.5));
  ctx.quadraticCurveTo(
    elbowX * 0.45 + nxH * (rootWidth * 0.65),
    elbowY * 0.45 + nyH * (rootWidth * 0.65),
    elbowX + nxH * (elbowWidth * 0.5),
    elbowY + nyH * (elbowWidth * 0.5)
  );
  ctx.lineTo(elbowX - nxH * (elbowWidth * 0.5), elbowY - nyH * (elbowWidth * 0.5));
  ctx.quadraticCurveTo(
    elbowX * 0.45 - nxH * (rootWidth * 0.45),
    elbowY * 0.45 - nyH * (rootWidth * 0.45),
    0 - nxH * (rootWidth * 0.5),
    0 - nyH * (rootWidth * 0.5)
  );
  ctx.closePath();

  const humerusGrad = ctx.createLinearGradient(0, 0, elbowX, elbowY);
  humerusGrad.addColorStop(0, cfg.scalePrimary);
  humerusGrad.addColorStop(0.35, cfg.scaleSecondary);
  humerusGrad.addColorStop(0.75, cfg.scalePrimary);
  ctx.fillStyle = humerusGrad;
  ctx.fill();

  // Specular dorsal muscular ridge highlight
  ctx.strokeStyle = boneHighlight;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.quadraticCurveTo(elbowX * 0.45, elbowY * 0.45 + 1.5, elbowX, elbowY + 1);
  ctx.stroke();

  const boneWidth = isBoss ? 6.8 : 5.2;

  // B. Forearm Spar (Radius & Ulna: Elbow to Carpal Wrist)
  ctx.strokeStyle = cfg.scaleSecondary;
  ctx.lineWidth = boneWidth;
  ctx.beginPath();
  ctx.moveTo(elbowX, elbowY);
  ctx.lineTo(carpalX, carpalY);
  ctx.stroke();

  ctx.strokeStyle = boneHighlight;
  ctx.lineWidth = boneWidth * 0.35;
  ctx.beginPath();
  ctx.moveTo(elbowX, elbowY + 1);
  ctx.lineTo(carpalX, carpalY + 1);
  ctx.stroke();

  // C. Elbow Joint (Olecranon) - Smooth joint without spikes or spurs
  ctx.fillStyle = cfg.scalePrimary;
  ctx.beginPath();
  ctx.arc(elbowX, elbowY, boneWidth * 0.65, 0, Math.PI * 2);
  ctx.fill();

  // D. 4 Extended Finger Phalange Struts (Digits II, III, IV, V)
  const fingers = [
    { kx: k1X, ky: k1Y, fx: f1X, fy: f1Y, w: 3.8, isPrimary: true },
    { kx: k2X, ky: k2Y, fx: f2X, fy: f2Y, w: 2.8, isPrimary: false },
    { kx: k3X, ky: k3Y, fx: f3X, fy: f3Y, w: 2.5, isPrimary: false },
    { kx: k4X, ky: k4Y, fx: f4X, fy: f4Y, w: 2.2, isPrimary: false }
  ];

  for (let i = 0; i < fingers.length; i++) {
    const f = fingers[i];

    // Bone strut midtone
    ctx.strokeStyle = f.isPrimary ? cfg.scaleSecondary : cfg.scalePrimary;
    ctx.lineWidth = f.w;
    ctx.beginPath();
    ctx.moveTo(carpalX, carpalY);
    ctx.lineTo(f.kx, f.ky);
    ctx.lineTo(f.fx, f.fy);
    ctx.stroke();

    // Bone strut highlight
    ctx.strokeStyle = boneHighlight;
    ctx.lineWidth = Math.max(0.7, f.w * 0.32);
    ctx.beginPath();
    ctx.moveTo(carpalX, carpalY);
    ctx.lineTo(f.kx, f.ky);
    ctx.lineTo(f.fx, f.fy);
    ctx.stroke();

    // Intermediate Knuckle Swelling Node
    ctx.fillStyle = cfg.scaleSecondary;
    ctx.beginPath();
    ctx.arc(f.kx, f.ky, f.w * 0.62, 0, Math.PI * 2);
    ctx.fill();

    // Terminal Needle-Sharp Claw Barb at Wingtip
    const tipAngle = Math.atan2(f.fy - f.ky, f.fx - f.kx);
    const barbLen = isBoss ? 6.5 : 4.5;
    ctx.fillStyle = cfg.wingClawColor || cfg.hornHighlight;
    ctx.beginPath();
    ctx.moveTo(f.fx - Math.sin(tipAngle) * 1.4, f.fy + Math.cos(tipAngle) * 1.4);
    ctx.lineTo(f.fx + Math.cos(tipAngle) * barbLen, f.fy + Math.sin(tipAngle) * barbLen);
    ctx.lineTo(f.fx + Math.sin(tipAngle) * 1.4, f.fy - Math.cos(tipAngle) * 1.4);
    ctx.closePath();
    ctx.fill();
  }

  // E. Carpal Wrist Joint Node & Predatory Alar Thumb Claw
  ctx.fillStyle = cfg.scalePrimary;
  ctx.beginPath();
  ctx.arc(carpalX, carpalY, boneWidth * 0.72, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = cfg.scaleSecondary;
  ctx.beginPath();
  ctx.arc(carpalX - 0.5, carpalY - 0.5, boneWidth * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Curved Alar Thumb Claw (Digit I / Pollex)
  ctx.fillStyle = cfg.hornColor;
  ctx.beginPath();
  ctx.moveTo(thumbBaseX, thumbBaseY);
  ctx.quadraticCurveTo(carpalX + 4, carpalY + 1, thumbTipX, thumbTipY);
  ctx.quadraticCurveTo(carpalX + 5, carpalY + 5, thumbBarbX, thumbBarbY);
  ctx.closePath();
  ctx.fill();

  // Thumb claw specular ridge
  ctx.fillStyle = cfg.hornHighlight;
  ctx.beginPath();
  ctx.moveTo(thumbBaseX + 1, thumbBaseY + 1);
  ctx.quadraticCurveTo(carpalX + 5, carpalY + 2, thumbTipX, thumbTipY);
  ctx.lineTo(carpalX + 4, carpalY + 4);
  ctx.closePath();
  ctx.fill();

  // Secondary thumb claw for Colossal Boss Dragon
  if (isBoss) {
    ctx.fillStyle = cfg.hornHighlight;
    ctx.beginPath();
    ctx.moveTo(carpalX, carpalY + 3);
    ctx.lineTo(bossThumbTipX, bossThumbTipY);
    ctx.lineTo(carpalX - 3, carpalY + 4);
    ctx.closePath();
    ctx.fill();
  }

  // F. ARTICULATED SCAPULAR SHOULDER CLEAT & HUMERAL BALL-AND-SOCKET JOINT
  const socketRadius = isBoss ? 5.8 : 4.4;

  ctx.fillStyle = cfg.scaleShadow || "#2b0606";
  ctx.beginPath();
  ctx.arc(0, 0, socketRadius + 1.4, 0, Math.PI * 2);
  ctx.fill();

  const socketGrad = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, socketRadius);
  socketGrad.addColorStop(0, boneHighlight);
  socketGrad.addColorStop(0.45, cfg.scaleSecondary);
  socketGrad.addColorStop(1, cfg.scalePrimary);
  ctx.fillStyle = socketGrad;
  ctx.beginPath();
  ctx.arc(0, 0, socketRadius, 0, Math.PI * 2);
  ctx.fill();

  // Fibrous Tendon Cords bridging socket to humerus
  ctx.strokeStyle = cfg.wingVeinGlow || boneHighlight;
  ctx.lineWidth = 1.0;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.moveTo(0, socketRadius * 0.5);
  ctx.quadraticCurveTo(elbowX * 0.15, elbowY * 0.15 + 2, elbowX * 0.3, elbowY * 0.3);
  ctx.moveTo(0, -socketRadius * 0.5);
  ctx.quadraticCurveTo(elbowX * 0.15, elbowY * 0.15 - 2, elbowX * 0.3, elbowY * 0.3);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // 7. AERODYNAMIC WINGTIP VORTICES & WING BUFFET VORTEX SHOCKWAVES
  if (isBuffet) {
    const vortexProgress = (attackProgress * 3.5) % 1;
    const vRadius = 12 + vortexProgress * 30;
    const vAlpha = Math.max(0, (1 - vortexProgress) * 0.85);

    ctx.save();
    ctx.strokeStyle = cfg.wingVeinGlow || "#ffffff";
    ctx.lineWidth = 2.2;
    ctx.globalAlpha = vAlpha;
    ctx.beginPath();
    ctx.arc(f1X, f1Y, vRadius, -Math.PI * 0.7, Math.PI * 0.4);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(f1X + 2, f1Y + 2, vRadius * 0.82, -Math.PI * 0.65, Math.PI * 0.35);
    ctx.stroke();
    ctx.restore();
  } else if (Math.abs(flapAngle) > 0.28) {
    const tipVaporAlpha = Math.min(0.40, (Math.abs(flapAngle) - 0.28) * 2.5);
    ctx.save();
    ctx.strokeStyle = cfg.wingVeinGlow || "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = tipVaporAlpha;
    ctx.beginPath();
    ctx.moveTo(f1X, f1Y);
    ctx.quadraticCurveTo(f1X + 6, f1Y - 8 * flapAngle, f1X + 12, f1Y - 14 * flapAngle);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // End bone cap
  ctx.restore(); // End wing transform
}

/**
 * Computes articulated serpentine tail vertebrae nodes trailing backward (-X)
 * directly continuous with the dragon's pelvic girdle.
 */
function getDragonTailNodes(tailWavePhase, swipeKick, rootX = -13, rootY = 0, spineAngle = Math.PI, baseWidth = 22) {
  const segments = 12;
  const tailLength = 64;
  const segLen = tailLength / segments;

  const nodes = [];
  let curX = rootX;
  let curY = rootY;
  let curAngle = spineAngle;

  nodes.push({ x: curX, y: curY, w: baseWidth, angle: curAngle });

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    // Harmonic serpentine wave
    const wave = Math.sin(tailWavePhase + t * Math.PI * 2.5) * (0.18 + swipeKick * 0.8) * (t * 1.3);
    curAngle += wave;
    curX += Math.cos(curAngle) * segLen;
    curY += Math.sin(curAngle) * segLen;
    // Smooth anatomical taper from pelvic base down to 1.6 at the tail tip
    const taper = Math.pow(1 - t, 1.35);
    const w = (baseWidth - 1.6) * taper + 1.6;
    nodes.push({ x: curX, y: curY, w, angle: curAngle });
  }

  return nodes;
}

/**
 * Draws standalone serpentine tapering tail trailing backward (-X)
 * used as a modular fallback or when rendering tail components.
 */
function drawDragonTail(ctx, tailWavePhase, swipeKick, cfg, rootY = 0) {
  const nodes = getDragonTailNodes(tailWavePhase, swipeKick, -13, rootY, Math.PI, 22);
  const leftPts = [];
  const rightPts = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const halfW = n.w * 0.5;
    const nx = -Math.sin(n.angle) * halfW;
    const ny = Math.cos(n.angle) * halfW;
    leftPts.push({ x: n.x + nx, y: n.y + ny });
    rightPts.push({ x: n.x - nx, y: n.y - ny });
  }

  ctx.beginPath();
  ctx.moveTo(leftPts[0].x, leftPts[0].y);
  for (let i = 1; i < leftPts.length; i++) {
    const prev = leftPts[i - 1];
    const curr = leftPts[i];
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) * 0.5, (prev.y + curr.y) * 0.5);
  }
  const last = nodes[nodes.length - 1];
  ctx.lineTo(last.x, last.y);
  for (let i = rightPts.length - 1; i >= 1; i--) {
    const curr = rightPts[i];
    const prev = rightPts[i - 1];
    ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + prev.x) * 0.5, (curr.y + prev.y) * 0.5);
  }
  ctx.lineTo(rightPts[0].x, rightPts[0].y);
  ctx.closePath();

  const tailGrad = ctx.createLinearGradient(-13, rootY, last.x, last.y);
  tailGrad.addColorStop(0, cfg.scaleSecondary);
  tailGrad.addColorStop(0.5, cfg.scalePrimary);
  tailGrad.addColorStop(1, cfg.scalePrimary);
  ctx.fillStyle = tailGrad;
  ctx.fill();

  // Dorsal Centerline Scale Highlight
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].x, nodes[i].y);
  }
  ctx.strokeStyle = cfg.scaleHighlight;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.stroke();

  // Barbed Arrowhead Dragon Tail Spade / Fluke
  drawDragonTailSpade(ctx, last, cfg);
}

/**
 * Draws an iconic barbed draconic spade fluke / tail blade at the tail apex.
 */
function drawDragonTailSpade(ctx, lastNode, cfg) {
  ctx.save();
  ctx.translate(lastNode.x, lastNode.y);
  ctx.rotate(lastNode.angle);

  const flukeLen = 13.5;
  const flukeHalfW = 8.0;

  // Arrowhead spade blade with swept barb wings
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(flukeLen * 0.35, flukeHalfW * 0.9, flukeLen * 0.65, flukeHalfW);
  ctx.lineTo(flukeLen, 0); // Stiletto tail tip
  ctx.lineTo(flukeLen * 0.65, -flukeHalfW);
  ctx.quadraticCurveTo(flukeLen * 0.35, -flukeHalfW * 0.9, 0, 0);
  ctx.closePath();

  const spadeGrad = ctx.createLinearGradient(0, 0, flukeLen, 0);
  spadeGrad.addColorStop(0, cfg.dorsalSpineShadow || cfg.scaleShadow || "#1a0303");
  spadeGrad.addColorStop(0.45, cfg.dorsalSpineColor || cfg.scaleSecondary);
  spadeGrad.addColorStop(0.85, cfg.dorsalSpineHighlight || cfg.scaleHighlight);
  spadeGrad.addColorStop(1, "#ffffff");
  ctx.fillStyle = spadeGrad;
  ctx.fill();

  // Central dorsal blade ridge
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(flukeLen * 0.95, 0);
  ctx.stroke();

  // Lateral recurved fin barbs
  ctx.fillStyle = cfg.hornHighlight || cfg.scaleHighlight;
  ctx.beginPath();
  ctx.moveTo(flukeLen * 0.65, flukeHalfW);
  ctx.lineTo(flukeLen * 0.48, flukeHalfW + 2.2);
  ctx.lineTo(flukeLen * 0.45, flukeHalfW * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(flukeLen * 0.65, -flukeHalfW);
  ctx.lineTo(flukeLen * 0.48, -flukeHalfW - 2.2);
  ctx.lineTo(flukeLen * 0.45, -flukeHalfW * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Renders triangular dorsal crest spines along the vertebral centerline.
 */
function drawDragonDorsalSpines(ctx, nodes, cfg, spineHeight = 4.0) {
  if (!nodes || nodes.length < 2) return;
  const spineColor = cfg.dorsalSpineColor || cfg.scaleHighlight;
  const shadowColor = cfg.dorsalSpineShadow || cfg.scaleShadow || "#1a0303";
  const hiColor = cfg.dorsalSpineHighlight || "#ffffff";

  ctx.save();
  for (let i = 0; i < nodes.length - 1; i++) {
    const curr = nodes[i];
    const next = nodes[i + 1];
    const t = i / (nodes.length - 1);

    // Spine size tapers down along the tail
    const curH = spineHeight * Math.max(0.4, (1 - t * 0.65));
    const curW = curH * 0.6;

    // Normal vector perpendicular to vertebral trajectory
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const midX = (curr.x + next.x) * 0.5;
    const midY = (curr.y + next.y) * 0.5;

    // Triangular spine tooth pointing along spine normal
    ctx.beginPath();
    ctx.moveTo(midX - (dx / len) * curW, midY - (dy / len) * curW);
    ctx.lineTo(midX + nx * curH, midY + ny * curH); // Spine tip
    ctx.lineTo(midX + (dx / len) * curW, midY + (dy / len) * curW);
    ctx.closePath();

    ctx.fillStyle = (i % 2 === 0) ? spineColor : shadowColor;
    ctx.fill();

    // Specular tip glint
    ctx.strokeStyle = hiColor;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midX + nx * curH, midY + ny * curH);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draws a single curved predatory draconic talon with lineless volumetric shading and specular ridge.
 */
function drawSingleTalon(ctx, rootX, rootY, angle, length, width, rootColor, tipColor) {
  ctx.save();
  ctx.translate(rootX, rootY);
  ctx.rotate(angle);

  // Curved talon blade
  ctx.beginPath();
  ctx.moveTo(0, -width * 0.5);
  ctx.quadraticCurveTo(length * 0.45, -width * 0.35, length, 0); // Sharp needle tip
  ctx.quadraticCurveTo(length * 0.45, width * 0.55, 0, width * 0.5);
  ctx.closePath();

  const clawGrad = ctx.createLinearGradient(0, 0, length, 0);
  clawGrad.addColorStop(0, rootColor);
  clawGrad.addColorStop(0.65, tipColor);
  clawGrad.addColorStop(1, "#ffffff");
  ctx.fillStyle = clawGrad;
  ctx.fill();

  // Dorsal specular ridge highlight
  ctx.beginPath();
  ctx.moveTo(1, -width * 0.2);
  ctx.quadraticCurveTo(length * 0.5, -width * 0.15, length * 0.92, 0);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.65;
  ctx.stroke();

  ctx.restore();
}

/**
 * Exact 2-Segment Inverse Kinematics for draconic sprawling limbs.
 * Given root joint (x0, y0), target paw (x2, y2), bone lengths (L1, L2),
 * and side (-1 for Left, +1 for Right), computes the knee/elbow joint (x1, y1)
 * flexing outward away from the dragon's longitudinal midline.
 */
function solveLimbIK(x0, y0, x2, y2, L1, L2, side) {
  const dx = x2 - x0;
  const dy = y2 - y0;
  // Bolt Opt: Math.hypot Function Call Elimination - Replaced Math.hypot(a, b) with Math.sqrt(a*a + b*b) to eliminate V8 overhead in hot render loop.
  let d = Math.sqrt(dx * dx + dy * dy);

  // Clamp distance to ensure valid physical triangle without collapse or hyperextension
  const maxD = L1 + L2 - 0.05;
  const minD = Math.max(0.2, Math.abs(L1 - L2) + 0.1);
  d = Math.max(minD, Math.min(maxD, d));

  // Law of Cosines for interior angle at root
  const cosAlpha = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const clampedCos = Math.max(-1, Math.min(1, cosAlpha));
  const alpha = Math.acos(clampedCos);

  // Base line direction from root to paw
  const baseAngle = Math.atan2(dy, dx);

  // Sprawling joint flexes OUTWARD away from midline (Y=0):
  // When side < 0 (Left side, Y < 0), outward is -alpha
  // When side > 0 (Right side, Y > 0), outward is +alpha
  const jointAngle = baseAngle + side * alpha;

  const x1 = x0 + Math.cos(jointAngle) * L1;
  const y1 = y0 + Math.sin(jointAngle) * L1;

  return { x1, y1, d };
}

/**
 * Computes stance vs swing kinematics for a leg.
 */
function computeGaitStride(phase, dutyFactor, isMoving, isAirborne, isBreath, isTail, isBuffet, isRoar, attackProgress, nowMs, side, hoverPhase, breathPhase, isFore) {
  let strideFrac = 0; // -1 (rear) to +1 (forward)
  let lift = 0;       // 0 (ground) to 1 (swing apex)
  let squash = 1.0;
  let splay = 1.0;

  if (isBreath) {
    const tremor = Math.sin(nowMs * 0.05 + side) * 0.5;
    if (isFore) {
      strideFrac = 0.85 + tremor * 0.06;
      squash = 1.25;
      splay = 1.45;
    } else {
      strideFrac = -0.95 + tremor * 0.06;
      squash = 1.25;
      splay = 1.45;
    }
  } else if (isTail) {
    if (isFore) {
      strideFrac = 0.5;
      splay = 1.25;
      squash = 1.15;
    } else {
      const swipePhase = Math.sin(attackProgress * Math.PI);
      if ((side < 0 && swipePhase > 0) || (side > 0 && swipePhase < 0)) {
        lift = 0.8;
        strideFrac = 0.2;
        splay = 0.9;
      } else {
        strideFrac = -0.7;
        splay = 1.3;
        squash = 1.2;
      }
    }
  } else if (isBuffet) {
    if (isFore) {
      lift = 0.7;
      strideFrac = -0.2;
      splay = 0.8;
    } else {
      strideFrac = 0.1;
      squash = 1.1;
      splay = 1.2;
    }
  } else if (isRoar) {
    strideFrac = isFore ? 0.6 : -0.6;
    splay = 1.35;
    squash = 1.2;
  } else if (isMoving && !isAirborne) {
    if (phase < dutyFactor) {
      // STANCE PHASE: grounded traction driving backward (+1 to -1)
      const s = phase / dutyFactor;
      strideFrac = 1.0 - 2.0 * s;
      lift = 0;
      const load = Math.sin(s * Math.PI);
      squash = 1.0 + load * 0.20;
      splay = 1.0 + load * 0.25;
    } else {
      // SWING PHASE: parabolic forward reach (-1 to +1)
      const w = (phase - dutyFactor) / (1.0 - dutyFactor);
      const ease = 0.5 - 0.5 * Math.cos(w * Math.PI);
      strideFrac = -1.0 + 2.0 * ease;
      lift = Math.sin(w * Math.PI);
      squash = 0.92;
      splay = 0.85;
    }
  } else if (isAirborne) {
    // Airborne Hover: aerodynamic tuck
    const lag = Math.sin(hoverPhase + (isFore ? 0.2 : -0.4)) * 0.25;
    strideFrac = (isFore ? 0.15 : -0.35) + lag;
    lift = 0.65;
    squash = 0.92;
    splay = 0.85;
  } else {
    // Grounded Idle Stance: rooted firmly
    const settle = Math.sin(breathPhase) * 0.04;
    strideFrac = 0;
    lift = 0;
    squash = 1.06 + settle;
    splay = 1.15 + settle;
  }

  return { strideFrac, lift, squash, splay };
}

/**
 * Renders a contoured lineless muscular bone segment (thigh, bicep, shank, forearm)
 * between two joint positions with linear lighting and a dorsal crest highlight.
 */
function drawLimbBoneSegment(ctx, x0, y0, x1, y1, w0, w1, cfg, boneHighlight, hasCalfBulge = false) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  // Bolt Opt: Math.hypot Function Call Elimination - Replaced Math.hypot(a, b) with Math.sqrt(a*a + b*b) to eliminate V8 overhead in hot render loop.
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) return;
  const nx = -dy / len;
  const ny = dx / len;

  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  if (hasCalfBulge) {
    ctx.quadraticCurveTo(
      (x0 + x1) * 0.5 - nx * (w0 * 1.35),
      (y0 + y1) * 0.5 - ny * (w0 * 1.35),
      x0 - nx * w0,
      y0 - ny * w0
    );
  } else {
    ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, cfg.scalePrimary);
  grad.addColorStop(0.5, cfg.scaleSecondary);
  grad.addColorStop(1, cfg.scalePrimary);
  ctx.fillStyle = grad;
  ctx.fill();

  // Dorsal muscular ridge specular highlight
  ctx.beginPath();
  ctx.moveTo(x0 + nx * (w0 * 0.25), y0 + ny * (w0 * 0.25));
  ctx.lineTo(x1 + nx * (w1 * 0.25), y1 + ny * (w1 * 0.25));
  ctx.strokeStyle = boneHighlight;
  ctx.lineWidth = 0.9;
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Renders an armored horn spur at a knee or elbow joint pointing backward/outward.
 */
function drawJointSpur(ctx, jx, jy, rootX, rootY, side, length, hornColor, hornHighlight) {
  const bAngle = Math.atan2(jy - rootY, jx - rootX);
  const spurAngle = bAngle + Math.PI - side * 0.35;

  ctx.save();
  ctx.translate(jx, jy);
  ctx.rotate(spurAngle);

  ctx.fillStyle = hornColor;
  ctx.beginPath();
  ctx.moveTo(0, -1.5);
  ctx.lineTo(length, 0);
  ctx.lineTo(0, 1.5);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = hornHighlight;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(length, 0);
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders the scalated dragon foot pad and 4 articulated talons pointing forward along +X.
 */
function drawDragonFoot(ctx, footX, footY, side, strideFrac, relDirX, relDirY, squash, splay, isBoss, cfg, clawRootColor, clawTipColor, isFore) {
  ctx.save();
  ctx.translate(footX, footY);

  // Foot yaw: Points forward along +X with gentle dynamic turnout
  const footYaw = side * 0.08 + (strideFrac * relDirX * 0.05) + (relDirY * strideFrac * 0.1);
  ctx.rotate(footYaw);

  // Sleek, proportionate scalated paw pad
  const padRadiusX = (isBoss ? 2.4 : 1.7) * squash;
  const padRadiusY = (isBoss ? 1.7 : 1.2);

  // Volumetric Scalated Palm Pad
  ctx.fillStyle = cfg.scalePrimary;
  ctx.beginPath();
  ctx.ellipse(0, 0, padRadiusX, padRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = cfg.scaleSecondary;
  ctx.beginPath();
  ctx.ellipse(-0.2, 0, padRadiusX * 0.72, padRadiusY * 0.70, 0, 0, Math.PI * 2);
  ctx.fill();

  // Proportionate, slender predatory talons
  const talonLen = (isBoss ? 3.6 : 2.5);
  const talonWidth = (isBoss ? 1.0 : 0.7);

  if (isFore) {
    // FOREPAW: 4 Claws (Digit I Dewclaw + Digits II, III, IV)
    // Digit I: Raptorial Dewclaw
    drawSingleTalon(ctx, -0.8, -side * (0.9 * splay), -side * (0.28 * splay), talonLen * 0.72, talonWidth * 0.85, clawRootColor, clawTipColor);
    // Digit II: Inner Razor Talon
    drawSingleTalon(ctx, 0.5, -side * (0.5 * splay), -side * (0.09 * splay), talonLen * 0.88, talonWidth * 0.95, clawRootColor, clawTipColor);
    // Digit III: Main Apex Talon (Dead Forward +X)
    drawSingleTalon(ctx, 1.2, 0, 0, talonLen * 1.0, talonWidth, clawRootColor, clawTipColor);
    // Digit IV: Outer Razor Talon
    drawSingleTalon(ctx, 0.5, side * (0.9 * splay), side * (0.16 * splay), talonLen * 0.84, talonWidth * 0.95, clawRootColor, clawTipColor);
  } else {
    // HINDPAW fallback: 4 Claws (Digit II, III, IV Forward + Hallux Rear)
    drawSingleTalon(ctx, 0.5, -side * (1.1 * splay), -side * (0.09 * splay), talonLen * 0.88, talonWidth, clawRootColor, clawTipColor);
    drawSingleTalon(ctx, 1.2, 0, 0, talonLen * 1.0, talonWidth * 1.05, clawRootColor, clawTipColor);
    drawSingleTalon(ctx, 0.5, side * (1.1 * splay), side * (0.15 * splay), talonLen * 0.88, talonWidth, clawRootColor, clawTipColor);
    drawSingleTalon(ctx, -1.2, -side * 0.3, Math.PI - side * 0.12, talonLen * 0.55, talonWidth * 0.85, clawRootColor, clawTipColor);
  }

  ctx.restore();
}

/**
 * Draws thoughtful, articulated draconic limbs with 2-segment inverse kinematics,
 * archosaurian diagonal gait coordination, and forward-pointing talons.
 * Handles both forelimbs (pectoral girdle) and hindlimbs (pelvic girdle).
 */
function drawDragonLimbs(
  ctx,
  side,
  cfg,
  nowMs = 0,
  seed = 0,
  isMoving = false,
  isAttacking = false,
  attackMode = "breath",
  attackProgress = 0,
  wingFlap = 0,
  speedMult = 1.0,
  gaitInfo = null,
  isFore = true
) {
  const isBoss = !!cfg.isBoss;
  const isBreath = isAttacking && (attackMode === "breath" || attackMode === "flame");
  const isTail = isAttacking && (attackMode === "tail_swipe" || attackMode === "swipe");
  const isBuffet = isAttacking && (attackMode === "wing_buffet" || attackMode === "buffet");
  const isRoar = isAttacking && (attackMode === "roar" || attackMode === "dragon_roar");

  const clawRootColor = cfg.hornColor || "#181216";
  const clawTipColor = cfg.hornHighlight || "#f59e0b";
  const boneHighlight = cfg.wingBoneHighlight || cfg.scaleHighlight;
  const scaleShadow = cfg.scaleShadow || "#2e0505";

  // Resolve gait parameters
  const isAirborne = gaitInfo ? !!gaitInfo.isAirborne : (!isMoving);
  const walkCycle = gaitInfo ? (gaitInfo.walkCycle || 0) : ((nowMs * 0.0011 * speedMult + seed * 0.1) % 1.0);
  const relDirX = gaitInfo ? gaitInfo.relDirX : (isMoving ? 1.0 : 0);
  const relDirY = gaitInfo ? gaitInfo.relDirY : 0;
  const turnRate = gaitInfo ? (gaitInfo.turnRate || 0) : 0;
  const hipSwayY = gaitInfo ? (gaitInfo.hipSwayY || 0) : 0;
  const chestSwayY = gaitInfo ? (gaitInfo.chestSwayY || 0) : 0;

  const hoverPhase = nowMs * 0.0035 * speedMult + seed;
  const breathPhase = nowMs * 0.0028 + seed;

  // Stride parameters
  const dutyFactor = 0.58;
  const turnMod = (side * turnRate < 0) ? (1 + Math.min(0.3, Math.abs(turnRate) * 0.12)) : (1 - Math.min(0.2, Math.abs(turnRate) * 0.08));

  if (isFore) {
    // FORELEG GAIT PHASING:
    // Alternating stride: Left Foreleg (phase = walkCycle), Right Foreleg (phase = (walkCycle + 0.5) % 1.0)
    const forePhase = (walkCycle + (side < 0 ? 0.0 : 0.5)) % 1.0;

    // FORELEG (Pectoral Girdle Root - Sprawling Outward & Forward)
    const shX = 9.5;
    const shY = side * (isBoss ? 13.0 : 11.0) + chestSwayY;

    const foreGait = computeGaitStride(
      forePhase,
      dutyFactor,
      isMoving,
      isAirborne,
      isBreath,
      isTail,
      isBuffet,
      isRoar,
      attackProgress,
      nowMs,
      side,
      hoverPhase,
      breathPhase,
      true
    );

    const baseForeStride = (isBoss ? 8.2 : 5.8) * turnMod;
    const foreStrideX = baseForeStride * foreGait.strideFrac * relDirX;
    const foreStrideY = baseForeStride * foreGait.strideFrac * relDirY * 0.5;
    const foreSwingLiftX = foreGait.lift * relDirX * 1.2;
    const foreSwingLiftY = side * foreGait.lift * (isBoss ? 1.8 : 1.3);

    const restForeX = isBoss ? 17.5 : 13.5;
    const restForeY = side * (isBoss ? 26.0 : 20.5);
    const foreFootX = restForeX + foreStrideX + foreSwingLiftX;
    const foreFootY = restForeY + foreStrideY + foreSwingLiftY;

    const L1_fore = isBoss ? 9.2 : 7.2;
    const L2_fore = isBoss ? 9.2 : 7.2;
    const { x1: elbowX, y1: elbowY } = solveLimbIK(shX, shY, foreFootX, foreFootY, L1_fore, L2_fore, side);

    const w0_bicep = isBoss ? 4.5 : 3.2;
    const w1_elbow = isBoss ? 3.0 : 2.1;
    const w2_wrist = isBoss ? 1.9 : 1.3;

    // Dark shoulder socket contour
    ctx.fillStyle = scaleShadow;
    ctx.beginPath();
    ctx.arc(shX, shY, w0_bicep * 1.10, 0, Math.PI * 2);
    ctx.fill();

    // Upper Arm (Bicep/Deltoid)
    drawLimbBoneSegment(ctx, shX, shY, elbowX, elbowY, w0_bicep, w1_elbow, cfg, boneHighlight, false);

    // Elbow Cap
    ctx.fillStyle = cfg.scalePrimary;
    ctx.beginPath();
    ctx.arc(elbowX, elbowY, w1_elbow * 1.10, 0, Math.PI * 2);
    ctx.fill();

    // Forearm
    drawLimbBoneSegment(ctx, elbowX, elbowY, foreFootX, foreFootY, w1_elbow, w2_wrist, cfg, boneHighlight, true);

    // Fore Foot & Splayed Predatory Talons
    drawDragonFoot(
      ctx,
      foreFootX,
      foreFootY,
      side,
      foreGait.strideFrac,
      relDirX,
      relDirY,
      foreGait.squash,
      foreGait.splay,
      isBoss,
      cfg,
      clawRootColor,
      clawTipColor,
      true
    );
  } else {
    // HINDLEG GAIT PHASING:
    // Diagonal archosaur cadence: Left Fore + Right Hind, Right Fore + Left Hind
    const hindPhase = (walkCycle + (side < 0 ? 0.5 : 0.0)) % 1.0;

    // HINDLEG (Pelvic Girdle Root - Muscular Hind Quarters)
    const hipX = -10.5;
    const hipY = side * (isBoss ? 12.0 : 9.8) + hipSwayY;

    const hindGait = computeGaitStride(
      hindPhase,
      dutyFactor,
      isMoving,
      isAirborne,
      isBreath,
      isTail,
      isBuffet,
      isRoar,
      attackProgress,
      nowMs,
      side,
      hoverPhase,
      breathPhase,
      false
    );

    const baseHindStride = (isBoss ? 9.2 : 6.6) * turnMod;
    const hindStrideX = baseHindStride * hindGait.strideFrac * relDirX;
    const hindStrideY = baseHindStride * hindGait.strideFrac * relDirY * 0.5;
    const hindSwingLiftX = hindGait.lift * relDirX * 1.2;
    const hindSwingLiftY = side * hindGait.lift * (isBoss ? 1.9 : 1.4);

    // Hind foot rests firmly outward and backward from pelvis
    const restHindX = isBoss ? -20.0 : -15.5;
    const restHindY = side * (isBoss ? 25.0 : 19.5);
    const hindFootX = restHindX + hindStrideX + hindSwingLiftX;
    const hindFootY = restHindY + hindStrideY + hindSwingLiftY;

    const L1_hind = isBoss ? 10.5 : 8.2; // Muscular Femur
    const L2_hind = isBoss ? 10.2 : 8.0; // Tibia/Fibula Shank
    const { x1: kneeX, y1: kneeY } = solveLimbIK(hipX, hipY, hindFootX, hindFootY, L1_hind, L2_hind, side);

    const w0_thigh = isBoss ? 5.6 : 4.0;
    const w1_knee = isBoss ? 3.5 : 2.5;
    const w2_ankle = isBoss ? 2.2 : 1.6;

    // Dark hip socket contour
    ctx.fillStyle = scaleShadow;
    ctx.beginPath();
    ctx.arc(hipX, hipY, w0_thigh * 1.12, 0, Math.PI * 2);
    ctx.fill();

    // Muscular Dinosaurian Thigh (Femur with bulging bicep femoris)
    drawLimbBoneSegment(ctx, hipX, hipY, kneeX, kneeY, w0_thigh, w1_knee, cfg, boneHighlight, true);

    // Knee Cap
    ctx.fillStyle = cfg.scalePrimary;
    ctx.beginPath();
    ctx.arc(kneeX, kneeY, w1_knee * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Armored knee spur pointing outward-backward
    drawJointSpur(ctx, kneeX, kneeY, hipX, hipY, side, isBoss ? 4.5 : 3.2, cfg.hornColor || "#181216", cfg.hornHighlight || "#f59e0b");

    // Shank (Crus / Tibia)
    drawLimbBoneSegment(ctx, kneeX, kneeY, hindFootX, hindFootY, w1_knee, w2_ankle, cfg, boneHighlight, false);

    // Hind Foot with Raptor Talons & Rear Hallux
    drawDragonFoot(
      ctx,
      hindFootX,
      hindFootY,
      side,
      hindGait.strideFrac,
      relDirX,
      relDirY,
      hindGait.squash,
      hindGait.splay,
      isBoss,
      cfg,
      clawRootColor,
      clawTipColor,
      false
    );
  }
}

/**
 * Draws the dragon head, sweeping backward horns, articulated jaw,
 * luminescent slit eyes, sharp nasal crest, and chiseled raptorial snout along the +X axis.
 */
function drawDragonHead(ctx, jawAngle, cfg, nowMs, seed, headYaw = 0, neckTipY = 0) {
  ctx.save();
  ctx.translate(22, neckTipY); // Head anchor at end of neck
  ctx.rotate(headYaw); // Rotates following dragon head sweep
  ctx.scale(1.10, 1.10); // Commanding dragon head presence in proportion to body and limbs

  const isQuad = cfg.isBoss;
  const scaleShadow = cfg.scaleShadow || "#2e0505";

  // 1. MAJESTIC BACKWARD-SWEEPING CROWN HORNS (Sweeping over the neck, razor-sharp stiletto tips)
  // Horns sweep backwards (-X) away from the face, establishing iconic draconic silhouette
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.scale(1, side);
    ctx.lineJoin = "miter";
    ctx.miterLimit = 8;

    // Deep ambient occlusion contour behind the horn base
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.1;

    // Primary Crown Horn: sweeps backward from cranium (-X and outward +Y)
    const hornGrad = ctx.createLinearGradient(0, 6, -34, 18);
    hornGrad.addColorStop(0, "#030407");     // Deep jet black root
    hornGrad.addColorStop(0.30, "#0e1218");  // Polished obsidian shadow
    hornGrad.addColorStop(0.65, "#1c232e");  // Midnight charcoal midtone
    hornGrad.addColorStop(0.90, "#0a0d12");  // Shadow near needle tip
    hornGrad.addColorStop(1, "#020304");     // Stiletto-sharp point

    ctx.beginPath();
    ctx.moveTo(-1, 5.5);
    ctx.bezierCurveTo(-10, 13.5, -22, 17.5, -34, 16.0);
    ctx.lineTo(-40, 17.5); // Sharp needle stiletto tip
    ctx.bezierCurveTo(-26, 12.0, -13, 9.0, -2, 4.0);
    ctx.closePath();
    ctx.fillStyle = hornGrad;
    ctx.fill();

    // Specular dorsal ridge running along the horn
    ctx.strokeStyle = "rgba(148, 163, 184, 0.65)";
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-1, 5.0);
    ctx.bezierCurveTo(-11, 13.0, -23, 16.5, -39.0, 17.5);
    ctx.stroke();

    // Secondary Horns (Temporal/Crest horns) for Colossal Sovereign Boss
    if (isQuad) {
      const secHornGrad = ctx.createLinearGradient(-3, 3, -48, 10);
      secHornGrad.addColorStop(0, "#030406");
      secHornGrad.addColorStop(0.55, "#181e28");
      secHornGrad.addColorStop(1, "#020305");

      ctx.fillStyle = secHornGrad;
      ctx.beginPath();
      ctx.moveTo(-3, 3.5);
      ctx.bezierCurveTo(-14, 8.0, -32, 11.5, -46, 9.5);
      ctx.lineTo(-52, 10.5); // Needle point
      ctx.bezierCurveTo(-34, 7.5, -16, 5.5, -4, 2.5);
      ctx.closePath();
      ctx.fill();
    }

    // Temporal cheek spines (jugal spikes flaring outward-backward)
    ctx.fillStyle = cfg.hornColor || "#05070a";
    ctx.beginPath();
    ctx.moveTo(1, 8.5);
    ctx.lineTo(-7, 14.5); // Sharp cheek thorn
    ctx.lineTo(-3, 8.0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = cfg.hornHighlight || "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 8.5);
    ctx.lineTo(-7, 14.5);
    ctx.stroke();

    // Glowing Ethereal Astral Fissures on Abyssal Void Dragon Horns
    if (cfg.id === "void_drake" || cfg.isVoid) {
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-1, 5.0);
      ctx.bezierCurveTo(-11, 13.0, -23, 16.5, -39.0, 17.5);
      ctx.stroke();

      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-2, 4.5);
      ctx.bezierCurveTo(-10, 12.0, -21, 15.0, -36.0, 16.8);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 2. CHISELED ANGULAR REPTILIAN CRANIUM & RAPTORIAL SNOUT (Non-phallic wedge architecture)
  // Sharp polygonal snout with keeled rostral apex, canine crests, and wide temporal temples
  ctx.beginPath();
  ctx.moveTo(-7, 0);       // Nape connection center
  ctx.lineTo(-6, -8.5);    // Left occipital cranium angle
  ctx.lineTo(2, -11.5);    // Left temporal cheek armor flare
  ctx.lineTo(9, -8.0);     // Left supraorbital brow angle
  ctx.lineTo(16, -5.8);    // Narrowed mid-snout bridge
  ctx.lineTo(20, -5.2);    // Left canine alveolar flare
  ctx.lineTo(23.5, -2.8);  // Left rostral bevel
  ctx.lineTo(26.5, 0);     // Sharp chiseled rostral beak apex (diamond wedge point!)
  ctx.lineTo(23.5, 2.8);   // Right rostral bevel
  ctx.lineTo(20, 5.2);     // Right canine alveolar flare
  ctx.lineTo(16, 5.8);     // Narrowed mid-snout bridge
  ctx.lineTo(9, 8.0);      // Right supraorbital brow angle
  ctx.lineTo(2, 11.5);     // Right temporal cheek armor flare
  ctx.lineTo(-6, 8.5);     // Right occipital cranium angle
  ctx.closePath();

  const headGrad = ctx.createRadialGradient(8, 0, 2, 8, 0, 22);
  headGrad.addColorStop(0, cfg.scaleHighlight);
  headGrad.addColorStop(0.55, cfg.scaleSecondary);
  headGrad.addColorStop(1, cfg.scalePrimary);
  ctx.fillStyle = headGrad;
  ctx.fill();

  // Angular Cranial Armor Plates (Heavy chitinous brow ridges over each eye)
  ctx.fillStyle = cfg.scalePrimary;
  ctx.beginPath();
  // Left brow plate
  ctx.moveTo(4, -10.5);
  ctx.lineTo(12, -7.0);
  ctx.lineTo(7, -4.5);
  ctx.lineTo(2, -7.5);
  ctx.closePath();
  // Right brow plate
  ctx.moveTo(4, 10.5);
  ctx.lineTo(12, 7.0);
  ctx.lineTo(7, 4.5);
  ctx.lineTo(2, 7.5);
  ctx.closePath();
  ctx.fill();

  // Dorsal Nasal Keel Spines along snout centerline (serrated dragon crest)
  const nasalSpines = [
    { x: 13, h: 2.2 },
    { x: 18, h: 2.6 },
    { x: 23, h: 2.0 }
  ];
  ctx.fillStyle = cfg.dorsalSpineColor || cfg.scaleHighlight;
  for (let n = 0; n < nasalSpines.length; n++) {
    const sp = nasalSpines[n];
    ctx.beginPath();
    ctx.moveTo(sp.x - 1.5, 0);
    ctx.lineTo(sp.x, -sp.h * 0.5);
    ctx.lineTo(sp.x + 1.2, 0);
    ctx.lineTo(sp.x, sp.h * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Glowing Reptilian Eyes with Slit Pupils
  const eyeBlink = ((nowMs * 0.0015 + seed) % 4.0) < 0.14;
  const eyeScaleY = eyeBlink ? 0.15 : 1.0;

  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(9, side * 6.2);
    ctx.scale(1, eyeScaleY);

    // Socket Shadow
    ctx.fillStyle = "#0f071b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.6, 2.2, side * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Luminescent Iris
    ctx.fillStyle = cfg.eyeColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.8, 1.6, side * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Slit Pupil
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.8, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular Highlight
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-0.7, -0.5, 0.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 4. Nostril Slits on the lateral snout ridge
  for (let side = -1; side <= 1; side += 2) {
    ctx.save();
    ctx.translate(20.5, side * 3.2);
    ctx.rotate(side * 0.35);

    ctx.fillStyle = "#1c0a0a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.4, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = cfg.breathMid;
    ctx.beginPath();
    ctx.ellipse(0.3, 0, 0.7, 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 5. Articulated Lower Jaw & Ivory Fangs
  ctx.save();
  ctx.translate(0, 0);

  // When jaw opens, reveal fiery throat glow inside the mouth cavity
  if (jawAngle > 0.08) {
    ctx.fillStyle = cfg.breathMid;
    ctx.beginPath();
    ctx.moveTo(14, -2.5);
    ctx.lineTo(22, -1.8);
    ctx.lineTo(24, 0);
    ctx.lineTo(22, 1.8);
    ctx.lineTo(14, 2.5);
    ctx.closePath();
    ctx.fill();
  }

  // Sharp Ivory Teeth along upper and lower snout
  ctx.fillStyle = "#ffffff";
  const teethList = [
    { x: 23, y: -2.6, h: 2.8 },
    { x: 19, y: -3.8, h: 2.5 },
    { x: 15, y: -4.5, h: 2.0 },
    { x: 23, y: 2.6, h: -2.8 },
    { x: 19, y: 3.8, h: -2.5 },
    { x: 15, y: 4.5, h: -2.0 }
  ];
  for (let t = 0; t < teethList.length; t++) {
    const tooth = teethList[t];
    ctx.beginPath();
    ctx.moveTo(tooth.x - 1, tooth.y);
    ctx.lineTo(tooth.x, tooth.y + tooth.h);
    ctx.lineTo(tooth.x + 1, tooth.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 6. Sinuous Ethereal Cosmic Whisker Barbels on Abyssal Void Dragon Chin
  if (cfg.id === "void_drake" || cfg.isVoid) {
    for (let side = -1; side <= 1; side += 2) {
      const wWave = Math.sin(nowMs * 0.007 + side + seed) * 3.5;
      ctx.save();
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(18, side * 3.5);
      ctx.quadraticCurveTo(8, side * 7 + wWave, -2, side * 11 + wWave * 1.5);
      ctx.stroke();

      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(18, side * 3.5);
      ctx.quadraticCurveTo(8, side * 7 + wWave, 2, side * 9 + wWave * 1.2);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Draws the high-fidelity volumetric dragon breath cone attack VFX.
 * Formatted to perfectly match the area attack indicator footprint in origin, radius, and arc.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} originX - Snout origin X in world space
 * @param {number} originY - Snout origin Y in world space
 * @param {number} angle - Facing angle in radians
 * @param {number} radius - Cone radius matching the area attack indicator
 * @param {number} arc - Cone arc spread in radians matching the area attack indicator
 * @param {number} attackProgress - Progress 0.0 to 1.0
 * @param {Object} cfg - Dragon variant configuration
 * @param {number} nowMs - Current timestamp in ms
 * @param {number} seed - Procedural seed
 */
function drawDragonBreathStream(ctx, originX, originY, angle, radius, arc, attackProgress, cfg, nowMs, seed) {
  // Attack Progress Curve:
  // 0.00 - 0.20: Inhale charge & throat furnace ignition
  // 0.20 - 0.38: Explosive surge reaching 100% radius
  // 0.38 - 0.82: Sustained roaring breath at full reach & spread
  // 0.82 - 1.00: Strike confirmation & thermal dissipation
  let intensity = 0;
  let reachRatio = 0;

  if (attackProgress < 0.20) {
    const p = attackProgress / 0.20;
    intensity = p * 0.28;
    reachRatio = 0.06 * p;
  } else if (attackProgress < 0.38) {
    const p = (attackProgress - 0.20) / 0.18;
    intensity = 0.28 + p * 0.72;
    reachRatio = 0.06 + Math.sin(p * Math.PI * 0.5) * 0.94;
  } else if (attackProgress < 0.82) {
    intensity = 1.0;
    reachRatio = 1.0;
  } else {
    const p = (attackProgress - 0.82) / 0.18;
    intensity = Math.max(0, 1.0 - p);
    reachRatio = 1.0;
  }

  if (intensity <= 0.02 || reachRatio <= 0.001) return;

  const isBoss = !!cfg.isBoss;
  const curRadius = radius * reachRatio;
  const halfArc = arc * 0.5;

  const coreColor = cfg.breathCore || "#ffffff";
  const midColor = cfg.breathMid || "#f97316";
  const edgeColor = cfg.breathEdge || "#dc2626";
  const emberPalette = cfg.emberColors || [coreColor, midColor, edgeColor];

  const type = (cfg.id || "").toLowerCase();
  const isFrost = type.includes("frost") || type.includes("wyrm");
  const isVoid = type.includes("void") || type.includes("abyss");
  const isEmerald = type.includes("emerald") || type.includes("toxic");

  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angle);

  // 1. GROUND SCORCH & AMBIENT ELEMENTAL FOOTPRINT
  // Soft glowing projection matching the exact cone sector
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, curRadius, -halfArc, halfArc);
  ctx.closePath();
  const groundGrad = ctx.createRadialGradient(0, 0, Math.max(1, curRadius * 0.05), 0, 0, curRadius);
  groundGrad.addColorStop(0, midColor);
  groundGrad.addColorStop(0.65, edgeColor);
  groundGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = groundGrad;
  ctx.globalAlpha = intensity * 0.36;
  ctx.fill();

  // 2. VOLUMETRIC BILLOWING FLAME / ELEMENTAL ENVELOPE
  // Sinuous outer gas billows kissing the exact sector boundaries
  ctx.beginPath();
  ctx.moveTo(0, 0);

  const edgeSteps = 16;
  // Left radial flank (angle = -halfArc)
  for (let i = 1; i <= edgeSteps; i++) {
    const t = i / edgeSteps;
    const d = curRadius * t;
    const wave = Math.sin(nowMs * 0.018 - t * 10 + seed) * (t * 7.5 * intensity);
    const a = -halfArc + (wave / (d + 20));
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }

  // Outer circular arc cap (angle: -halfArc to +halfArc)
  const capSteps = 24;
  for (let j = 0; j <= capSteps; j++) {
    const t = j / capSteps;
    const baseA = -halfArc + arc * t;
    const wave = Math.sin(nowMs * 0.015 + j * 1.3 + seed * 2) * (4.5 * intensity);
    const d = curRadius + wave;
    ctx.lineTo(Math.cos(baseA) * d, Math.sin(baseA) * d);
  }

  // Right radial flank (angle = +halfArc back to 0)
  for (let i = edgeSteps; i >= 1; i--) {
    const t = i / edgeSteps;
    const d = curRadius * t;
    const wave = Math.cos(nowMs * 0.018 - t * 9 + seed * 3) * (t * 7.5 * intensity);
    const a = halfArc + (wave / (d + 20));
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();

  const plumeGrad = ctx.createRadialGradient(0, 0, curRadius * 0.05, 0, 0, curRadius);
  plumeGrad.addColorStop(0, "#ffffff");
  plumeGrad.addColorStop(0.18, coreColor);
  plumeGrad.addColorStop(0.50, midColor);
  plumeGrad.addColorStop(0.85, edgeColor);
  plumeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = plumeGrad;
  ctx.globalAlpha = intensity * 0.88;
  ctx.fill();

  // 3. SEVEN SINUOUS PLASMA VORTICES & BRAIDED ENERGY STRANDS
  // Churning turbulent ribbon streams fanning across the sector
  const strandCount = 7;
  for (let s = 0; s < strandCount; s++) {
    const frac = (s / (strandCount - 1)) - 0.5; // -0.5 to +0.5
    const strandAngle = frac * (arc * 0.84);
    ctx.beginPath();
    ctx.moveTo(0, 0);

    const steps = 14;
    for (let st = 1; st <= steps; st++) {
      const t = st / steps;
      const d = curRadius * t;
      const swirl = Math.sin(nowMs * 0.024 - t * 9 + s * 1.35 + seed) * (t * 11 * intensity);
      const a = strandAngle + swirl / (d + 18);
      ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }

    ctx.strokeStyle = (s % 2 === 0) ? midColor : coreColor;
    ctx.lineWidth = Math.max(1.2, (1 - Math.abs(frac) * 0.45) * 4.2 * intensity);
    ctx.globalAlpha = intensity * 0.72;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // 4. INCANDESCENT HIGH-VELOCITY CORE BEAM JETS
  // Piercing solar-hot plasma lance through the center axis
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const coreAngle = halfArc * 0.35;
  ctx.lineTo(Math.cos(-coreAngle) * (curRadius * 0.72), Math.sin(-coreAngle) * (curRadius * 0.72));
  ctx.lineTo(curRadius * 0.90, 0);
  ctx.lineTo(Math.cos(coreAngle) * (curRadius * 0.72), Math.sin(coreAngle) * (curRadius * 0.72));
  ctx.closePath();

  const coreGrad = ctx.createRadialGradient(0, 0, 3, 0, 0, curRadius * 0.85);
  coreGrad.addColorStop(0, "#ffffff");
  coreGrad.addColorStop(0.32, coreColor);
  coreGrad.addColorStop(0.78, midColor);
  coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = coreGrad;
  ctx.globalAlpha = intensity * 0.94;
  ctx.fill();

  // 5. PULSING CONCUSSIVE THERMAL SHOCKWAVE ARCS
  // Wavefronts propagating forward through the breath stream
  const waveCount = isBoss ? 3 : 2;
  for (let w = 0; w < waveCount; w++) {
    const waveProgress = ((nowMs * 0.0032 + w * (1 / waveCount) + seed * 0.1) % 1.0);
    const waveR = curRadius * waveProgress;
    const waveAlpha = Math.sin(waveProgress * Math.PI) * intensity * (isBoss ? 0.75 : 0.55);

    if (waveR > 6 && waveAlpha > 0.02) {
      ctx.beginPath();
      ctx.arc(0, 0, waveR, -halfArc * 0.92, halfArc * 0.92);
      ctx.strokeStyle = coreColor;
      ctx.lineWidth = 1.8 * (1 - waveProgress * 0.5);
      ctx.globalAlpha = waveAlpha;
      ctx.stroke();
    }
  }

  // 6. SWIRLING ELEMENTAL MOTES, SPARK EMBERS & ICE SHARDS
  // Procedural flying embers fanning radially across the cone
  const moteCount = isBoss ? 32 : 22;
  for (let m = 0; m < moteCount; m++) {
    const mAngleFrac = (((m * 17.3 + seed * 7.1) % 100) / 100) - 0.5;
    const mAngle = mAngleFrac * (arc * 0.90);
    const mSpeed = 0.8 + ((m * 13) % 7) * 0.07;
    const mProg = ((nowMs * 0.0035 * mSpeed + m * 0.19 + seed * 0.1) % 1.0);
    const mDist = mProg * curRadius;
    const mFlutter = Math.sin(nowMs * 0.025 + m * 2.2) * (5 * (1 - mProg));
    const mx = Math.cos(mAngle) * mDist - Math.sin(mAngle) * mFlutter;
    const my = Math.sin(mAngle) * mDist + Math.cos(mAngle) * mFlutter;
    const mSize = (1.5 + (m % 3) * 1.4) * (1 - mProg * 0.6);
    const mAlpha = Math.sin(mProg * Math.PI) * intensity;

    ctx.fillStyle = emberPalette[m % emberPalette.length];
    ctx.globalAlpha = mAlpha;
    ctx.beginPath();
    if (isFrost) {
      ctx.moveTo(mx, my - mSize * 1.3);
      ctx.lineTo(mx + mSize, my);
      ctx.lineTo(mx, my + mSize * 1.3);
      ctx.lineTo(mx - mSize, my);
      ctx.closePath();
    } else {
      ctx.arc(mx, my, mSize, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  ctx.restore();

  // Continuous live particle emission for extra punch
  if (typeof window !== "undefined" && typeof window.spawnParticle === "function" && Math.random() < 0.45 * intensity) {
    const pAngle = angle - halfArc * 0.75 + Math.random() * arc * 0.75;
    const pSpeed = (160 + Math.random() * 220) * reachRatio;
    window.spawnParticle({
      x: originX + Math.cos(angle) * 8 + (Math.random() - 0.5) * 6,
      y: originY + Math.sin(angle) * 8 + (Math.random() - 0.5) * 6,
      vx: Math.cos(pAngle) * pSpeed,
      vy: Math.sin(pAngle) * pSpeed,
      color: emberPalette,
      size: 2.2 + Math.random() * 3.5,
      maxLife: 0.55 + Math.random() * 0.45,
      drag: 0.96,
      gravity: isFrost ? 15 : -15,
      shrink: true,
      style: isFrost ? "diamond" : "circle"
    });
  }
}

/**
 * Procedural Lineless Dragon Master Entity Renderer
 *
 * All dragon anatomy is constructed in a robust, cohesive coordinate space
 * aligned with facingAngle, ensuring perfect proportions at every angle.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Target X coordinate
 * @param {number} y - Target Y coordinate
 * @param {Object} ent - Entity state object
 * @param {boolean} isShadowPass - Shadow pass flag (strictly prohibits solid ground shadows)
 */
export function drawDragonEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};

  const type = (ent.type || "dragon").toLowerCase();
  const cfg = resolveDragonConfig(type);
  const isBoss = !!cfg.isBoss;
  const facingAngle = (typeof ent.facingAngle === "number" && !isNaN(ent.facingAngle)) ? ent.facingAngle : 0;
  const isMoving = !!(ent.moving || ent.isMoving);
  const isSlowed = !!ent.isSlowed;

  if (ent._seed === undefined) {
    const id = ent.id || ("dragon_" + Math.round(x) + "_" + Math.round(y));
    ent._seed = typeof computeFastSeed === "function" ? computeFastSeed(id) : 42;
  }
  const seed = ent._seed;
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  // Attack State Calculation
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  let attackProgress = 0;
  if (ent.currentCast && ent.currentCast.duration > 0) {
    const elapsed = Math.max(0, nowMs - (ent.currentCast.startTime || nowMs));
    attackProgress = Math.min(1, elapsed / ent.currentCast.duration);
    isAttacking = true;
  } else if (isAttacking) {
    const animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
    const dur = (ent.attackDuration && ent.attackDuration > 0) ? ent.attackDuration : 650;
    attackProgress = Math.min(1, (nowMs - animStart) / dur);
    if (attackProgress >= 1) isAttacking = false;
  }

  // Continuous studio preview
  if (!isAttacking && (ent.showZonePreview || ent.loopZonePreview)) {
    isAttacking = true;
    attackProgress = ((nowMs * 0.00085 + seed * 0.1) % 1);
  }

  // Hit Flash
  let isFlashing = false;
  let flashAmt = 0;
  if (ent.lastHitTime && nowMs - ent.lastHitTime < 160) {
    isFlashing = true;
    flashAmt = Math.max(0, 1 - (nowMs - ent.lastHitTime) / 160);
  }

  // Attack Modality: breath, tail_swipe, wing_buffet, roar
  const attackMode = ent.dragonAttackType || ent.attackType || "breath";
  const isBreathAtk = attackMode === "breath" || attackMode === "flame";
  const isTailAtk = attackMode === "tail_swipe" || attackMode === "swipe";
  const isBuffetAtk = attackMode === "wing_buffet" || attackMode === "buffet";
  const isRoarAtk = attackMode === "roar" || attackMode === "dragon_roar";

  // Compute synchronized dragon breath parameters & head kinematics
  const breathParams = getDragonBreathAreaParams(ent, x, y, facingAngle, cfg, nowMs);

  // Multimodal Kinematic Rhythm & Locomotion State
  const speedMult = isSlowed ? 0.45 : 1.0;
  const isAirborne = !!(ent.isFlying || ent.isAirborne || ent.flightMode);

  // Velocity & Direction
  let moveAngle = facingAngle;
  let moveSpeed = 0;
  if (typeof ent.vx === "number" && typeof ent.vy === "number" && (ent.vx !== 0 || ent.vy !== 0)) {
    // Bolt Opt: Math.hypot Function Call Elimination - Replaced Math.hypot(a, b) with Math.sqrt(a*a + b*b) to eliminate V8 overhead in hot render loop.
    moveSpeed = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
    if (moveSpeed > 0.1) {
      moveAngle = Math.atan2(ent.vy, ent.vx);
    }
  } else if (typeof ent.moveAngle === "number") {
    moveAngle = ent.moveAngle;
    moveSpeed = (typeof ent.speed === "number" && ent.speed > 5) ? ent.speed : (isSlowed ? 45 : 90);
  } else if (isMoving) {
    moveAngle = facingAngle;
    moveSpeed = (typeof ent.speed === "number" && ent.speed > 5) ? ent.speed : (isSlowed ? 45 : 90);
  }

  // Relative movement angle in dragon's local coordinate frame
  let relAngle = moveAngle - facingAngle;
  while (relAngle > Math.PI) relAngle -= Math.PI * 2;
  while (relAngle < -Math.PI) relAngle += Math.PI * 2;

  const relDirX = isMoving ? Math.cos(relAngle) : 1; // forward (+1) or backward (-1)
  const relDirY = isMoving ? Math.sin(relAngle) : 0; // right (+1) or left (-1)

  // Turn rate detection
  if (ent._lastFacing === undefined) {
    ent._lastFacing = facingAngle;
    ent._turnRate = 0;
    ent._lastTurnMs = nowMs;
  }
  let dAngle = facingAngle - ent._lastFacing;
  while (dAngle > Math.PI) dAngle -= Math.PI * 2;
  while (dAngle < -Math.PI) dAngle += Math.PI * 2;
  const dtTurn = Math.max(0.001, Math.min(0.1, (nowMs - (ent._lastTurnMs || nowMs)) / 1000));
  ent._lastTurnMs = nowMs;
  ent._lastFacing = facingAngle;
  ent._turnRate = (ent._turnRate || 0) * 0.8 + (dAngle / dtTurn) * 0.2;
  const turnRate = ent._turnRate;

  // Walk cycle accumulation (continuous non-slipping phase with robust continuous-time fallback)
  const baseCadence = 1.15; // Crisp, responsive stride frequency
  const speedFactor = (moveSpeed > 0 ? (moveSpeed / 90) : 1.0) * speedMult;
  let walkCycle;
  const dtWalk = (ent._lastWalkMs !== undefined && nowMs > ent._lastWalkMs)
    ? Math.max(0.001, Math.min(0.1, (nowMs - ent._lastWalkMs) / 1000))
    : 0.016;
  ent._lastWalkMs = nowMs;

  if (typeof ent.walkCycle === "number") {
    walkCycle = ((ent.walkCycle % 1.0) + 1.0) % 1.0;
  } else if (isMoving) {
    if (ent._walkCycle !== undefined) {
      ent._walkCycle = (ent._walkCycle + dtWalk * baseCadence * speedFactor) % 1.0;
      walkCycle = ent._walkCycle;
    } else {
      walkCycle = ((nowMs * 0.001 * baseCadence * speedFactor + (seed * 19.3)) % 1.0 + 1.0) % 1.0;
      ent._walkCycle = walkCycle;
    }
  } else if (Math.abs(turnRate) > 0.25) {
    if (ent._walkCycle !== undefined) {
      ent._walkCycle = (ent._walkCycle + dtWalk * Math.min(2.0, Math.abs(turnRate) * 0.4)) % 1.0;
      walkCycle = ent._walkCycle;
    } else {
      walkCycle = ((nowMs * 0.0005 + (seed * 19.3)) % 1.0 + 1.0) % 1.0;
      ent._walkCycle = walkCycle;
    }
  } else {
    walkCycle = ent._walkCycle !== undefined ? ent._walkCycle : ((seed * 19.3) % 1.0);
  }

  const spineSway = (!isAirborne && isMoving) ? Math.sin(walkCycle * Math.PI * 2) * 2.2 : 0;
  const chestSwayY = spineSway * 0.65;
  const hipSwayY = -spineSway * 0.90;

  const gaitInfo = {
    walkCycle,
    relAngle,
    relDirX,
    relDirY,
    moveSpeed,
    isAirborne,
    turnRate,
    isMoving,
    speedMult,
    spineSway,
    chestSwayY,
    hipSwayY,
    dutyFactor: 0.58
  };

  const hoverBob = breathParams.hoverBob;
  const breathPulse = Math.sin(nowMs * 0.005 * speedMult + seed * 2) * 1.5;
  const wingFlapBase = Math.sin(nowMs * 0.006 * speedMult + seed) * 0.42;
  const tailWavePhase = nowMs * 0.0055 * speedMult + seed;

  // Lunge & Jaw Dynamics during attacks
  let attackLungeDist = 0;
  let jawAngle = 0.05;
  let wingFlap = wingFlapBase;
  let swipeKick = 0;
  let headYaw = breathParams.headYaw;
  let neckTipY = breathParams.neckTipY;

  if (isAttacking) {
    if (isBreathAtk || isRoarAtk) {
      attackLungeDist = breathParams.attackLungeDist;
      if (attackProgress < 0.28) {
        jawAngle = 0.1 + (attackProgress / 0.28) * 0.35;
      } else if (attackProgress < 0.72) {
        const p = (attackProgress - 0.28) / 0.44;
        jawAngle = 0.5 + Math.sin(p * Math.PI) * 0.2;
      } else {
        const p = (attackProgress - 0.72) / 0.28;
        jawAngle = Math.max(0.05, 0.5 * (1 - p));
      }
    } else if (isBuffetAtk) {
      if (attackProgress < 0.20) {
        // Windup: wings cock backward and upward, gathering air
        const p = attackProgress / 0.20;
        wingFlap = -0.70 * p;
        attackLungeDist = -6 * p;
      } else if (attackProgress < 0.82) {
        // Concussive forward buffeting beats
        const p = (attackProgress - 0.20) / 0.62;
        wingFlap = Math.sin(p * Math.PI * 4) * 1.15;
        attackLungeDist = 12 * Math.sin(p * Math.PI);
      } else {
        wingFlap = wingFlapBase;
      }
    } else if (isTailAtk) {
      swipeKick = Math.sin(attackProgress * Math.PI) * 1.5;
    }
  } else if (!isAirborne && isMoving) {
    // Grounded stalking wing posture: folded back in aerodynamic poise, subtly counterbalancing steps
    wingFlap = 0.12 + Math.sin(walkCycle * Math.PI * 2) * 0.06;
  }

  // Draw Ground Attack Warning Zone during attack windup
  const showZone = ent.showAttackZone !== false && ent.showZone !== false;
  if (isAttacking && showZone) {
    drawEntityAttackArea(ctx, ent, x, y);
  }

  // Ambient ember particles drifting from nostrils/maw
  if (typeof spawnParticle === "function" && Math.random() < 0.18) {
    const snoutDist = cfg.scale * 46;
    const emitX = x + Math.cos(facingAngle) * snoutDist;
    const emitY = y + Math.sin(facingAngle) * snoutDist;
    spawnParticle({
      x: emitX + (Math.random() - 0.5) * 6,
      y: emitY + (Math.random() - 0.5) * 6,
      vx: Math.cos(facingAngle) * (20 + Math.random() * 30) + (Math.random() - 0.5) * 15,
      vy: Math.sin(facingAngle) * (20 + Math.random() * 30) - 15 - Math.random() * 20,
      color: cfg.emberColors,
      size: 1.5 + Math.random() * 2.5,
      maxLife: 0.85 + Math.random() * 0.5,
      drag: 0.95,
      gravity: -10,
      shrink: true,
      style: "circle"
    });
  }

  ctx.save();
  // Translate to entity center in world space
  ctx.translate(x, y);
  // Rotate completely into dragon's forward facing coordinate frame
  ctx.rotate(facingAngle);
  // Apply attack lunge forward along the local X axis and hover altitude in airborne mode
  ctx.translate(attackLungeDist, isAirborne ? hoverBob : 0);
  ctx.scale(cfg.scale, cfg.scale);

  if (isFlashing) {
    ctx.filter = `brightness(${1 + flashAmt * 1.5}) contrast(${1 + flashAmt * 0.5})`;
  }

  // -------------------------------------------------------------
  // 1. THERMAL / ELEMENTAL AURA (Volumetric, No Solid Shadow)
  // -------------------------------------------------------------
  const auraRadius = 48 + breathPulse * 3;
  const auraGrad = safeCreateRadialGradient(ctx, 0, 0, 8, 0, 0, auraRadius);
  if (auraGrad) {
    auraGrad.addColorStop(0, cfg.auraGlow);
    auraGrad.addColorStop(0.65, "rgba(0, 0, 0, 0.08)");
    auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------
  // 2. ARTICULATED DRACONIC LIMBS (Hindlegs & Forelegs - Quadruped Stance)
  // Two-bone inverse kinematics, archosaurian diagonal cadence, and predatory talons
  // -------------------------------------------------------------
  // Hindlimbs rendered first (anchored to pelvic girdle)
  drawDragonLimbs(ctx, -1, cfg, nowMs, seed, isMoving, isAttacking, attackMode, attackProgress, wingFlap, speedMult, gaitInfo, false);
  drawDragonLimbs(ctx, 1, cfg, nowMs, seed, isMoving, isAttacking, attackMode, attackProgress, wingFlap, speedMult, gaitInfo, false);

  // Forelimbs rendered (anchored to pectoral shoulder girdle)
  drawDragonLimbs(ctx, -1, cfg, nowMs, seed, isMoving, isAttacking, attackMode, attackProgress, wingFlap, speedMult, gaitInfo, true);
  drawDragonLimbs(ctx, 1, cfg, nowMs, seed, isMoving, isAttacking, attackMode, attackProgress, wingFlap, speedMult, gaitInfo, true);

  // -------------------------------------------------------------
  // 3. UNIFIED DRAGON BODY & SINUOUS TAIL
  // Torso and tail integrated into a single continuous anatomical envelope
  // with seamless flank contouring, shared longitudinal gradient, and unbroken dorsal spine highlight
  // -------------------------------------------------------------
  const pelvicWidth = isBoss ? 26 : 22;
  const tailNodes = getDragonTailNodes(
    tailWavePhase + spineSway * 0.35,
    swipeKick,
    -13,
    hipSwayY,
    Math.PI,
    pelvicWidth
  );

  const leftPts = [];
  const rightPts = [];
  for (let i = 0; i < tailNodes.length; i++) {
    const n = tailNodes[i];
    const halfW = n.w * 0.5;
    const nx = -Math.sin(n.angle) * halfW;
    const ny = Math.cos(n.angle) * halfW;
    leftPts.push({ x: n.x + nx, y: n.y + ny });
    rightPts.push({ x: n.x - nx, y: n.y - ny });
  }

  ctx.save();
  // Continuous anatomical envelope integrating torso and tail into a single seamless surface
  ctx.beginPath();
  ctx.moveTo(12, chestSwayY);

  // Left flank: Anterior Chest -> Thoracic Ribcage -> Inguinal Waist -> Pelvic Flank
  ctx.quadraticCurveTo(8, -16.0 + chestSwayY * 0.7, -2, -11.0 + hipSwayY * 0.4);
  ctx.quadraticCurveTo(-8, -14.0 + hipSwayY * 0.8, leftPts[0].x, leftPts[0].y);

  // Left lateral margin of tail: Pelvis smoothly continuing to tail tip
  for (let i = 1; i < leftPts.length; i++) {
    const prev = leftPts[i - 1];
    const curr = leftPts[i];
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) * 0.5, (prev.y + curr.y) * 0.5);
  }

  // Smooth tapered tail tip
  const lastNode = tailNodes[tailNodes.length - 1];
  ctx.lineTo(lastNode.x, lastNode.y);

  // Right lateral margin of tail: Tail tip smoothly continuing back to pelvis
  for (let i = rightPts.length - 1; i >= 1; i--) {
    const curr = rightPts[i];
    const prev = rightPts[i - 1];
    ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + prev.x) * 0.5, (curr.y + prev.y) * 0.5);
  }
  ctx.lineTo(rightPts[0].x, rightPts[0].y);

  // Right flank: Pelvic Flank -> Inguinal Waist -> Thoracic Ribcage -> Anterior Chest
  ctx.quadraticCurveTo(-8, 14.0 + hipSwayY * 0.8, -2, 11.0 + hipSwayY * 0.4);
  ctx.quadraticCurveTo(8, 16.0 + chestSwayY * 0.7, 12, chestSwayY);
  ctx.closePath();

  // Continuous longitudinal scale gradient flowing across the unified body and tail
  const bodyGrad = ctx.createLinearGradient(12, chestSwayY, lastNode.x, lastNode.y);
  bodyGrad.addColorStop(0, cfg.scaleSecondary);
  bodyGrad.addColorStop(0.12, cfg.scaleHighlight);
  bodyGrad.addColorStop(0.30, cfg.scaleSecondary);
  bodyGrad.addColorStop(0.65, cfg.scalePrimary);
  bodyGrad.addColorStop(1, cfg.scalePrimary);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Volumetric thoracic highlight overlay (soft lineless 3D ribcage curve)
  const bodyMidY = (chestSwayY + hipSwayY) * 0.5;
  const torsoVol = ctx.createRadialGradient(2, bodyMidY, 2, 0, bodyMidY, 19);
  torsoVol.addColorStop(0, cfg.scaleHighlight);
  torsoVol.addColorStop(0.55, cfg.scaleSecondary);
  torsoVol.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = torsoVol;
  ctx.fill();

  // Segmented Ventral Belly Plates (Angular chevron gastrosteges undulating across torso)
  const plateCount = 7;
  for (let p = 0; p < plateCount; p++) {
    const tPlate = p / (plateCount - 1);
    let px, py, pw, ph;
    if (tPlate < 0.25) {
      const tn = tailNodes[1];
      px = tn.x;
      py = tn.y;
      pw = 3.6;
      ph = 5.2;
    } else {
      const torsoT = (tPlate - 0.25) / 0.75;
      px = -12 + torsoT * 22;
      py = hipSwayY * (1 - torsoT) + chestSwayY * torsoT;
      pw = 4.4;
      ph = 7.6 - Math.abs(torsoT - 0.5) * 2.4;
    }

    ctx.save();
    ctx.translate(px, py);
    // Angular chevron plate (wide V-notch)
    ctx.beginPath();
    ctx.moveTo(-pw * 0.5, -ph * 0.45);
    ctx.lineTo(pw * 0.5, 0); // V-apex
    ctx.lineTo(-pw * 0.5, ph * 0.45);
    ctx.lineTo(-pw * 0.35, 0);
    ctx.closePath();

    const bellyGrad = ctx.createLinearGradient(0, -ph * 0.5, 0, ph * 0.5);
    bellyGrad.addColorStop(0, cfg.bellySecondary);
    bellyGrad.addColorStop(0.5, cfg.bellyPrimary);
    bellyGrad.addColorStop(1, cfg.scalePrimary);
    ctx.fillStyle = bellyGrad;
    ctx.fill();

    // Plate highlight line
    ctx.strokeStyle = cfg.dorsalSpineHighlight || "#ffffff";
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-pw * 0.5, -ph * 0.45);
    ctx.lineTo(pw * 0.5, 0);
    ctx.lineTo(-pw * 0.5, ph * 0.45);
    ctx.stroke();

    ctx.restore();
  }

  // Abyssal Singularity Core on Torso (Black Hole Accretion Disc)
  if (cfg.id === "void_drake" || cfg.isVoid) {
    ctx.save();
    const coreX = 4;
    const coreY = chestSwayY * 0.85;
    ctx.translate(coreX, coreY);

    // Accretion halo
    const pulseAccr = 0.85 + Math.sin(nowMs * 0.005 + seed) * 0.15;
    const accrGrad = ctx.createRadialGradient(0, 0, 1.2, 0, 0, 7.5 * pulseAccr);
    accrGrad.addColorStop(0, "#00f0ff");
    accrGrad.addColorStop(0.35, "#d946ef");
    accrGrad.addColorStop(0.7, "rgba(46, 16, 101, 0.45)");
    accrGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = accrGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5 * pulseAccr, 0, Math.PI * 2);
    ctx.fill();

    // Event horizon (Collapsed Singularity)
    ctx.fillStyle = "#030107";
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Luminous photon ring rim
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 3.3, 0, Math.PI * 2);
    ctx.stroke();

    // Orbiting micro gravitational motes
    for (let gm = 0; gm < 3; gm++) {
      const gAngle = nowMs * 0.006 + gm * (Math.PI * 2 / 3);
      const gx = Math.cos(gAngle) * 5.2;
      const gy = Math.sin(gAngle) * 2.8;
      ctx.fillStyle = (gm === 0) ? "#00f0ff" : "#e879f9";
      ctx.beginPath();
      ctx.arc(gx, gy, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Dorsal Spine Vertebrae Points
  const spinePoints = [
    { x: 11, y: chestSwayY },
    { x: 4, y: chestSwayY * 0.7 + hipSwayY * 0.3 },
    { x: -3, y: chestSwayY * 0.3 + hipSwayY * 0.7 },
    ...tailNodes
  ];

  ctx.beginPath();
  ctx.moveTo(spinePoints[0].x, spinePoints[0].y);
  for (let i = 1; i < spinePoints.length; i++) {
    ctx.lineTo(spinePoints[i].x, spinePoints[i].y);
  }
  ctx.strokeStyle = cfg.scaleHighlight;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.stroke();

  // Serrated Triangular Dorsal Spines along spine and tail
  drawDragonDorsalSpines(ctx, spinePoints, cfg, isBoss ? 5.2 : 3.8);

  // Barbed Arrowhead Tail Spade / Fluke
  drawDragonTailSpade(ctx, lastNode, cfg);

  // Sculpted Scapular Shoulder Armor Plates (Wing Root Girdle)
  for (let s = -1; s <= 1; s += 2) {
    const sX = 2;
    const sY = s * 13.0 + chestSwayY * 0.85;
    ctx.save();
    ctx.translate(sX, sY);

    // Layered angular scapular scute
    ctx.beginPath();
    ctx.moveTo(-6, -s * 2);
    ctx.lineTo(0, -s * (isBoss ? 8.5 : 6.8));
    ctx.lineTo(isBoss ? 9.5 : 7.5, 0);
    ctx.lineTo(2, s * (isBoss ? 7.5 : 5.8));
    ctx.lineTo(-4, s * 2);
    ctx.closePath();

    const moundGrad = ctx.createLinearGradient(-4, -s * 6, 6, s * 6);
    moundGrad.addColorStop(0, cfg.scaleHighlight);
    moundGrad.addColorStop(0.5, cfg.scaleSecondary);
    moundGrad.addColorStop(1, cfg.scalePrimary);
    ctx.fillStyle = moundGrad;
    ctx.fill();

    // Specular ridge along scapular plate
    ctx.strokeStyle = cfg.scaleHighlight;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(isBoss ? 9.0 : 7.0, 0);
    ctx.stroke();

    ctx.restore();
  }
  ctx.restore();

  // -------------------------------------------------------------
  // 5. ARTICULATED DRACONIC WINGS (Left & Right - Symmetrical Outward Expansion)
  // -------------------------------------------------------------
  const leftWingFlap = wingFlap + Math.sin(nowMs * 0.007 * speedMult + seed + 0.35) * 0.035;
  const rightWingFlap = wingFlap + Math.sin(nowMs * 0.007 * speedMult + seed - 0.35) * 0.035;
  drawDragonWing(ctx, -1, leftWingFlap, cfg, nowMs, seed, isAttacking, attackMode, attackProgress, chestSwayY);
  drawDragonWing(ctx, 1, rightWingFlap, cfg, nowMs, seed, isAttacking, attackMode, attackProgress, chestSwayY);

  // -------------------------------------------------------------
  // 6. MUSCULAR ARCHED NECK & DORSAL NAPE CREST
  // Connects undulating torso (+10, chestSwayY) to cranium (+22, neckTipY)
  // -------------------------------------------------------------
  ctx.beginPath();
  ctx.moveTo(10, -6.5 + chestSwayY);
  ctx.quadraticCurveTo(16, -5.5 + (neckTipY + chestSwayY) * 0.5, 22, -4.8 + neckTipY);
  ctx.lineTo(22, 4.8 + neckTipY);
  ctx.quadraticCurveTo(16, 5.5 + (neckTipY + chestSwayY) * 0.5, 10, 6.5 + chestSwayY);
  ctx.closePath();
  const neckGrad = ctx.createLinearGradient(10, chestSwayY, 22, neckTipY);
  neckGrad.addColorStop(0, cfg.scalePrimary);
  neckGrad.addColorStop(0.5, cfg.scaleSecondary);
  neckGrad.addColorStop(1, cfg.scaleHighlight);
  ctx.fillStyle = neckGrad;
  ctx.fill();

  // Arched Neck Dorsal Spines along the nape (breaks cylinder into jagged reptile crest)
  const neckNodes = [
    { x: 10.5, y: chestSwayY },
    { x: 14.0, y: chestSwayY * 0.65 + neckTipY * 0.35 },
    { x: 18.0, y: chestSwayY * 0.35 + neckTipY * 0.65 },
    { x: 21.5, y: neckTipY }
  ];
  drawDragonDorsalSpines(ctx, neckNodes, cfg, isBoss ? 4.8 : 3.5);

  // -------------------------------------------------------------
  // 7. DRAGON HEAD, HORNS, EYES & ARTICULATED JAW (Follows Head Yaw)
  // -------------------------------------------------------------
  drawDragonHead(ctx, jawAngle, cfg, nowMs, seed, headYaw - chestSwayY * 0.04, neckTipY);

  // Sonic Roar Shockwave Ring
  if (isAttacking && isRoarAtk) {
    const roarRadius = 25 + attackProgress * 75;
    const roarAlpha = Math.max(0, 1 - attackProgress);
    ctx.save();
    ctx.strokeStyle = cfg.breathMid;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = roarAlpha * 0.75;
    ctx.beginPath();
    ctx.arc(36, 0, roarRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(36, 0, roarRadius * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // -------------------------------------------------------------
  // 8. BREATH ATTACK CONE VFX STREAM (Matches & Follows Dragon's Head)
  // -------------------------------------------------------------
  if (isAttacking && isBreathAtk) {
    drawDragonBreathStream(
      ctx,
      breathParams.originX,
      breathParams.originY,
      breathParams.angle,
      breathParams.radius,
      breathParams.arc,
      attackProgress,
      cfg,
      nowMs,
      seed
    );
  }
}

// --- Family: Frost Elemental ---
// frostElementals.js - Procedural Lineless Frost Elemental & Glacial Entity Renderer


/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * Monsters must never have baked-in dark circular shapes emulating ground shadows.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

// Visual archetypes for the Frost Elemental family
export const FROST_ELEMENTAL_VARIANTS = Object.freeze({
  frost_wisp: {
    id: "frost_wisp",
    label: "Frost Wisp (Cute Snowsand Sprite)",
    scale: 1.15,
    coreRadius: 15,
    orbitCount: 3,
    ringCount: 0,
    hasHands: true,
    hasCrown: false,
    hasShield: false,
    hasFists: false,
    isBoss: false,
    isSnowsandWisp: true,
    primaryColor: "#38bdf8",
    secondaryColor: "#0284c7",
    glowColor: "rgba(56, 189, 248, 0.40)",
    coreLight: "#ffffff"
  },
  frost_elemental: {
    id: "frost_elemental",
    label: "Glacial Elemental (Faceted Ice Core)",
    scale: 1.15,
    coreRadius: 18,
    orbitCount: 5,
    ringCount: 1,
    hasHands: true,
    hasCrown: true,
    hasShield: false,
    hasFists: false,
    isBoss: false,
    primaryColor: "#0284c7",
    secondaryColor: "#0369a1",
    glowColor: "rgba(56, 189, 248, 0.52)",
    coreLight: "#ffffff"
  },
  frost_tempest: {
    id: "frost_tempest",
    label: "Frost Tempest (Blizzard Vortex)",
    scale: 1.25,
    coreRadius: 19,
    orbitCount: 6,
    ringCount: 2,
    hasHands: true,
    hasCrown: true,
    hasShield: false,
    hasFists: false,
    isVortex: true,
    isBoss: false,
    primaryColor: "#0284c7",
    secondaryColor: "#075985",
    glowColor: "rgba(125, 211, 252, 0.55)",
    coreLight: "#e0f2fe"
  },
  cryo_warden: {
    id: "cryo_warden",
    label: "Cryo Warden (Permafrost Monolith)",
    scale: 1.35,
    coreRadius: 22,
    orbitCount: 4,
    ringCount: 1,
    hasHands: true,
    hasCrown: true,
    hasShield: true,
    hasFists: false,
    isBoss: false,
    primaryColor: "#0369a1",
    secondaryColor: "#0c4a6e",
    glowColor: "rgba(56, 189, 248, 0.58)",
    coreLight: "#ffffff"
  },
  glacial_colossus: {
    id: "glacial_colossus",
    label: "Glacial Colossus (Ice Titan Golem)",
    scale: 1.6,
    coreRadius: 28,
    orbitCount: 6,
    ringCount: 2,
    hasHands: false,
    hasCrown: true,
    hasShield: false,
    hasFists: true,
    isBoss: false,
    primaryColor: "#075985",
    secondaryColor: "#082f49",
    glowColor: "rgba(56, 189, 248, 0.62)",
    coreLight: "#ffffff"
  },
  boss_frost_monarch: {
    id: "boss_frost_monarch",
    label: "Sovereign Frost Monarch (Cryo Archon)",
    scale: 1.85,
    coreRadius: 34,
    orbitCount: 8,
    ringCount: 3,
    hasHands: true,
    hasCrown: true,
    hasShield: true,
    hasFists: true,
    isBoss: true,
    primaryColor: "#082f49",
    secondaryColor: "#0284c7",
    glowColor: "rgba(56, 189, 248, 0.72)",
    coreLight: "#ffffff"
  }
});

/**
 * Returns configuration for a frost elemental entity based on type.
 */
export function getFrostElementalConfig(type) {
  if (!type) return FROST_ELEMENTAL_VARIANTS.frost_elemental;
  const t = type.toLowerCase();
  if (t === "boss_frost_monarch" || t.includes("monarch") || t.includes("archon") || (t.includes("boss") && (t.includes("elemental") || t.includes("frost") || t.includes("ice")))) {
    return FROST_ELEMENTAL_VARIANTS.boss_frost_monarch;
  }
  if (t === "glacial_colossus" || t.includes("colossus") || t.includes("titan") || (t.includes("golem") && t.includes("frost"))) {
    return FROST_ELEMENTAL_VARIANTS.glacial_colossus;
  }
  if (t === "cryo_warden" || t.includes("warden") || t.includes("monolith") || t.includes("sentinel")) {
    return FROST_ELEMENTAL_VARIANTS.cryo_warden;
  }
  if (t === "frost_tempest" || t.includes("tempest") || t.includes("vortex") || t.includes("blizzard")) {
    return FROST_ELEMENTAL_VARIANTS.frost_tempest;
  }
  if (t === "frost_wisp" || t.includes("wisp") || t.includes("sprite") || t.includes("lesser")) {
    return FROST_ELEMENTAL_VARIANTS.frost_wisp;
  }
  return FROST_ELEMENTAL_VARIANTS.frost_elemental;
}

/**
 * Draws a sharp 4-pointed prismatic diamond star glint.
 */
export function drawFrostDiamondGlint(ctx, x, y, size, alpha = 1.0, rotation = 0) {
  if (alpha <= 0.02 || size <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);

  ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.45})`;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.6);
  ctx.lineTo(size * 0.26, -size * 0.26);
  ctx.lineTo(size * 1.6, 0);
  ctx.lineTo(size * 0.26, size * 0.26);
  ctx.lineTo(0, size * 1.6);
  ctx.lineTo(-size * 0.26, size * 0.26);
  ctx.lineTo(-size * 1.6, 0);
  ctx.lineTo(-size * 0.26, -size * 0.26);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.2, -size * 0.2);
  ctx.lineTo(size, 0);
  ctx.lineTo(size * 0.2, size * 0.2);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.2, size * 0.2);
  ctx.lineTo(-size, 0);
  ctx.lineTo(-size * 0.2, -size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-0.7, -0.7, 1.4, 1.4);
  ctx.restore();
}

/**
 * Renders a faceted crystalline ice polygon with multi-stop linear gradient
 * and highlighted specular bevel edge.
 */
function drawFacetedIceCrystal(ctx, x, y, width, height, angle = 0, facetLight = 1.0, isDark = false) {
  ctx.save();
  ctx.translate(x, y);
  if (angle !== 0) ctx.rotate(angle);

  const hw = width / 2;
  const hh = height / 2;

  const grad = ctx.createLinearGradient(-hw, -hh, hw, hh);
  if (isDark) {
    grad.addColorStop(0, "#0369a1");
    grad.addColorStop(0.4, "#082f49");
    grad.addColorStop(0.85, "#0c4a6e");
    grad.addColorStop(1, "#0284c7");
  } else {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.25, "#bae6fd");
    grad.addColorStop(0.65, "#38bdf8");
    grad.addColorStop(1, "#0284c7");
  }

  // Left facet (Shadow facet)
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(-hw, 0);
  ctx.lineTo(0, hh);
  ctx.closePath();
  ctx.fillStyle = isDark ? "#082f49" : "#0284c7";
  ctx.globalAlpha = 0.92;
  ctx.fill();

  // Right facet (Illuminated facet)
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(hw, 0);
  ctx.lineTo(0, hh);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.globalAlpha = facetLight;
  ctx.fill();

  // Center crest ridge highlight
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = Math.max(0.7, width * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(0, hh);
  ctx.stroke();

  // Specular rim
  ctx.strokeStyle = "rgba(224, 242, 254, 0.7)";
  ctx.lineWidth = Math.max(0.5, width * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.lineTo(hw, 0);
  ctx.lineTo(0, hh);
  ctx.stroke();

  ctx.restore();
}

/**
 * Triggers a frost elemental death explosion:
 * Shattering crystalline shards, collapsing sub-zero core burst,
 * and drifting icy frost motes.
 */
export function triggerFrostElementalDeathExplosion(ce) {
  if (!ce || ce._frostExploded) return;
  ce._frostExploded = true;

  const cfg = getFrostElementalConfig(ce.type);
  const cx = ce.x || 0;
  const cy = ce.y || 0;
  const isBoss = cfg.isBoss;

  if (typeof spawnParticle === "function") {
    // Check if Cute Snowsand Frost Wisp
    if (cfg.isSnowsandWisp || ce.type === "frost_wisp" || (ce.type && ce.type.includes("wisp"))) {
      // 1. Tumbling Cute Snowsand Spheres
      for (let s = 0; s < 8; s++) {
        const ang = (s / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const spd = 60 + Math.random() * 90;
        spawnParticle({
          x: cx + Math.cos(ang) * 6,
          y: cy + Math.sin(ang) * 6,
          vx: Math.cos(ang) * spd,
          vy: -55 - Math.random() * 85,
          color: "#ffffff",
          accentColor: "#bae6fd",
          size: 4.5 + Math.random() * 3.5,
          maxLife: 1.6,
          drag: 0.94,
          style: "snow_sphere",
          gravity: 120,
          shrink: true
        });
      }

      // 2. Spinning Procedural Dendritic Snowflakes
      for (let f = 0; f < 12; f++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 35 + Math.random() * 110;
        spawnParticle({
          x: cx + (Math.random() - 0.5) * 12,
          y: cy + (Math.random() - 0.5) * 12,
          vx: Math.cos(ang) * spd,
          vy: -35 - Math.random() * 65,
          color: "#ffffff",
          accentColor: "#7dd3fc",
          size: 6.5 + Math.random() * 5.5,
          maxLife: 2.1,
          drag: 0.95,
          style: "snowflake",
          gravity: 30,
          shrink: true
        });
      }

      // 3. Drifting Powdery Snowsand Grains & Micro-Sparkles
      for (let g = 0; g < 30; g++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 20 + Math.random() * 130;
        spawnParticle({
          x: cx + (Math.random() - 0.5) * 14,
          y: cy + (Math.random() - 0.5) * 14,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 25,
          color: ["#ffffff", "#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc"],
          size: 1.5 + Math.random() * 2.5,
          maxLife: 1.4,
          drag: 0.92,
          style: "snow_sand",
          gravity: 35,
          shrink: true
        });
      }
      return;
    }

    // 1. Shattered Glacial Crystal Shards flying outward
    const shardCount = isBoss ? 16 : 9;
    for (let s = 0; s < shardCount; s++) {
      const angle = (s / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 90 + Math.random() * 160;
      spawnParticle({
        x: cx + Math.cos(angle) * 8,
        y: cy + Math.sin(angle) * 8,
        vx: Math.cos(angle) * speed,
        vy: -70 - Math.random() * 110,
        color: ["#bae6fd", "#7dd3fc", "#38bdf8", "#ffffff"],
        accentColor: "#0284c7",
        size: isBoss ? 9 : 6.5,
        maxLife: 2.2,
        drag: 0.94,
        style: "glass_shard",
        gravity: 160,
        shrink: true
      });
    }

    // 2. Exploding Blizzard Frost Motes & Snowflakes
    const moteCount = isBoss ? 45 : 24;
    for (let m = 0; m < moteCount; m++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 180;
      spawnParticle({
        x: cx + (Math.random() - 0.5) * 16,
        y: cy + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        color: ["#ffffff", "#e0f2fe", "#bae6fd", "#38bdf8", "#0284c7"],
        size: 2.0 + Math.random() * 3.5,
        maxLife: 1.4 + Math.random() * 0.8,
        drag: 0.92,
        gravity: 40,
        shrink: true,
        style: "circle"
      });
    }

    // 3. Floating Crystalline Prismatic Stars
    for (let p = 0; p < (isBoss ? 8 : 4); p++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 20;
      spawnParticle({
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        vx: Math.cos(ang) * 50,
        vy: -50 - Math.random() * 40,
        color: "#ffffff",
        size: 4 + Math.random() * 4,
        maxLife: 0.8,
        drag: 0.9,
        gravity: 20,
        shrink: true,
        style: "circle"
      });
    }
  }
}

/**
 * Universal Frost Elemental Entity Renderer
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Origin X
 * @param {number} y - Origin Y
 * @param {Object} ent - Entity state object
 * @param {boolean} isShadowPass - Shadow pass flag (no solid black circles)
 */
export function drawFrostElementalEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;

  const type = (ent.type || "frost_elemental").toLowerCase();
  const cfg = getFrostElementalConfig(type);

  // Specialized route for Cute Snowsand Frost Wisp
  if (cfg.isSnowsandWisp || type === "frost_wisp" || type.includes("wisp")) {
    return drawSnowsandFrostWisp(ctx, x, y, ent, cfg, isShadowPass);
  }

  if (ent._seed === undefined) {
    ent._seed = computeFastSeed(ent.id || type);
  }
  const seed = ent._seed;
  const now = performance.now();

  const isMoving = !!(ent.moving || ent.isMoving);
  const isSlowed = !!ent.isSlowed;
  const facingAngle = typeof ent.facingAngle === "number" ? ent.facingAngle : 0;
  const facingSign = Math.cos(facingAngle) >= 0 ? 1 : -1;

  // Hit Flash & Attack States
  const isHit = ent.lastHitTime && (now - ent.lastHitTime < 240);
  const hitRatio = isHit ? Math.max(0, 1 - (now - ent.lastHitTime) / 240) : 0;
  const isAttacking = !!(ent.isAttacking || ent.currentCast);
  const curAttackDur = ent.attackDuration || 500;
  const attackProgress = isAttacking
    ? (ent.currentCast && typeof ent.currentCast.progress === "number"
      ? ent.currentCast.progress
      : Math.min(1.0, (now - (ent.attackStart || ent.lastAttackTime || now)) / curAttackDur))
    : 0;

  // Kinetic Breathing & Levitation Oscillation
  const hoverRate = isSlowed ? 0.002 : 0.0035;
  const hoverAmp = cfg.isBoss ? 4.5 : 3.5;
  const hoverY = Math.sin(now * hoverRate + seed) * hoverAmp;
  const hoverTilt = Math.sin(now * (hoverRate * 0.7) + seed) * 0.06;

  // Movement Drift & Surge
  const moveTilt = isMoving ? facingSign * 0.14 : 0;
  const attackSurgeX = isAttacking ? Math.cos(facingAngle) * Math.sin(attackProgress * Math.PI) * (cfg.isBoss ? 16 : 10) : 0;
  const attackSurgeY = isAttacking ? Math.sin(facingAngle) * Math.sin(attackProgress * Math.PI) * (cfg.isBoss ? 10 : 6) : 0;

  ctx.save();
  ctx.translate(x + attackSurgeX, y + hoverY + attackSurgeY);
  ctx.scale(2, 2);

  const baseScale = cfg.scale;
  const hitSquashX = isHit ? 1 + hitRatio * 0.18 : 1;
  const hitSquashY = isHit ? 1 - hitRatio * 0.15 : 1;
  ctx.scale(baseScale * hitSquashX, baseScale * hitSquashY);
  ctx.rotate(hoverTilt + moveTilt);

  // 1. Atmospheric Ambient Ground Glow Halo (Zero solid shadows per strict rule)
  const auraR = cfg.coreRadius * 1.5;
  const groundGlow = safeCreateRadialGradient(ctx, 0, cfg.coreRadius * 1.1, 0, 0, cfg.coreRadius * 1.1, auraR);
  if (groundGlow) {
    groundGlow.addColorStop(0, cfg.glowColor);
    groundGlow.addColorStop(0.5, "rgba(56, 189, 248, 0.18)");
    groundGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.save();
    ctx.scale(1, 0.32);
    ctx.fillStyle = groundGlow;
    ctx.beginPath();
    ctx.arc(0, (cfg.coreRadius * 1.1) / 0.32, auraR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Boss Cryo Archon Rotating Runic Snowflake Seal on Floor
  if (cfg.isBoss) {
    ctx.save();
    ctx.scale(1, 0.34);
    ctx.translate(0, 75);
    const sealAngle = now * 0.001;
    ctx.rotate(sealAngle);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 1.6;

    // Runic ring
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();

    // 6 Hexagonal Snowflake Spoke Runes
    for (let r = 0; r < 6; r++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -48);
      ctx.moveTo(-6, -26);
      ctx.lineTo(0, -34);
      ctx.lineTo(6, -26);
      ctx.moveTo(-5, -38);
      ctx.lineTo(0, -44);
      ctx.lineTo(5, -38);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Blizzard Vortex Cyclone Base (for Frost Tempest)
  if (cfg.isVortex) {
    ctx.save();
    const vTime = now * 0.004;
    for (let b = 0; b < 4; b++) {
      const bProgress = ((vTime + b * 0.25) % 1.0);
      const bY = 2 + bProgress * 22;
      const bW = (1 - bProgress) * 26 + 6;
      const bAlpha = Math.sin(bProgress * Math.PI) * 0.65;

      const vGrad = ctx.createLinearGradient(-bW, bY, bW, bY);
      vGrad.addColorStop(0, "rgba(2, 132, 199, 0)");
      vGrad.addColorStop(0.5, `rgba(186, 230, 253, ${bAlpha})`);
      vGrad.addColorStop(1, "rgba(2, 132, 199, 0)");

      ctx.fillStyle = vGrad;
      ctx.beginPath();
      ctx.ellipse(Math.sin(vTime * 3 + b) * 2, bY, bW, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Floating Concentric Gyroscope Cryo Rings (for Boss and Tempest)
  if (cfg.ringCount > 0) {
    ctx.save();
    ctx.translate(0, -2);
    const ringPulse = Math.sin(now * 0.003 + seed) * 1.5;
    for (let rg = 0; rg < cfg.ringCount; rg++) {
      const speed = (rg % 2 === 0 ? 0.0018 : -0.0022) * (rg + 1);
      const ringRot = now * speed + seed;
      const ringRadius = cfg.coreRadius * (1.35 + rg * 0.38) + ringPulse;

      ctx.save();
      ctx.rotate(ringRot);
      ctx.scale(1, 0.42 + rg * 0.1);

      ctx.strokeStyle = rg === 0 ? "rgba(186, 230, 253, 0.8)" : "rgba(56, 189, 248, 0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Gyro Satellite Ice Nodes
      for (let n = 0; n < 3; n++) {
        const nAngle = (n / 3) * Math.PI * 2;
        const nx = Math.cos(nAngle) * ringRadius;
        const ny = Math.sin(nAngle) * ringRadius;
        drawFrostDiamondGlint(ctx, nx, ny, 2.8, 0.85);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // 5. Orbiting Glacial Diamond Shards
  const orbitRadiusX = cfg.coreRadius * 1.6;
  const orbitRadiusY = cfg.coreRadius * 0.75;
  const orbitSpeed = isSlowed ? 0.0012 : (isAttacking ? 0.0045 : 0.0024);

  // Sort orbiting shards back-to-front for proper depth layering
  const shards = [];
  for (let i = 0; i < cfg.orbitCount; i++) {
    const angleOffset = (i / cfg.orbitCount) * Math.PI * 2;
    const curAngle = now * orbitSpeed + angleOffset + seed;
    const sx = Math.cos(curAngle) * orbitRadiusX;
    const sy = Math.sin(curAngle) * orbitRadiusY + Math.sin(now * 0.004 + i) * 3;
    const depth = Math.sin(curAngle);
    const shardSize = (cfg.coreRadius * 0.38) * (0.8 + (depth + 1) * 0.25);
    shards.push({ sx, sy, depth, shardSize, index: i });
  }
  shards.sort((a, b) => a.depth - b.depth);

  // Render back shards (behind main body)
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (s.depth < 0) {
      drawFacetedIceCrystal(ctx, s.sx, s.sy - 2, s.shardSize * 0.7, s.shardSize * 1.4, s.depth * 0.3, 0.7, true);
    }
  }

  // 6. Sub-surface Radiant Frost Aura Halo behind main torso
  const bodyPulse = Math.sin(now * 0.005 + seed) * (cfg.isBoss ? 3 : 2);
  const coreAuraGrad = safeCreateRadialGradient(ctx, 0, -2, 2, 0, -2, cfg.coreRadius * 1.8 + bodyPulse);
  if (coreAuraGrad) {
    coreAuraGrad.addColorStop(0, "rgba(224, 242, 254, 0.75)");
    coreAuraGrad.addColorStop(0.35, "rgba(56, 189, 248, 0.45)");
    coreAuraGrad.addColorStop(0.7, "rgba(2, 132, 199, 0.18)");
    coreAuraGrad.addColorStop(1, "rgba(2, 132, 199, 0)");
    ctx.fillStyle = coreAuraGrad;
    ctx.beginPath();
    ctx.arc(0, -2, cfg.coreRadius * 1.8 + bodyPulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. Main Central Glacial Body (Faceted Octahedron & Diamond Monolith)
  ctx.save();
  ctx.translate(0, -2);

  const cr = cfg.coreRadius;
  const attackSquash = isAttacking ? Math.sin(attackProgress * Math.PI) * 0.15 : 0;

  // Facet 1: Lower Core Diamond
  const lowerGrad = ctx.createLinearGradient(-cr, 0, cr, cr * 1.3);
  lowerGrad.addColorStop(0, "#0369a1");
  lowerGrad.addColorStop(0.5, "#075985");
  lowerGrad.addColorStop(1, "#082f49");
  ctx.fillStyle = lowerGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-cr * 0.85, 0);
  ctx.lineTo(0, cr * 1.25 * (1 + attackSquash));
  ctx.lineTo(cr * 0.85, 0);
  ctx.closePath();
  ctx.fill();

  // Facet 2: Upper Glacial Torso
  const upperGrad = ctx.createLinearGradient(-cr * 0.8, -cr * 1.1, cr * 0.8, 0);
  upperGrad.addColorStop(0, "#e0f2fe");
  upperGrad.addColorStop(0.4, "#38bdf8");
  upperGrad.addColorStop(0.85, "#0284c7");
  upperGrad.addColorStop(1, "#0369a1");
  ctx.fillStyle = upperGrad;
  ctx.beginPath();
  ctx.moveTo(0, -cr * 1.15 * (1 - attackSquash));
  ctx.lineTo(-cr * 0.85, 0);
  ctx.lineTo(0, cr * 0.3);
  ctx.lineTo(cr * 0.85, 0);
  ctx.closePath();
  ctx.fill();

  // Facet 3: Left Shade Facet
  ctx.fillStyle = "rgba(8, 47, 73, 0.45)";
  ctx.beginPath();
  ctx.moveTo(0, -cr * 1.15 * (1 - attackSquash));
  ctx.lineTo(-cr * 0.85, 0);
  ctx.lineTo(0, cr * 1.25 * (1 + attackSquash));
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Facet 4: Center Ridge Highlight
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -cr * 1.15 * (1 - attackSquash));
  ctx.lineTo(0, cr * 1.25 * (1 + attackSquash));
  ctx.stroke();

  // Lateral Crystalline Wings / Ribs
  ctx.fillStyle = "rgba(186, 230, 253, 0.7)";
  ctx.beginPath();
  ctx.moveTo(-cr * 0.85, 0);
  ctx.lineTo(-cr * 1.25, -cr * 0.4);
  ctx.lineTo(-cr * 0.5, -cr * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(224, 242, 254, 0.85)";
  ctx.beginPath();
  ctx.moveTo(cr * 0.85, 0);
  ctx.lineTo(cr * 1.25, -cr * 0.4);
  ctx.lineTo(cr * 0.5, -cr * 0.6);
  ctx.closePath();
  ctx.fill();

  // 8. Glowing Heart Nucleus (Blinding White-Hot Cold Plasma Flare)
  const nucleusPulse = Math.sin(now * 0.006 + seed) * (cr * 0.12);
  const coreRad = cr * 0.45 + nucleusPulse;
  const nucleusGrad = safeCreateRadialGradient(ctx, 0, 0, 0, 0, 0, coreRad);
  if (nucleusGrad) {
    nucleusGrad.addColorStop(0, "#ffffff");
    nucleusGrad.addColorStop(0.35, "#e0f2fe");
    nucleusGrad.addColorStop(0.7, "#38bdf8");
    nucleusGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = nucleusGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coreRad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radiant Prismatic Star Glint at Heart Center
  drawFrostDiamondGlint(ctx, 0, 0, cr * 0.5, 0.95);

  ctx.restore();

  // 9. Permafrost Horned Crown / Crystalline Crest
  if (cfg.hasCrown) {
    ctx.save();
    ctx.translate(0, -cfg.coreRadius * 1.1);
    const crownBob = Math.sin(now * 0.003 + seed) * 1.2;
    ctx.translate(0, crownBob);

    // Center Spire
    drawFacetedIceCrystal(ctx, 0, -cfg.coreRadius * 0.5, cfg.coreRadius * 0.35, cfg.coreRadius * 0.95, 0, 1.0);

    // Left Spire
    drawFacetedIceCrystal(ctx, -cfg.coreRadius * 0.45, -cfg.coreRadius * 0.35, cfg.coreRadius * 0.28, cfg.coreRadius * 0.75, -0.32, 0.85);

    // Right Spire
    drawFacetedIceCrystal(ctx, cfg.coreRadius * 0.45, -cfg.coreRadius * 0.35, cfg.coreRadius * 0.28, cfg.coreRadius * 0.75, 0.32, 0.95);

    if (cfg.isBoss) {
      // Sovereign Outer Horn Spires
      drawFacetedIceCrystal(ctx, -cfg.coreRadius * 0.85, -cfg.coreRadius * 0.2, cfg.coreRadius * 0.25, cfg.coreRadius * 0.65, -0.6, 0.8);
      drawFacetedIceCrystal(ctx, cfg.coreRadius * 0.85, -cfg.coreRadius * 0.2, cfg.coreRadius * 0.25, cfg.coreRadius * 0.65, 0.6, 0.9);

      // Aurora Borealis Crown Ribbon
      const aTime = now * 0.002;
      const ribbonGrad = ctx.createLinearGradient(-cfg.coreRadius * 1.3, -cfg.coreRadius, cfg.coreRadius * 1.3, -cfg.coreRadius * 1.5);
      ribbonGrad.addColorStop(0, "rgba(56, 189, 248, 0)");
      ribbonGrad.addColorStop(0.3, "rgba(168, 85, 247, 0.4)");
      ribbonGrad.addColorStop(0.6, "rgba(52, 211, 153, 0.45)");
      ribbonGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

      ctx.fillStyle = ribbonGrad;
      ctx.beginPath();
      ctx.moveTo(-cfg.coreRadius * 1.3, -cfg.coreRadius * 0.8 + Math.sin(aTime) * 3);
      ctx.quadraticCurveTo(0, -cfg.coreRadius * 1.6 + Math.cos(aTime) * 5, cfg.coreRadius * 1.3, -cfg.coreRadius * 0.8 + Math.sin(aTime + 1) * 3);
      ctx.quadraticCurveTo(0, -cfg.coreRadius * 1.2, -cfg.coreRadius * 1.3, -cfg.coreRadius * 0.8 + Math.sin(aTime) * 3);
      ctx.fill();
    }

    ctx.restore();
  }

  // 10. Piercing Cyan Elemental Eyes
  ctx.save();
  ctx.translate(0, -cfg.coreRadius * 0.4);
  const eyeDist = cfg.coreRadius * 0.3;
  const eyeY = 0;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-eyeDist, eyeY, 2.4, 0, Math.PI * 2);
  ctx.arc(eyeDist, eyeY, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#00f0ff";
  ctx.beginPath();
  ctx.arc(-eyeDist, eyeY, 1.4, 0, Math.PI * 2);
  ctx.arc(eyeDist, eyeY, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Eye flare glints
  drawFrostDiamondGlint(ctx, -eyeDist, eyeY, 2.0, 0.9);
  drawFrostDiamondGlint(ctx, eyeDist, eyeY, 2.0, 0.9);
  ctx.restore();

  // 11. Floating Limbs: Crystalline Shield (Cryo Warden & Monarch)
  if (cfg.hasShield) {
    ctx.save();
    const shieldAngle = facingAngle + Math.PI * 0.45;
    const shieldDist = cfg.coreRadius * 1.45;
    const shieldX = Math.cos(shieldAngle) * shieldDist;
    const shieldY = Math.sin(shieldAngle) * (shieldDist * 0.6) + Math.sin(now * 0.003 + 2) * 2.5;

    ctx.translate(shieldX, shieldY);
    ctx.rotate(0.15 * facingSign);

    const sw = cfg.coreRadius * 0.75;
    const sh = cfg.coreRadius * 1.7;

    const sGrad = ctx.createLinearGradient(-sw / 2, -sh / 2, sw / 2, sh / 2);
    sGrad.addColorStop(0, "#bae6fd");
    sGrad.addColorStop(0.3, "#38bdf8");
    sGrad.addColorStop(0.7, "#0369a1");
    sGrad.addColorStop(1, "#082f49");

    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.moveTo(0, -sh / 2);
    ctx.lineTo(sw / 2, -sh * 0.3);
    ctx.lineTo(sw / 2, sh * 0.35);
    ctx.lineTo(0, sh / 2);
    ctx.lineTo(-sw / 2, sh * 0.35);
    ctx.lineTo(-sw / 2, -sh * 0.3);
    ctx.closePath();
    ctx.fill();

    drawFrostDiamondGlint(ctx, 0, 0, sw * 0.55, 0.95);
    ctx.restore();
  }

  // 12. Floating Limbs: Heavy Glacial Fists (Glacial Colossus & Monarch)
  if (cfg.hasFists) {
    const fAngle = facingAngle;
    const fistSwing = isAttacking ? Math.sin(attackProgress * Math.PI) * (cfg.coreRadius * 1.2) : 0;
    const fistSwayL = Math.sin(now * 0.004 + seed) * 3;
    const fistSwayR = Math.cos(now * 0.004 + seed) * 3;

    // Left Fist
    ctx.save();
    const lfx = -cfg.coreRadius * 1.35 + Math.cos(fAngle) * fistSwing;
    const lfy = cfg.coreRadius * 0.4 + fistSwayL + Math.sin(fAngle) * fistSwing * 0.4;
    ctx.translate(lfx, lfy);
    drawFacetedIceCrystal(ctx, 0, 0, cfg.coreRadius * 0.7, cfg.coreRadius * 0.85, -0.2, 0.85);
    drawFrostDiamondGlint(ctx, 0, 0, cfg.coreRadius * 0.35, 0.8);
    ctx.restore();

    // Right Fist (Striking Fist)
    ctx.save();
    const rfx = cfg.coreRadius * 1.35 + Math.cos(fAngle) * fistSwing * 1.4;
    const rfy = cfg.coreRadius * 0.4 + fistSwayR + Math.sin(fAngle) * fistSwing * 0.6;
    ctx.translate(rfx, rfy);
    drawFacetedIceCrystal(ctx, 0, 0, cfg.coreRadius * 0.7, cfg.coreRadius * 0.85, 0.2, 0.95);
    drawFrostDiamondGlint(ctx, 0, 0, cfg.coreRadius * 0.35, 0.9);
    ctx.restore();
  } else if (cfg.hasHands) {
    // Floating Crystalline Hand Claws
    const handSwing = isAttacking ? Math.sin(attackProgress * Math.PI) * (cfg.coreRadius * 0.9) : 0;
    const handSway = Math.sin(now * 0.004 + seed) * 2;

    // Left hand
    ctx.save();
    ctx.translate(-cfg.coreRadius * 1.2, cfg.coreRadius * 0.2 + handSway);
    drawFacetedIceCrystal(ctx, 0, 0, cfg.coreRadius * 0.35, cfg.coreRadius * 0.6, -0.25, 0.85);
    ctx.restore();

    // Right hand
    ctx.save();
    ctx.translate(cfg.coreRadius * 1.2 + handSwing, cfg.coreRadius * 0.2 - handSway);
    drawFacetedIceCrystal(ctx, 0, 0, cfg.coreRadius * 0.35, cfg.coreRadius * 0.6, 0.25, 0.95);
    ctx.restore();
  }

  // 13. Attack Cast VFX: Glacial Ice Spear Surge or Frost Nova
  if (isAttacking && attackProgress > 0.25) {
    ctx.save();
    const flareProgress = (attackProgress - 0.25) / 0.75;
    const projDist = flareProgress * (cfg.coreRadius * 2.5);
    const px = Math.cos(facingAngle) * projDist;
    const py = Math.sin(facingAngle) * projDist;

    // Projected Glacial Spire Spear
    drawFacetedIceCrystal(ctx, px, py, cfg.coreRadius * 0.6, cfg.coreRadius * 1.8, facingAngle + Math.PI / 2, 1.0);

    // Impact Frost Burst Flare
    drawFrostDiamondGlint(ctx, px, py, cfg.coreRadius * 0.8 * (1 - flareProgress * 0.4), 0.95);
    ctx.restore();
  }

  // 14. Render Front Orbiting Shards (passing in front of main torso)
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (s.depth >= 0) {
      drawFacetedIceCrystal(ctx, s.sx, s.sy - 2, s.shardSize * 0.75, s.shardSize * 1.45, s.depth * 0.35, 1.0, false);
      drawFrostDiamondGlint(ctx, s.sx, s.sy - 2, s.shardSize * 0.32, 0.9);
    }
  }

  // 15. Continuous Ambient Frost Mist Particles
  if (!isShadowPass && Math.random() < (cfg.isBoss ? 0.4 : 0.2)) {
    if (typeof spawnParticle === "function") {
      const pAngle = Math.random() * Math.PI * 2;
      const pDist = Math.random() * cfg.coreRadius * 1.2;
      spawnParticle({
        x: (ent.x || 0) + Math.cos(pAngle) * pDist,
        y: (ent.y || 0) + Math.sin(pAngle) * pDist - 4,
        vx: (Math.random() - 0.5) * 14,
        vy: -12 - Math.random() * 16,
        color: ["#ffffff", "#e0f2fe", "#bae6fd", "#7dd3fc"],
        size: 1.5 + Math.random() * 2.2,
        maxLife: 0.55,
        gravity: 8,
        drag: 0.94,
        shrink: true,
        style: "circle"
      });
    }
  }

  ctx.restore();
}

/**
 * Draws an intricate 6-fold dendritic procedural crystalline snowflake.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} radius - Outer tip radius
 * @param {number} rotation - Snowflake rotation in radians
 * @param {number} alpha - Opacity (0 to 1)
 * @param {string} color - Primary spine color
 * @param {string} accentColor - Rim glow and dendritic branch color
 */
export function drawProceduralSnowflake(ctx, x, y, radius, rotation = 0, alpha = 1.0, color = "#ffffff", accentColor = "#bae6fd") {
  if (radius <= 0.8 || alpha <= 0.02) return;
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);
  ctx.globalAlpha = Math.min(1, Math.max(0, alpha));

  // Soft atmospheric frost halo behind snowflake
  if (radius >= 6) {
    const halo = safeCreateRadialGradient(ctx, 0, 0, radius * 0.2, 0, 0, radius * 1.35);
    if (halo) {
      halo.addColorStop(0, "rgba(224, 242, 254, 0.45)");
      halo.addColorStop(0.5, "rgba(56, 189, 248, 0.22)");
      halo.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 1. Dendritic Branches (6-fold radial symmetry, 60 degrees apart)
  ctx.strokeStyle = accentColor || "#bae6fd";
  ctx.lineWidth = Math.max(0.7, radius * 0.11);
  ctx.lineCap = "round";

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Main Spoke Spine
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cosA * radius, sinA * radius);
    ctx.stroke();

    if (radius >= 4.0) {
      // Inner chevron pair at ~44% distance
      const d1 = radius * 0.44;
      const bLen1 = radius * 0.30;
      const bx1 = cosA * d1;
      const by1 = sinA * d1;
      const angL = angle + Math.PI / 3;
      const angR = angle - Math.PI / 3;

      ctx.beginPath();
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx1 + Math.cos(angL) * bLen1, by1 + Math.sin(angL) * bLen1);
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx1 + Math.cos(angR) * bLen1, by1 + Math.sin(angR) * bLen1);
      ctx.stroke();

      // Outer chevron pair at ~74% distance
      if (radius >= 7.0) {
        const d2 = radius * 0.74;
        const bLen2 = radius * 0.22;
        const bx2 = cosA * d2;
        const by2 = sinA * d2;

        ctx.beginPath();
        ctx.moveTo(bx2, by2);
        ctx.lineTo(bx2 + Math.cos(angL) * bLen2, by2 + Math.sin(angL) * bLen2);
        ctx.moveTo(bx2, by2);
        ctx.lineTo(bx2 + Math.cos(angR) * bLen2, by2 + Math.sin(angR) * bLen2);
        ctx.stroke();
      }
    }
  }

  // 2. Central Hexagonal Core & Prismatic Facet
  ctx.fillStyle = color || "#ffffff";
  if (radius >= 5.0) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const hAngle = (i * Math.PI) / 3;
      const hx = Math.cos(hAngle) * (radius * 0.22);
      const hy = Math.sin(hAngle) * (radius * 0.22);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 3. Central Glinting Diamond
  const centerSize = Math.max(1.0, radius * 0.18);
  ctx.beginPath();
  ctx.moveTo(0, -centerSize * 1.3);
  ctx.lineTo(centerSize * 0.8, 0);
  ctx.lineTo(0, centerSize * 1.3);
  ctx.lineTo(-centerSize * 0.8, 0);
  ctx.closePath();
  ctx.fill();

  // 4. Crystalline Tip Diamond Beads
  if (radius >= 4.5) {
    const tipSize = Math.max(0.7, radius * 0.12);
    for (let i = 0; i < 6; i++) {
      const sAngle = (i * Math.PI) / 3;
      const tx = Math.cos(sAngle) * radius;
      const ty = Math.sin(sAngle) * radius;
      ctx.beginPath();
      ctx.arc(tx, ty, tipSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Draws a single volumetric snowsand sphere with granular micro-sparkles,
 * soft sky blue subsurface light scattering, and permafrost shadow.
 */
function drawSnowsandSphere(ctx, cx, cy, r, seedOffset = 0, options = {}) {
  if (r <= 0.5) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (options.rotation) ctx.rotate(options.rotation);
  if (options.scaleX || options.scaleY) ctx.scale(options.scaleX || 1, options.scaleY || 1);

  // Soft snow subsurface glow halo
  const glowR = r * 1.32;
  const sGlow = safeCreateRadialGradient(ctx, 0, 0, r * 0.5, 0, 0, glowR);
  if (sGlow) {
    sGlow.addColorStop(0, "rgba(224, 242, 254, 0.40)");
    sGlow.addColorStop(0.65, "rgba(56, 189, 248, 0.16)");
    sGlow.addColorStop(1, "rgba(56, 189, 248, 0)");
    ctx.fillStyle = sGlow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Volumetric Packed Snow Gradient (Subsurface scattering)
  const lightX = -r * 0.32;
  const lightY = -r * 0.36;
  const grad = safeCreateRadialGradient(ctx, lightX, lightY, r * 0.08, 0, 0, r);
  if (grad) {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.28, "#f0f9ff");
    grad.addColorStop(0.62, "#e0f2fe");
    grad.addColorStop(0.85, "#bae6fd");
    grad.addColorStop(1.0, "#7dd3fc");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = "#e0f2fe";
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Soft lower permafrost ambient shadow cushion
  const botShadow = safeCreateRadialGradient(ctx, 0, r * 0.45, 0, 0, r * 0.45, r * 0.85);
  if (botShadow) {
    botShadow.addColorStop(0, "rgba(56, 189, 248, 0.35)");
    botShadow.addColorStop(0.6, "rgba(2, 132, 199, 0.15)");
    botShadow.addColorStop(1, "rgba(2, 132, 199, 0)");
    ctx.fillStyle = botShadow;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Procedural Granular Snowsand Micro-Glints & Texture
  const grainCount = Math.floor(r * 1.3);
  ctx.fillStyle = "#ffffff";
  for (let g = 0; g < grainCount; g++) {
    const p = ((seedOffset + g * 37) % 1000) / 1000;
    const p2 = ((seedOffset + g * 53 + 17) % 1000) / 1000;
    const dist = Math.sqrt(p) * (r * 0.82);
    const ang = p2 * Math.PI * 2;
    const gx = Math.cos(ang) * dist;
    const gy = Math.sin(ang) * dist;

    // Brighter micro-sparkles near the illuminated facet
    const isHighlightZone = (gx - lightX) * (gx - lightX) + (gy - lightY) * (gy - lightY) < (r * 0.6) * (r * 0.6);
    const grainAlpha = isHighlightZone ? 0.85 : 0.42;
    const grainSize = isHighlightZone ? 0.9 : 0.65;

    ctx.globalAlpha = grainAlpha;
    ctx.fillRect(gx - grainSize * 0.5, gy - grainSize * 0.5, grainSize, grainSize);
  }
  ctx.globalAlpha = 1.0;

  // Specular top-left crest gleam
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.beginPath();
  ctx.arc(lightX, lightY, Math.max(0.8, r * 0.22), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Recreated Frost Wisp: Cute Snowsand Agglomerate of Spheres
 * that sends delicate procedural snowflakes in its attacks!
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Origin X
 * @param {number} y - Origin Y
 * @param {Object} ent - Entity state object
 * @param {Object} cfg - Variant configuration
 * @param {boolean} isShadowPass - Shadow pass flag (no solid black circles)
 */
export function drawSnowsandFrostWisp(ctx, x, y, ent, cfg, isShadowPass = false) {
  if (isShadowPass) return;

  if (ent._seed === undefined) {
    ent._seed = computeFastSeed(ent.id || "frost_wisp");
  }
  const seed = ent._seed;
  const now = performance.now();

  const isMoving = !!(ent.moving || ent.isMoving);
  const isSlowed = !!ent.isSlowed;
  const facingAngle = typeof ent.facingAngle === "number" ? ent.facingAngle : 0;
  const facingSign = Math.cos(facingAngle) >= 0 ? 1 : -1;

  // Hit Flash
  const isHit = ent.lastHitTime && (now - ent.lastHitTime < 240);
  const hitRatio = isHit ? Math.max(0, 1 - (now - ent.lastHitTime) / 240) : 0;

  // Attack Kinematics
  const isAttacking = !!(ent.isAttacking || ent.currentCast);
  const curAttackDur = ent.attackDuration || 500;
  const attackProgress = isAttacking
    ? (ent.currentCast && typeof ent.currentCast.progress === "number"
      ? ent.currentCast.progress
      : Math.min(1.0, (now - (ent.attackStart || ent.lastAttackTime || now)) / curAttackDur))
    : 0;

  // Sleep & Standby State Detection
  const isSleeping = !isAttacking && (ent.isSleeping || ent.sleeping || !isMoving);

  // Standby Sleep vs Active Floating Oscillations
  let hoverY = 0;
  let hoverTilt = 0;
  let bobSquashX = 1;
  let bobSquashY = 1;
  let sleepBreath = 0;

  if (isSleeping) {
    // Slower, deeper harmonic slumber breathing
    const sleepRate = 0.0016;
    sleepBreath = Math.sin(now * sleepRate + seed);
    // Sinks comfortably lower to ground in a cozy resting nap
    hoverY = 3.6 + sleepBreath * 2.2;
    // Drowsy gentle head nod
    hoverTilt = Math.sin(now * (sleepRate * 0.5) + seed) * 0.065;
    // Deep sleep chest inhalation & resting exhalation squish
    bobSquashX = 1 + sleepBreath * 0.055;
    bobSquashY = 1 - sleepBreath * 0.045;
  } else {
    // Active awake floating & bobbing
    const hoverRate = isSlowed ? 0.0022 : 0.0038;
    hoverY = Math.sin(now * hoverRate + seed) * 4.2;
    hoverTilt = Math.sin(now * (hoverRate * 0.7) + seed) * 0.06;
    const bobVel = Math.cos(now * hoverRate + seed);
    bobSquashX = 1 - bobVel * 0.04;
    bobSquashY = 1 + bobVel * 0.04;
  }

  const moveTilt = isMoving ? facingSign * 0.16 : 0;
  const moveHop = isMoving ? Math.abs(Math.sin(now * 0.008)) * 2.5 : 0;

  // Attack surge and squash
  let attackSurgeX = 0;
  let attackSurgeY = 0;
  let attackSquashX = 1;
  let attackSquashY = 1;

  if (isAttacking) {
    if (attackProgress < 0.32) {
      // Phase 1: Windup cute squish back
      const wProg = attackProgress / 0.32;
      const wWave = Math.sin(wProg * Math.PI);
      attackSquashX = 1 + wWave * 0.18;
      attackSquashY = 1 - wWave * 0.16;
      attackSurgeX = -Math.cos(facingAngle) * wWave * 6;
      attackSurgeY = -Math.sin(facingAngle) * wWave * 4;
    } else if (attackProgress <= 0.85) {
      // Phase 2: Forward thrust & snowflake release
      const relNorm = (attackProgress - 0.32) / 0.53;
      const relWave = Math.sin(relNorm * Math.PI);
      attackSquashX = 1 - relWave * 0.14;
      attackSquashY = 1 + relWave * 0.16;
      attackSurgeX = Math.cos(facingAngle) * relWave * 18;
      attackSurgeY = Math.sin(facingAngle) * relWave * 11;
    } else {
      // Phase 3: Cute recovery bounce
      const recNorm = (attackProgress - 0.85) / 0.15;
      const recWave = Math.sin(recNorm * Math.PI * 2);
      attackSquashX = 1 + recWave * 0.06;
      attackSquashY = 1 - recWave * 0.06;
    }
  }

  ctx.save();
  ctx.translate(x + attackSurgeX, y + hoverY - moveHop + attackSurgeY);
  ctx.scale(2, 2);

  const baseScale = cfg.scale || 1.15;
  const hitSquashX = isHit ? 1 + hitRatio * 0.20 : 1;
  const hitSquashY = isHit ? 1 - hitRatio * 0.16 : 1;
  ctx.scale(baseScale * hitSquashX * bobSquashX * attackSquashX, baseScale * hitSquashY * bobSquashY * attackSquashY);
  ctx.rotate(hoverTilt + moveTilt);

  // 1. Soft Sub-Zero Frost Halo on Floor (Strict zero solid black shadow disc!)
  const groundAuraR = 26;
  const groundGlow = safeCreateRadialGradient(ctx, 0, 16, 0, 0, 16, groundAuraR);
  if (groundGlow) {
    groundGlow.addColorStop(0, "rgba(56, 189, 248, 0.35)");
    groundGlow.addColorStop(0.5, "rgba(186, 230, 253, 0.16)");
    groundGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.save();
    ctx.scale(1, 0.30);
    ctx.fillStyle = groundGlow;
    ctx.beginPath();
    ctx.arc(0, 16 / 0.30, groundAuraR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 2. Trailing Snowsand Tail Spheres (Undulating gently behind/below)
  const tailWave = Math.sin(now * (isSleeping ? 0.002 : 0.0045) + seed) * (isSleeping ? 1.4 : 2.2);
  drawSnowsandSphere(ctx, tailWave * 0.8, 17.5, 4.8, seed + 1);
  drawSnowsandSphere(ctx, -4.5 + tailWave * 0.3, 11.5, 6.2, seed + 2);
  drawSnowsandSphere(ctx, 4.5 + tailWave * 0.3, 11.5, 6.2, seed + 3);

  // 3. Fluffy Cheek Agglomerate Spheres
  drawSnowsandSphere(ctx, -9.5, 3.5, 9.8, seed + 4);
  drawSnowsandSphere(ctx, 9.5, 3.5, 9.8, seed + 5);

  // 4. Cute Pom-Pom Crown Tuft Spheres (Playful crest on top)
  const tuftBob = Math.sin(now * (isSleeping ? 0.002 : 0.005) + seed) * (isSleeping ? 0.4 : 0.8);
  drawSnowsandSphere(ctx, -6.8, -13.2 + tuftBob, 5.6, seed + 6);
  drawSnowsandSphere(ctx, 6.8, -13.2 + tuftBob, 5.6, seed + 7);
  drawSnowsandSphere(ctx, 0, -15.8 + tuftBob * 1.2, 6.8, seed + 8);

  // 5. Main Central Head/Body Snow Sphere
  drawSnowsandSphere(ctx, 0, 0, 16.0, seed + 9);

  // 6. Cute Blushing Cheeks (Soft frosty pink-cyan pastel glow)
  const blushAlpha = isSleeping ? 0.48 : 0.40;
  const blushGradL = safeCreateRadialGradient(ctx, -7.8, 3.2, 0, -7.8, 3.2, 4.6);
  if (blushGradL) {
    blushGradL.addColorStop(0, `rgba(244, 114, 182, ${blushAlpha})`);
    blushGradL.addColorStop(0.5, "rgba(186, 230, 253, 0.25)");
    blushGradL.addColorStop(1, "rgba(186, 230, 253, 0)");
    ctx.fillStyle = blushGradL;
    ctx.beginPath();
    ctx.arc(-7.8, 3.2, 4.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const blushGradR = safeCreateRadialGradient(ctx, 7.8, 3.2, 0, 7.8, 3.2, 4.6);
  if (blushGradR) {
    blushGradR.addColorStop(0, `rgba(244, 114, 182, ${blushAlpha})`);
    blushGradR.addColorStop(0.5, "rgba(186, 230, 253, 0.25)");
    blushGradR.addColorStop(1, "rgba(186, 230, 253, 0)");
    ctx.fillStyle = blushGradR;
    ctx.beginPath();
    ctx.arc(7.8, 3.2, 4.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. Cute Expressive Eyes & Kawaii Gaze (Awake vs Sleeping Standby)
  const lookX = isSleeping ? 0 : Math.max(-2.2, Math.min(2.2, Math.cos(facingAngle) * 2.2));
  const lookY = isSleeping ? 0.6 : Math.max(-1.5, Math.min(1.5, Math.sin(facingAngle) * 1.5));
  const eyeBaseY = -1.5 + lookY;
  const leftEyeX = -5.2 + lookX;
  const rightEyeX = 5.2 + lookX;

  // Natural cute blink cycle for awake state
  const blinkTimer = (now + seed * 120) % 3800;
  const isBlinking = blinkTimer < 140;

  // Drowsy occasional eye flutter in sleep state (every ~13s)
  const flutterCycle = (now + seed * 230) % 13000;
  const isSleepFlutter = isSleeping && flutterCycle < 380;

  if (isAttacking && attackProgress < 0.35) {
    // Attack Windup: Cute squinting concentration eyes (> <)
    ctx.strokeStyle = "#082f49";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";

    // Left eye squint >
    ctx.beginPath();
    ctx.moveTo(leftEyeX - 2.2, eyeBaseY - 1.6);
    ctx.lineTo(leftEyeX + 1.2, eyeBaseY);
    ctx.lineTo(leftEyeX - 2.2, eyeBaseY + 1.6);
    ctx.stroke();

    // Right eye squint <
    ctx.beginPath();
    ctx.moveTo(rightEyeX + 2.2, eyeBaseY - 1.6);
    ctx.lineTo(rightEyeX - 1.2, eyeBaseY);
    ctx.lineTo(rightEyeX + 2.2, eyeBaseY + 1.6);
    ctx.stroke();

    // Tiny frosty sparkle glints near squinted eyes
    drawFrostDiamondGlint(ctx, leftEyeX - 3.2, eyeBaseY - 2.2, 1.4, 0.9);
    drawFrostDiamondGlint(ctx, rightEyeX + 3.2, eyeBaseY - 2.2, 1.4, 0.9);
  } else if (isSleeping) {
    if (isSleepFlutter) {
      // Drowsy sleepy half-slit flutter
      ctx.strokeStyle = "#082f49";
      ctx.lineWidth = 1.3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.ellipse(leftEyeX, eyeBaseY + 0.3, 2.3, 0.65, 0, 0, Math.PI * 2);
      ctx.ellipse(rightEyeX, eyeBaseY + 0.3, 2.3, 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(leftEyeX - 0.5, eyeBaseY + 0.2, 1, 1);
      ctx.fillRect(rightEyeX - 0.5, eyeBaseY + 0.2, 1, 1);
    } else {
      // Peaceful deep sleep: Adorable closed sleeping arcs curving downwards with soft eyelashes
      ctx.strokeStyle = "#082f49";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";

      // Left sleeping eye curve
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeBaseY - 0.4, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      // Left outer eyelash
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 2.2, eyeBaseY + 0.5);
      ctx.lineTo(leftEyeX - 3.4, eyeBaseY - 0.2);
      ctx.stroke();

      // Right sleeping eye curve
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeBaseY - 0.4, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      // Right outer eyelash
      ctx.beginPath();
      ctx.moveTo(rightEyeX + 2.2, eyeBaseY + 0.5);
      ctx.lineTo(rightEyeX + 3.4, eyeBaseY - 0.2);
      ctx.stroke();
    }
  } else if (isBlinking) {
    // Cute happy crescent smiling eyes (^ ^)
    ctx.strokeStyle = "#082f49";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.arc(leftEyeX, eyeBaseY + 0.5, 2.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rightEyeX, eyeBaseY + 0.5, 2.5, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else {
    // Awake: Expressive glossy sapphire pebble eyes with dual catchlight reflections
    const renderEye = (ex, ey) => {
      // Outer dark navy/sapphire pebble
      ctx.fillStyle = "#082f49";
      ctx.beginPath();
      ctx.ellipse(ex, ey, 2.4, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bright cyan bottom reflection crescent
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.ellipse(ex, ey + 1.0, 1.6, 1.3, 0, 0, Math.PI);
      ctx.fill();

      // Deep inner pupil
      ctx.fillStyle = "#0c4a6e";
      ctx.beginPath();
      ctx.arc(ex, ey, 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Main specular catchlight gleam (large white round glint)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex - 0.7, ey - 0.9, 1.05, 0, Math.PI * 2);
      ctx.fill();

      // Secondary tiny twinkle highlight
      ctx.beginPath();
      ctx.arc(ex + 0.75, ey + 0.8, 0.55, 0, Math.PI * 2);
      ctx.fill();
    };

    renderEye(leftEyeX, eyeBaseY);
    renderEye(rightEyeX, eyeBaseY);
  }

  // 8. Cute Expressive Mouth
  ctx.save();
  if (isAttacking && attackProgress < 0.45) {
    // Attack Windup: Cute open 'o' mouth gathering frost breath
    ctx.fillStyle = "#082f49";
    ctx.beginPath();
    ctx.ellipse(0, 2.6, 1.5, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.ellipse(0, 3.2, 0.9, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (isSleeping) {
    // Peaceful sweet sleeping smile
    ctx.strokeStyle = "rgba(8, 47, 73, 0.75)";
    ctx.lineWidth = 1.0;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 2.8, 1.4, 0.18 * Math.PI, 0.82 * Math.PI);
    ctx.stroke();

    // Sleepy breathing frost bubble inflating and deflating gently at mouth corner
    const bubbleIntensity = Math.max(0, sleepBreath);
    if (bubbleIntensity > 0.05) {
      const bRad = 0.9 + bubbleIntensity * 1.7;
      const bX = 2.4 + bubbleIntensity * 0.8;
      const bY = 2.4 - bubbleIntensity * 0.4;
      const bGrad = safeCreateRadialGradient(ctx, bX - bRad * 0.3, bY - bRad * 0.3, 0, bX, bY, bRad);
      if (bGrad) {
        bGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
        bGrad.addColorStop(0.55, "rgba(186, 230, 253, 0.55)");
        bGrad.addColorStop(1, "rgba(56, 189, 248, 0.20)");
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(bX, bY, bRad, 0, Math.PI * 2);
        ctx.fill();

        // Tiny specular shine on bubble
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(bX - bRad * 0.45, bY - bRad * 0.45, 0.8, 0.8);
      }
    }
  } else {
    // Idle Awake: Gentle sweet smile curve
    ctx.strokeStyle = "rgba(8, 47, 73, 0.85)";
    ctx.lineWidth = 1.0;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 2.2, 1.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  // 9. Floating Satellite Snowball Hands (Awake Wide vs Sleeping Cozy Tucked In)
  let leftHandX = -18.5;
  let leftHandY = 2.0;
  let rightHandX = 18.5;
  let rightHandY = 2.0;

  if (isAttacking) {
    if (attackProgress < 0.35) {
      // Windup: Hands gather at front-center, swirling snow energy
      const gNorm = attackProgress / 0.35;
      const gWave = Math.sin(gNorm * Math.PI * 0.5);
      leftHandX = -18.5 + gWave * 12.0;
      rightHandX = 18.5 - gWave * 12.0;
      leftHandY = 2.0 + Math.sin(facingAngle) * 4.0;
      rightHandY = 2.0 + Math.sin(facingAngle) * 4.0;

      // Nascent spinning snowflake forming between the hands
      const growRadius = 2.5 + gNorm * 5.5;
      const spinAngle = now * 0.012;
      drawProceduralSnowflake(ctx, 0, 3.0, growRadius, spinAngle, gNorm * 0.9, "#ffffff", "#bae6fd");
    } else if (attackProgress <= 0.85) {
      // Release: Hands thrust outward in facing direction!
      const tNorm = (attackProgress - 0.35) / 0.50;
      const tWave = Math.sin(tNorm * Math.PI);
      const thrustDist = tWave * 14.0;

      leftHandX = -12.0 + Math.cos(facingAngle) * thrustDist;
      leftHandY = 2.0 + Math.sin(facingAngle) * thrustDist - 2.0;
      rightHandX = 12.0 + Math.cos(facingAngle) * thrustDist;
      rightHandY = 2.0 + Math.sin(facingAngle) * thrustDist + 2.0;
    }
  } else if (isSleeping) {
    // Sleeping standby: Hands snugly tucked in beside cheeks like resting paws
    leftHandX = -13.2 + Math.sin(now * 0.0016 + seed) * 0.6;
    leftHandY = 5.8 + sleepBreath * 1.2;
    rightHandX = 13.2 - Math.sin(now * 0.0016 + seed) * 0.6;
    rightHandY = 5.8 + sleepBreath * 1.2;
  } else {
    // Active awake idle: Hands bob playfully out wide
    const handSway = Math.sin(now * 0.004 + seed) * 2.8;
    leftHandX = -18.5;
    leftHandY = 2.0 + handSway;
    rightHandX = 18.5;
    rightHandY = 2.0 - handSway;
  }

  // Draw Left and Right Snowball Hands
  drawSnowsandSphere(ctx, leftHandX, leftHandY, 5.2, seed + 10);
  drawSnowsandSphere(ctx, rightHandX, rightHandY, 5.2, seed + 11);

  // Tiny orbiting crystalline frost pearls around hands
  const handOrbitAngle = now * 0.005;
  drawSnowsandSphere(ctx, leftHandX + Math.cos(handOrbitAngle) * 7.5, leftHandY + Math.sin(handOrbitAngle) * 3.5, 1.8, seed + 12);
  drawSnowsandSphere(ctx, rightHandX + Math.cos(handOrbitAngle + Math.PI) * 7.5, rightHandY + Math.sin(handOrbitAngle + Math.PI) * 3.5, 1.8, seed + 13);

  // 10. Orbiting Micro Snowsand Pearls (circling around the main body)
  for (let p = 0; p < 3; p++) {
    const pAngle = now * 0.0022 + (p * Math.PI * 2) / 3 + seed;
    const px = Math.cos(pAngle) * 23.0;
    const py = Math.sin(pAngle) * 9.0 - 2.0;
    const pDepth = Math.sin(pAngle);
    if (pDepth < 0) {
      drawSnowsandSphere(ctx, px, py, 2.6, seed + 14 + p);
    }
  }

  // 11. ATTACK VFX: Delicate Procedural Snowflake Flurry Projection!
  if (isAttacking && attackProgress > 0.30) {
    ctx.save();
    const flightProgress = (attackProgress - 0.30) / 0.70;
    const flakeTravelDist = flightProgress * 95.0;
    const mainFlakeX = Math.cos(facingAngle) * flakeTravelDist;
    const mainFlakeY = Math.sin(facingAngle) * flakeTravelDist;
    const mainFlakeAlpha = Math.max(0, 1.0 - Math.pow(flightProgress, 3));
    const mainSpin = now * 0.008 + flightProgress * 14.0;

    // A. Breezy Swirling Frost Wind Flurry Ribbons
    const gustCount = 3;
    for (let g = 0; g < gustCount; g++) {
      const gOffset = (g - 1) * 7.0;
      const gDist = flakeTravelDist * (0.6 + g * 0.18);
      const gx = Math.cos(facingAngle) * gDist - Math.sin(facingAngle) * gOffset;
      const gy = Math.sin(facingAngle) * gDist + Math.cos(facingAngle) * gOffset;

      ctx.strokeStyle = `rgba(186, 230, 253, ${mainFlakeAlpha * 0.45})`;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(gx, gy, 8.0, facingAngle - 0.6, facingAngle + 0.6);
      ctx.stroke();
    }

    // B. Main Grand 6-Point Dendritic Snowflake
    drawProceduralSnowflake(ctx, mainFlakeX, mainFlakeY, 13.5, mainSpin, mainFlakeAlpha, "#ffffff", "#7dd3fc");

    // C. Flanking Swirling Snowflakes (Dancing along sinusoidal arcs)
    const flank1Dist = flakeTravelDist * 0.75;
    const flank1Wave = Math.sin(now * 0.015) * 11.0;
    const f1x = Math.cos(facingAngle) * flank1Dist - Math.sin(facingAngle) * flank1Wave;
    const f1y = Math.sin(facingAngle) * flank1Dist + Math.cos(facingAngle) * flank1Wave;
    drawProceduralSnowflake(ctx, f1x, f1y, 7.8, -mainSpin * 1.3, mainFlakeAlpha * 0.9, "#ffffff", "#bae6fd");

    const flank2Dist = flakeTravelDist * 0.55;
    const flank2Wave = Math.cos(now * 0.015) * 11.0;
    const f2x = Math.cos(facingAngle) * flank2Dist - Math.sin(facingAngle) * flank2Wave;
    const f2y = Math.sin(facingAngle) * flank2Dist + Math.cos(facingAngle) * flank2Wave;
    drawProceduralSnowflake(ctx, f2x, f2y, 6.5, mainSpin * 1.5, mainFlakeAlpha * 0.85, "#ffffff", "#bae6fd");

    // D. Trailing Micro Snowflake
    const flank3Dist = flakeTravelDist * 0.35;
    const f3x = Math.cos(facingAngle) * flank3Dist;
    const f3y = Math.sin(facingAngle) * flank3Dist;
    drawProceduralSnowflake(ctx, f3x, f3y, 4.8, -mainSpin, mainFlakeAlpha * 0.75, "#ffffff", "#e0f2fe");

    ctx.restore();

    // Spawn live particles into canvas particle system during attack
    if (typeof spawnParticle === "function" && Math.random() < 0.35) {
      const pSpread = (Math.random() - 0.5) * 12;
      spawnParticle({
        x: (ent.x || 0) + Math.cos(facingAngle) * (flakeTravelDist * 1.5) + Math.sin(facingAngle) * pSpread,
        y: (ent.y || 0) + Math.sin(facingAngle) * (flakeTravelDist * 1.5) + Math.cos(facingAngle) * pSpread,
        vx: Math.cos(facingAngle) * (70 + Math.random() * 80),
        vy: Math.sin(facingAngle) * (70 + Math.random() * 80) - 15,
        color: "#ffffff",
        accentColor: "#bae6fd",
        size: 5.5 + Math.random() * 4.5,
        maxLife: 1.2,
        drag: 0.94,
        style: "snowflake",
        gravity: 25,
        shrink: true
      });
    }
  }

  // 12. Front Orbiting Micro Snowsand Pearls
  for (let p = 0; p < 3; p++) {
    const pAngle = now * 0.0022 + (p * Math.PI * 2) / 3 + seed;
    const px = Math.cos(pAngle) * 23.0;
    const py = Math.sin(pAngle) * 9.0 - 2.0;
    const pDepth = Math.sin(pAngle);
    if (pDepth >= 0) {
      drawSnowsandSphere(ctx, px, py, 2.6, seed + 14 + p);
      drawFrostDiamondGlint(ctx, px, py, 1.4, 0.85);
    }
  }

  // 13. Floating Sleepy Crystalline "Z z z" Letters (When resting in standby nap)
  if (isSleeping) {
    for (let z = 0; z < 3; z++) {
      const zLoop = (now * 0.00045 + z * 0.333 + seed * 0.1) % 1.0;
      const zAlpha = Math.sin(zLoop * Math.PI) * 0.85;
      if (zAlpha > 0.02) {
        const zDist = zLoop * 34.0;
        const zSway = Math.sin(zLoop * 6.0 + z) * 4.5;
        const zX = 6.5 + zSway;
        const zY = -2.0 - zDist;
        const zSize = 1.8 + z * 0.7 + zLoop * 1.4;

        ctx.save();
        ctx.translate(zX, zY);
        ctx.rotate(Math.sin(zLoop * 4.0) * 0.18);
        ctx.strokeStyle = `rgba(186, 230, 253, ${zAlpha})`;
        ctx.lineWidth = 1.1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(-zSize, -zSize);
        ctx.lineTo(zSize, -zSize);
        ctx.lineTo(-zSize, zSize);
        ctx.lineTo(zSize, zSize);
        ctx.stroke();

        // Delicate frosty highlight on Z corner
        ctx.fillStyle = `rgba(255, 255, 255, ${zAlpha * 0.95})`;
        ctx.fillRect(zSize - 0.6, -zSize - 0.6, 1.2, 1.2);
        ctx.restore();
      }
    }
  }

  // 14. Continuous Ambient Powdered Snow Dust
  if (!isShadowPass && Math.random() < (isSleeping ? 0.10 : 0.22)) {
    if (typeof spawnParticle === "function") {
      const pAngle = Math.random() * Math.PI * 2;
      const pDist = Math.random() * 18.0;
      spawnParticle({
        x: (ent.x || 0) + Math.cos(pAngle) * pDist,
        y: (ent.y || 0) + Math.sin(pAngle) * pDist - 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -10 - Math.random() * 15,
        color: ["#ffffff", "#f0f9ff", "#e0f2fe", "#bae6fd"],
        size: 1.4 + Math.random() * 2.0,
        maxLife: 0.65,
        gravity: 10,
        drag: 0.94,
        shrink: true,
        style: "circle"
      });
    }
  }

  ctx.restore();
}

export const drawFrostElemental = drawFrostElementalEntity;

// --- Family: Giant Rat ---
// rats.js - Lineless Procedural Giant Rat & Vermin Entity Renderer


/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

/**
 * Triggers a procedural limb and debris explosion upon rat death.
 * Produces severed digitigrade rodent paws, sleek tail segments,
 * rat craniums with clean incisors, and fur tuft particles.
 * @param {Object} ce - Combat entity
 */
export function triggerRatDeathExplosion(ce) {
  if (!ce || ce._limbsExploded) return;
  ce._limbsExploded = true;

  const rawType = (ce.type || "rat").toLowerCase();
  const isBoss = rawType.startsWith("boss_") || rawType.includes("king");
  const isDire = rawType.includes("dire") || rawType.includes("armored");
  const isAlbino = rawType.includes("albino") || rawType.includes("white");
  const isShadow = rawType.includes("shadow") || rawType.includes("black");

  const bodyColor = isBoss
    ? "#1e1326"
    : isAlbino
      ? "#e4e4e7"
      : isShadow
        ? "#18181b"
        : isDire
          ? "#1e293b"
          : "#423225";

  const accentColor = isBoss
    ? "#0f0814"
    : isAlbino
      ? "#f472b6"
      : isShadow
        ? "#09090b"
        : isDire
          ? "#0f172a"
          : "#241a12";

  const skinTone = isAlbino ? "#fbcfe8" : isDire ? "#94a3b8" : "#d8a399";

  if (typeof spawnParticle === "function") {
    // 1. Articulated Rodent Claws & Paws
    const pawCount = isBoss ? 6 : 4;
    for (let i = 0; i < pawCount; i++) {
      spawnParticle({
        x: (ce.x || 0) + (Math.random() - 0.5) * 18,
        y: (ce.y || 0) + (Math.random() - 0.5) * 18,
        vx: (Math.random() - 0.5) * 190,
        vy: -90 - Math.random() * 110,
        color: bodyColor,
        accentColor: skinTone,
        size: isBoss ? 6.5 : 4.2,
        maxLife: 2.0,
        drag: 0.94,
        style: "rat_paw",
        gravity: 210,
        shrink: true,
      });
    }

    // 2. Simple Sleek Whip Tail Segments
    const tailCount = isBoss ? 4 : 1;
    for (let t = 0; t < tailCount; t++) {
      const tAngle = (t / tailCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const tSpeed = isBoss ? 130 + Math.random() * 60 : 140;
      spawnParticle({
        x: (ce.x || 0) - 8 + Math.cos(tAngle) * 6,
        y: (ce.y || 0) + Math.sin(tAngle) * 6,
        vx: Math.cos(tAngle) * tSpeed,
        vy: -75 - Math.random() * 95,
        color: skinTone,
        accentColor: bodyColor,
        size: isBoss ? 13 : 9,
        maxLife: 2.2,
        drag: 0.94,
        style: "rat_tail",
        gravity: 200,
        shrink: true,
      });
    }

    // 3. Feral Cranium with Clean Incisors
    const skullCount = isBoss ? 3 : 1;
    for (let s = 0; s < skullCount; s++) {
      const isMaster = s === 0;
      spawnParticle({
        x: (ce.x || 0) + (isMaster ? 8 : (Math.random() - 0.5) * 14),
        y: (ce.y || 0) + (isMaster ? 0 : (Math.random() - 0.5) * 10),
        vx: (Math.random() - 0.5) * (isMaster ? 150 : 190),
        vy: -95 - Math.random() * (isMaster ? 80 : 120),
        color: bodyColor,
        accentColor: isBoss ? "#f59e0b" : accentColor,
        size: isMaster ? (isBoss ? 13 : 9) : 7.5,
        maxLife: 2.3,
        drag: 0.94,
        style: "rat_head",
        gravity: 200,
        shrink: true,
      });
    }

    // 4. Rat King Scavenged Diadem Metal Shards, Incisors & Jewels
    if (isBoss) {
      const crownColors = ["#f59e0b", "#fef08a", "#fef9c3", "#ef4444", "#d97706", "#ffffff"];
      for (let c = 0; c < 14; c++) {
        spawnParticle({
          x: (ce.x || 0) + 8 + (Math.random() - 0.5) * 8,
          y: (ce.y || 0) - 6 + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 220,
          vy: -110 - Math.random() * 130,
          color: crownColors[c % crownColors.length],
          accentColor: "#92400e",
          size: 3.2 + Math.random() * 3.5,
          maxLife: 2.0,
          drag: 0.93,
          style: c % 3 === 0 ? "rat_paw" : "circle",
          gravity: 220,
          shrink: true,
        });
      }
    }

    // 5. Clean Fur Tuft Particles
    const tuftCount = isBoss ? 24 : 14;
    for (let f = 0; f < tuftCount; f++) {
      spawnParticle({
        x: (ce.x || 0) + (Math.random() - 0.5) * 16,
        y: (ce.y || 0) + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 160,
        vy: -50 - Math.random() * 100,
        color: [bodyColor, accentColor, "#6b5444"],
        size: 1.8 + Math.random() * 2.4,
        maxLife: 1.2 + Math.random() * 0.6,
        drag: 0.92,
        gravity: 170,
        style: "circle",
        shrink: true,
      });
    }
  }
}

/**
 * Universal Lineless Procedural Rat Entity Renderer
 * Clean rodent biology:
 * - Natural rodent fur coats (brown sewer, dire slate, sleek black, albino white)
 * - Zero plague aspects: no buboes, no pustules, no bile motes, no diseased drool
 * - Simple, elegant, smooth-tapered rodent tail
 * - Lifelike quadruped scurrying leg mechanics with articulated thigh, knee, shank, and clawed foot
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {Object} ent
 * @param {boolean} isShadowPass - Strictly prohibited from drawing solid shadows
 */
export function drawRatEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};

  const rawType = (ent.type || "rat").toLowerCase();
  const isSlowed = !!ent.isSlowed;
  let angle = 0;
  if (typeof ent.facingAngle === "number" && !isNaN(ent.facingAngle)) {
    angle = ent.facingAngle;
  } else if (typeof ent.angle === "number" && !isNaN(ent.angle)) {
    angle = ent.angle;
  } else if (typeof ent.rotation === "number" && !isNaN(ent.rotation)) {
    angle = ent.rotation;
  } else if (typeof ent.vx === "number" && typeof ent.vy === "number" && (ent.vx !== 0 || ent.vy !== 0)) {
    angle = Math.atan2(ent.vy, ent.vx);
  }
  if (ent._seed === undefined) {
    ent._seed = computeFastSeed(ent.id || "rat_clean");
  }
  const seed = ent._seed;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  // Species Classification - strictly free of plague
  const isBoss = rawType === "boss_rat_king" || rawType.startsWith("boss_") || rawType.includes("king");
  const isDire = rawType === "dire_rat" || rawType === "armored_rat" || rawType.includes("dire") || rawType.includes("armored");
  const isAlbino = rawType === "albino_rat" || rawType.includes("albino") || rawType.includes("white");
  const isShadow = rawType === "shadow_rat" || rawType.includes("shadow") || rawType.includes("black");

  // Proportions & Sizing
  const baseScale = isBoss ? 2.5 : isDire ? 2.05 : 1.75;
  const r = isBoss ? 33 : isDire ? 22 : 17;

  // -------------------------------------------------------------
  // Palettes (Clean, natural rodent pelts & healthy skin tones)
  // -------------------------------------------------------------
  // Default: Common Brown / Sewer Rat
  let furMantle = "#5c4333";
  let furCore = "#3f2d21";
  let furShadow = "#221710";
  let furHighlight = "#80604b";
  let skinTone = "#d8a399";
  let skinShadow = "#a66d62";
  let eyeColor = "#181412";
  let eyePupil = "#ffffff";
  let toothColor = "#fef9c3";

  if (isBoss) {
    // The Sovereign Rat King: Regal deep dark plum velvet fur
    furMantle = "#2a1636";
    furCore = "#180a21";
    furShadow = "#0a030f";
    furHighlight = "#4a2c59";
    skinTone = "#c2899f";
    skinShadow = "#7d475d";
    eyeColor = "#dc2626";
    eyePupil = "#fef08a";
    toothColor = "#fef9c3";
  } else if (isDire) {
    // Dire Armored Rat: Dark Slate Steel Pelt
    furMantle = "#334155";
    furCore = "#1e293b";
    furShadow = "#0f172a";
    furHighlight = "#64748b";
    skinTone = "#94a3b8";
    skinShadow = "#475569";
    eyeColor = "#d97706";
    eyePupil = "#fef3c7";
    toothColor = "#f8fafc";
  } else if (isAlbino) {
    // Albino Rat: Clean Ivory / Soft Cream Pelt with Pink Eyes & Paws
    furMantle = "#f4f4f5";
    furCore = "#e4e4e7";
    furShadow = "#a1a1aa";
    furHighlight = "#ffffff";
    skinTone = "#fbcfe8";
    skinShadow = "#f472b6";
    eyeColor = "#e11d48";
    eyePupil = "#ffe4e6";
    toothColor = "#ffffff";
  } else if (isShadow) {
    // Shadow Vermin: Sleek Charcoal Ebony Pelt
    furMantle = "#27272a";
    furCore = "#18181b";
    furShadow = "#09090b";
    furHighlight = "#3f3f46";
    skinTone = "#71717a";
    skinShadow = "#3f3f46";
    eyeColor = "#f59e0b";
    eyePupil = "#fef08a";
    toothColor = "#fef9c3";
  }

  if (isSlowed) {
    furMantle = "#0c4a6e";
    furCore = "#072b40";
    furShadow = "#031520";
    furHighlight = "#38bdf8";
  }

  // -------------------------------------------------------------
  // Kinematics & Timing (Attacks, Breaths, Scurrying)
  // -------------------------------------------------------------
  const isAttacking = !!(ent.isAttacking || ent.currentCast);
  let attackProgress = 0;
  const attackType = ent.attackType || ent.ratAttackType || (isBoss ? "surge" : "chomp");
  const defaultAttackDur = isBoss ? 1000 : 650;

  if (isAttacking) {
    if (ent.currentCast) {
      if (typeof ent.currentCast.progress === "number" && !isNaN(ent.currentCast.progress)) {
        attackProgress = Math.min(1, Math.max(0, ent.currentCast.progress));
      } else if (ent.currentCast.duration > 0) {
        const start = ent.currentCast.startTime || now;
        const currentRef = start > 1e11 ? Date.now() : now;
        attackProgress = Math.min(1, Math.max(0, (currentRef - start) / ent.currentCast.duration));
      } else {
        attackProgress = (now % defaultAttackDur) / defaultAttackDur;
      }
    } else {
      const animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime;
      if (animStart) {
        const currentRef = animStart > 1e11 ? Date.now() : now;
        attackProgress = Math.min(1, Math.max(0, (currentRef - animStart) / (ent.attackDuration || defaultAttackDur)));
      } else {
        attackProgress = (now % defaultAttackDur) / defaultAttackDur;
      }
    }
  }

  // Attack Offsets
  let lungeX = 0;
  let jawOpen = 0;
  let clawSwipe = 0;
  let pounceHeight = 0;
  let spinalPitch = 0;

  if (isAttacking && attackProgress > 0) {
    if (attackType === "surge") {
      // Sovereign Outburst: Rears up, roars, swipes forepaws
      if (attackProgress < 0.45) {
        const t = attackProgress / 0.45;
        pounceHeight = -t * (isBoss ? 9 : 6);
        spinalPitch = -t * 0.28;
        lungeX = -t * (r * 0.18);
        jawOpen = t * 0.75;
      } else if (attackProgress < 0.78) {
        const t = (attackProgress - 0.45) / 0.33;
        pounceHeight = (isBoss ? -9 : -6) + t * (isBoss ? 9 : 6);
        spinalPitch = -0.28 + t * 0.38;
        lungeX = r * 0.35;
        jawOpen = 0.75;
        clawSwipe = Math.sin(t * Math.PI) * (isBoss ? 8 : 5.5);
      } else {
        const t = (attackProgress - 0.78) / 0.22;
        pounceHeight = 0;
        spinalPitch = 0.1 * (1 - t);
        lungeX = (r * 0.35) * (1 - t);
        jawOpen = 0;
      }
    } else {
      // Vicious Chomp / Pounce: Pre-strike crouch then springing snap
      if (attackProgress < 0.32) {
        const t = attackProgress / 0.32;
        lungeX = -t * (r * 0.32);
        jawOpen = t * 0.55;
        pounceHeight = -t * (isBoss ? 4.0 : 2.5);
        spinalPitch = -t * 0.12;
      } else if (attackProgress < 0.68) {
        const t = (attackProgress - 0.32) / 0.36;
        const spring = Math.sin(t * Math.PI * 0.5);
        lungeX = -r * 0.32 + spring * (r * 0.95);
        pounceHeight = (isBoss ? -4.0 : -2.5) + Math.sin(t * Math.PI) * (isBoss ? -7 : -5);
        clawSwipe = Math.sin(t * Math.PI) * (isBoss ? 7.5 : 5.0);
        spinalPitch = 0.08;
        jawOpen = t < 0.4 ? 0.7 : (0.7 * Math.max(0, 1 - (t - 0.4) / 0.35));
      } else {
        const t = (attackProgress - 0.68) / 0.32;
        lungeX = (r * 0.38) * (1 - t);
        jawOpen = 0;
        pounceHeight = 0;
        spinalPitch = 0;
      }
    }
  }

  // -------------------------------------------------------------
  // Improved Quadruped Scurry Leg Movement System
  const isMoving = ent.isMoving !== undefined
    ? !!ent.isMoving
    : !!(ent.moving || (ent.vx !== undefined && ent.vy !== undefined && (ent.vx * ent.vx + ent.vy * ent.vy > 20)));
  const scurrySpeed = isSlowed ? 0.006 : (isBoss ? 0.009 : 0.0125);
  const scurryPhase = now * scurrySpeed + (seed % 100);

  // Natural quadruped trotting scurry gait:
  // Forelegs lead hindlegs by a slight organic offset for fluid body ripple
  const foreLead = 0.22;
  const phaseFarFore = scurryPhase + foreLead;
  const phaseNearHind = scurryPhase;
  const phaseNearFore = scurryPhase + Math.PI + foreLead;
  const phaseFarHind = scurryPhase + Math.PI;

  // Stride amplitude & foot lift height
  const frontStride = isMoving ? r * 0.42 : 0;
  const hindStride = isMoving ? r * 0.48 : 0;
  const stepLiftHeight = isMoving ? (isBoss ? 4.2 : 3.2) : 0;

  // -------------------------------------------------------------
  // Organic Breathing, Sniffing Bursts & Alert Rodent Idle Cycles
  // -------------------------------------------------------------
  const breath = Math.sin(now * 0.0024 + seed) * (isMoving ? 0.022 : 0.048);
  
  // Rodent sniffing bouts: smooth continuous intensity envelope
  const sniffRaw = Math.sin(now * 0.0013 + seed * 2.1);
  const sniffIntensity = (!isMoving && !isAttacking && sniffRaw > 0) ? Math.pow(sniffRaw, 2.0) : 0;
  const sniffTwitch = (Math.sin(now * 0.032) * 0.75 * sniffIntensity) + Math.sin(now * 0.0035 + seed) * (0.18 * (1 - sniffIntensity));

  // Sensory Vibrissae (Whiskers): flaring forward smoothly during sniffing bouts
  const whiskerFlare = (sniffIntensity * 1.5) + (Math.sin(now * 0.032) * 1.2 * sniffIntensity) + Math.sin(now * 0.008 + seed) * 0.5;
  const whiskerVibe = (isMoving ? 1.0 : 0) + whiskerFlare;

  // Independent auditory ear scanning in idle
  const earFlick = (Math.sin(now * 0.0016 + seed) > 0.88) ? Math.sin(now * 0.025) * 0.18 : 0;
  const farEarScan = isMoving ? 0 : (Math.sin(now * 0.0011 + seed) * 0.08);
  const nearEarScan = isMoving ? 0 : (-Math.cos(now * 0.0014 + seed * 1.6) * 0.08);

  // Inquisitive cranial elevation & scan in idle
  const idleHeadElevate = isMoving ? 0 : (-1.4 * sniffIntensity + Math.sin(now * 0.0018 + seed) * (0.6 * (1 - sniffIntensity)));
  const idleHeadScan = isMoving ? 0 : (Math.sin(now * 0.00085 + seed) * 0.07 + Math.cos(now * 0.0017 + seed * 1.9) * 0.035);

  // Idle stance weight shifting
  const idleWeight = isMoving ? 0 : Math.sin(now * 0.0024 + seed) * 0.4;

  // Periodic rodent idle blink (~140ms quick blink every ~4.5 - 7 seconds)
  const blinkCycleMs = 4500 + (seed % 2500);
  const blinkElapsed = (now + seed * 450) % blinkCycleMs;
  let eyelidCloseRatio = 0;
  if (!isAttacking && blinkElapsed < 140) {
    eyelidCloseRatio = Math.sin((blinkElapsed / 140) * Math.PI);
  }


  // Scurry spine dynamics:
  // 1. Vertical bounce (peaks as limbs push off)
  const spineBobY = isMoving ? Math.abs(Math.sin(scurryPhase * 2)) * 1.4 : 0;
  // 2. Lateral pelvic roll / spinal sway
  const bodySway = isMoving ? Math.sin(scurryPhase) * 0.035 : 0;

  // Hit Flinch
  const hitAge = ent.lastHitTime ? (now - ent.lastHitTime) : 9999;
  let hitFlinchX = 0;
  let isFlashing = false;
  let flashAmt = 0;
  if (hitAge >= 0 && hitAge < 160) {
    const t = hitAge / 160;
    hitFlinchX = -Math.sin((1 - t) * Math.PI) * 3.5;
    isFlashing = true;
    flashAmt = 1 - t;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(baseScale, baseScale);

  // Facing Direction: Flip horizontally for Left/West, Never invert vertically (upside down)
  let facingSign = ent._facingSign !== undefined ? ent._facingSign : 1;
  const cosA = Math.cos(angle);
  if (Math.abs(cosA) > 0.05) {
    facingSign = cosA >= 0 ? 1 : -1;
    ent._facingSign = facingSign;
  }
  ctx.scale(facingSign, 1);

  // Gentle vertical pitch to align with North/South locomotion without inverting vertical axis
  const verticalPitch = Math.sin(angle) * 0.16 * facingSign;
  ctx.rotate(verticalPitch);

  // Apply Lunge, Pounce Arc, Body Bob, Scurry Sway, and Flinch
  ctx.translate(lungeX + hitFlinchX, pounceHeight + spineBobY);
  if (spinalPitch !== 0 || bodySway !== 0) {
    ctx.rotate(spinalPitch + bodySway);
  }

  if (isFlashing) {
    ctx.filter = `brightness(${1 + flashAmt * 1.6}) contrast(${1 + flashAmt * 0.35})`;
  }

  // -------------------------------------------------------------
  // Helper: Draw Articulated Rodent Leg
  // -------------------------------------------------------------
  function drawArticulatedLeg(hipX, hipY, phase, stride, isFore, isNear) {
    const legColor = isNear ? furMantle : furCore;
    const jointColor = isNear ? furHighlight : furShadow;
    const footColor = isNear ? skinTone : skinShadow;

    // Kinematic motion calculation
    let footDx = 0;
    let footDy = 0;
    let pawPitch = 0;
    let footSquashX = 1.0;
    let footSquashY = 1.0;

    if (isMoving) {
      // Horizontal stride: pushes back on stance, reaches forward on swing
      footDx = -Math.cos(phase) * stride;
      const sinP = Math.sin(phase);

      if (sinP > 0) {
        // Swing phase (paw lifted in the air moving forward)
        footDy = -sinP * stepLiftHeight;
        // Paw articulates: curls slightly at lift-off, flattens to reach forward
        pawPitch = Math.cos(phase) * 0.28;
      } else {
        // Stance phase (paw planted, bearing weight)
        const stanceWeight = Math.abs(sinP);
        footDy = stanceWeight * 0.4;
        footSquashX = 1.0 + stanceWeight * 0.12;
        footSquashY = 1.0 - stanceWeight * 0.08;
        pawPitch = -0.04 + Math.cos(phase) * 0.06;
      }
    } else {
      // Natural quadruped idle stance & inquisitive rodent sniffing paw tap
      if (isFore && isNear) {
        // Near Foreleg: Inquisitive sniffing paw lift every ~4-5 seconds
        const liftRaw = Math.sin(now * 0.0014 + seed * 3.7);
        const liftProgress = (liftRaw > 0.4) ? Math.pow(Math.sin(((liftRaw - 0.4) / 0.6) * Math.PI), 2.0) : 0;
        
        footDy = -liftProgress * (isBoss ? 4.5 : 3.2) - (1 - liftProgress) * (idleWeight * 0.15);
        footDx = -liftProgress * (isBoss ? 1.8 : 1.2) + (1 - liftProgress) * (idleWeight * 0.3);
        pawPitch = liftProgress * 0.35 + (1 - liftProgress) * (-0.05 + idleWeight * 0.05);
        footSquashX = 1.0 - liftProgress * 0.05;
        footSquashY = 1.0 + liftProgress * 0.05;
      } else if (isFore && !isNear) {
        // Far Foreleg: Supporting front stance weight
        footDx = -idleWeight * 0.25;
        footDy = idleWeight * 0.2;
        pawPitch = 0.04;
      } else if (!isFore && isNear) {
        // Near Hindleg: Braced athletic digitigrade stance
        footDx = -idleWeight * 0.35;
        footDy = Math.max(0, idleWeight) * 0.25;
        pawPitch = -0.08;
      } else {
        // Far Hindleg: Stabilizing pelvis
        footDx = idleWeight * 0.2;
        footDy = -Math.max(0, -idleWeight) * 0.2;
        pawPitch = 0.06;
      }
    }

    // Claw swipe offset for forelegs during attack
    if (isFore && isAttacking) {
      footDx += clawSwipe * (isNear ? 1.0 : 0.7);
    }

    const footTargetX = hipX + footDx + (isFore ? 2.5 : -2.0);
    const footTargetY = hipY + footDy + (isFore ? 3.0 : 4.0);

    // Dynamic intermediate joint calculation with natural flexion
    const jointFlex = isMoving ? Math.sin(phase) * (isFore ? 1.0 : -1.4) : 0;
    const midX = (hipX + footTargetX) * 0.5 + (isFore ? -2.2 : 2.5) + jointFlex;
    const midY = (hipY + footTargetY) * 0.5 - (isMoving ? 1.8 : 0.9) - Math.max(0, -footDy * 0.4);

    ctx.save();

    // 1. Muscular upper segment (Thigh or Shoulder)
    if (!isFore && isNear) {
      ctx.fillStyle = furCore;
      ctx.beginPath();
      ctx.ellipse(hipX, hipY, isBoss ? 5.2 : 3.8, isBoss ? 4.0 : 2.8, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = legColor;
    ctx.lineWidth = isBoss ? 3.8 : 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(midX, midY);
    ctx.stroke();

    // Joint highlight / soft shading
    ctx.strokeStyle = jointColor;
    ctx.lineWidth = isBoss ? 2.6 : 1.8;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(midX, midY);
    ctx.stroke();

    // 2. Lower shank segment tapering to paw
    ctx.strokeStyle = footColor;
    ctx.lineWidth = isBoss ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(footTargetX, footTargetY);
    ctx.stroke();

    // 3. Articulated Paw with Dexterous Digits
    ctx.save();
    ctx.translate(footTargetX, footTargetY);
    ctx.rotate((isFore ? 0.18 : 0.12) + pawPitch);
    ctx.scale(footSquashX, footSquashY);

    ctx.fillStyle = footColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, isBoss ? 3.0 : 2.2, isBoss ? 1.8 : 1.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3 Articulated Dexterous Toes with Claws pointing forward
    ctx.fillStyle = footColor;
    const toeR = isBoss ? 1.1 : 0.8;
    ctx.beginPath();
    ctx.arc(isBoss ? 2.2 : 1.6, -0.6, toeR, 0, Math.PI * 2);
    ctx.arc(isBoss ? 2.6 : 1.9, 0.0, toeR, 0, Math.PI * 2);
    ctx.arc(isBoss ? 2.2 : 1.6, 0.6, toeR, 0, Math.PI * 2);
    ctx.fill();

    // Sharp forward-facing claws
    ctx.fillStyle = toothColor;
    const cW = isBoss ? 1.8 : 1.3;
    const cH = isBoss ? 0.8 : 0.6;
    ctx.fillRect(isBoss ? 2.6 : 1.9, -0.8, cW, cH);
    ctx.fillRect(isBoss ? 3.0 : 2.2, -0.2, cW * 1.1, cH);
    ctx.fillRect(isBoss ? 2.6 : 1.9, 0.4, cW, cH);

    ctx.restore();
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 1. Procedural Ground-Sliding & Unstable Serpentine Rodent Tail
  // Features:
  // - Anchored firmly inside rump to prevent detaching from body
  // - Natural rump-to-ground drape: curves down to rest on the ground plane
  // - Floor friction & sliding dynamics: drags along the surface behind the scurrying rat
  // - Kinematic instability: multi-harmonic serpentine waves, whip-tip snaps, and nervous micro-twitches
  // - Subsurface contact shadow: grounds the tail directly to the floor surface
  // - Volumetric tapering envelope from muscular root to slender whip tip
  // - Knot cluster for Sovereign Rat King
  // -------------------------------------------------------------
  const spineSquashX = 1 + breath - (isMoving ? Math.sin(scurryPhase * 2) * 0.035 : 0);
  const spineSquashY = 1 - breath * 0.5 + (isMoving ? Math.sin(scurryPhase * 2) * 0.025 : 0);
  const tailBaseX = -r * 0.78 * spineSquashX;
  const tailBaseY = 0.5 * spineSquashY;
  const targetGroundY = isBoss ? (r * 0.22 + 3.2) : (r * 0.20 + 2.4);

  ctx.save();

  // Helper to draw a single continuous ground-sliding tail with physical dragging dynamics
  function drawGroundSlidingTail(tailOpts) {
    const {
      length = r * 2.4,
      baseWidth = isBoss ? 5.2 : 3.6,
      tipWidth = isBoss ? 1.1 : 0.7,
      angleOffset = 0,
      waveFreqMult = 1.0,
      phaseOffset = 0,
      tailIdx = 0,
      segments = 16
    } = tailOpts;

    const nodes = [];
    const segStep = length / segments;
    const speedMult = isSlowed ? 0.45 : 1.0;

    // Continuous wave speed: active scurry cadence when moving, gentle idle slither when standing
    const tailWaveSpeed = isMoving ? (0.0135 * speedMult) : (0.0028 * speedMult);
    const continuousPhase = (now * tailWaveSpeed) + (seed % 100) * 0.1;

    // Progressive kinematics calculation
    for (let s = 0; s <= segments; s++) {
      const t = s / segments; // 0.0 (rump root) -> 1.0 (whip tip)

      // 1. Ground drape: tail slopes down from rump (tailBaseY) to touch the floor (targetGroundY)
      const drapeProgress = Math.min(1.0, t / 0.25);
      const easeDrape = Math.sin(drapeProgress * Math.PI * 0.5);
      const groundLine = tailBaseY * (1.0 - easeDrape) + targetGroundY * easeDrape;

      // Kinematic wave ramp: strictly 0 at the root (t = 0) so the tail NEVER detaches from the body
      const waveRamp = Math.min(1.0, Math.pow(t / 0.18, 1.4));

      // 2. Wave propagation lag: continuous traveling wave with phase delay along tail
      const wavePhase = (continuousPhase * waveFreqMult) - (t * 3.4) + phaseOffset;

      // 3. Multi-harmonic serpentine lateral drag (sliding across the floor with ZERO leaps)
      // Primary dragging wave (ramped up from 0 at the root)
      const primaryAmp = (isMoving ? (3.5 + t * 9.5) : (1.8 + t * 5.2)) * waveRamp;
      const primarySway = Math.sin(wavePhase) * primaryAmp;

      // Smooth secondary chaotic harmonic (ramped from 0 at root)
      const chaoticHarmonic = Math.sin(wavePhase * 1.63 + seed * 0.3 + tailIdx * 1.4) * (1.1 + t * 3.2) * waveRamp;

      // Slower ground friction drag resistance (ramped from 0 at root)
      const frictionDrift = Math.sin(now * 0.0022 * speedMult - t * 2.5 + seed * 0.5 + tailIdx) * (0.9 + t * 2.6) * waveRamp;

      // High-frequency nervous rodent micro-twitch with smooth C2 bell-curve burst (ramped from 0 at root)
      const twitchEnvelope = Math.max(0, Math.sin(now * 0.0019 + seed * 2.5 + tailIdx * 1.2));
      const smoothTwitchBurst = Math.pow(twitchEnvelope, 4);
      const microTwitch = Math.sin(now * 0.018 + t * 5.5) * smoothTwitchBurst * (0.8 + t * 2.5) * waveRamp;

      // Whip tip snap and curl (smooth continuous trigonometric functions, active only towards the tip)
      const tipSnapFactor = Math.pow(Math.max(0, (t - 0.52) / 0.48), 2.0);
      const tipPhase = wavePhase * 1.2 + seed + tailIdx;
      const tipCurlX = Math.cos(tipPhase) * (tipSnapFactor * (isBoss ? 3.8 : 2.6));
      const tipCurlY = Math.sin(tipPhase) * (tipSnapFactor * (isBoss ? 5.2 : 3.8));

      // Ground drag longitudinal compression (dragging friction smoothly flexes length)
      const dragCompression = (Math.sin(wavePhase * 0.85) * 0.04 + 0.03) * t;

      // Nominal X extending backwards from rump
      const nominalX = tailBaseX - (segStep * s) * (1.0 - dragCompression) + tipCurlX;

      // Fan spread for Rat King swarm knot (ramped from 0 at root)
      const spreadX = -Math.cos(angleOffset) * (segStep * s * 0.14);
      const spreadY = Math.sin(angleOffset) * (segStep * s * 0.65) * waveRamp;

      const nodeX = nominalX + spreadX;
      // Ground plane contact + lateral serpentine sliding + chaotic harmonics + twitches
      const nodeY = groundLine + spreadY + primarySway + chaoticHarmonic + frictionDrift + microTwitch + tipCurlY;

      // Dynamic tapering: thick muscular root down to delicate whip tip
      const nodeW = baseWidth * Math.pow(1.0 - t * 0.82, 1.35) + tipWidth;

      nodes.push({
        x: nodeX,
        y: nodeY,
        w: nodeW,
        t: t,
        isOnGround: t >= 0.22
      });
    }

    // Compute continuous perpendicular normals for volumetric envelope
    for (let i = 0; i < nodes.length; i++) {
      let dx = 0;
      let dy = 0;
      if (i === 0) {
        dx = nodes[1].x - nodes[0].x;
        dy = nodes[1].y - nodes[0].y;
      } else if (i === nodes.length - 1) {
        dx = nodes[i].x - nodes[i - 1].x;
        dy = nodes[i].y - nodes[i - 1].y;
      } else {
        dx = nodes[i + 1].x - nodes[i - 1].x;
        dy = nodes[i + 1].y - nodes[i - 1].y;
      }
      const len = Math.sqrt((dx) * (dx) + (dy) * (dy)) || 1;
      nodes[i].perpX = -dy / len;
      nodes[i].perpY = dx / len;
    }

    // 1. Subsurface Ground Contact Shadow (Firmly roots the tail to the floor surface)
    ctx.save();
    ctx.beginPath();
    let shadowStarted = false;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.isOnGround) {
        const shadowY = node.y + (node.w * 0.38) + 0.7;
        if (!shadowStarted) {
          ctx.moveTo(node.x, shadowY);
          shadowStarted = true;
        } else {
          ctx.lineTo(node.x, shadowY);
        }
      }
    }
    if (shadowStarted) {
      ctx.strokeStyle = "rgba(18, 12, 10, 0.24)";
      ctx.lineWidth = baseWidth * 0.95;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      ctx.strokeStyle = "rgba(10, 6, 5, 0.12)";
      ctx.lineWidth = baseWidth * 1.6;
      ctx.stroke();
    }
    ctx.restore();

    // 2. Sliding Ground Skid Marks / Friction Dust when scurrying
    if (isMoving && nodes.length > 8) {
      const dustNode1 = nodes[Math.floor(nodes.length * 0.45)];
      const dustNode2 = nodes[Math.floor(nodes.length * 0.8)];
      const dustAlpha = 0.18 + Math.sin(now * 0.01 + seed + tailIdx) * 0.08;
      ctx.fillStyle = `rgba(168, 138, 118, ${dustAlpha})`;
      ctx.beginPath();
      ctx.ellipse(dustNode1.x + 1.2, dustNode1.y + 1.4, 1.9, 0.9, 0, 0, Math.PI * 2);
      ctx.ellipse(dustNode2.x + 0.6, dustNode2.y + 1.1, 1.4, 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Volumetric Tail Body Envelope (Continuous organic lineless polygon)
    ctx.beginPath();
    // Top ridge (root to tip)
    ctx.moveTo(nodes[0].x + nodes[0].perpX * (nodes[0].w * 0.5), nodes[0].y + nodes[0].perpY * (nodes[0].w * 0.5));
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const cur = nodes[i];
      const mx = (prev.x + prev.perpX * (prev.w * 0.5) + cur.x + cur.perpX * (cur.w * 0.5)) * 0.5;
      const my = (prev.y + prev.perpY * (prev.w * 0.5) + cur.y + cur.perpY * (cur.w * 0.5)) * 0.5;
      ctx.quadraticCurveTo(
        prev.x + prev.perpX * (prev.w * 0.5),
        prev.y + prev.perpY * (prev.w * 0.5),
        mx,
        my
      );
    }
    const last = nodes[nodes.length - 1];
    ctx.lineTo(last.x, last.y);

    // Bottom ridge (tip back to root)
    for (let i = nodes.length - 1; i >= 0; i--) {
      const cur = nodes[i];
      const rx = cur.x - cur.perpX * (cur.w * 0.5);
      const ry = cur.y - cur.perpY * (cur.w * 0.5);
      ctx.lineTo(rx, ry);
    }
    ctx.closePath();

    // Dual-tone volumetric shading: top highlight to ground-contact shadow
    const tailGrad = ctx.createLinearGradient(tailBaseX, tailBaseY - 3, tailBaseX, targetGroundY + 5);
    tailGrad.addColorStop(0, skinTone);
    tailGrad.addColorStop(0.48, skinTone);
    tailGrad.addColorStop(1, skinShadow);
    ctx.fillStyle = tailGrad;
    ctx.fill();

    // 4. Dorsal Spine Glint (Subtle 3D tubular specular ribbon)
    ctx.beginPath();
    ctx.moveTo(nodes[0].x + nodes[0].perpX * (nodes[0].w * 0.15), nodes[0].y + nodes[0].perpY * (nodes[0].w * 0.15) - 0.2);
    for (let i = 1; i < nodes.length - 1; i++) {
      const cur = nodes[i];
      const next = nodes[i + 1];
      const hx = (cur.x + next.x) * 0.5 + cur.perpX * (cur.w * 0.15);
      const hy = (cur.y + next.y) * 0.5 + cur.perpY * (cur.w * 0.15) - 0.2;
      ctx.quadraticCurveTo(
        cur.x + cur.perpX * (cur.w * 0.15),
        cur.y + cur.perpY * (cur.w * 0.15) - 0.2,
        hx,
        hy
      );
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
    ctx.lineWidth = Math.max(0.65, baseWidth * 0.24);
    ctx.lineCap = "round";
    ctx.stroke();

    // 5. Rounded tip cap
    ctx.fillStyle = skinShadow;
    ctx.beginPath();
    ctx.arc(last.x, last.y, tipWidth * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }

  if (isBoss) {
    // Sovereign Rat King: Tangled knot of 5 chaotic, intertwined tails sliding on the floor
    const kingTails = [
      { len: r * 2.5, baseW: 4.6, tipW: 1.1, angleOffset: -0.24, waveFreq: 0.95, phaseOffset: 0.0 },
      { len: r * 2.7, baseW: 5.2, tipW: 1.2, angleOffset: -0.06, waveFreq: 1.10, phaseOffset: 1.3 },
      { len: r * 2.4, baseW: 4.8, tipW: 1.0, angleOffset: 0.12,  waveFreq: 0.88, phaseOffset: 2.6 },
      { len: r * 2.6, baseW: 4.2, tipW: 0.9, angleOffset: 0.28,  waveFreq: 1.25, phaseOffset: 3.9 },
      { len: r * 2.3, baseW: 3.8, tipW: 0.8, angleOffset: -0.15, waveFreq: 1.05, phaseOffset: 5.1 }
    ];

    kingTails.forEach((kt, idx) => {
      drawGroundSlidingTail({
        length: kt.len,
        baseWidth: kt.baseW,
        tipWidth: kt.tipW,
        angleOffset: kt.angleOffset,
        waveFreqMult: kt.waveFreq,
        phaseOffset: kt.phaseOffset,
        tailIdx: idx,
        segments: 16
      });
    });

    // Fibrous intertwined knot mass at the rump
    ctx.fillStyle = furShadow;
    ctx.beginPath();
    ctx.ellipse(tailBaseX + 0.5, tailBaseY + 1.2, 5.8, 4.8, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = furCore;
    ctx.beginPath();
    ctx.ellipse(tailBaseX, tailBaseY + 0.6, 5.2, 4.2, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skinShadow;
    ctx.beginPath();
    ctx.ellipse(tailBaseX - 1.2, tailBaseY + 1.6, 3.2, 2.4, 0.3, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Standard Rat: Single fluid, unstable whip tail dragging and sliding along the ground
    drawGroundSlidingTail({
      length: r * 2.5,
      baseWidth: isDire ? 4.4 : 3.6,
      tipWidth: isDire ? 0.9 : 0.7,
      angleOffset: 0,
      waveFreqMult: 1.0,
      phaseOffset: 0,
      tailIdx: 0,
      segments: 16
    });

    // Fleshy muscular tail root at rump
    ctx.fillStyle = furCore;
    ctx.beginPath();
    ctx.ellipse(tailBaseX, tailBaseY + 0.4, 2.8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // -------------------------------------------------------------
  // 2. Far Legs (North / Top side in isometric view)
  // Drawn behind the body for correct depth sorting
  // -------------------------------------------------------------
  // Far Hindleg
  drawArticulatedLeg(-r * 0.48, -r * 0.32, phaseFarHind, hindStride, false, false);
  // Far Foreleg
  drawArticulatedLeg(r * 0.38, -r * 0.30, phaseFarFore, frontStride, true, false);

  // -------------------------------------------------------------
  // 3. Sleek Rodent Torso & Arched Spine
  // Healthy, agile rodent anatomy (no diseased pustules or sagging lesions)
  // -------------------------------------------------------------
  ctx.save();
  ctx.scale(spineSquashX, spineSquashY);

  // Volumetric Torso Shading Gradient
  const torsoGrad = safeCreateRadialGradient(ctx, -r * 0.12, -r * 0.16, r * 0.1, 0, 0, r * 1.2);
  if (torsoGrad) {
    torsoGrad.addColorStop(0, furHighlight);
    torsoGrad.addColorStop(0.35, furMantle);
    torsoGrad.addColorStop(0.75, furCore);
    torsoGrad.addColorStop(1, furShadow);
  }
  ctx.fillStyle = torsoGrad || furMantle;

  // Sleek rodent body contour
  ctx.beginPath();
  ctx.moveTo(-r * 0.86, 0);
  // High arched hunchback spine crest
  ctx.quadraticCurveTo(-r * 0.76, -r * 0.68, -r * 0.20, -r * 0.65);
  // Sloping muscular withers towards neck
  ctx.quadraticCurveTo(r * 0.35, -r * 0.55, r * 0.66, -r * 0.14);
  // Healthy belly line
  ctx.quadraticCurveTo(r * 0.48, r * 0.42, 0, r * 0.48);
  // Muscular flank & rump
  ctx.quadraticCurveTo(-r * 0.65, r * 0.46, -r * 0.86, 0);
  ctx.closePath();
  ctx.fill();

  // Dire Armored Steel Plates (Smooth curved segmented plating without triangular spikes)
  if (isDire) {
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.44, -r * 0.62);
    ctx.quadraticCurveTo(-r * 0.10, -r * 0.76, r * 0.34, -r * 0.54);
    ctx.quadraticCurveTo(r * 0.20, -r * 0.46, -r * 0.05, -r * 0.52);
    ctx.quadraticCurveTo(-r * 0.28, -r * 0.50, -r * 0.44, -r * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore(); // Restore torso squash

  // -------------------------------------------------------------
  // 4. Near Legs (South / Bottom side in isometric view)
  // Drawn in front of the body with full articulation
  // -------------------------------------------------------------
  // Near Hindleg (powerful back leg driving the scurry)
  drawArticulatedLeg(-r * 0.42, r * 0.34, phaseNearHind, hindStride, false, true);
  // Near Foreleg (agile front leg reaching forward)
  drawArticulatedLeg(r * 0.44, r * 0.32, phaseNearFore, frontStride, true, true);

  // -------------------------------------------------------------
  // 5. Rodent Cranium, Articulated Maw & Whiskers
  // -------------------------------------------------------------
  ctx.save();
  const headBob = (isMoving ? -Math.cos(scurryPhase) * 1.3 : 0) + sniffTwitch * 0.5 + idleHeadElevate;
  const headAngle = (isAttacking ? 0.07 : 0) + earFlick * 0.15 + (isMoving ? Math.sin(scurryPhase) * 0.04 : idleHeadScan);
  ctx.translate(r * 0.64 + (isMoving ? 0 : idleWeight * 0.25), headBob);
  ctx.rotate(headAngle);

  // Volumetric Skull Silhouette
  const headGrad = safeCreateRadialGradient(ctx, r * 0.14, -r * 0.10, r * 0.05, 0, 0, r * 0.68);
  if (headGrad) {
    headGrad.addColorStop(0, furHighlight);
    headGrad.addColorStop(0.48, furMantle);
    headGrad.addColorStop(1, furShadow);
  }
  ctx.fillStyle = headGrad || furMantle;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.36);
  // Sloping snout profile towards twitching nose tip
  ctx.quadraticCurveTo(r * 0.36, -r * 0.28, r * 0.60, -r * 0.03 + sniffTwitch * 0.35);
  // Lower jaw contour
  ctx.quadraticCurveTo(r * 0.36, r * 0.26 + jawOpen * 6.0, 0, r * 0.28);
  // Cranial back curve
  ctx.quadraticCurveTo(-r * 0.15, 0, 0, -r * 0.36);
  ctx.closePath();
  ctx.fill();

  // Clean Pink/Pebbled Nose Pad
  ctx.fillStyle = skinShadow;
  ctx.beginPath();
  ctx.ellipse(r * 0.60, -r * 0.03 + sniffTwitch * 0.35, isBoss ? 3.4 : 2.7, isBoss ? 2.5 : 1.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Clean Sharp Upper Incisors
  ctx.fillStyle = toothColor;
  const incisorLen = isBoss ? 5.2 : 3.4;
  ctx.fillRect(r * 0.52, 0.4, isBoss ? 2.6 : 2.0, incisorLen);
  ctx.fillRect(r * 0.55, 0.5, isBoss ? 2.4 : 1.8, incisorLen * 0.95);

  // Articulated Open Maw & Lower Incisors (on attack)
  if (jawOpen > 0.04 || isAttacking) {
    const lowerY = 2.0 + jawOpen * (isBoss ? 6.5 : 5.0);
    // Dark Oral Cavity
    ctx.fillStyle = "#180a14";
    ctx.beginPath();
    ctx.ellipse(r * 0.42, 1.8 + jawOpen * 3.0, isBoss ? 3.6 : 2.6, jawOpen * (isBoss ? 3.8 : 2.8), 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Healthy Pink Tongue
    ctx.fillStyle = skinShadow;
    ctx.beginPath();
    ctx.ellipse(r * 0.42, 2.0 + jawOpen * 3.2, isBoss ? 2.4 : 1.6, jawOpen * (isBoss ? 1.8 : 1.3), 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Lower Incisors
    ctx.fillStyle = toothColor;
    ctx.fillRect(r * 0.46, lowerY, isBoss ? 2.2 : 1.7, isBoss ? 3.4 : 2.6);
    ctx.fillRect(r * 0.49, lowerY, isBoss ? 2.0 : 1.5, isBoss ? 3.4 : 2.6);
  }

  // Sensory Vibrissae (Whiskers): active flare and vibration
  ctx.strokeStyle = isAlbino ? "rgba(255, 255, 255, 0.9)" : "rgba(228, 228, 231, 0.75)";
  ctx.lineWidth = isBoss ? 0.85 : 0.7;
  ctx.beginPath();
  // Upper whiskers
  ctx.moveTo(r * 0.44, -r * 0.07);
  ctx.lineTo(r * (isBoss ? 1.22 : 1.05) + (sniffIntensity * 1.6), -r * 0.32 + whiskerVibe);
  ctx.moveTo(r * 0.44, -r * 0.03);
  ctx.lineTo(r * (isBoss ? 1.28 : 1.10) + (sniffIntensity * 2.0), -r * 0.05 + whiskerVibe * 0.5);
  // Lower whiskers
  ctx.moveTo(r * 0.44, 0.06);
  ctx.lineTo(r * (isBoss ? 1.22 : 1.05) + (sniffIntensity * 1.6), r * 0.28 - whiskerVibe);
  ctx.moveTo(r * 0.44, 0.13);
  ctx.lineTo(r * (isBoss ? 1.14 : 0.94) + (sniffIntensity * 1.2), r * 0.40 - whiskerVibe * 0.7);
  ctx.stroke();

  // Rodent Ears with independent auditory scanning
  // Far Ear (Upper)
  ctx.save();
  ctx.translate(r * 0.06, -r * 0.38);
  ctx.rotate(-0.22 + farEarScan + earFlick);
  ctx.fillStyle = furCore;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.22, r * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.ellipse(0.4, 0.4, r * 0.13, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Near Ear (Lower/Facing)
  ctx.save();
  ctx.translate(r * 0.14, -r * 0.17);
  ctx.rotate(0.14 + nearEarScan - earFlick * 0.5);
  ctx.fillStyle = furMantle;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.24, r * 0.29, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skinTone;
  ctx.beginPath();
  ctx.ellipse(0.4, 0.4, r * 0.15, r * 0.20, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eye with natural idle blinking
  const eyeX = r * 0.32;
  const eyeY = -r * 0.12;
  const eyeRad = isBoss ? 3.3 : 2.5;

  ctx.fillStyle = "#09090b";
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeRad + 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeRad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = eyePupil;
  ctx.beginPath();
  ctx.arc(eyeX + 0.5, eyeY - 0.4, eyeRad * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Natural upper eyelid draping during idle blink
  if (eyelidCloseRatio > 0.02) {
    ctx.fillStyle = furMantle;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY - eyeRad * 0.5 + eyelidCloseRatio * eyeRad * 0.85, eyeRad * 1.2, eyeRad * eyelidCloseRatio, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------
  // RAT KING VERMIN SOVEREIGN CROWN
  // Lineless Scavenged Rodent Diadem:
  // - Lineless volumetric anatomy: strictly zero black/dark strokes or outlines
  // - Curved Rodent Incisor Spires: iconic chisel rat teeth forming crown spires
  // - Feral Rodent Skull Centerpiece: lineless miniature rat cranium crest
  // - Hammered Scavenged Gold Band: beaten metal with subtle rodent gnaw notches
  // - Embedded Vermin Blood-Garnet & Amber Eye Beads
  // - Organic Ambient Occlusion: seamlessly nests into dark velvet fur
  // -------------------------------------------------------------
  if (isBoss) {
    ctx.save();
    // Position crown naturally tilted atop the rat king's cranium
    ctx.translate(r * 0.17, -r * 0.44);
    ctx.rotate(-0.08);

    const crownW = r * 0.72;
    const crownH = r * 0.70;

    // 1. Soft Ambient Occlusion Under Crown (nestled seamlessly into dark velvet fur)
    const furNestGrad = safeCreateRadialGradient(ctx, 0, 3.0, 1, 0, 3.0, crownW * 0.65);
    if (furNestGrad) {
      furNestGrad.addColorStop(0, "rgba(8, 2, 12, 0.75)");
      furNestGrad.addColorStop(0.65, "rgba(15, 6, 20, 0.45)");
      furNestGrad.addColorStop(1, "rgba(24, 10, 33, 0)");
      ctx.fillStyle = furNestGrad;
      ctx.beginPath();
      ctx.ellipse(0, 3.2, crownW * 0.58, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Base Scavenged Circlet Underlayer (Hammered beaten gold & sewer copper wire band)
    const bandBackGrad = ctx.createLinearGradient(-crownW * 0.5, 0, crownW * 0.5, 0);
    bandBackGrad.addColorStop(0, "#78350f");
    bandBackGrad.addColorStop(0.5, "#b45309");
    bandBackGrad.addColorStop(1, "#78350f");
    ctx.fillStyle = bandBackGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2.5, crownW * 0.48, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Curved Rodent Incisor Spires (Forming the crown's prongs)
    // Rat incisors are iconic: long, forward-curving chisel tusks with amber/golden enamel facing
    function drawRatIncisorProng(baseX, baseY, width, height, curveAngle, isCenter = false) {
      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(curveAngle);

      // Incisor gradient: amber/orange enamel front face, calcified ivory tip, root shadow
      const toothGrad = ctx.createLinearGradient(-width * 0.5, 0, width * 0.5, -height);
      toothGrad.addColorStop(0, "#92400e");       // warm root/socket amber-brown
      toothGrad.addColorStop(0.25, "#d97706");    // keratinized golden-yellow rat enamel
      toothGrad.addColorStop(0.65, "#fef08a");    // pale yellow dental ivory
      toothGrad.addColorStop(0.92, "#ffffff");    // sharp chiseled enamel tip
      toothGrad.addColorStop(1.0, "#ffffff");

      // Organic curved incisor polygon with chisel edge
      ctx.fillStyle = toothGrad;
      ctx.beginPath();
      ctx.moveTo(-width * 0.5, 0);
      // Outer curved ridge
      ctx.quadraticCurveTo(-width * 0.45, -height * 0.55, -width * 0.12, -height);
      // Chisel bevel edge at tip
      ctx.lineTo(width * 0.22, -height * 0.94);
      // Inner curved ridge tapering back to root
      ctx.quadraticCurveTo(width * 0.45, -height * 0.45, width * 0.5, 0);
      ctx.closePath();
      ctx.fill();

      // Enamel front gleam / specular ridge (lineless light reflection)
      ctx.fillStyle = isCenter ? "rgba(255, 255, 255, 0.65)" : "rgba(255, 255, 255, 0.45)";
      ctx.beginPath();
      ctx.moveTo(-width * 0.18, -height * 0.2);
      ctx.quadraticCurveTo(-width * 0.25, -height * 0.6, -width * 0.08, -height * 0.92);
      ctx.lineTo(width * 0.06, -height * 0.90);
      ctx.quadraticCurveTo(-width * 0.08, -height * 0.58, -width * 0.02, -height * 0.2);
      ctx.closePath();
      ctx.fill();

      // Subtle dental root groove (warm organic shadow)
      ctx.fillStyle = "rgba(120, 53, 15, 0.45)";
      ctx.beginPath();
      ctx.ellipse(0, -height * 0.12, width * 0.22, height * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Outer Far Left Incisor (curving backwards)
    drawRatIncisorProng(-crownW * 0.42, 1.2, 3.4, crownH * 0.55, -0.48);

    // Mid Left Incisor (curving upward-left)
    drawRatIncisorProng(-crownW * 0.23, 0.4, 4.0, crownH * 0.78, -0.22);

    // Outer Far Right Incisor (curving backwards-right)
    drawRatIncisorProng(crownW * 0.42, 1.2, 3.4, crownH * 0.55, 0.48);

    // Mid Right Incisor (curving upward-right)
    drawRatIncisorProng(crownW * 0.23, 0.4, 4.0, crownH * 0.78, 0.22);

    // Central Twin Sovereign Rat Incisors (the majestic towering rat fangs)
    drawRatIncisorProng(-3.2, -0.8, 4.8, crownH * 1.05, -0.06, true);
    drawRatIncisorProng(3.2, -0.8, 4.8, crownH * 1.05, 0.06, true);

    // 4. Hammered Scavenged Gold / Brass Plates (Holding the incisors together)
    // Tarnished beaten gold diadem band with jagged rodent gnaw-cut notches
    const goldGrad = safeCreateRadialGradient(ctx, 0, -crownH * 0.15, 2, 0, 0, crownW * 0.6);
    if (goldGrad) {
      goldGrad.addColorStop(0, "#fef08a");
      goldGrad.addColorStop(0.28, "#f59e0b");
      goldGrad.addColorStop(0.68, "#b45309");
      goldGrad.addColorStop(1, "#78350f");
    }
    ctx.fillStyle = goldGrad || "#d97706";

    ctx.beginPath();
    // Band top rim with rodent-gnawed serrations
    ctx.moveTo(-crownW * 0.46, 2.0);
    ctx.quadraticCurveTo(-crownW * 0.35, -crownH * 0.18, -crownW * 0.26, -crownH * 0.12);
    ctx.lineTo(-crownW * 0.23, -crownH * 0.24); // gnaw notch
    ctx.lineTo(-crownW * 0.18, -crownH * 0.15);
    ctx.quadraticCurveTo(-crownW * 0.09, -crownH * 0.28, 0, -crownH * 0.32); // arched center peak
    ctx.quadraticCurveTo(crownW * 0.09, -crownH * 0.28, crownW * 0.18, -crownH * 0.15);
    ctx.lineTo(crownW * 0.23, -crownH * 0.24); // gnaw notch
    ctx.lineTo(crownW * 0.26, -crownH * 0.12);
    ctx.quadraticCurveTo(crownW * 0.35, -crownH * 0.18, crownW * 0.46, 2.0);
    // Lower front rim
    ctx.quadraticCurveTo(crownW * 0.24, 4.5, 0, 4.8);
    ctx.quadraticCurveTo(-crownW * 0.24, 4.5, -crownW * 0.46, 2.0);
    ctx.closePath();
    ctx.fill();

    // 5. Lineless Miniature Rodent Cranium / Feral Rat Skull Centerpiece
    ctx.save();
    ctx.translate(0, -crownH * 0.08);

    // Rodent skull braincase (calcified bone gradient)
    const skullBoneGrad = ctx.createLinearGradient(0, -crownH * 0.22, 0, crownH * 0.15);
    skullBoneGrad.addColorStop(0, "#ffffff");
    skullBoneGrad.addColorStop(0.45, "#fef08a");
    skullBoneGrad.addColorStop(0.85, "#d4af37");
    skullBoneGrad.addColorStop(1, "#92400e");
    ctx.fillStyle = skullBoneGrad;

    // Skull outline path (lineless)
    ctx.beginPath();
    ctx.moveTo(0, -crownH * 0.22); // skull dome top
    ctx.quadraticCurveTo(5.5, -crownH * 0.18, 6.2, -crownH * 0.04); // right parietal ridge
    ctx.quadraticCurveTo(5.8, crownH * 0.08, 3.4, crownH * 0.14);  // right cheek / zygomatic
    ctx.lineTo(1.8, crownH * 0.24); // right upper incisor
    ctx.lineTo(0, crownH * 0.16);   // tooth notch
    ctx.lineTo(-1.8, crownH * 0.24);// left upper incisor
    ctx.lineTo(-3.4, crownH * 0.14);// left cheek
    ctx.quadraticCurveTo(-5.8, crownH * 0.08, -6.2, -crownH * 0.04);
    ctx.quadraticCurveTo(-5.5, -crownH * 0.18, 0, -crownH * 0.22);
    ctx.closePath();
    ctx.fill();

    // Dark Rodent Eye Sockets (hollow skull orbits)
    ctx.fillStyle = "#1e0b04";
    ctx.beginPath();
    ctx.ellipse(-3.0, -crownH * 0.05, 1.8, 2.4, -0.22, 0, Math.PI * 2);
    ctx.ellipse(3.0, -crownH * 0.05, 1.8, 2.4, 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Feral Red Glow / Ruby Glimmer inside the skull sockets
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(-3.0, -crownH * 0.05, 0.9, 0, Math.PI * 2);
    ctx.arc(3.0, -crownH * 0.05, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Snout nasal cavity slit
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.moveTo(0, crownH * 0.02);
    ctx.lineTo(0.9, crownH * 0.11);
    ctx.lineTo(-0.9, crownH * 0.11);
    ctx.closePath();
    ctx.fill();

    // Skull cranial suture highlight (ivory reflection)
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.beginPath();
    ctx.ellipse(0, -crownH * 0.16, 2.2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 6. Central Scavenged Blood-Garnet Jewel (Embedded in the gold diadem base)
    const gemY = 2.4;
    // Dark gem setting cup
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.ellipse(0, gemY, 3.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep Blood-Garnet Body
    const gemGrad = safeCreateRadialGradient(ctx, -0.8, gemY - 1.2, 0.5, 0, gemY, 3.4);
    if (gemGrad) {
      gemGrad.addColorStop(0, "#f87171");
      gemGrad.addColorStop(0.3, "#dc2626");
      gemGrad.addColorStop(0.7, "#991b1b");
      gemGrad.addColorStop(1, "#450a0a");
    }
    ctx.fillStyle = gemGrad || "#dc2626";
    ctx.beginPath();
    ctx.ellipse(0, gemY, 3.0, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Facet Specular Glint (crisp pure white highlight)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(-0.9, gemY - 1.4, 1.1, 0.7, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Secondary sub-surface reflection
    ctx.fillStyle = "rgba(254, 202, 202, 0.55)";
    ctx.beginPath();
    ctx.arc(1.0, gemY + 1.6, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // 7. Lateral Sewer Amber Beads & Braided Wire Rivets (No outlines)
    const beadOffsets = [-crownW * 0.34, -crownW * 0.18, crownW * 0.18, crownW * 0.34];
    beadOffsets.forEach((bx, bIdx) => {
      const by = 2.2 + Math.abs(bx) * 0.04;
      // Shadow seat
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.arc(bx, by, 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Amber bead (rat eyes / sewer amber)
      const isRedBead = bIdx === 0 || bIdx === 3;
      ctx.fillStyle = isRedBead ? "#b91c1c" : "#f59e0b";
      ctx.beginPath();
      ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Highlight pin
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(bx - 0.4, by - 0.5, 0.55, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8. Polished Gold Crown Rim Highlight (volumetric lineless gleam)
    ctx.fillStyle = "rgba(254, 240, 138, 0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 0.8, crownW * 0.32, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore(); // Restore head
  ctx.restore(); // Restore overall transform
}

// --- Family: Skeleton ---
// skeletons.js - Procedural 8-Directional Samba-Inspired Skeleton Renderer with Anatomical Bone Details


/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * No baked-in solid or flat circle/ellipse ground shadows beneath the skeleton.
 */

export const BONE_PALETTES = {
  ivory: {
    name: "Ancient Ivory",
    boneBase: "#f8fafc",
    boneMid: "#e2e8f0",
    boneShadow: "#94a3b8",
    boneDark: "#475569",
    boneCavity: "#1e293b",
    boneHighlight: "#ffffff",
    suture: "#64748b",
    cartilage: "#cbd5e1"
  },
  bleached: {
    name: "Pristine Bleached",
    boneBase: "#ffffff",
    boneMid: "#f1f5f9",
    boneShadow: "#cbd5e1",
    boneDark: "#64748b",
    boneCavity: "#0f172a",
    boneHighlight: "#ffffff",
    suture: "#94a3b8",
    cartilage: "#e2e8f0"
  },
  crypt: {
    name: "Cursed Crypt Bone",
    boneBase: "#cbd5e1",
    boneMid: "#94a3b8",
    boneShadow: "#475569",
    boneDark: "#334155",
    boneCavity: "#0b1220",
    boneHighlight: "#e2e8f0",
    suture: "#1e293b",
    cartilage: "#64748b"
  },
  gilded: {
    name: "Gilded Relic Bone",
    boneBase: "#fef08a",
    boneMid: "#fde047",
    boneShadow: "#ca8a04",
    boneDark: "#854d0e",
    boneCavity: "#422006",
    boneHighlight: "#ffffff",
    suture: "#a16207",
    cartilage: "#eab308"
  }
};

const SAMBA_PALETTES = {
  // Emerald Green, Canary Gold & Cyan (Classic Rio Samba School vibe)
  passista: {
    name: "Passista de Carnaval",
    feathers: ["#10b981", "#059669", "#f59e0b", "#fbbf24", "#06b6d4"],
    accent: "#f59e0b",
    sash: "#10b981",
    sashTrim: "#fef08a",
    pandeiroHoop: "#d97706",
    pandeiroSkin: "#fef3c7",
    glow: "#34d399",
    metal: "#fbbf24",
    gem: "#ec4899",
    boneStyle: "ivory"
  },
  // Royal Purple, Imperial Gold & Crimson (Mestre de Bateria)
  mestre: {
    name: "Mestre de Bateria",
    feathers: ["#9333ea", "#7e22ce", "#f59e0b", "#fbbf24", "#ef4444"],
    accent: "#fbbf24",
    sash: "#9333ea",
    sashTrim: "#fde047",
    pandeiroHoop: "#b45309",
    pandeiroSkin: "#fef9c3",
    glow: "#a855f7",
    metal: "#f59e0b",
    gem: "#38bdf8",
    boneStyle: "bleached"
  },
  // Classic Malandro: Crimson, Pure White, Jet Black (Lapa Street Samba Swagger)
  malandro: {
    name: "Samba Malandro",
    feathers: ["#ef4444", "#dc2626", "#f8fafc", "#f59e0b", "#1e293b"],
    accent: "#ef4444",
    sash: "#dc2626",
    sashTrim: "#ffffff",
    pandeiroHoop: "#b91c1c",
    pandeiroSkin: "#f8fafc",
    glow: "#f87171",
    metal: "#cbd5e1",
    gem: "#f59e0b",
    boneStyle: "crypt"
  },
  // Gilded Carnival Champion Guard
  knight: {
    name: "Guerreiro do Sambodromo",
    feathers: ["#f59e0b", "#d97706", "#06b6d4", "#0891b2", "#8b5cf6"],
    accent: "#fbbf24",
    sash: "#0891b2",
    sashTrim: "#fef08a",
    pandeiroHoop: "#d97706",
    pandeiroSkin: "#f1f5f9",
    glow: "#38bdf8",
    metal: "#f59e0b",
    gem: "#10b981",
    boneStyle: "gilded"
  },
  // Monumental Carnival Skeleton King Boss (Rei Momo dos Ossos)
  boss: {
    name: "Rei Momo dos Ossos",
    feathers: ["#fbbf24", "#f59e0b", "#ec4899", "#8b5cf6", "#10b981", "#06b6d4"],
    accent: "#fbbf24",
    sash: "#ec4899",
    sashTrim: "#fef08a",
    pandeiroHoop: "#b45309",
    pandeiroSkin: "#fffbeb",
    glow: "#f43f5e",
    metal: "#fbbf24",
    gem: "#67e8f9",
    boneStyle: "ivory"
  }
};

/**
 * Procedural Anatomical Long Bone Primitive
 * Renders an osseous tubular diaphysis with proximal/distal flared condyles,
 * core shadow, cylindrical specular ridge, and osteon micro-relief.
 */
export function drawLongBone(ctx, x1, y1, x2, y2, width, colors, options = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt((dx) * (dx) + (dy) * (dy));
  if (len < 0.8) return;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  const headR = Math.max(1.2, width * 1.05);
  const condyleR = Math.max(1.1, width * 0.95);
  const shaftW = Math.max(0.9, width * 0.65);

  // 1. Core Diaphysis (Shaft) - Core shadow side
  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.moveTo(headR * 0.6, -shaftW * 0.5);
  ctx.lineTo(len - condyleR * 0.6, -shaftW * 0.5);
  ctx.lineTo(len - condyleR * 0.6, shaftW * 0.55);
  ctx.lineTo(headR * 0.6, shaftW * 0.55);
  ctx.closePath();
  ctx.fill();

  // 2. Light side highlight (Upper half of the shaft)
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.moveTo(headR * 0.6, -shaftW * 0.5);
  ctx.lineTo(len - condyleR * 0.6, -shaftW * 0.5);
  ctx.lineTo(len - condyleR * 0.6, 0);
  ctx.lineTo(headR * 0.6, 0);
  ctx.closePath();
  ctx.fill();

  // 3. Specular ivory crest line
  ctx.fillStyle = colors.boneHighlight;
  const specLen = Math.max(1.0, len - (headR + condyleR) * 0.8);
  ctx.fillRect(headR * 0.7, -shaftW * 0.45, specLen, Math.max(0.5, shaftW * 0.28));

  // 4. Proximal Epiphysis (Double condyles / Head & Trochanter)
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.arc(headR * 0.35, -shaftW * 0.5, headR * 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.boneMid;
  ctx.beginPath();
  ctx.arc(headR * 0.35, shaftW * 0.5, headR * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.boneHighlight;
  ctx.beginPath();
  ctx.arc(headR * 0.25, -shaftW * 0.35, headR * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // 5. Distal Epiphysis (Articulating Joint Knuckles / Condyles)
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.arc(len - condyleR * 0.35, -shaftW * 0.55, condyleR * 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.arc(len - condyleR * 0.35, shaftW * 0.55, condyleR * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Intercondylar notch / fossa cavity
  ctx.fillStyle = colors.boneDark;
  ctx.beginPath();
  ctx.ellipse(len - condyleR * 0.2, 0, condyleR * 0.3, condyleR * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Micro-crack or osteon fissure detail
  if (options.crack) {
    ctx.strokeStyle = colors.suture;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(len * 0.42, -shaftW * 0.3);
    ctx.lineTo(len * 0.52, 0.1);
    ctx.lineTo(len * 0.6, -shaftW * 0.2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the twin parallel bones of the human skeletal forearm:
 * - Ulna: Medial bone with prominent Olecranon beak at the elbow.
 * - Radius: Lateral bone rotating down to the radial styloid process at the wrist.
 */
export function drawForearmTwinBones(ctx, x1, y1, x2, y2, colors) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt((dx) * (dx) + (dy) * (dy));
  if (len < 0.8) return;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(angle);

  // 1. Ulna (Main hinge bone with olecranon beak hook at elbow)
  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.moveTo(0, -1.3);
  ctx.lineTo(-1.2, -0.6); // Olecranon beak
  ctx.lineTo(len - 0.4, -0.5);
  ctx.lineTo(len - 0.4, 0.4);
  ctx.lineTo(0.6, 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.boneHighlight;
  ctx.fillRect(0.8, -1.0, len - 1.8, 0.6);

  // 2. Interosseous Space (Dark gap separating Radius and Ulna)
  ctx.fillStyle = colors.boneCavity;
  ctx.fillRect(1.5, 0.2, len - 3.2, 0.6);

  // 3. Radius (Slightly curved lateral bone, broad base at wrist)
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.moveTo(0.8, 0.8);
  ctx.lineTo(len - 0.2, 1.4); // Broad radial base at wrist
  ctx.lineTo(len - 0.2, 2.4);
  ctx.lineTo(0.8, 1.8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.boneMid;
  ctx.beginPath();
  ctx.arc(len - 0.2, 1.8, 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws the twin bones of the skeletal lower leg:
 * - Tibia: Heavy shin bone with prominent anterior tibial crest and medial malleolus.
 * - Fibula: Slender lateral stabilizer pin ending in the lateral malleolus.
 * - Patella: Articulated sesamoid kneecap sitting over the femoral condyles.
 */
export function drawLowerLegTwinBones(ctx, kneeX, kneeY, ankleX, ankleY, isRight, colors) {
  const dx = ankleX - kneeX;
  const dy = ankleY - kneeY;
  const len = Math.sqrt((dx) * (dx) + (dy) * (dy));
  if (len < 0.8) return;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(kneeX, kneeY);
  ctx.rotate(angle);

  const sideSign = isRight ? 1 : -1;

  // 1. Tibia (Heavy Shin Bone - Medial side)
  // Deep shadow layer
  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.moveTo(0.4, -1.4);
  ctx.lineTo(len - 0.6, -1.0);
  ctx.lineTo(len - 0.6, 0.9);
  ctx.lineTo(0.4, 1.2);
  ctx.closePath();
  ctx.fill();

  // Anterior tibial crest highlight
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.moveTo(0.5, -1.4);
  ctx.lineTo(len - 0.6, -1.0);
  ctx.lineTo(len - 0.6, 0);
  ctx.lineTo(0.5, 0);
  ctx.closePath();
  ctx.fill();

  // Sharp specular crest reflection
  ctx.fillStyle = colors.boneHighlight;
  ctx.fillRect(0.8, -1.1, len - 2.0, 0.55);

  // Medial malleolus knob at ankle
  ctx.fillStyle = colors.boneMid;
  ctx.beginPath();
  ctx.arc(len - 0.5, -0.6, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // 2. Interosseous Membrane Fossa (Dark split)
  ctx.fillStyle = colors.boneCavity;
  ctx.fillRect(1.8, 0.8, len - 3.4, 0.5);

  // 3. Fibula (Slender lateral pin bone)
  const fibOffset = sideSign * 1.5;
  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.moveTo(1.2, fibOffset - 0.4);
  ctx.lineTo(len - 0.4, fibOffset - 0.3);
  ctx.lineTo(len - 0.4, fibOffset + 0.5);
  ctx.lineTo(1.2, fibOffset + 0.4);
  ctx.closePath();
  ctx.fill();

  // Lateral malleolus knob at outer ankle
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.arc(len - 0.4, fibOffset + 0.1, 0.75, 0, Math.PI * 2);
  ctx.fill();

  // 4. Patella (Kneecap)
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.ellipse(0.2, 0, 1.3, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.boneHighlight;
  ctx.beginPath();
  ctx.arc(-0.1, -0.3, 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors.boneShadow;
  ctx.lineWidth = 0.4;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws the grand Carnival Headdress ("Costeiro" / Penacho Real)
 */
function drawCarnivalPlume(ctx, x, y, angle, length, width, color, flutter, highlightColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + flutter * 0.12);

  // Outer feather contour
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-width * 0.7, -length * 0.45, -width * 0.2 + flutter * 2.5, -length);
  ctx.quadraticCurveTo(width * 0.2 + flutter * 2.5, -length, width * 0.7, -length * 0.45);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();

  // Central quill spine
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(flutter * 1.2, -length * 0.5, flutter * 2.5, -length);
  ctx.strokeStyle = highlightColor || "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = Math.max(0.75, width * 0.18);
  ctx.lineCap = "round";
  ctx.stroke();

  // Subtle barbs fringe
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 0.5;
  for (let s = 0.25; s <= 0.85; s += 0.2) {
    const py = -length * s;
    const px = flutter * s * 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - width * 0.4, py + 1.5);
    ctx.moveTo(px, py);
    ctx.lineTo(px + width * 0.4, py + 1.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCarnivalHeaddress(ctx, tier, palette, nowMs, seed, isBackView = false) {
  const isBoss = tier === "boss";
  const plumeCount = isBoss ? 11 : tier === "mestre" ? 9 : 7;
  const spreadAngle = isBoss ? Math.PI * 0.78 : Math.PI * 0.65;
  const baseLength = isBoss ? 26 : 18;
  const baseWidth = isBoss ? 7 : 5;

  ctx.save();
  // Crest / diadem harness base
  if (!isBackView) {
    // Front jeweled diadem
    ctx.fillStyle = palette.metal;
    ctx.beginPath();
    ctx.arc(0, -1, 7.5, Math.PI * 0.9, Math.PI * 2.1);
    ctx.lineTo(0, -6.5);
    ctx.closePath();
    ctx.fill();

    // Center gemstone
    ctx.fillStyle = palette.gem;
    ctx.beginPath();
    ctx.arc(0, -3.2, isBoss ? 2.5 : 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.metal;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  } else {
    // Back harness straps (golden structure supporting the plumes)
    ctx.strokeStyle = palette.metal;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, -2, 8, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -1);
    ctx.lineTo(0, -5.5);
    ctx.lineTo(6, -1);
    ctx.stroke();
  }

  // Radiating plumes
  const colors = palette.feathers;
  const startAngle = -Math.PI / 2 - spreadAngle / 2;
  const step = spreadAngle / (plumeCount - 1);

  for (let i = 0; i < plumeCount; i++) {
    const curAngle = startAngle + i * step;
    const color = colors[i % colors.length];
    const flutter = Math.sin(nowMs * 0.007 + i * 0.8 + seed) * 1.8;
    const lenMult = 1 - Math.abs(i - (plumeCount - 1) / 2) * 0.09;
    const plumeLen = baseLength * lenMult;
    const plumeW = baseWidth * lenMult;

    drawCarnivalPlume(
      ctx,
      0,
      -3.5,
      curAngle,
      plumeLen,
      plumeW,
      color,
      flutter,
      palette.accent
    );
  }

  // Malandro Panama Hat variation if active
  if (tier === "malandro" && !isBackView) {
    ctx.save();
    ctx.translate(0, -4);
    ctx.rotate(-0.1);

    // Hat brim
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Hat crown
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.quadraticCurveTo(-6, -7, 0, -8);
    ctx.quadraticCurveTo(6, -7, 6, 0);
    ctx.closePath();
    ctx.fill();

    // Red ribbon band
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(-6.2, -2.5, 12.4, 2.5);

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders the festive Brazilian Pandeiro (Tambourine with brass jingles)
 */
function drawPandeiro(ctx, x, y, scale, angle, palette, isShaking, nowMs) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const jingleVibe = isShaking ? Math.sin(nowMs * 0.04) * 1.5 : 0;
  const r = 7 * scale;

  // Outer wooden frame
  ctx.fillStyle = palette.pandeiroHoop;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // White goat skin drum head
  ctx.fillStyle = palette.pandeiroSkin;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.fill();

  // Decorative Samba star or crest on drumhead
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // 6 Brass Jingles (Platinelas) around the rim
  ctx.fillStyle = "#fef08a";
  ctx.strokeStyle = "#ca8a04";
  ctx.lineWidth = 0.6;
  for (let j = 0; j < 6; j++) {
    const ja = (j / 6) * Math.PI * 2;
    const jx = Math.cos(ja) * (r * 0.95);
    const jy = Math.sin(ja) * (r * 0.95);
    ctx.beginPath();
    ctx.arc(jx + jingleVibe * 0.4, jy, 1.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Thumb hold notch
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.arc(r * 0.88, 0, 1.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Rhythmic Samba Carnaval foot-tapping kinematic calculator.
 */
function getSambaFootTap(prog) {
  let liftY = 0;
  let angle = 0;
  let impact = 0;
  let kneeOffset = 0;

  if (prog < 0.16) {
    const t = prog / 0.16;
    const ease = Math.sin(t * Math.PI * 0.5);
    liftY = -3.2 * ease;
    angle = -0.38 * ease;
    kneeOffset = 1.3 * ease;
  } else if (prog < 0.25) {
    const t = (prog - 0.16) / 0.09;
    liftY = -3.2 * (1 - t);
    angle = -0.38 * (1 - t);
    kneeOffset = 1.3 * (1 - t);
    impact = Math.sin(t * Math.PI);
  } else if (prog < 0.36) {
    const t = (prog - 0.25) / 0.11;
    const ease = Math.sin(t * Math.PI * 0.5);
    liftY = -2.2 * ease;
    angle = -0.28 * ease;
    kneeOffset = 0.9 * ease;
  } else if (prog < 0.46) {
    const t = (prog - 0.36) / 0.10;
    liftY = -2.2 * (1 - t);
    angle = -0.28 * (1 - t);
    kneeOffset = 0.9 * (1 - t);
    impact = Math.sin(t * Math.PI);
  } else if (prog < 0.82) {
    const t = (prog - 0.46) / 0.36;
    liftY = 0;
    angle = 0;
    kneeOffset = Math.sin(t * Math.PI) * 0.4;
  }

  return { liftY, angle, impact, kneeOffset };
}

/**
 * Anatomical Skeletal Foot Renderer
 * Renders Calcaneus heel with plantar spur, Talus joint mortise,
 * Tarsal arch, 5 Metatarsal bone rays, and jointed toe phalanges.
 */
export function drawDetailedSkeletalFoot(ctx, sideSign, tapData, colors) {
  ctx.save();
  ctx.scale(sideSign, 1);
  ctx.rotate(tapData.angle);

  // 1. Calcaneus (Heel Bone) with posterior spur
  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.ellipse(-1.4, 0.6, 1.5, 1.1, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.arc(-1.5, 0.3, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // 2. Talus (Ankle Mortise Articulation)
  ctx.fillStyle = colors.boneMid;
  ctx.beginPath();
  ctx.ellipse(-0.2, -0.2, 1.2, 0.9, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // 3. Tarsus / Navicular / Cuneiform Foot Arch
  ctx.fillStyle = colors.boneMid;
  ctx.beginPath();
  ctx.moveTo(-0.6, -0.6);
  ctx.lineTo(2.4, -0.2);
  ctx.lineTo(2.2, 2.0);
  ctx.lineTo(-0.8, 1.6);
  ctx.closePath();
  ctx.fill();

  // Longitudinal arch shadow underneath foot
  ctx.fillStyle = colors.boneCavity;
  ctx.beginPath();
  ctx.ellipse(0.8, 1.8, 1.4, 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. 5 Metatarsal Bone Rays
  ctx.fillStyle = colors.boneBase;
  for (let m = 0; m < 5; m++) {
    const my = 0.2 + m * 0.36;
    const mxLen = 3.6 - Math.abs(m - 1) * 0.25;
    ctx.fillRect(1.6, my, mxLen - 1.6, 0.28);
  }

  // 5. Articulated Toe Phalanges
  // Hallux (Big Toe)
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.ellipse(3.8, 0.4, 1.2, 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.boneHighlight;
  ctx.beginPath();
  ctx.arc(4.7, 0.4, 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Lesser Toes (Digits II to V)
  ctx.fillStyle = colors.boneMid;
  for (let t = 1; t < 5; t++) {
    const ty = 0.4 + t * 0.4;
    const tx = 3.6 - (t * 0.22);
    ctx.beginPath();
    ctx.arc(tx, ty, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.arc(tx + 0.6, ty, 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Articulated Skeletal Leg with High-Detail Femur, Patella, Tibia/Fibula and Foot.
 */
function drawSambaLegAndFoot(ctx, isRight, baseX, legSwing, tapData, palette, colors, isMoving, nowMs, seed) {
  ctx.save();
  ctx.translate(baseX, 0);

  const sideSign = isRight ? 1 : -1;
  const kneeX = sideSign * 1.5 + legSwing * 0.3 + sideSign * tapData.kneeOffset * 0.6;
  const kneeY = 7 + tapData.kneeOffset * 0.4;
  const ankleX = sideSign * 1.5 + legSwing * 0.8;
  const ankleY = 14 + tapData.liftY;

  // 1. Femur (Thigh Bone) with Trochanter and Condyles
  drawLongBone(ctx, 0, 0, kneeX, kneeY, 2.4, colors, { crack: seed % 2 === 0 });

  // 2. Tibia & Fibula (Lower Leg Twin Bones) + Patella
  drawLowerLegTwinBones(ctx, kneeX, kneeY, ankleX, ankleY, isRight, colors);

  // 3. Ankle & Articulated Skeletal Foot
  ctx.save();
  ctx.translate(ankleX, ankleY);

  drawDetailedSkeletalFoot(ctx, sideSign, tapData, colors);

  // Golden Ankle Bracelet ("Cascaveis de Carnaval")
  ctx.fillStyle = palette.metal;
  ctx.fillRect(-1.8, -1.8, 3.6, 1.4);
  const jingleSway = Math.sin(nowMs * 0.015 + (isRight ? 0 : 2) + seed) * 1.2 + tapData.angle * 2.0;
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.arc(0.4 + jingleSway * 0.4, 0.8, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Subtle rhythmic floor tap shockwave pulse
  if (tapData.impact > 0.25) {
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = tapData.impact * 0.7;
    ctx.beginPath();
    ctx.arc(4.2, 1.8, 2.5 + (1 - tapData.impact) * 3.5, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = tapData.impact * 0.5;
    ctx.beginPath();
    ctx.arc(4.2, 1.8, 1.5 + (1 - tapData.impact) * 2.0, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // Foot
  ctx.restore(); // Leg
}

/**
 * Anatomical Pelvic Girdle Renderer
 * Renders flared Iliac crests, Sacrum with sacral foramina, Coccyx tailbone,
 * paired Obturator Foramina cavities, and Acetabular hip sockets.
 */
export function drawDetailedPelvis(ctx, colors, isBackView = false) {
  ctx.save();

  // 1. Central Sacrum & Coccyx
  ctx.fillStyle = colors.boneMid;
  ctx.beginPath();
  ctx.moveTo(-2.4, -2.8);
  ctx.lineTo(2.4, -2.8);
  ctx.lineTo(1.2, 3.6);
  ctx.lineTo(0, 4.8); // Coccyx tip
  ctx.lineTo(-1.2, 3.6);
  ctx.closePath();
  ctx.fill();

  // Sacral foramina (nerve holes) & transverse ridges
  ctx.fillStyle = colors.boneCavity;
  for (let s = -1.2; s <= 2.2; s += 1.2) {
    ctx.fillRect(-1.4, s, 0.6, 0.6);
    ctx.fillRect(0.8, s, 0.6, 0.6);
  }

  // 2. Left & Right Iliac Blades (Ala of Ilium)
  // Left Ilium
  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.moveTo(-1.8, -2.2);
  ctx.quadraticCurveTo(-6.6, -3.8, -7.0, -1.0); // Iliac crest arch
  ctx.quadraticCurveTo(-6.8, 2.0, -3.2, 1.8);
  ctx.lineTo(-1.8, 1.0);
  ctx.closePath();
  ctx.fill();

  // Right Ilium
  ctx.beginPath();
  ctx.moveTo(1.8, -2.2);
  ctx.quadraticCurveTo(6.6, -3.8, 7.0, -1.0); // Iliac crest arch
  ctx.quadraticCurveTo(6.8, 2.0, 3.2, 1.8);
  ctx.lineTo(1.8, 1.0);
  ctx.closePath();
  ctx.fill();

  // Iliac crest highlights
  ctx.strokeStyle = colors.boneHighlight;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(-4.6, -2.2, 2.4, Math.PI * 0.9, Math.PI * 1.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(4.6, -2.2, 2.4, Math.PI * 1.2, Math.PI * 2.1);
  ctx.stroke();

  // 3. Pelvic Basin / Cavity Depth
  ctx.fillStyle = colors.boneCavity;
  ctx.beginPath();
  ctx.ellipse(0, 0.2, 2.8, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Paired Obturator Foramina (Dark oval holes between ischium and pubis)
  ctx.fillStyle = colors.boneCavity;
  ctx.beginPath();
  ctx.ellipse(-2.6, 1.4, 1.1, 0.8, -0.3, 0, Math.PI * 2);
  ctx.ellipse(2.6, 1.4, 1.1, 0.8, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // 5. Pubic Arch & Symphysis
  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.moveTo(-1.6, 2.4);
  ctx.lineTo(0, 1.6);
  ctx.lineTo(1.6, 2.4);
  ctx.lineTo(0, 3.2);
  ctx.closePath();
  ctx.fill();

  // 6. Acetabulum (Hip Socket Cups)
  ctx.fillStyle = colors.boneDark;
  ctx.beginPath();
  ctx.arc(-4.2, 0.8, 1.2, 0, Math.PI * 2);
  ctx.arc(4.2, 0.8, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Anatomical Thoracic Cage (Ribcage, Spine, Clavicles, Scapulae & Sternum)
 * Features true 3D volumetric curved ribs wrapping around the thoracic cavity,
 * segmented thoracic vertebrae with spinous processes, clavicles, scapulae wings,
 * and tripartite sternum (Manubrium, Sternal Body, Xiphoid process).
 */
export function drawDetailedRibcage(ctx, colors, isBackView = false, dirIndex = 2) {
  ctx.save();

  // 1. Posterior Dorsal Spine & Intervertebral Discs
  ctx.fillStyle = colors.boneShadow;
  for (let v = -10.5; v <= -0.5; v += 1.8) {
    ctx.fillRect(-1.1, v, 2.2, 1.2);
    // Intervertebral disc cartilage
    ctx.fillStyle = colors.boneDark;
    ctx.fillRect(-1.2, v + 1.2, 2.4, 0.6);
    ctx.fillStyle = colors.boneShadow;

    // Spinous process spur down dorsal midline
    if (isBackView) {
      ctx.fillStyle = colors.boneHighlight;
      ctx.fillRect(-0.4, v + 0.1, 0.8, 1.0);
      ctx.fillStyle = colors.boneShadow;
    }
  }

  // 2. Posterior Rib Arches (Inner depth layer seen through the ribcage)
  ctx.strokeStyle = colors.boneDark;
  ctx.lineWidth = 1.0;
  for (let r = 0; r < 6; r++) {
    const ry = -9.2 + r * 1.5;
    const rw = 6.2 - Math.abs(r - 2.5) * 0.55;
    ctx.beginPath();
    ctx.moveTo(-rw * 0.9, ry - 0.4);
    ctx.quadraticCurveTo(0, ry - 0.8, rw * 0.9, ry - 0.4);
    ctx.stroke();
  }

  // 3. Thoracic Cavity Ambient Shadow
  ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
  ctx.beginPath();
  ctx.ellipse(0, -5.5, 5.2, 5.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Anterior Rib Arches (Front volumetric cylindrical rib strips)
  for (let r = 0; r < 6; r++) {
    const ry = -9.2 + r * 1.5;
    const rw = 7.0 - Math.abs(r - 2.5) * 0.6;

    // Rib Shadow (inferior costal groove)
    ctx.strokeStyle = colors.boneShadow;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-rw, ry + 0.4);
    ctx.quadraticCurveTo(-rw * 0.5, ry + 1.2, 0, ry + 0.9);
    ctx.quadraticCurveTo(rw * 0.5, ry + 1.2, rw, ry + 0.4);
    ctx.stroke();

    // Rib Highlight (superior crest)
    ctx.strokeStyle = colors.boneBase;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-rw, ry);
    ctx.quadraticCurveTo(-rw * 0.5, ry + 0.8, 0, ry + 0.5);
    ctx.quadraticCurveTo(rw * 0.5, ry + 0.8, rw, ry);
    ctx.stroke();

    // Specular rib glint
    ctx.strokeStyle = colors.boneHighlight;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-rw * 0.8, ry + 0.1);
    ctx.lineTo(-rw * 0.3, ry + 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rw * 0.3, ry + 0.5);
    ctx.lineTo(rw * 0.8, ry + 0.1);
    ctx.stroke();
  }

  // 5. Back View: Bilateral Scapulae (Shoulder Blades)
  if (isBackView) {
    // Left Scapula
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.moveTo(-2.2, -10.2);
    ctx.lineTo(-7.2, -9.6);
    ctx.lineTo(-4.0, -3.8); // Inferior angle
    ctx.closePath();
    ctx.fill();

    // Scapular spine ridge
    ctx.strokeStyle = colors.boneHighlight;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-7.2, -9.6);
    ctx.lineTo(-2.8, -8.6);
    ctx.stroke();

    // Right Scapula
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.moveTo(2.2, -10.2);
    ctx.lineTo(7.2, -9.6);
    ctx.lineTo(4.0, -3.8); // Inferior angle
    ctx.closePath();
    ctx.fill();

    // Scapular spine ridge
    ctx.beginPath();
    ctx.moveTo(7.2, -9.6);
    ctx.lineTo(2.8, -8.6);
    ctx.stroke();
  } else {
    // 6. Front View: Tripartite Sternum (Breastbone)
    // Manubrium (Broad upper shield with suprasternal notch)
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.moveTo(-2.0, -10.4);
    ctx.lineTo(0, -9.8); // Suprasternal notch
    ctx.lineTo(2.0, -10.4);
    ctx.lineTo(1.8, -8.2);
    ctx.lineTo(-1.8, -8.2);
    ctx.closePath();
    ctx.fill();

    // Body of Sternum (Gladiolus with segmented costal notches)
    ctx.fillStyle = colors.boneMid;
    ctx.fillRect(-1.1, -8.0, 2.2, 5.0);

    for (let c = -7.2; c <= -4.0; c += 1.4) {
      ctx.fillStyle = colors.boneDark;
      ctx.fillRect(-1.2, c, 2.4, 0.4);
      ctx.fillStyle = colors.boneHighlight;
      ctx.fillRect(-0.4, c + 0.4, 0.8, 0.8);
    }

    // Xiphoid Process (Pointed bottom tip)
    ctx.fillStyle = colors.boneShadow;
    ctx.beginPath();
    ctx.moveTo(-0.9, -3.0);
    ctx.lineTo(0.9, -3.0);
    ctx.lineTo(0, -1.6);
    ctx.closePath();
    ctx.fill();

    // 7. Clavicles (S-Curved Collarbones)
    ctx.strokeStyle = colors.boneBase;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    // Left clavicle
    ctx.beginPath();
    ctx.moveTo(0, -9.8);
    ctx.quadraticCurveTo(-4.0, -11.6, -7.5, -10.0);
    ctx.stroke();
    // Right clavicle
    ctx.beginPath();
    ctx.moveTo(0, -9.8);
    ctx.quadraticCurveTo(4.0, -11.6, 7.5, -10.0);
    ctx.stroke();

    // Clavicular highlight
    ctx.strokeStyle = colors.boneHighlight;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1.0, -10.1);
    ctx.quadraticCurveTo(-4.0, -11.4, -6.5, -10.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1.0, -10.1);
    ctx.quadraticCurveTo(4.0, -11.4, 6.5, -10.3);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Articulated Skeletal Hand (Carpals, Metacarpals & Segmented Phalanges)
 */
export function drawDetailedSkeletalHand(ctx, colors, gripRadius = 1.6, isLeft = false) {
  ctx.save();
  const dir = isLeft ? -1 : 1;

  // 1. Carpal Bone Cluster (Wrist)
  ctx.fillStyle = colors.boneShadow;
  ctx.beginPath();
  ctx.ellipse(0, 0, 1.8, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.boneBase;
  ctx.beginPath();
  ctx.arc(-0.6 * dir, -0.3, 0.6, 0, Math.PI * 2);
  ctx.arc(0.5 * dir, -0.3, 0.6, 0, Math.PI * 2);
  ctx.fill();

  // 2. Metacarpals (Palm Rays)
  ctx.fillStyle = colors.boneMid;
  for (let m = -2; m <= 2; m++) {
    const mx = m * 0.7 * dir;
    const my = 1.0 + Math.abs(m) * 0.2;
    ctx.fillRect(mx - 0.2, 0.4, 0.4, my);
  }

  // 3. Segmented Gripping Phalanges (Fingers curled around grip)
  for (let f = -2; f <= 2; f++) {
    const fx = f * 0.75 * dir;
    const fy = 1.4 + Math.abs(f) * 0.3;

    // Proximal phalange
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.arc(fx, fy, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Distal phalange curled
    ctx.fillStyle = colors.boneHighlight;
    ctx.beginPath();
    ctx.arc(fx + 0.3 * dir, fy + 0.7, 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Joint crevice
    ctx.fillStyle = colors.boneCavity;
    ctx.fillRect(fx - 0.3, fy + 0.25, 0.6, 0.3);
  }

  ctx.restore();
}

/**
 * High-Fidelity Anatomical Skull Renderer
 * Renders Cranium with coronal/sagittal suture zig-zag crack, supraorbital brow torus,
 * 3D orbital sockets with soul fire, piriform aperture (nasal cavity with vomer bone septum),
 * flared zygomatic arches, maxilla with individual dental crowns & gold tooth,
 * and articulated mandible with chin cleft and lower dental row.
 */
export function drawDetailedSkull(ctx, isBackView, dirIndex, colors, palette, nowMs, seed, isAttacking, attackProgress) {
  ctx.save();

  const isSideEast = dirIndex === 0;
  const isSideWest = dirIndex === 4;
  const eyeOffsetX = isSideEast ? 1.5 : isSideWest ? -1.5 : 0;

  // 1. Cervical Spine (C1-C7 Neck Vertebrae)
  ctx.fillStyle = colors.boneShadow;
  for (let c = 5.2; c <= 8.5; c += 1.2) {
    ctx.fillRect(-1.4, c, 2.8, 0.85);
    ctx.fillStyle = colors.boneDark;
    ctx.fillRect(-1.5, c + 0.85, 3.0, 0.35);
    ctx.fillStyle = colors.boneShadow;
  }

  if (isBackView) {
    // -----------------------------------------------------------------------
    // BACK VIEW: Neurocranium, Occipital Bone & Lambdoid Suture
    // -----------------------------------------------------------------------
    // Cranial Dome
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.arc(0, 0, 7.2, 0, Math.PI * 2);
    ctx.fill();

    // Occipital core shadow
    ctx.fillStyle = colors.boneShadow;
    ctx.beginPath();
    ctx.arc(0, 2.5, 4.8, 0, Math.PI);
    ctx.fill();

    // External Occipital Protuberance & Nuchal Crest
    ctx.fillStyle = colors.boneHighlight;
    ctx.beginPath();
    ctx.ellipse(0, 1.2, 1.2, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lambdoid Suture (Fine serrated zig-zag suture line)
    ctx.strokeStyle = colors.suture;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-5.5, -1.0);
    ctx.lineTo(-4.0, 0.8);
    ctx.lineTo(-2.2, 0.2);
    ctx.lineTo(0, 1.2);
    ctx.lineTo(2.2, 0.2);
    ctx.lineTo(4.0, 0.8);
    ctx.lineTo(5.5, -1.0);
    ctx.stroke();

    // Mastoid processes on lateral base
    ctx.fillStyle = colors.boneMid;
    ctx.beginPath();
    ctx.arc(-5.2, 4.5, 1.3, 0, Math.PI * 2);
    ctx.arc(5.2, 4.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // -----------------------------------------------------------------------
    // FRONT / 3-QUARTER VIEW: Cranium, Suture, Orbits, Piriform & Mandible
    // -----------------------------------------------------------------------
    // 1. Neurocranium (Frontal & Parietal Vault Dome)
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.arc(0, -1.2, 7.0, 0, Math.PI * 2);
    ctx.fill();

    // Cranial 3D volume shading
    ctx.fillStyle = colors.boneHighlight;
    ctx.beginPath();
    ctx.arc(-1.5, -3.8, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Coronal Suture (Fine zig-zag suture crack across frontal bone)
    ctx.strokeStyle = colors.suture;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-4.8, -4.5);
    ctx.lineTo(-3.2, -5.2);
    ctx.lineTo(-1.8, -4.6);
    ctx.lineTo(0, -5.4);
    ctx.lineTo(1.8, -4.7);
    ctx.lineTo(3.6, -5.3);
    ctx.lineTo(4.8, -4.5);
    ctx.stroke();

    // Temporal Lines indentation
    ctx.strokeStyle = colors.boneShadow;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(-5.2, -1.5, 2.5, -Math.PI * 0.4, Math.PI * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5.2, -1.5, 2.5, Math.PI * 0.8, Math.PI * 1.4);
    ctx.stroke();

    // 2. Supraorbital Brow Ridge (Prominent heavy bone eyebrow torus)
    ctx.fillStyle = colors.boneHighlight;
    ctx.beginPath();
    ctx.moveTo(-5.5 + eyeOffsetX, -2.4);
    ctx.quadraticCurveTo(-2.6 + eyeOffsetX, -3.8, 0 + eyeOffsetX, -2.8); // Glabella
    ctx.quadraticCurveTo(2.6 + eyeOffsetX, -3.8, 5.5 + eyeOffsetX, -2.4);
    ctx.quadraticCurveTo(2.6 + eyeOffsetX, -2.8, 0 + eyeOffsetX, -2.0);
    ctx.quadraticCurveTo(-2.6 + eyeOffsetX, -2.8, -5.5 + eyeOffsetX, -2.4);
    ctx.closePath();
    ctx.fill();

    // 3. Zygomatic Arches (Flared Cheekbones)
    ctx.fillStyle = colors.boneBase;
    ctx.beginPath();
    ctx.moveTo(-6.8, -0.6);
    ctx.lineTo(-4.5, 2.2);
    ctx.lineTo(-3.2, 2.0);
    ctx.lineTo(-4.2, -0.8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(6.8, -0.6);
    ctx.lineTo(4.5, 2.2);
    ctx.lineTo(3.2, 2.0);
    ctx.lineTo(4.2, -0.8);
    ctx.closePath();
    ctx.fill();

    // Subzygomatic fossa depth shadow
    ctx.fillStyle = colors.boneCavity;
    ctx.fillRect(-5.6, 1.2, 1.6, 1.4);
    ctx.fillRect(4.0, 1.2, 1.6, 1.4);

    // 4. Orbits (Eye Sockets) - Anatomical pear-drop shape with depth gradient
    ctx.fillStyle = colors.boneCavity;
    ctx.beginPath();
    ctx.ellipse(-2.5 + eyeOffsetX, -0.8, 1.8, 2.2, -0.1, 0, Math.PI * 2);
    ctx.ellipse(2.5 + eyeOffsetX, -0.8, 1.8, 2.2, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Inner orbital rim depth shadow
    ctx.strokeStyle = colors.boneDark;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(-2.5 + eyeOffsetX, -0.8, 1.9, 0, Math.PI * 2);
    ctx.arc(2.5 + eyeOffsetX, -0.8, 1.9, 0, Math.PI * 2);
    ctx.stroke();

    // Soul Flame / Festive Gaze
    ctx.fillStyle = palette.glow;
    ctx.beginPath();
    ctx.arc(-2.5 + eyeOffsetX, -0.8, 0.9, 0, Math.PI * 2);
    ctx.arc(2.5 + eyeOffsetX, -0.8, 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-2.3 + eyeOffsetX, -1.0, 0.4, 0, Math.PI * 2);
    ctx.arc(2.7 + eyeOffsetX, -1.0, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 5. Piriform Aperture (Nasal Cavity & Vomer Septum Bone)
    // Inverted heart / spade shaped hollow
    ctx.fillStyle = colors.boneCavity;
    ctx.beginPath();
    ctx.moveTo(0 + eyeOffsetX, 0.4);
    ctx.lineTo(1.1 + eyeOffsetX, 2.2);
    ctx.lineTo(0 + eyeOffsetX, 2.6);
    ctx.lineTo(-1.1 + eyeOffsetX, 2.2);
    ctx.closePath();
    ctx.fill();

    // Vomer Bone / Nasal Septum (Vertical dividing bone)
    ctx.strokeStyle = colors.boneMid;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0 + eyeOffsetX, 0.6);
    ctx.lineTo(0 + eyeOffsetX, 2.4);
    ctx.stroke();

    // Infraorbital Foramina (Nerve holes under eyes)
    ctx.fillStyle = colors.boneDark;
    ctx.fillRect(-2.8 + eyeOffsetX, 1.4, 0.5, 0.5);
    ctx.fillRect(2.3 + eyeOffsetX, 1.4, 0.5, 0.5);

    // 6. Maxilla & Dental Arch (Upper Jaw with Individual Tooth Roots)
    ctx.fillStyle = colors.boneBase;
    ctx.fillRect(-3.0 + eyeOffsetX, 2.2, 6.0, 1.2);

    // Dark interdental gumline
    ctx.fillStyle = colors.boneCavity;
    ctx.fillRect(-2.8 + eyeOffsetX, 3.2, 5.6, 1.0);

    // Upper Teeth (Incisors & Canines)
    const teeth = [-2.4, -1.4, -0.4, 0.6, 1.6];
    for (let i = 0; i < teeth.length; i++) {
      const tx = teeth[i] + eyeOffsetX;
      const isGold = (i === 2); // Center gold tooth
      ctx.fillStyle = isGold ? palette.metal : colors.boneHighlight;
      ctx.beginPath();
      ctx.rect(tx, 2.6, 0.75, 1.5);
      ctx.fill();

      // Interdental shadow crevice
      ctx.fillStyle = colors.boneCavity;
      ctx.fillRect(tx + 0.75, 2.6, 0.25, 1.5);
    }

    // 7. Articulated Mandible (Lower Jaw with Mental Protuberance / Chin)
    // Dynamic jaw opening chatter on attacks or syncopated beat
    const jawDrop = isAttacking
      ? Math.sin(attackProgress * Math.PI) * 1.6
      : Math.abs(Math.sin(nowMs * 0.008 + seed)) * 0.6;

    ctx.save();
    ctx.translate(0, jawDrop);

    // Mandibular Body & Chin (Mental Protuberance)
    ctx.fillStyle = colors.boneMid;
    ctx.beginPath();
    ctx.moveTo(-3.2 + eyeOffsetX, 3.8);
    ctx.lineTo(-2.2 + eyeOffsetX, 5.8);
    ctx.lineTo(0 + eyeOffsetX, 6.2); // Chin cleft
    ctx.lineTo(2.2 + eyeOffsetX, 5.8);
    ctx.lineTo(3.2 + eyeOffsetX, 3.8);
    ctx.closePath();
    ctx.fill();

    // Chin highlight
    ctx.fillStyle = colors.boneHighlight;
    ctx.beginPath();
    ctx.ellipse(0 + eyeOffsetX, 5.6, 1.4, 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lower Dental Row
    for (let i = 0; i < teeth.length; i++) {
      const tx = teeth[i] + eyeOffsetX;
      ctx.fillStyle = colors.boneHighlight;
      ctx.fillRect(tx + 0.1, 4.0, 0.65, 1.1);
      ctx.fillStyle = colors.boneCavity;
      ctx.fillRect(tx + 0.75, 4.0, 0.25, 1.1);
    }

    ctx.restore(); // Mandible

    // Carnival Face Paint / Sugar Skull swirls around eyes
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.arc(-2.5 + eyeOffsetX, -0.8, 2.6, Math.PI * 0.8, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2.5 + eyeOffsetX, -0.8, 2.6, Math.PI * 1.2, Math.PI * 2.2);
    ctx.stroke();

    // Brow ornamental jewel / feather bind
    ctx.fillStyle = palette.gem;
    ctx.beginPath();
    ctx.arc(0 + eyeOffsetX, -3.2, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Main procedural Samba Skeleton renderer
 */
export function drawSkeletonEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};

  const type = ent.type || "skeleton";
  const facingAngle = ent.facingAngle || 0;
  const isMoving = !!(ent.moving || ent.isMoving);
  const nowMs = performance.now();

  if (ent._seed === undefined) {
    const id = ent.id || ("skel_" + Math.round(x) + "_" + Math.round(y));
    ent._seed = computeFastSeed(id);
  }
  const seed = ent._seed;

  // Variant resolution
  let variantKey = "passista";
  if (type === "boss_samba_king" || type.includes("boss")) {
    variantKey = "boss";
  } else if (type === "elite_knight" || type.includes("knight") || type.includes("warrior")) {
    variantKey = "knight";
  } else if (type.includes("mestre") || type.includes("bateria")) {
    variantKey = "mestre";
  } else if (type.includes("malandro")) {
    variantKey = "malandro";
  }
  const palette = SAMBA_PALETTES[variantKey];

  // Resolve Bone Material Palette
  const boneStyleKey = ent.boneStyle || palette.boneStyle || "ivory";
  const boneColors = BONE_PALETTES[boneStyleKey] || BONE_PALETTES.ivory;

  // Attack detection & progress
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  if (!isAttacking && typeof GameState !== "undefined" && GameState.combatAnimations && ent.id) {
    for (let i = 0; i < GameState.combatAnimations.length; i++) {
      const anim = GameState.combatAnimations[i];
      const dur = anim.duration || anim.durationMs || 450;
      if (anim.attackerId === ent.id && nowMs - anim.createdAt < dur) {
        isAttacking = true;
        break;
      }
    }
  }

  const curAttackDur = ent.attackDuration || 450;
  const attackStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
  let attackProgress = 0;
  if (ent.currentCast && typeof ent.currentCast.progress === "number") {
    attackProgress = ent.currentCast.progress;
  } else if (isAttacking) {
    attackProgress = Math.min(1.0, Math.max(0, (nowMs - attackStart) / curAttackDur));
  }

  const attackType = ent.attackType || ent.skeletonAttackType || (variantKey === "boss" || variantKey === "knight" ? "cleave" : "thrust");
  const isThrust = attackType === "thrust";

  // Hit flash detection
  let isFlashing = false;
  let flashAmt = 0;
  if (ent.lastHitTime && nowMs - ent.lastHitTime < 160) {
    isFlashing = true;
    flashAmt = Math.max(0, 1 - (nowMs - ent.lastHitTime) / 160);
  }

  // Samba BPM Rhythm Calculation
  const bpm = ent.sambaBpm || 124;
  const beatPeriod = 60000 / bpm;
  const beatProgress = ((nowMs + seed * 20) % beatPeriod) / beatPeriod;
  const beatAngle = beatProgress * Math.PI * 2;

  // Syncopated "Samba no Pe" bounce & weight transfer: quick-quick-slow
  const sambaStep = Math.sin(beatAngle) + 0.35 * Math.sin(beatAngle * 2);
  const sambaSway = Math.cos(beatAngle) * 0.12; // Hip & torso sway angle
  const bounceY = Math.abs(Math.sin(beatAngle)) * (isMoving ? 3.5 : 2.0);

  // 8-Direction Matrix
  const normAngle = ((facingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dirIndex = Math.floor(((normAngle + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));

  const isBackView = dirIndex === 5 || dirIndex === 6 || dirIndex === 7;
  const isSideEast = dirIndex === 0;
  const isSideWest = dirIndex === 4;

  ctx.save();
  ctx.translate(x, y);

  // Boss scale modifier
  const masterScale = variantKey === "boss" ? 1.55 : variantKey === "knight" ? 1.25 : 1.15;
  ctx.scale(masterScale, masterScale);

  if (isFlashing) {
    ctx.filter = `brightness(${1 + flashAmt * 1.6}) contrast(${1 + flashAmt * 0.4})`;
  }

  // Rhythmic Samba Ginga bounce
  ctx.translate(0, -bounceY);

  // Dynamic directional forward lunge during attack
  if (isAttacking && attackProgress > 0) {
    const lungeCurve = isThrust
      ? (attackProgress < 0.22 ? -Math.sin(attackProgress / 0.22 * Math.PI * 0.5) * 2.5 : Math.sin((attackProgress - 0.22) / 0.78 * Math.PI) * 10)
      : Math.sin(attackProgress * Math.PI) * 7.5;
    const lungeDist = Math.max(-3, lungeCurve);
    const lungeX = Math.cos(facingAngle) * lungeDist;
    const lungeY = Math.sin(facingAngle) * lungeDist * 0.65;
    ctx.translate(lungeX, lungeY);
  }

  // -------------------------------------------------------------------------
  // 1. CARNAVAL CONFETTI & SPARKS AMBIENT AURA (Boss or Elite)
  // -------------------------------------------------------------------------
  if (variantKey === "boss" || variantKey === "knight") {
    ctx.save();
    const particleCount = variantKey === "boss" ? 6 : 3;
    for (let p = 0; p < particleCount; p++) {
      const pCycle = (nowMs * 0.04 + p * 40 + seed * 12) % 60;
      const pAlpha = Math.max(0, 1 - pCycle / 55);
      const px = Math.sin(nowMs * 0.005 + p * 2.3 + seed) * (18 + p * 2);
      const py = 10 - pCycle * 0.7;
      ctx.fillStyle = palette.feathers[p % palette.feathers.length];
      ctx.globalAlpha = pAlpha * 0.85;
      ctx.fillRect(px - 1, py - 1, 2.5, 2.5);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 2. BACK CARNAVAL PLUMES (Visible when facing forward / side)
  // -------------------------------------------------------------------------
  if (!isBackView) {
    ctx.save();
    ctx.translate(0, -18);
    drawCarnivalHeaddress(ctx, variantKey, palette, nowMs, seed, false);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // 3. ANATOMY: LEGS & FEET ("Samba no Pe" Dynamic Step & Rhythmic Foot-Tap)
  // -------------------------------------------------------------------------
  const isFootTapEnabled = (ent.footTap !== undefined ? !!ent.footTap : (ent.rhythmicFootTap !== undefined ? !!ent.rhythmicFootTap : true));

  const legSwingL = isMoving ? Math.sin(beatAngle) * 5 : sambaStep * 2;
  const legSwingR = isMoving ? -Math.sin(beatAngle) * 5 : -sambaStep * 2;

  let tapDataL = { liftY: 0, angle: 0, impact: 0, kneeOffset: 0 };
  let tapDataR = { liftY: 0, angle: 0, impact: 0, kneeOffset: 0 };

  if (isFootTapEnabled) {
    const measurePeriod = beatPeriod * 2;
    const measureProgress = ((nowMs + seed * 25) % measurePeriod) / measurePeriod;

    if (measureProgress < 0.5) {
      tapDataR = getSambaFootTap(measureProgress / 0.5);
      tapDataL = {
        liftY: 0,
        angle: 0,
        impact: 0,
        kneeOffset: Math.sin(measureProgress * Math.PI * 4) * 0.3
      };
    } else {
      tapDataL = getSambaFootTap((measureProgress - 0.5) / 0.5);
      tapDataR = {
        liftY: 0,
        angle: 0,
        impact: 0,
        kneeOffset: Math.sin(measureProgress * Math.PI * 4) * 0.3
      };
    }
  }

  // Left Leg (Behind/Side)
  drawSambaLegAndFoot(ctx, false, -4, legSwingL, tapDataL, palette, boneColors, isMoving, nowMs, seed);

  // Right Leg
  drawSambaLegAndFoot(ctx, true, 4, legSwingR, tapDataR, palette, boneColors, isMoving, nowMs, seed);

  // -------------------------------------------------------------------------
  // 4. PELVIS & FESTIVE FRINGE SKIRT / JEWELED BELT ("Cinto de Passista")
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.rotate(sambaSway);

  // Anatomical Pelvis (Ilium wings, Sacrum, Obturator holes)
  drawDetailedPelvis(ctx, boneColors, isBackView);

  // Jeweled Belt
  ctx.fillStyle = palette.metal;
  ctx.fillRect(-5.5, -1, 11, 2.5);

  // Center buckle gem
  ctx.fillStyle = palette.gem;
  ctx.beginPath();
  ctx.arc(0, 0.2, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Swinging carnival fringe ribbons
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  const ribbonSway = Math.sin(beatAngle * 1.5) * 2;
  for (let r = -4; r <= 4; r += 2) {
    ctx.beginPath();
    ctx.moveTo(r, 1.5);
    ctx.lineTo(r + ribbonSway * (r > 0 ? 0.6 : -0.6), 5.5);
    ctx.stroke();
  }
  ctx.restore();

  // -------------------------------------------------------------------------
  // 5. RIBCAGE & CARNAVAL SASH ("Faixa de Mestre / Passista")
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.rotate(sambaSway * 0.7);

  // Anatomical Thoracic Cage (Volumetric curved ribs, Spine, Clavicles, Sternum)
  drawDetailedRibcage(ctx, boneColors, isBackView, dirIndex);

  // Diagonal Parade Sash ("Faixa Carnavalesca")
  ctx.strokeStyle = palette.sash;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(5, -1);
  ctx.stroke();

  // Gold trim on sash
  ctx.strokeStyle = palette.sashTrim;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-6.2, -10.8);
  ctx.lineTo(5.2, -1.8);
  ctx.stroke();

  // -------------------------------------------------------------------------
  // 6. FESTIVE COLLAR & EPAULETTES WITH TASSELS ("Ombreiras Festivas")
  // -------------------------------------------------------------------------
  // Golden Gorget / Collar
  ctx.fillStyle = palette.metal;
  ctx.beginPath();
  ctx.ellipse(0, -10.5, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Epaulette Plumes on Shoulders
  const epauletteFlutter = Math.sin(nowMs * 0.008 + seed) * 1.5;
  drawCarnivalPlume(ctx, -7, -10, -Math.PI * 0.7, 7, 3, palette.feathers[0], epauletteFlutter, palette.accent);
  drawCarnivalPlume(ctx, 7, -10, Math.PI * 0.7, 7, 3, palette.feathers[1 % palette.feathers.length], -epauletteFlutter, palette.accent);

  ctx.restore();

  // -------------------------------------------------------------------------
  // 7. ARMS, PANDEIRO & WEAPON (Rhythmic Playing & Attack Motion)
  // -------------------------------------------------------------------------
  // Left Arm: Pandeiro (Tambourine)
  const pandeiroTapAngle = isAttacking
    ? (isThrust ? -1.15 : -0.85)
    : Math.sin(beatAngle * 2) * 0.35 - 0.2;

  ctx.save();
  ctx.translate(-7, -9);
  ctx.rotate(pandeiroTapAngle);

  // Upper Arm: Humerus
  drawLongBone(ctx, 0, 0, -4, 5, 2.2, boneColors);

  // Forearm: Twin bones (Radius & Ulna)
  drawForearmTwinBones(ctx, -4, 5, -2, 10, boneColors);

  // Articulated Hand gripping Pandeiro
  ctx.save();
  ctx.translate(-2, 10);
  drawDetailedSkeletalHand(ctx, boneColors, 1.4, true);
  ctx.restore();

  // Draw Pandeiro
  const isPandeiroShaking = isAttacking || isMoving;
  drawPandeiro(ctx, -2, 10, 1.1, pandeiroTapAngle, palette, isPandeiroShaking, nowMs);
  ctx.restore();

  // Right Arm: Festive Bone Rapier / Maraca / Tamborim Baton
  ctx.save();
  ctx.translate(7, -9);

  let handX = 5;
  let handY = 10;
  let weaponAngle = 0.35;
  let armSwing = Math.sin(beatAngle) * 0.25;

  if (isAttacking && attackProgress > 0) {
    if (isThrust) {
      if (attackProgress < 0.22) {
        const prep = attackProgress / 0.22;
        handX = 5 - prep * 3;
        handY = 10 - prep * 5;
        armSwing = -prep * 0.2;
        weaponAngle = 0.35 - prep * 0.3;
      } else if (attackProgress < 0.68) {
        const strikeP = (attackProgress - 0.22) / 0.46;
        const snap = Math.sin(strikeP * Math.PI);
        handX = 5 + snap * 16;
        handY = 6 - snap * 14;
        armSwing = -snap * 0.4;
        weaponAngle = -Math.PI * 0.42 + (1 - snap) * 0.2;
      } else {
        const rec = (attackProgress - 0.68) / 0.32;
        handX = 5 + (1 - rec) * 4;
        handY = 6 + rec * 4;
        armSwing = (1 - rec) * -0.15;
        weaponAngle = 0.35 + (1 - rec) * -0.2;
      }
    } else {
      if (attackProgress < 0.25) {
        const prep = attackProgress / 0.25;
        handX = 5 + prep * 2;
        handY = 10 - prep * 16;
        armSwing = -prep * 0.6;
        weaponAngle = 0.35 - prep * 1.2;
      } else if (attackProgress < 0.72) {
        const strikeP = (attackProgress - 0.25) / 0.47;
        const sweep = Math.sin(strikeP * Math.PI);
        handX = 7 + sweep * 13;
        handY = -6 + strikeP * 14;
        armSwing = -0.6 + strikeP * 1.4;
        weaponAngle = -0.85 + strikeP * 1.7;
      } else {
        const rec = (attackProgress - 0.72) / 0.28;
        handX = 7 + (1 - rec) * 4;
        handY = 8 + rec * 2;
        armSwing = (1 - rec) * 0.4;
        weaponAngle = 0.85 - rec * 0.5;
      }
    }
  }

  ctx.rotate(armSwing);

  // Upper Arm: Humerus
  drawLongBone(ctx, 0, 0, handX * 0.6, handY * 0.5, 2.2, boneColors);

  // Forearm: Twin bones (Radius & Ulna)
  drawForearmTwinBones(ctx, handX * 0.6, handY * 0.5, handX, handY, boneColors);

  // Articulated Hand gripping weapon
  ctx.save();
  ctx.translate(handX, handY);
  drawDetailedSkeletalHand(ctx, boneColors, 1.4, false);
  ctx.restore();

  // Weapon Attachment: Sabre Carnavalesco / Baton / Cane
  ctx.save();
  ctx.translate(handX, handY);

  if (variantKey === "mestre") {
    // Dual golden conductor baton with gem tip
    ctx.rotate(-0.4 + (isAttacking ? (isThrust ? -weaponAngle * 0.8 : weaponAngle * 0.6) : 0));
    ctx.strokeStyle = palette.metal;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, -18);
    ctx.stroke();
    ctx.fillStyle = palette.gem;
    ctx.beginPath();
    ctx.arc(0, -18, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (variantKey === "malandro") {
    // Stylish silver cane with ivory skull pommel
    ctx.rotate(0.2 + (isAttacking ? (isThrust ? -weaponAngle * 0.5 : weaponAngle * 0.6) : 0));
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(0, 19);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -4, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Sabre Carnavalesco (Carved Ivory blade with golden cup-hilt and fluttering festival ribbons)
    ctx.rotate(weaponAngle);

    // Golden Cup Hilt
    ctx.fillStyle = palette.metal;
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Sharp Ivory Blade with marrow groove
    ctx.fillStyle = boneColors.boneBase;
    ctx.strokeStyle = boneColors.boneShadow;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-0.8, -22);
    ctx.lineTo(0, -24);
    ctx.lineTo(0.8, -22);
    ctx.lineTo(1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Blade central fuller (marrow line)
    ctx.strokeStyle = boneColors.boneShadow;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, -20);
    ctx.stroke();

    // Piercing thrust / slash visual blade trail VFX
    if (isAttacking && attackProgress > 0.22 && attackProgress < 0.70) {
      if (isThrust) {
        const streakAlpha = Math.sin((attackProgress - 0.22) / 0.48 * Math.PI);
        ctx.save();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 2.8;
        ctx.globalAlpha = streakAlpha * 0.85;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(0, -48);
        ctx.stroke();

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(0, -44);
        ctx.stroke();
        ctx.restore();
      } else {
        const arcAlpha = Math.sin((attackProgress - 0.25) / 0.47 * Math.PI);
        ctx.save();
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 3.0;
        ctx.globalAlpha = arcAlpha * 0.8;
        ctx.beginPath();
        ctx.arc(0, -10, 26, -Math.PI * 0.8, Math.PI * 0.1);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Fluttering Carnival Ribbons tied to hilt
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1.2;
    const ribFlutter = Math.sin(nowMs * 0.012 + seed) * 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(4 + ribFlutter, 6, 2 + ribFlutter * 1.5, 12);
    ctx.stroke();

    ctx.strokeStyle = palette.feathers[0];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4 - ribFlutter, 7, -2 - ribFlutter * 1.5, 14);
    ctx.stroke();
  }

  // Micro sparks on strike impact apex
  if (isAttacking && attackProgress >= 0.45 && attackProgress <= 0.60) {
    if (!ent._lastFiredStrikeCycle || ent._lastFiredStrikeCycle !== attackStart) {
      ent._lastFiredStrikeCycle = attackStart;
      if (typeof window !== "undefined" && window.spawnParticle) {
        const sparkColors = [palette.accent, palette.metal, "#ffffff", palette.feathers[0]];
        const tipWorldDist = 28;
        const tipX = x + Math.cos(facingAngle) * tipWorldDist;
        const tipY = y + Math.sin(facingAngle) * tipWorldDist;
        for (let sp = 0; sp < 4; sp++) {
          const spAngle = facingAngle + (Math.random() - 0.5) * 0.8;
          const spSpeed = 50 + Math.random() * 60;
          window.spawnParticle({
            x: tipX,
            y: tipY,
            vx: Math.cos(spAngle) * spSpeed,
            vy: Math.sin(spAngle) * spSpeed - 15,
            color: sparkColors[sp % sparkColors.length],
            size: 1.8 + Math.random() * 1.5,
            maxLife: 0.35 + Math.random() * 0.2,
            gravity: 40,
            drag: 0.92,
            shrink: true
          });
        }
      }
    }
  } else if (attackProgress >= 0.95 || !isAttacking) {
    ent._lastFiredStrikeCycle = null;
  }

  ctx.restore();
  ctx.restore();

  // -------------------------------------------------------------------------
  // 8. SKULL & CARNAVAL MAKEUP / WARPAINT
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.translate(0, -17);
  ctx.rotate(sambaSway * 0.5);

  // Anatomical Skull Renderer
  drawDetailedSkull(ctx, isBackView, dirIndex, boneColors, palette, nowMs, seed, isAttacking, attackProgress);

  // Back headdress feathers mounted behind the skull harness
  if (isBackView) {
    drawCarnivalHeaddress(ctx, variantKey, palette, nowMs, seed, true);
  }

  ctx.restore();

  ctx.restore();
}

/**
 * Triggers a festive Samba Skeleton death explosion:
 * Explodes into flying anatomical bone segments (femurs, ribs, skull fragments, vertebrae)
 * and vibrant carnival confetti & ribbons!
 */
export function triggerSkeletonDeathExplosion(ent) {
  if (typeof window === "undefined" || !window.spawnParticle) return;
  const x = ent.x || 0;
  const y = ent.y || 0;

  const confettiColors = [
    "#10b981", "#f59e0b", "#ec4899", "#8b5cf6",
    "#06b6d4", "#ef4444", "#fbbf24", "#f8fafc"
  ];

  // 1. Anatomical Bone Fragments with specialized bone styles
  const boneStyles = ["bone_femur", "bone_rib", "bone_skull", "bone_vertebra", "bone_finger"];
  for (let b = 0; b < 14; b++) {
    const angle = (b / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 70 + Math.random() * 95;
    const style = boneStyles[b % boneStyles.length];
    window.spawnParticle({
      x: x,
      y: y - 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 45,
      color: "#f8fafc",
      accentColor: "#94a3b8",
      style: style,
      size: 4 + Math.random() * 3.5,
      maxLife: 1.0 + Math.random() * 0.4,
      gravity: 130,
      drag: 0.96,
      shrink: false
    });
  }

  // 2. Flying Carnival Confetti & Streamers
  for (let c = 0; c < 28; c++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 110;
    const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    window.spawnParticle({
      x: x,
      y: y - 15,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      color: color,
      size: 2.2 + Math.random() * 2.5,
      maxLife: 1.1 + Math.random() * 0.5,
      gravity: 50,
      drag: 0.94,
      shrink: false
    });
  }
}

// --- Family: Giant Spider ---
// spiders.js - Procedural Lineless Giant Cave Spider & Arachnid Entity Renderer


/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * Monsters must never have baked-in dark circular shapes emulating ground shadows.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

/**
 * Triggers an arachnid death explosion with severed multi-jointed chitin legs,
 * bursting toxic venom ichor, silk filaments, and skittering spiderlings.
 * @param {Object} ce - Entity state object
 */
export function triggerSpiderDeathExplosion(ce) {
  if (!ce || ce._spiderExploded) return;
  ce._spiderExploded = true;

  const type = (ce.type || "spider").toLowerCase();
  const isBoss = type.startsWith("boss_") || type.includes("broodmother") || type.includes("weaver");
  const isCrystal = type.includes("crystal") || type.includes("weaver");
  const isStalker = type.includes("stalker") || (type.includes("void") && !isCrystal && !type.includes("broodmother"));
  const isVoid = isStalker || type.includes("void");

  const legColor = isCrystal ? "#c084fc" : isStalker ? "#0a0316" : isVoid ? "#312e81" : "#1e293b";
  const legAccent = isCrystal ? "#f0abfc" : isStalker ? "#00f0ff" : isVoid ? "#4338ca" : "#334155";
  const ichorColors = isCrystal
    ? ["#e879f9", "#c084fc", "#a855f7", "#ffffff"]
    : isStalker
    ? ["#00f0ff", "#38bdf8", "#c084fc", "#e879f9", "#d946ef", "#ffffff"]
    : isVoid
    ? ["#6366f1", "#4f46e5", "#818cf8", "#c084fc"]
    : ["#84cc16", "#a3e635", "#4d7c0f", "#22c55e", "#15803d"];

  if (typeof spawnParticle === "function") {
    if (isStalker && !lowDetail) {
      // 1. Severed Void Scythe Legs flying outward in radial burst
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = 125 + Math.random() * 150;
        spawnParticle({
          x: ce.x + Math.cos(angle) * 8,
          y: ce.y + Math.sin(angle) * 6,
          vx: Math.cos(angle) * speed,
          vy: -85 - Math.random() * 120,
          color: "#0a0316",
          accentColor: "#00f0ff",
          size: 7.5,
          maxLife: 2.3,
          drag: 0.94,
          style: "wolf_leg",
          gravity: 220,
          shrink: true,
        });
      }

      // 2. Shattered Obsidian Carapace Shards
      for (let s = 0; s < 6; s++) {
        const angle = (s / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = 90 + Math.random() * 140;
        spawnParticle({
          x: ce.x + Math.cos(angle) * 8,
          y: ce.y + Math.sin(angle) * 8,
          vx: Math.cos(angle) * speed,
          vy: -90 - Math.random() * 110,
          color: "#05020c",
          accentColor: "#c084fc",
          size: 7,
          maxLife: 2.0,
          drag: 0.94,
          style: "wolf_head",
          gravity: 210,
          shrink: true,
        });
      }

      // 3. Cosmic Nova Spark Motes & Void Lightning Sparks
      for (let m = 0; m < 42; m++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 55 + Math.random() * 220;
        spawnParticle({
          x: ce.x + (Math.random() - 0.5) * 12,
          y: ce.y + (Math.random() - 0.5) * 12,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 35,
          color: ichorColors,
          size: 2.2 + Math.random() * 3.8,
          maxLife: 1.3 + Math.random() * 0.8,
          drag: 0.92,
          gravity: 65,
          shrink: true,
          style: "circle",
        });
      }

      // 4. Central Collapsed Singularity Implosion Pulse
      spawnParticle({
        x: ce.x,
        y: ce.y,
        vx: 0,
        vy: -15,
        color: "#00f0ff",
        size: 22,
        maxLife: 0.65,
        drag: 0.88,
        gravity: 0,
        shrink: true,
        style: "circle",
      });

      // 5. Drifting Ethereal Shadow Mist Wisps
      for (let s = 0; s < 10; s++) {
        spawnParticle({
          x: ce.x + (Math.random() - 0.5) * 14,
          y: ce.y + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 60,
          vy: -35 - Math.random() * 60,
          color: ["#1e0836", "#3b0764", "#4c1d95", "#0f051d"],
          size: 3.5 + Math.random() * 2.5,
          maxLife: 1.6,
          drag: 0.96,
          gravity: -25,
          shrink: true,
          style: "circle",
        });
      }
      return;
    }
    // 8 Severed Chitinous Legs flying outward in radial directions
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 110 + Math.random() * 140;
      spawnParticle({
        x: ce.x + Math.cos(angle) * 8,
        y: ce.y + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed,
        vy: -70 - Math.random() * 110,
        color: legColor,
        accentColor: legAccent,
        size: isBoss ? 9 : 6.5,
        maxLife: 2.2,
        drag: 0.94,
        style: "wolf_leg",
        gravity: 240,
        shrink: true,
      });
    }

    // Abdomen rupture pieces
    for (let p = 0; p < 6; p++) {
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 14,
        y: ce.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 160,
        vy: -90 - Math.random() * 100,
        color: legColor,
        accentColor: legAccent,
        size: isBoss ? 11 : 7,
        maxLife: 1.8,
        drag: 0.93,
        style: "wolf_head",
        gravity: 220,
        shrink: true,
      });
    }

    // Splattering toxic venom & ichor droplets
    const dropletCount = isBoss ? 45 : 28;
    for (let b = 0; b < dropletCount; b++) {
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 16,
        y: ce.y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 190,
        vy: -50 - Math.random() * 130,
        color: ichorColors,
        size: 2.2 + Math.random() * 3.8,
        maxLife: 1.1 + Math.random() * 0.7,
        drag: 0.92,
        gravity: 170,
        style: "circle",
      });
    }

    // Drifting silk wisps
    for (let s = 0; s < 8; s++) {
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 10,
        y: ce.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 70,
        vy: -30 - Math.random() * 50,
        color: ["#f8fafc", "#e2e8f0", "#cbd5e1"],
        size: 1.8,
        maxLife: 1.4,
        drag: 0.97,
        gravity: -15, // float gently upwards
        style: "circle",
      });
    }
  }
}

/**
 * Procedural Lineless Giant Cave Spider Entity Renderer
 * Features:
 * - 8 Articulated Inverse-Kinematic legs with Coxa, Femur, Tibia, and Tarsus claws
 * - Alternating tetrapod gait (true arachnid locomotion mechanics)
 * - Volumetric lineless prosoma (carapace) and opisthosoma (abdomen) with breathing hydraulic pulsation
 * - Chelicerae with dripping toxic acid/venom droplets
 * - Articulated pedipalps probing and threat-rearing
 * - 8 glowing predatory ocelli arranged in authentic ocular pattern
 * - Directional 3D depth sorting and continuous facing angle rotation
 * - Dynamic combat animations (threat rear, fang strike, venom spit recoil)
 * - Pure lineless rendering (0 solid ground shadow discs)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {Object} ent - Entity state object
 * @param {boolean} isShadowPass - Shadow pass flag (strictly prohibited from drawing shadows)
 */
export function drawSpiderEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};

  const type = (ent.type || "giant_cave_spider").toLowerCase();
  const facingAngle = (typeof ent.facingAngle === "number" && !isNaN(ent.facingAngle)) ? ent.facingAngle : 0;
  const isMoving = !!(ent.moving || ent.isMoving);
  const isSlowed = !!ent.isSlowed;

  if (ent._seed === undefined) {
    ent._seed = computeFastSeed(ent.id || "spider_entity");
  }
  const seed = ent._seed;
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  // Attack and Cast State Detection
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  let attackProgress = 0;
  if (isAttacking) {
    let animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
    if (ent.currentCast && ent.currentCast.startTime) {
      animStart = ent.currentCast.startTime;
    }
    const duration = (ent.currentCast && ent.currentCast.duration) ? ent.currentCast.duration : 450;
    attackProgress = Math.min(1.0, Math.max(0, (nowMs - animStart) / duration));
  }

  // Hit Flash & Knockback Handling
  let kbX = 0;
  let kbY = 0;
  let isFlashing = false;
  let flashAmt = 0;

    // Crowd level of detail (main.js CrowdLOD) & graphics quality check
  const lowDetail = typeof window !== "undefined" && !!(window.CrowdLOD && window.CrowdLOD.current);
  const allowBlur = !lowDetail && !(typeof window !== "undefined" && window.gameConfig && window.gameConfig.graphicsQuality === "low");

  if (ent.lastHitTime && (nowMs - ent.lastHitTime < 160)) {
    isFlashing = true;
    flashAmt = Math.max(0, 1 - (nowMs - ent.lastHitTime) / 160);
  }

  // Visual Archetypes & Palettes
  const isBoss = type.startsWith("boss_") || type.includes("broodmother");
  const isCrystal = type.includes("crystal");
  const isWeaver = type.includes("weaver") && !isCrystal;
  const isBroodmother = type.includes("broodmother");
  const isTarantula = type.includes("tarantula");
  const isStalker = type.includes("stalker") || (type.includes("void") && !isCrystal && !isBroodmother);
  const isVoid = isStalker || type.includes("void") || type.includes("shadow");

  // Volumetric Color Palettes (Pure Lineless Digital Shading)
  let p = {
    carapaceGrad0: "#334155", // Prosoma highlights
    carapaceGrad1: "#1e293b", // Prosoma midtone
    carapaceGrad2: "#0f172a", // Prosoma shadow
    carapaceSpecular: "rgba(148, 163, 184, 0.45)",

    abdoGrad0: "#384556",     // Opisthosoma upper highlight
    abdoGrad1: "#1e293b",     // Opisthosoma primary body
    abdoGrad2: "#090d16",     // Opisthosoma deep underbelly
    abdoMarking: "#64748b",   // Tergite plates / dorsal grooves
    abdoMarkingGlow: "#22c55e",

    legFemurGrad0: "#475569", // Upper leg highlight
    legFemurGrad1: "#1e293b", // Upper leg base
    legTibiaGrad0: "#334155", // Lower leg
    legTibiaGrad1: "#0f172a",
    legClaw: "#020617",       // Sharp tarsus claw tip
    legJointSpur: "#64748b",  // Patella knee spur

    chelicerae0: "#334155",
    chelicerae1: "#0f172a",
    fangColor: "#090d16",
    fangGlint: "#cbd5e1",
    venomColor: "#84cc16",
    venomGlow: "rgba(132, 204, 22, 0.7)",

    eyeCore: "#22c55e",       // Bioluminescent Emerald Cave Eyes
    eyeGlow: "rgba(34, 197, 94, 0.8)",
    eyeSpecular: "#ffffff",

    auraColor: "rgba(34, 197, 94, 0.25)"
  };

  if (isWeaver) {
    p = {
      carapaceGrad0: "#f8fafc", // Silky ivory pearl prosoma
      carapaceGrad1: "#cbd5e1", // Silvery silk chitin midtone
      carapaceGrad2: "#64748b", // Deep slate shadow
      carapaceSpecular: "rgba(255, 255, 255, 0.9)",

      abdoGrad0: "#ffffff",     // Luminous opalescent abdomen highlight
      abdoGrad1: "#cbd5e1",     // Silk spinneret body
      abdoGrad2: "#475569",     // Deep silk gland shadow
      abdoMarking: "#e2e8f0",   // Gossamer web dorsal filigree
      abdoMarkingGlow: "#a855f7",// Arcane silk luminescence

      legFemurGrad0: "#f1f5f9", // Pearlescent upper leg
      legFemurGrad1: "#94a3b8",
      legTibiaGrad0: "#cbd5e1", // Lower leg
      legTibiaGrad1: "#475569",
      legClaw: "#0f172a",       // Chitin tip claw
      legJointSpur: "#c084fc",  // Amethyst silk patella spur

      chelicerae0: "#cbd5e1",
      chelicerae1: "#475569",
      fangColor: "#1e1b4b",     // Obsidian fangs
      fangGlint: "#ffffff",     // Needle-sharp glint
      venomColor: "#c084fc",    // Radiant silk venom / gossamer thread
      venomGlow: "rgba(192, 132, 252, 0.85)",

      eyeCore: "#a855f7",       // Bioluminescent Mystic Amethyst Eyes
      eyeGlow: "rgba(168, 85, 247, 0.9)",
      eyeSpecular: "#ffffff",

      auraColor: "rgba(168, 85, 247, 0.3)"
    };
  } else if (isCrystal) {
    p = {
      carapaceGrad0: "#c084fc",
      carapaceGrad1: "#7e22ce",
      carapaceGrad2: "#3b0764",
      carapaceSpecular: "rgba(245, 208, 254, 0.75)",

      abdoGrad0: "#e879f9",
      abdoGrad1: "#9333ea",
      abdoGrad2: "#2e1065",
      abdoMarking: "#f0abfc",
      abdoMarkingGlow: "#e879f9",

      legFemurGrad0: "#d8b4fe",
      legFemurGrad1: "#6b21a8",
      legTibiaGrad0: "#a855f7",
      legTibiaGrad1: "#3b0764",
      legClaw: "#2e1065",
      legJointSpur: "#f5d0fe",

      chelicerae0: "#7e22ce",
      chelicerae1: "#3b0764",
      fangColor: "#f0abfc",
      fangGlint: "#ffffff",
      venomColor: "#f43f5e",
      venomGlow: "rgba(244, 63, 94, 0.8)",

      eyeCore: "#f43f5e",
      eyeGlow: "rgba(244, 63, 94, 0.85)",
      eyeSpecular: "#fff1f2",

      auraColor: "rgba(192, 132, 252, 0.35)"
    };
  } else if (isBroodmother) {
    p = {
      carapaceGrad0: "#451a03",
      carapaceGrad1: "#271004",
      carapaceGrad2: "#140702",
      carapaceSpecular: "rgba(217, 119, 6, 0.4)",

      abdoGrad0: "#78350f",
      abdoGrad1: "#361605",
      abdoGrad2: "#0f0501",
      abdoMarking: "#b45309",
      abdoMarkingGlow: "#f59e0b",

      legFemurGrad0: "#572407",
      legFemurGrad1: "#240d02",
      legTibiaGrad0: "#361605",
      legTibiaGrad1: "#140702",
      legClaw: "#0a0301",
      legJointSpur: "#92400e",

      chelicerae0: "#451a03",
      chelicerae1: "#170802",
      fangColor: "#0d0401",
      fangGlint: "#fef3c7",
      venomColor: "#eab308",
      venomGlow: "rgba(234, 179, 8, 0.75)",

      eyeCore: "#dc2626",
      eyeGlow: "rgba(220, 38, 38, 0.85)",
      eyeSpecular: "#fee2e2",

      auraColor: "rgba(217, 119, 6, 0.3)"
    };
  } else if (isTarantula) {
    p = {
      carapaceGrad0: "#3f3f46",
      carapaceGrad1: "#27272a",
      carapaceGrad2: "#09090b",
      carapaceSpecular: "rgba(161, 161, 170, 0.4)",

      abdoGrad0: "#52525b",
      abdoGrad1: "#27272a",
      abdoGrad2: "#09090b",
      abdoMarking: "#ea580c",
      abdoMarkingGlow: "#f97316",

      legFemurGrad0: "#52525b",
      legFemurGrad1: "#27272a",
      legTibiaGrad0: "#3f3f46",
      legTibiaGrad1: "#18181b",
      legClaw: "#000000",
      legJointSpur: "#ea580c",

      chelicerae0: "#3f3f46",
      chelicerae1: "#18181b",
      fangColor: "#09090b",
      fangGlint: "#f4f4f5",
      venomColor: "#f97316",
      venomGlow: "rgba(249, 115, 22, 0.7)",

      eyeCore: "#f59e0b",
      eyeGlow: "rgba(245, 158, 11, 0.85)",
      eyeSpecular: "#ffffff",

      auraColor: "rgba(234, 88, 12, 0.25)"
    };
  } else if (isStalker || isVoid) {
    p = {
      carapaceGrad0: "#3b156b", // spectral amethyst highlight
      carapaceGrad1: "#16082f", // abyssal violet midtone
      carapaceGrad2: "#05020c", // pitch obsidian void shadow
      carapaceSpecular: "rgba(192, 132, 252, 0.8)",

      abdoGrad0: "#4c1d95",     // deep void purple
      abdoGrad1: "#1e0836",     // cosmic event horizon
      abdoGrad2: "#030008",     // abyss core
      abdoMarking: "#c084fc",
      abdoMarkingGlow: "#00f0ff",

      legFemurGrad0: "#581c87", // upper leg abyssal violet
      legFemurGrad1: "#1e0836",
      legTibiaGrad0: "#3b0764", // lower leg
      legTibiaGrad1: "#090214",
      legClaw: "#020006",       // razor obsidian scythe blade
      legJointSpur: "#00f0ff",  // glowing cyan astral crystals

      chelicerae0: "#312e81",
      chelicerae1: "#0a0316",
      fangColor: "#05010d",
      fangGlint: "#38bdf8",     // cyan glint
      venomColor: "#00f0ff",    // celestial plasma venom
      venomGlow: "rgba(0, 240, 255, 0.9)",

      eyeCore: "#00f0ff",       // piercing cyan predatory eyes
      eyeGlow: "rgba(0, 240, 255, 0.95)",
      eyeSpecular: "#ffffff",

      auraColor: "rgba(168, 85, 247, 0.35)",
      runeGlow: "#e879f9",
      voidPhotonRing: "rgba(0, 240, 255, 0.7)"
    };
  }

  // Kinematic Cycle & Walking Phase
  const speedFactor = isSlowed ? 0.45 : 1.0;
  const walkSpeed = 0.011 * speedFactor;
  const walkPhase = isMoving ? (nowMs * walkSpeed + seed) % (Math.PI * 2) : 0;
  const idleBreathe = Math.sin(nowMs * 0.0035 + seed) * 1.2;
  const palpTwitch = Math.sin(nowMs * 0.008 + seed * 2) * 1.5;

  // Elastic Squash & Stretch on Movement / Damage Flash
  let squashX = 1;
  let squashY = 1;
  if (isFlashing) {
    const elasticHit = Math.sin(flashAmt * Math.PI) * 0.24;
    squashY = 1 - elasticHit;
    squashX = 1 + elasticHit;
  } else if (isMoving) {
    const scuttleSquash = Math.sin(walkPhase * 2) * 0.04;
    squashX = 1 + scuttleSquash;
    squashY = 1 - scuttleSquash;
  }

  // Attack Animation Kinetics (Threat display rear-up -> Forward lunge strike -> Recovery)
  let atkLungeY = 0;
  let atkRearAngle = 0;
  let fangSpread = 0;
  let venomDripDrop = 0;

  if (isAttacking) {
    if (attackProgress < 0.35) {
      // Phase 1: Threat Display / Rearing Back
      const t = attackProgress / 0.35;
      atkLungeY = -Math.sin(t * Math.PI * 0.5) * 6;
      atkRearAngle = -0.18 * Math.sin(t * Math.PI * 0.5);
      fangSpread = t * 4;
    } else if (attackProgress < 0.65) {
      // Phase 2: Violent Forward Fang Snap & Venom Strike
      const t = (attackProgress - 0.35) / 0.3;
      atkLungeY = 12 * Math.sin(t * Math.PI);
      atkRearAngle = 0.12 * Math.sin(t * Math.PI);
      fangSpread = 4 * (1 - t * 0.8);
      venomDripDrop = t * 14;
    } else {
      // Phase 3: Recoil & Settle
      const t = (attackProgress - 0.65) / 0.35;
      atkLungeY = (1 - t) * 3;
      atkRearAngle = (1 - t) * 0.04;
      fangSpread = (1 - t) * 1.5;
    }
  }

  // Base Scale of the Giant Spider
  const baseScale = isBoss ? 2.5 : isBroodmother ? 2.3 : isStalker ? 2.25 : isTarantula ? 2.15 : isWeaver ? 2.1 : 2.0;

  ctx.save();
  ctx.translate(x + kbX, y + kbY);

  if (isFlashing) {
    ctx.filter = `brightness(${1 + flashAmt * 1.6}) contrast(${1 + flashAmt * 0.6})`;
  }

  ctx.scale(baseScale * squashX, baseScale * squashY);

  // Rotate to entity facing direction (aligning anterior head along facing angle vector)
  ctx.rotate(facingAngle + Math.PI / 2);

  // Subtle body vertical bobbing while scuttling or breathing, and forward attack lunge (head is at local -Y)
  const bodyBob = isMoving ? Math.abs(Math.sin(walkPhase)) * 1.8 : idleBreathe * 0.6;
  ctx.translate(0, bodyBob - atkLungeY);

  // -------------------------------------------------------------
  // 1. BOSS & VOID STALKER AURA GLOW (Atmospheric bioluminescence, strictly NO solid ground shadow)
  // -------------------------------------------------------------
  if (isStalker) {
    // Cosmic Event Horizon Aura & Gravitational Lensing
    const stalkerPulse = Math.sin(nowMs * 0.0035 + seed) * 0.2 + 0.8;
    const auraR = 48 * stalkerPulse;
    const voidAura = safeCreateRadialGradient(ctx, 0, 0, 6, 0, 0, auraR);
    if (voidAura) {
      voidAura.addColorStop(0, "rgba(217, 70, 239, 0.32)");
      voidAura.addColorStop(0.35, "rgba(59, 7, 100, 0.22)");
      voidAura.addColorStop(0.7, "rgba(6, 182, 212, 0.12)");
      voidAura.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = voidAura;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expanding Gravitational Lensing Ring
    ctx.save();
    const ringPhase = ((nowMs * 0.0016 + seed) % 1);
    const ringR = 26 + ringPhase * 26;
    const ringAlpha = (1 - ringPhase) * 0.35;
    ctx.strokeStyle = `rgba(0, 240, 255, ${ringAlpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, ringR, ringR * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Void Shockwave Ring during Phase-Strike
    if (isAttacking && attackProgress >= 0.32 && attackProgress <= 0.75) {
      const swP = (attackProgress - 0.32) / 0.43;
      const swR = 12 + swP * 46;
      const swAlpha = (1 - swP) * 0.75;
      ctx.save();
      ctx.strokeStyle = `rgba(0, 240, 255, ${swAlpha})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, -6, swR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  } else if (isBoss) {
    const auraPulse = Math.sin(nowMs * 0.004) * 0.2 + 0.8;
    const auraGrad = safeCreateRadialGradient(ctx, 0, 0, 4, 0, 0, 40 * auraPulse);
    if (auraGrad) {
      auraGrad.addColorStop(0, p.auraColor);
      auraGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 40 * auraPulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------
  // 2. EIGHT ARTICULATED INVERSE-KINEMATIC ARACHNID LEGS
  // 4 pairs: L1-L4 (left side) and R1-R4 (right side)
  // Walking Mechanics: Alternating Tetrapod Gait
  // Group A: L1, R2, L3, R4
  // Group B: R1, L2, R4, L3
  // -------------------------------------------------------------
  // Leg Base Config: [angleFromCenter, femurLength, tibiaLength, restSpreadX, restSpreadY]
  const legConfigs = [
    // Pair 1: Front reachers (angled forward-out)
    { side: -1, idx: 0, group: 0, rootX: -6, rootY: -6, kneeReachX: -22, kneeReachY: -18, tipReachX: -28, tipReachY: -28 },
    { side:  1, idx: 0, group: 1, rootX:  6, rootY: -6, kneeReachX:  22, kneeReachY: -18, tipReachX:  28, tipReachY: -28 },

    // Pair 2: Mid-front lateral reachers
    { side: -1, idx: 1, group: 1, rootX: -7, rootY: -2, kneeReachX: -28, kneeReachY: -7,  tipReachX: -36, tipReachY: -10 },
    { side:  1, idx: 1, group: 0, rootX:  7, rootY: -2, kneeReachX:  28, kneeReachY: -7,  tipReachX:  36, tipReachY: -10 },

    // Pair 3: Mid-back lateral reachers
    { side: -1, idx: 2, group: 0, rootX: -7, rootY:  3, kneeReachX: -27, kneeReachY:  8,  tipReachX: -35, tipReachY:  15 },
    { side:  1, idx: 2, group: 1, rootX:  7, rootY:  3, kneeReachX:  27, kneeReachY:  8,  tipReachX:  35, tipReachY:  15 },

    // Pair 4: Rear anchors (angled backward-out)
    { side: -1, idx: 3, group: 1, rootX: -6, rootY:  7, kneeReachX: -20, kneeReachY: 20,  tipReachX: -26, tipReachY:  32 },
    { side:  1, idx: 3, group: 0, rootX:  6, rootY:  7, kneeReachX:  20, kneeReachY: 20,  tipReachX:  26, tipReachY:  32 },
  ];

  // Helper to draw a single 3-segment articulated lineless leg
  function drawArticulatedLeg(legCfg) {
    const isGroupA = legCfg.group === 0;
    const phaseOffset = isGroupA ? 0 : Math.PI;
    const legPhase = (walkPhase + phaseOffset) % (Math.PI * 2);

    // Tetrapod gait kinematics
    // When swinging forward: leg lifts and steps outward/forward
    // When planted: leg pushes down and slightly back
    let stepLift = 0;
    let stepSweepX = 0;
    let stepSweepY = 0;

    if (isMoving) {
      const swingRatio = Math.sin(legPhase);
      stepLift = Math.max(0, swingRatio) * 5; // Knee lift
      stepSweepY = -Math.cos(legPhase) * 4;
      stepSweepX = legCfg.side * Math.sin(legPhase) * 2;
    } else {
      // Subtle idle arachnid twitch
      const microTwitch = Math.sin(nowMs * 0.004 + legCfg.idx * 1.5 + seed) * 0.8;
      stepSweepY = microTwitch;
    }

    // Threat Display Reaction: front pair (idx 0) rears UP high!
    if (isAttacking && legCfg.idx === 0) {
      const rearUp = Math.sin(Math.min(1, attackProgress * 2) * Math.PI) * 12;
      stepLift += rearUp * 0.8;
      stepSweepY -= rearUp * 0.9;
    }

    const rx = legCfg.rootX;
    const ry = legCfg.rootY;
    const kx = legCfg.kneeReachX + stepSweepX * 0.4;
    const ky = legCfg.kneeReachY - stepLift + stepSweepY * 0.3;
    const tx = legCfg.tipReachX + stepSweepX;
    const ty = legCfg.tipReachY + stepSweepY;

    // Segment 1: Coxa & Femur (Fast solid fill under low detail)
    ctx.save();
    if (lowDetail) {
      ctx.fillStyle = p.legFemurGrad0;
    } else {
      const femurGrad = ctx.createLinearGradient(rx, ry, kx, ky);
      femurGrad.addColorStop(0, p.legFemurGrad1);
      femurGrad.addColorStop(0.5, p.legFemurGrad0);
      femurGrad.addColorStop(1, p.legTibiaGrad1);
      ctx.fillStyle = femurGrad;
    }

    ctx.beginPath();
    // Draw tapered muscular chitin segment
    const perpX = -(ky - ry);
    const perpY = (kx - rx);
    const len = Math.sqrt((perpX) * (perpX) + (perpY) * (perpY)) || 1;
    const nx = (perpX / len) * 2.2;
    const ny = (perpY / len) * 2.2;

    ctx.moveTo(rx - nx * 0.8, ry - ny * 0.8);
    ctx.lineTo(kx - nx * 0.4, ky - ny * 0.4);
    ctx.lineTo(kx + nx * 0.4, ky + ny * 0.4);
    ctx.lineTo(rx + nx * 0.8, ry + ny * 0.8);
    ctx.closePath();
    ctx.fill();

    if (!lowDetail) {
      // Femur dorsal ridge specular glint
      ctx.strokeStyle = p.carapaceSpecular;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(kx, ky);
      ctx.stroke();

      // Patella Knee Joint Bulb & Spur
      ctx.fillStyle = p.legJointSpur;
      ctx.beginPath();
      ctx.arc(kx, ky, 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Knee spine spur
      const spurAngle = Math.atan2(ky - ry, kx - rx) + (legCfg.side * Math.PI * 0.5);
      ctx.fillStyle = p.legClaw;
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(kx + Math.cos(spurAngle) * 2.5, ky + Math.sin(spurAngle) * 2.5);
      ctx.lineTo(kx - nx * 0.3, ky - ny * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    // Segment 2: Tibia, Metatarsus & Tarsus
    if (lowDetail) {
      ctx.fillStyle = p.legTibiaGrad0;
    } else {
      const tibiaGrad = ctx.createLinearGradient(kx, ky, tx, ty);
      tibiaGrad.addColorStop(0, p.legTibiaGrad0);
      tibiaGrad.addColorStop(0.7, p.legTibiaGrad1);
      tibiaGrad.addColorStop(1, p.legClaw);
      ctx.fillStyle = tibiaGrad;
    }
    const tPerpX = -(ty - ky);
    const tPerpY = (tx - kx);
    const tLen = Math.sqrt((tPerpX) * (tPerpX) + (tPerpY) * (tPerpY)) || 1;
    const tnx = (tPerpX / tLen) * 1.6;
    const tny = (tPerpY / tLen) * 1.6;

    ctx.beginPath();
    ctx.moveTo(kx - tnx, ky - tny);
    ctx.lineTo(tx, ty); // Taper to sharp tip
    ctx.lineTo(kx + tnx, ky + tny);
    ctx.closePath();
    ctx.fill();

    // Sharp Tarsus Claw / Razor Void Scythe Blade
    if (isStalker) {
      // Curved Razor Void Scythe Blade with Astral Edge
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.quadraticCurveTo(tx + (legCfg.side * 3.5), ty - 1.5, tx, ty);
      ctx.stroke();

      ctx.fillStyle = "#00f0ff";
      ctx.beginPath();
      ctx.arc(tx, ty, 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Dimensional Phase Trail when moving or attacking
      if (isMoving || isAttacking) {
        ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + (stepSweepX * -1.5), ty + (stepSweepY * -1.5));
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = p.legClaw;
      ctx.beginPath();
      ctx.arc(tx, ty, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Draw Rear and Mid Legs First (Behind Abdomen Z-Layer)
  for (let i = 2; i < legConfigs.length; i++) {
    drawArticulatedLeg(legConfigs[i]);
  }

  // -------------------------------------------------------------
  // 3. OPISTHOSOMA (ABDOMEN) - Volumetric Lineless Spherical Mass
  // Positioned posteriorly (towards positive Y)
  // Hydraulic respiration pulsing
  // -------------------------------------------------------------
  const abdoPulse = Math.sin(nowMs * 0.003 + seed) * 0.8;
  const abdoRadiusX = (isBroodmother ? 17 : isBoss ? 16 : isWeaver ? 14.5 : 13.5) + abdoPulse * 0.4;
  const abdoRadiusY = (isBroodmother ? 21 : isBoss ? 19 : isWeaver ? 17.5 : 16.5) + abdoPulse * 0.6;
  const abdoCenterY = 13 + abdoPulse * 0.3;

  ctx.save();
  // Pedicel (waist connecting prosoma and opisthosoma)
  ctx.fillStyle = p.carapaceGrad2;
  ctx.beginPath();
  ctx.ellipse(0, 3, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Opisthosoma Main Mass
  const abdoGrad = safeCreateRadialGradient(
    ctx,
    0, abdoCenterY - abdoRadiusY * 0.25, 2,
    0, abdoCenterY, abdoRadiusY * 1.05
  );
  if (abdoGrad) {
    abdoGrad.addColorStop(0, p.abdoGrad0);
    abdoGrad.addColorStop(0.5, p.abdoGrad1);
    abdoGrad.addColorStop(1, p.abdoGrad2);
    ctx.fillStyle = abdoGrad;
  } else {
    ctx.fillStyle = p.abdoGrad1;
  }

  ctx.beginPath();
  ctx.ellipse(0, abdoCenterY, abdoRadiusX, abdoRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Opisthosoma Tergite Plates / Segmented Dorsal Grooves
  // 5 curved transverse chitin plates with ambient shadow valleys
  for (let s = 1; s <= 4; s++) {
    const segY = abdoCenterY - abdoRadiusY * 0.55 + s * (abdoRadiusY * 0.28);
    const segWidth = Math.sin((s / 5) * Math.PI) * (abdoRadiusX * 1.5);

    // Deep shadow groove
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, segY - 14, segWidth * 0.7, 0.6, Math.PI - 0.6);
    ctx.stroke();

    // Subtle dorsal highlight on chitin plate lip
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(0, segY - 13, segWidth * 0.68, 0.6, Math.PI - 0.6);
    ctx.stroke();
  }

  // Cave Spider Dorsal Warning Pattern / Bioluminescent Chevron Fissures
  ctx.save();
  ctx.fillStyle = p.abdoMarkingGlow;
  if (allowBlur) {
    ctx.shadowColor = p.abdoMarkingGlow;
    ctx.shadowBlur = allowBlur ? 6 : 0;
  }
  ctx.globalAlpha = 0.75 + Math.sin(nowMs * 0.005 + seed) * 0.2;

  if (isWeaver) {
    // Ethereal Gossamer Silk Web Filigree on Opisthosoma (Tecela da Seda)
    ctx.strokeStyle = p.abdoMarking;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let w = 1; w <= 3; w++) {
      const wr = w * 4.2;
      ctx.arc(0, abdoCenterY - 2, wr, 0.2, Math.PI - 0.2);
    }
    ctx.moveTo(0, abdoCenterY - 14);
    ctx.lineTo(0, abdoCenterY + 14);
    ctx.moveTo(-9, abdoCenterY - 8);
    ctx.lineTo(9, abdoCenterY + 4);
    ctx.moveTo(9, abdoCenterY - 8);
    ctx.lineTo(-9, abdoCenterY + 4);
    ctx.stroke();

    ctx.fillStyle = p.abdoMarkingGlow;
    ctx.beginPath();
    ctx.arc(0, abdoCenterY - 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (isCrystal) {
    // Faceted Gemstone Veins
    ctx.strokeStyle = p.abdoMarking;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, abdoCenterY - 12);
    ctx.lineTo(-7, abdoCenterY);
    ctx.lineTo(0, abdoCenterY + 12);
    ctx.lineTo(7, abdoCenterY);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, abdoCenterY - 12);
    ctx.lineTo(0, abdoCenterY + 12);
    ctx.moveTo(-7, abdoCenterY);
    ctx.lineTo(7, abdoCenterY);
    ctx.stroke();
  } else if (isBroodmother) {
    // Cluster of pulsating egg-sac nodules on abdomen
    ctx.shadowBlur = allowBlur ? 4 : 0;
    const eggNodules = [
      { x: -5, y: abdoCenterY - 4, r: 3.5 },
      { x:  5, y: abdoCenterY - 3, r: 3.2 },
      { x:  0, y: abdoCenterY + 4, r: 4.2 },
      { x: -6, y: abdoCenterY + 6, r: 2.8 },
      { x:  6, y: abdoCenterY + 7, r: 3.0 }
    ];
    for (const egg of eggNodules) {
      const ep = Math.sin(nowMs * 0.006 + egg.x) * 0.4;
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(egg.x, egg.y, egg.r + ep, 0, Math.PI * 2);
      ctx.fill();
      // Glowing spiderling embryo inside
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(egg.x, egg.y, (egg.r + ep) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (isStalker) {
    // VOID SHADOW STALKER: Embedded Cosmic Singularity Core & Runic Astral Chevron Sigils
    const singularityR = 6.2;

    // 1. Concentric Relativistic Photon Accretion Ring
    const photonGrad = safeCreateRadialGradient(ctx, 0, abdoCenterY, singularityR * 0.4, 0, abdoCenterY, singularityR * 1.8);
    if (photonGrad) {
      photonGrad.addColorStop(0, "rgba(0, 240, 255, 0.95)");
      photonGrad.addColorStop(0.35, "rgba(217, 70, 239, 0.75)");
      photonGrad.addColorStop(0.75, "rgba(76, 29, 149, 0.3)");
      photonGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = photonGrad;
      ctx.beginPath();
      ctx.arc(0, abdoCenterY, singularityR * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Swirling Accretion Spirals & Orbiting Stardust
    ctx.save();
    ctx.translate(0, abdoCenterY);
    const spiralRot = nowMs * 0.003 + seed;
    ctx.rotate(spiralRot);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let st = 0; st <= 14; st++) {
      const prog = st / 14;
      const sr = singularityR * 0.35 + prog * singularityR * 1.1;
      const stheta = prog * Math.PI * 1.2;
      const sx = Math.cos(stheta) * sr;
      const sy = Math.sin(stheta) * sr * 0.75;
      if (st === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Orbiting Cosmic Stardust Motes
    for (let m = 0; m < 3; m++) {
      const ma = (m / 3) * Math.PI * 2 + nowMs * 0.0045;
      const md = singularityR * 1.1 + Math.sin(nowMs * 0.005 + m) * 1.2;
      const mx = Math.cos(ma) * md;
      const my = Math.sin(ma) * md * 0.7;
      ctx.fillStyle = (m === 0) ? "#ffffff" : "#00f0ff";
      ctx.beginPath();
      ctx.arc(mx, my, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Pitch-Black Event Horizon Void Core
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(0, abdoCenterY, singularityR * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Doppler Beaming Rim Arc
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, abdoCenterY, singularityR * 0.72, -Math.PI * 0.7, Math.PI * 0.1);
    ctx.stroke();

    // 4. Glowing Runic Astral Chevron Sigils (Above and below Singularity)
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = allowBlur ? 8 : 0;

    // Upper chevron
    ctx.beginPath();
    ctx.moveTo(0, abdoCenterY - 10.5);
    ctx.lineTo(-6, abdoCenterY - 6.5);
    ctx.lineTo(-4, abdoCenterY - 5.5);
    ctx.lineTo(0, abdoCenterY - 8.5);
    ctx.lineTo(4, abdoCenterY - 5.5);
    ctx.lineTo(6, abdoCenterY - 6.5);
    ctx.closePath();
    ctx.fill();

    // Lower chevron
    ctx.fillStyle = "#e879f9";
    ctx.shadowColor = "#e879f9";
    ctx.beginPath();
    ctx.moveTo(0, abdoCenterY + 9);
    ctx.lineTo(-6, abdoCenterY + 12);
    ctx.lineTo(-4, abdoCenterY + 13);
    ctx.lineTo(0, abdoCenterY + 10.5);
    ctx.lineTo(4, abdoCenterY + 13);
    ctx.lineTo(6, abdoCenterY + 12);
    ctx.closePath();
    ctx.fill();
  } else {
    // Deep Subterranean Arachnid Fissure Chevrons (Classic Cave Predator)
    ctx.beginPath();
    // Chevron 1
    ctx.moveTo(0, abdoCenterY - 8);
    ctx.lineTo(-5, abdoCenterY - 4);
    ctx.lineTo(-3, abdoCenterY - 3);
    ctx.lineTo(0, abdoCenterY - 6);
    ctx.lineTo(3, abdoCenterY - 3);
    ctx.lineTo(5, abdoCenterY - 4);
    ctx.closePath();
    ctx.fill();

    // Chevron 2
    ctx.beginPath();
    ctx.moveTo(0, abdoCenterY - 2);
    ctx.lineTo(-6, abdoCenterY + 2);
    ctx.lineTo(-4, abdoCenterY + 3);
    ctx.lineTo(0, abdoCenterY);
    ctx.lineTo(4, abdoCenterY + 3);
    ctx.lineTo(6, abdoCenterY + 2);
    ctx.closePath();
    ctx.fill();

    // Chevron 3 (smaller)
    ctx.beginPath();
    ctx.moveTo(0, abdoCenterY + 4);
    ctx.lineTo(-4, abdoCenterY + 7);
    ctx.lineTo(-2, abdoCenterY + 8);
    ctx.lineTo(0, abdoCenterY + 6);
    ctx.lineTo(2, abdoCenterY + 8);
    ctx.lineTo(4, abdoCenterY + 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Spinnerets at posterior apex (Silk Glands)
  ctx.fillStyle = p.carapaceGrad2;
  ctx.beginPath();
  ctx.ellipse(-2.5, abdoCenterY + abdoRadiusY - 1, 1.8, 3, 0.2, 0, Math.PI * 2);
  ctx.ellipse( 2.5, abdoCenterY + abdoRadiusY - 1, 1.8, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Ethereal Abyssal Shadow Tendrils or Drifting Silk Filament Wisps
  if (isStalker) {
    // Ethereal Abyssal Shadow Tendrils trailing smoothly behind the Stalker
    const tendrilCount = 3;
    for (let td = 0; td < tendrilCount; td++) {
      const tSide = (td === 0 ? 0 : td === 1 ? -1 : 1);
      const tWave = Math.sin(nowMs * 0.007 + td * 1.8 + seed) * (4 + (isMoving ? 3 : 0));
      const tWave2 = Math.cos(nowMs * 0.005 + td * 1.5) * 3;
      const startX = tSide * 2.5;
      const startY = abdoCenterY + abdoRadiusY;

      ctx.save();
      const tGrad = ctx.createLinearGradient(startX, startY, startX + tWave2, startY + 22);
      tGrad.addColorStop(0, "rgba(0, 240, 255, 0.75)");
      tGrad.addColorStop(0.35, "rgba(168, 85, 247, 0.5)");
      tGrad.addColorStop(0.75, "rgba(30, 8, 54, 0.3)");
      tGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.strokeStyle = tGrad;
      ctx.lineWidth = 1.8 - td * 0.3;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(startX + tWave, startY + 10, startX + tWave2 + (tSide * 4), startY + 22);
      ctx.stroke();
      ctx.restore();
    }
  } else if (isWeaver) {
    if (!lowDetail) {
      // Luminous silk strands drifting from the spinnerets (Tecela da Seda)
      for (const s of [-1, 1]) {
      const sWave = Math.sin(nowMs * 0.008 + s * 1.5 + seed) * 5;
      const sWave2 = Math.cos(nowMs * 0.006 + s * 2.0) * 4;
      const sx = s * 2.5;
      const sy = abdoCenterY + abdoRadiusY;

      ctx.save();
      const sGrad = ctx.createLinearGradient(sx, sy, sx + sWave2, sy + 22);
      sGrad.addColorStop(0, "rgba(248, 250, 252, 0.85)");
      sGrad.addColorStop(0.4, "rgba(192, 132, 252, 0.65)");
      sGrad.addColorStop(1, "rgba(168, 85, 247, 0)");
      ctx.strokeStyle = sGrad;
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + sWave, sy + 11, sx + sWave2 + s * 5, sy + 22);
      ctx.stroke();
      ctx.restore();
    }
    }
  } else if (isMoving || isAttacking) {
    if (!lowDetail) {
      ctx.strokeStyle = "rgba(241, 245, 249, 0.55)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      const silkWave = Math.sin(nowMs * 0.01 + seed) * 4;
      ctx.moveTo(0, abdoCenterY + abdoRadiusY + 1);
      ctx.quadraticCurveTo(silkWave, abdoCenterY + abdoRadiusY + 9, silkWave * 1.5, abdoCenterY + abdoRadiusY + 18);
      ctx.stroke();
    }
  }

  ctx.restore();

  // -------------------------------------------------------------
  // 4. CEPHALOTHORAX (PROSOMA) - Armored Lineless Carapace
  // Shield-shaped carapace with fovea depression and eye turret
  // -------------------------------------------------------------
  ctx.save();
  const proGrad = safeCreateRadialGradient(ctx, 0, -6, 2, 0, -4, 13);
  if (proGrad) {
    proGrad.addColorStop(0, p.carapaceGrad0);
    proGrad.addColorStop(0.5, p.carapaceGrad1);
    proGrad.addColorStop(1, p.carapaceGrad2);
    ctx.fillStyle = proGrad;
  } else {
    ctx.fillStyle = p.carapaceGrad1;
  }

  // Draw sculpted arachnid carapace (narrowing at ocular turret, broad at center)
  ctx.beginPath();
  ctx.moveTo(0, -14); // Front ocular rostrum
  ctx.bezierCurveTo(-8, -14, -11, -8, -11, -3);
  ctx.bezierCurveTo(-11, 2, -9, 5, 0, 6); // Posterior margin
  ctx.bezierCurveTo(9, 5, 11, 2, 11, -3);
  ctx.bezierCurveTo(11, -8, 8, -14, 0, -14);
  ctx.closePath();
  ctx.fill();

  // Carapace Fovea & Radiating Furrows (Anatomical chitin depressions)
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, -2, 2.5, 1.4, 0, 0, Math.PI * 2); // Central fovea pit
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 1.0;
  // Radial furrows towards leg bases
  ctx.beginPath();
  ctx.moveTo(-1.5, -2); ctx.lineTo(-8, -5);
  ctx.moveTo(-1.5, -2); ctx.lineTo(-9, -1);
  ctx.moveTo(-1.5, -2); ctx.lineTo(-8, 3);
  ctx.moveTo(1.5, -2);  ctx.lineTo(8, -5);
  ctx.moveTo(1.5, -2);  ctx.lineTo(9, -1);
  ctx.moveTo(1.5, -2);  ctx.lineTo(8, 3);
  ctx.stroke();

  // Dorsal Carapace Specular Edge Gleam
  ctx.strokeStyle = p.carapaceSpecular;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, -8, 8.5, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();

  if (isStalker) {
    // Glowing Runic Void Constellation Veins on Prosoma
    ctx.strokeStyle = "rgba(0, 240, 255, 0.75)";
    ctx.shadowColor = "rgba(0, 240, 255, 0.9)";
    ctx.shadowBlur = allowBlur ? 6 : 0;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(-5, -6); ctx.lineTo(-8, 0);
    ctx.moveTo(0, -12); ctx.lineTo(5, -6); ctx.lineTo(8, 0);
    ctx.moveTo(0, -8); ctx.lineTo(0, -3);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    const cNodes = [{ x: -5, y: -6 }, { x: -8, y: 0 }, { x: 5, y: -6 }, { x: 8, y: 0 }, { x: 0, y: -3 }];
    for (const cn of cNodes) {
      ctx.beginPath();
      ctx.arc(cn.x, cn.y, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // -------------------------------------------------------------
  // 5. ARTICULATED PEDIPALPS (Front Feeler Limbs)
  // -------------------------------------------------------------
  ctx.save();
  for (const palpSide of [-1, 1]) {
    const pTwitch = (palpSide === -1 ? palpTwitch : -palpTwitch) + (isAttacking ? -3 : 0);
    const prx = palpSide * 4.5;
    const pry = -12;
    const pkx = palpSide * 9;
    const pky = -18 + pTwitch * 0.5;
    const ptx = palpSide * 7;
    const pty = -23 + pTwitch;

    ctx.strokeStyle = p.legFemurGrad0;
    ctx.lineWidth = 2.0;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prx, pry);
    ctx.lineTo(pkx, pky);
    ctx.lineTo(ptx, pty);
    ctx.stroke();

    // Palp sensory bulb / claw
    ctx.fillStyle = p.legClaw;
    ctx.beginPath();
    ctx.arc(ptx, pty, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // -------------------------------------------------------------
  // 6. CHELICERAE & DRIPPING VENOM FANGS
  // Positioned anteriorly at rostrum
  // -------------------------------------------------------------
  ctx.save();
  const cSpread = fangSpread;

  // Left & Right Chelicerae base
  for (const cSide of [-1, 1]) {
    const cx = cSide * (3.8 + cSpread * 0.4);
    const cy = -13;

    // Heavy chitin chelicera block
    const chelGrad = ctx.createLinearGradient(cx, cy, cx + cSide * 2, cy - 6);
    chelGrad.addColorStop(0, p.chelicerae0);
    chelGrad.addColorStop(1, p.chelicerae1);
    ctx.fillStyle = chelGrad;

    ctx.beginPath();
    ctx.moveTo(cx - cSide * 2.2, cy);
    ctx.lineTo(cx + cSide * 2.8, cy);
    ctx.lineTo(cx + cSide * 1.5, cy - 7);
    ctx.lineTo(cx - cSide * 1.5, cy - 7);
    ctx.closePath();
    ctx.fill();

    // Curved Piercing Venom Fang
    ctx.fillStyle = p.fangColor;
    ctx.beginPath();
    ctx.moveTo(cx + cSide * 1.2, cy - 7);
    // Curve inward towards center
    ctx.quadraticCurveTo(cx + cSide * 3.5 + (cSide * cSpread), cy - 13, cx - cSide * 1.2, cy - 15);
    ctx.quadraticCurveTo(cx + cSide * 0.5, cy - 11, cx - cSide * 0.8, cy - 7);
    ctx.closePath();
    ctx.fill();

    // Fang Sharp Needle Specular Glint
    ctx.strokeStyle = p.fangGlint;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx + cSide * 1.8, cy - 8);
    ctx.quadraticCurveTo(cx + cSide * 2.8, cy - 12, cx - cSide * 1.2, cy - 15);
    ctx.stroke();

    // Electric Cyan Core Needle inside obsidian fang for Void Stalker
    if (isStalker) {
      ctx.strokeStyle = "#00f0ff";
      ctx.shadowColor = "rgba(0, 240, 255, 0.9)";
      ctx.shadowBlur = allowBlur ? 5 : 0;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(cx + cSide * 1.5, cy - 8);
      ctx.quadraticCurveTo(cx + cSide * 2.2, cy - 12, cx - cSide * 1.2, cy - 15);
      ctx.stroke();
    }

    // Dripping Acid / Venom Droplet
    const dripCycle = (nowMs * 0.005 + seed * 2 + (cSide === 1 ? 2 : 0)) % 1;
    const dripY = -15 - dripCycle * 5 - venomDripDrop;
    const dripAlpha = Math.max(0, 1 - dripCycle);

    ctx.fillStyle = p.venomColor;
    ctx.shadowColor = p.venomGlow;
    ctx.shadowBlur = allowBlur ? 4 : 0;
    ctx.beginPath();
    ctx.arc(cx - cSide * 1.2, -15, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Falling droplet
    if (dripCycle > 0.3) {
      ctx.globalAlpha = dripAlpha;
      ctx.beginPath();
      ctx.arc(cx - cSide * 1.2, dripY, 1.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }
  ctx.restore();

  // -------------------------------------------------------------
  // 7. OCULAR TURRET & 8 GLOWING ARACHNID OCELLI
  // Authentic Arachnid Arrangement:
  // Anterior Median Eyes (AME) - large central hunters
  // Anterior Lateral Eyes (ALE) - forward-side sensors
  // Posterior Median Eyes (PME) - dorsal crown
  // Posterior Lateral Eyes (PLE) - wide angle panoramic
  // -------------------------------------------------------------
  ctx.save();
  const eyeTurretY = -10.5;

  // Dark ocular mound
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.beginPath();
  ctx.ellipse(0, eyeTurretY, 6.2, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const eyeList = [
    // AME (Anterior Median: 2 large central eyes)
    { x: -1.8, y: eyeTurretY - 1.8, r: 1.8, glow: 5 },
    { x:  1.8, y: eyeTurretY - 1.8, r: 1.8, glow: 5 },

    // ALE (Anterior Lateral: 2 side eyes)
    { x: -4.3, y: eyeTurretY - 1.1, r: 1.3, glow: 3 },
    { x:  4.3, y: eyeTurretY - 1.1, r: 1.3, glow: 3 },

    // PME (Posterior Median: 2 upper eyes)
    { x: -1.6, y: eyeTurretY + 1.2, r: 1.2, glow: 3 },
    { x:  1.6, y: eyeTurretY + 1.2, r: 1.2, glow: 3 },

    // PLE (Posterior Lateral: 2 rear outer eyes)
    { x: -4.1, y: eyeTurretY + 1.4, r: 1.1, glow: 3 },
    { x:  4.1, y: eyeTurretY + 1.4, r: 1.1, glow: 3 },
  ];

  const eyeGlowPulse = Math.sin(nowMs * 0.006 + seed) * 0.2 + 0.8;
  const attackEyeBoost = isAttacking ? (isStalker ? 2.4 : 1.6) : 1.0;

  for (let eIdx = 0; eIdx < eyeList.length; eIdx++) {
    const eye = eyeList[eIdx];
    // Outer Eerie Bioluminescent Halo
    ctx.shadowColor = p.eyeGlow;
    ctx.shadowBlur = allowBlur ? (eye.glow * eyeGlowPulse * attackEyeBoost) : 0;
    ctx.fillStyle = p.eyeCore;

    ctx.beginPath();
    ctx.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
    ctx.fill();

    // For isStalker, draw vertical predatory slit pupils inside central hunter eyes (AME)
    if (isStalker && (eIdx === 0 || eIdx === 1)) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, eye.r * 0.3, eye.r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // High Specular Reflex Pinpoint (Menacing Predatory Gleam)
    ctx.shadowBlur = 0;
    ctx.fillStyle = p.eyeSpecular;
    ctx.beginPath();
    ctx.arc(eye.x - eye.r * 0.25, eye.y - eye.r * 0.25, eye.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // -------------------------------------------------------------
  // 8. FOREGROUND LEGS (Front Pairs L1, R1, L2, R2)
  // Drawn after Prosoma to layer cleanly in front
  // -------------------------------------------------------------
  for (let i = 0; i < 2; i++) {
    drawArticulatedLeg(legConfigs[i]);
  }

  // -------------------------------------------------------------
  // 9. BOSS CROWN / TROPHY HORN EMBLEM (For Boss Tier)
  // -------------------------------------------------------------
  if (isBoss) {
    ctx.save();
    ctx.translate(0, -18);
    const crownPulse = Math.sin(nowMs * 0.005) * 1.5;

    // Glowing Subterranean Brood Crown Spikes
    ctx.fillStyle = isCrystal ? "#f0abfc" : "#f59e0b";
    ctx.shadowColor = isCrystal ? "#c084fc" : "#fbbf24";
    ctx.shadowBlur = allowBlur ? 8 : 0;

    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(-11, -5 + crownPulse);
    ctx.lineTo(-5, -1);
    ctx.lineTo(0, -9 + crownPulse * 1.2);
    ctx.lineTo(5, -1);
    ctx.lineTo(11, -5 + crownPulse);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();

    // Central Radiant Gem Nucleus
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

// --- Family: Slime ---
// slimes.js - Procedural Organic Slime Entity Renderer with Volumetric Gradients


// Classic DVD Screensaver color palette: shifts to a new vibrant hue on each wall ricochet
const DVD_SCREENSAVER_COLORS = [
  "#38bdf8", // Electric Cyan
  "#f43f5e", // Crimson Rose
  "#a855f7", // Neon Purple
  "#22c55e", // Bright Emerald
  "#eab308", // Golden Topaz
  "#ec4899", // Hot Magenta
  "#06b6d4", // Deep Cyan
  "#f97316"  // Radiant Orange
];

const _dvdEyeMap = new Map();
const _slimePuddleMap = new Map();
const _slimeRippleMap = new Map();

// --- Gradient caching ---
// A slime used to build ~23 gradients (and parse ~70 colour strings) every frame. Almost all of
// them depend only on the palette and the slime size, and a canvas gradient is interpreted in the
// transform that is current when it is filled, so a cached gradient draws exactly like a fresh one.
// Gradients whose size changes each frame are built at unit size and drawn under a scale().
// Caches are per canvas context and are rebuilt when the "low" graphics preset is toggled
// (tileDrawing.js swaps gradients for cheap proxies in that mode).

function isLowGraphics() {
  return typeof window !== "undefined" && !!window.gameConfig && window.gameConfig.graphicsQuality === "low";
}

const _gradientCaches = new WeakMap(); // ctx -> { low, byPalette: Map(pal -> gradient set) }

function getContextGradientCache(ctx) {
  const low = isLowGraphics();
  let cache = _gradientCaches.get(ctx);
  if (!cache || cache.low !== low) {
    cache = { low, byPalette: new Map(), bubbles: new Map() };
    _gradientCaches.set(ctx, cache);
  }
  return cache;
}

function radial(ctx, x0, y0, r0, x1, y1, r1, stops) {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}

function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
  return g;
}

function slimeEyeRadius(radius) {
  return Math.max(2.8, radius * 0.165);
}

function buildSlimeGradients(ctx, pal) {
  const r = pal.radius;
  const eyeR = slimeEyeRadius(r);
  const coreRadius = r * 0.46;
  const specX = -r * 0.36;
  const specY = -r * 0.40;
  const set = {
    // Floor glow, unit radius: drawn under translate(0, shadowY) + scale(R).
    glowUnit: radial(ctx, 0, 0, 0, 0, 0, 1, [0, pal.glowAura, 0.65, "rgba(0, 0, 0, 0)"]),
    back: radial(ctx, 0, r * 0.42, r * 0.08, 0, 0, r * 1.22,
      [0, pal.bodyBack[0], 0.55, pal.bodyBack[1], 0.92, pal.bodyBack[2], 1, "rgba(0, 0, 0, 0.5)"]),
    front: radial(ctx, -r * 0.35, -r * 0.42, r * 0.05, -r * 0.08, -r * 0.08, r * 1.15,
      [0, pal.bodyFront[0], 0.42, pal.bodyFront[1], 0.82, pal.bodyFront[2], 1, pal.bodyBottom]),
    caustic: radial(ctx, r * 0.15, r * 0.45, 0, r * 0.15, r * 0.45, r * 0.65,
      [0, pal.fresnel, 0.65, "rgba(255, 255, 255, 0.05)", 1, "rgba(0, 0, 0, 0)"]),
    core: radial(ctx, -coreRadius * 0.25, -coreRadius * 0.25, 0, 0, 0, coreRadius * 1.15,
      [0, pal.coreGrad[0], 0.32, pal.coreGrad[1], 0.72, pal.coreGrad[2], 1, "rgba(0, 0, 0, 0)"]),
    corona: radial(ctx, 0, 0, coreRadius * 0.5, 0, 0, coreRadius * 1.35,
      [0, pal.fresnel, 0.6, "rgba(255, 255, 255, 0.18)", 1, "rgba(0, 0, 0, 0)"]),
    spec: radial(ctx, specX, specY, 0, specX, specY, r * 0.36,
      [0, pal.highlight, 0.45, "rgba(255, 255, 255, 0.4)", 1, "rgba(255, 255, 255, 0)"]),
    glint: radial(ctx, -r * 0.22, -r * 0.56, 0, -r * 0.22, -r * 0.56, r * 0.12,
      [0, "#ffffff", 0.6, "rgba(255, 255, 255, 0.8)", 1, "rgba(255, 255, 255, 0)"]),
    bounce: radial(ctx, r * 0.35, r * 0.34, 0, r * 0.35, r * 0.34, r * 0.3,
      [0, "rgba(255, 255, 255, 0.28)", 0.65, "rgba(255, 255, 255, 0.08)", 1, "rgba(255, 255, 255, 0)"]),
    // Eye parts at the eye origin; cheeks are drawn under translate(cheekX, cheekY).
    cheek: radial(ctx, 0, 0, 0, 0, 0, eyeR * 1.1,
      [0, pal.cheekColor, 0.6, "rgba(244, 63, 94, 0.16)", 1, "rgba(244, 63, 94, 0)"]),
    wake: radial(ctx, 0, 0, eyeR * 0.65, 0, 0, eyeR * 1.15,
      [0, "rgba(255, 255, 255, 0)", 0.7, pal.fresnel, 1, "rgba(255, 255, 255, 0)"]),
    // Pupil, unit radius: drawn under translate(pupilX, pupilY) + scale(pupilRadius).
    pupilUnit: radial(ctx, 0, 0, 0, 0, 0, 1,
      [0, "#020617", 0.85, pal.pupilColor, 1, "rgba(15, 23, 42, 0.7)"]),
    sclera: new Array(DVD_SCREENSAVER_COLORS.length),
    closedLid: new Array(DVD_SCREENSAVER_COLORS.length),
    sockets: new Map(),
    crown: null,
    // Floating relics (section 8): crystal facets for hasCrystal palettes, clover leaf otherwise.
    crystalDeep: pal.hasCrystal ? linear(ctx, -6, -8, 6, 8, [0, "#042f2e", 0.7, "#0f766e", 1, "#14b8a6"]) : null,
    crystalLit: pal.hasCrystal ? linear(ctx, -6, -8, 6, 8, [0, "#ffffff", 0.35, "#5eead4", 1, "#0d9488"]) : null,
    clover: (!pal.hasCrown && !pal.hasCrystal)
      ? radial(ctx, 0, 0, 0, 0, 0, 3.5, [0, "rgba(255, 255, 255, 0.95)", 0.4, pal.fresnel, 1, pal.bodyFront[1]])
      : null
  };
  if (pal.hasCrown) {
    set.crown = {
      shadow: radial(ctx, 0, -r * 0.08, 0, 0, -r * 0.08, 14, [0, "rgba(0, 0, 0, 0.38)", 1, "rgba(0, 0, 0, 0)"]),
      body: linear(ctx, 0, -r * 0.44, 0, -r * 0.1, [0, "#fef08a", 0.35, "#facc15", 0.7, "#ca8a04", 1, "#713f12"]),
      rim: linear(ctx, -13, 0, 13, 0, [0, "rgba(255, 255, 255, 0.3)", 0.5, "rgba(255, 255, 255, 0.95)", 1, "rgba(255, 255, 255, 0.3)"]),
      gems: SLIME_CROWN_GEMS.map((gem) => {
        const gy = gem.yf * r;
        return { x: gem.x, y: gy, r: gem.r, grad: radial(ctx, gem.x - 0.6, gy - 0.6, 0.2, gem.x, gy, gem.r, [0, "#ffffff", 0.4, gem.c0, 1, gem.c1]) };
      })
    };
  }
  return set;
}

const SLIME_CROWN_GEMS = [
  { x: -14, yf: -0.34, r: 2.5, c0: "#fca5a5", c1: "#dc2626" },
  { x: 0, yf: -0.44, r: 3.2, c0: "#93c5fd", c1: "#2563eb" },
  { x: 14, yf: -0.34, r: 2.5, c0: "#86efac", c1: "#16a34a" }
];

function getSlimeGradients(ctx, pal) {
  const cache = getContextGradientCache(ctx);
  let set = cache.byPalette.get(pal);
  if (!set) {
    set = buildSlimeGradients(ctx, pal);
    cache.byPalette.set(pal, set);
  }
  return set;
}

function getScleraGradient(ctx, set, pal, colorIndex) {
  let g = set.sclera[colorIndex];
  if (!g) {
    const eyeR = slimeEyeRadius(pal.radius);
    g = radial(ctx, -eyeR * 0.3, -eyeR * 0.3, 0.2, 0, 0, eyeR,
      [0, "#ffffff", 0.65, DVD_SCREENSAVER_COLORS[colorIndex], 1, pal.fresnel]);
    set.sclera[colorIndex] = g;
  }
  return g;
}

function getClosedLidGradient(ctx, set, pal, colorIndex) {
  let g = set.closedLid[colorIndex];
  if (!g) {
    const eyeR = slimeEyeRadius(pal.radius);
    g = linear(ctx, -eyeR, 0, eyeR, 0,
      [0, "rgba(0, 0, 0, 0.2)", 0.5, DVD_SCREENSAVER_COLORS[colorIndex], 1, "rgba(0, 0, 0, 0.2)"]);
    set.closedLid[colorIndex] = g;
  }
  return g;
}

// The socket shadow's inner circle trails the pupil, so its gradient is cached per offset,
// rounded to 3.5% of the eye radius (about 0.1 px on screen).
function getSocketGradient(ctx, set, pal, lagX, lagY) {
  const eyeR = slimeEyeRadius(pal.radius);
  const step = eyeR * 0.035;
  const qx = Math.round(lagX / step);
  const qy = Math.round(lagY / step);
  const key = qx * 4096 + qy;
  let g = set.sockets.get(key);
  if (!g) {
    g = radial(ctx, qx * step, qy * step, eyeR * 0.35, 0, 0, eyeR * 1.35,
      [0, "rgba(0, 0, 0, 0.28)", 0.7, "rgba(0, 0, 0, 0.08)", 1, "rgba(0, 0, 0, 0)"]);
    set.sockets.set(key, g);
  }
  return g;
}

// Bubble highlight at unit radius, drawn under translate + scale(bubbleSize) with globalAlpha
// carrying the fade. Bubbles are 1.2-2.8 units, bucketed in 0.2 steps for the focal circle.
function getBubbleGradient(ctx, bubbleSize) {
  const cache = getContextGradientCache(ctx);
  const bucket = Math.max(1, Math.round(bubbleSize * 5));
  let g = cache.bubbles.get(bucket);
  if (!g) {
    g = radial(ctx, -0.35, -0.35, 0.2 / (bucket / 5), 0, 0, 1,
      [0, "rgba(255, 255, 255, 0.95)", 0.4, "rgba(255, 255, 255, 0.55)", 1, "rgba(255, 255, 255, 0)"]);
    cache.bubbles.set(bucket, g);
  }
  return g;
}

// Palettes are plain data; build each one once so gradient caches can key on the object.
const _paletteCache = new Map();
function getSlimePaletteCached(type, isSlowed) {
  const key = isSlowed ? type + "|slowed" : type;
  let pal = _paletteCache.get(key);
  if (!pal) {
    pal = getSlimePalette(type, isSlowed);
    _paletteCache.set(key, pal);
  }
  return pal;
}

// Reused membrane outline buffer (24 points, x/y interleaved).
const _membranePoints = new Float64Array(48);

// Smooth closed spline through the outline points (quadratic curves between midpoints),
// so the membrane has no polygon corners.
function traceSmoothFluidPathXY(ctx, pts, count) {
  ctx.beginPath();
  const lastX = pts[(count - 1) * 2];
  const lastY = pts[(count - 1) * 2 + 1];
  ctx.moveTo((lastX + pts[0]) / 2, (lastY + pts[1]) / 2);
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const px = pts[i * 2];
    const py = pts[i * 2 + 1];
    ctx.quadraticCurveTo(px, py, (px + pts[next * 2]) / 2, (py + pts[next * 2 + 1]) / 2);
  }
  ctx.closePath();
}

/**
 * Renders an organic translucent slime footprint puddle with sub-surface radial gradient
 * and glassy specular curved sheen.
 */
// A puddle only shrinks uniformly over its life (rx and ry by the same factor), so its gradients
// and outlines are built once at full size and drawn under scale(shrink).
function buildPuddleCache(ctx, p, low) {
  const rx = p.rx;
  const ry = p.ry;
  const rimPath = new Path2D();
  rimPath.ellipse(0, 0, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2);

  const n = 8;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const delta = p.shapeDeltas ? p.shapeDeltas[i] : 1;
    xs[i] = Math.cos(a) * rx * delta;
    ys[i] = Math.sin(a) * ry * delta;
  }
  const bodyPath = new Path2D();
  bodyPath.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    bodyPath.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[next]) / 2, (ys[i] + ys[next]) / 2);
  }
  bodyPath.closePath();

  const highlightPath = new Path2D();
  highlightPath.ellipse(-rx * 0.28, -ry * 0.28, rx * 0.32, ry * 0.20, -0.3, 0, Math.PI * 2);

  return {
    low,
    rimPath,
    bodyPath,
    highlightPath,
    rimGrad: radial(ctx, 0, 0, rx * 0.25, 0, 0, rx * 1.25, [0, p.glow, 0.55, p.glow, 1, "rgba(0, 0, 0, 0)"]),
    bodyGrad: radial(ctx, -rx * 0.2, -ry * 0.2, 0, 0, 0, rx, [0, p.colorFront, 0.68, p.colorDeep, 1, "rgba(0, 0, 0, 0.25)"]),
    highlightGrad: radial(ctx, -rx * 0.32, -ry * 0.32, 0, -rx * 0.32, -ry * 0.32, rx * 0.42,
      [0, p.specular || "#ffffff", 0.45, "rgba(255, 255, 255, 0.38)", 1, "rgba(255, 255, 255, 0)"])
  };
}

function drawFluidPuddle(ctx, p, now) {
  const age = now - p.createdAt;
  if (age >= p.duration) return;
  const progress = age / p.duration;
  const alpha = Math.pow(Math.max(0, 1 - progress), 1.35);
  const shrink = 1 - progress * 0.15;
  const low = isLowGraphics();
  if (!p._cache || p._cache.low !== low) p._cache = buildPuddleCache(ctx, p, low);
  const c = p._cache;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, 0.38);
  ctx.rotate(p.angle);
  ctx.scale(shrink, shrink);

  // Soft ambient ground glow halo
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = c.rimGrad;
  ctx.fill(c.rimPath);

  // Organic fluid blob membrane (8-point smoothed spline)
  ctx.globalAlpha = alpha * 0.82;
  ctx.fillStyle = c.bodyGrad;
  ctx.fill(c.bodyPath);

  // Glassy specular surface highlight
  ctx.globalAlpha = alpha * 0.72;
  ctx.fillStyle = c.highlightGrad;
  ctx.fill(c.highlightPath);

  ctx.restore();
}

/**
 * Renders an expanding lineless radial ground impact shockwave ring on slime landing.
 * Features volumetric multi-stop wave crest, secondary trailing cavitation ring,
 * and radial viscous splashing droplets.
 */
function drawFluidRipple(ctx, r, now) {
  const age = now - r.createdAt;
  if (age >= r.duration) return;
  const progress = age / r.duration;
  const alpha = Math.pow(Math.max(0, 1 - progress), 1.25) * 0.78;
  const curRadius = r.maxRadius * (0.2 + progress * 0.8);

  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.scale(1, 0.34);
  ctx.globalAlpha = alpha;

  // Ring and trail scale with curRadius, so they are cached at unit radius (see buildPuddleCache).
  const low = isLowGraphics();
  if (!r._cache || r._cache.low !== low) {
    const ringPath = new Path2D();
    ringPath.arc(0, 0, 1.05, 0, Math.PI * 2);
    ringPath.arc(0, 0, 0.58, 0, Math.PI * 2, true);
    const trailPath = new Path2D();
    trailPath.arc(0, 0, 0.48, 0, Math.PI * 2);
    r._cache = {
      low,
      ringPath,
      trailPath,
      ringGrad: radial(ctx, 0, 0, 0.58, 0, 0, 1.05,
        [0, "rgba(0, 0, 0, 0)", 0.42, r.color, 0.72, r.fresnel || "rgba(255, 255, 255, 0.65)", 0.92, r.color, 1, "rgba(0, 0, 0, 0)"]),
      trailGrad: radial(ctx, 0, 0, 0.24, 0, 0, 0.48, [0, "rgba(0, 0, 0, 0)", 0.7, r.color, 1, "rgba(0, 0, 0, 0)"])
    };
  }

  // 1. Primary Volumetric Viscous Wavefront Ring
  ctx.save();
  ctx.scale(curRadius, curRadius);
  ctx.fillStyle = r._cache.ringGrad;
  ctx.fill(r._cache.ringPath);

  // 2. Trailing Cavitation / Secondary Harmonic Ring
  if (progress > 0.15) {
    ctx.globalAlpha = (1 - progress) * 0.45;
    ctx.fillStyle = r._cache.trailGrad;
    ctx.fill(r._cache.trailPath);
  }
  ctx.restore();

  // 3. Radial Viscous Splatter Droplets along Wavefront
  const dropProgress = Math.pow(progress, 0.75);
  const numDroplets = 8;
  for (let i = 0; i < numDroplets; i++) {
    const angle = (i / numDroplets) * Math.PI * 2 + (i % 2 === 0 ? 0.12 : -0.12);
    const dropDist = curRadius * (0.96 + dropProgress * 0.18);
    const dx = Math.cos(angle) * dropDist;
    const dy = Math.sin(angle) * dropDist;
    const dropRadius = Math.max(0.6, (1 - progress) * (i % 2 === 0 ? 2.2 : 1.4));

    ctx.fillStyle = r.fresnel || "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(dx, dy, dropRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws viscous elastic slime tendrils connecting the ground to the rising slime base
 * during the initial spring-off phase of the hop.
 */
function drawSlimeTendrils(ctx, radius, currentHopY, shadowY, pal) {
  if (currentHopY >= -0.8 || currentHopY < -radius * 0.45) return;
  const progress = -currentHopY / (radius * 0.45);
  const alpha = Math.max(0, 1 - progress) * 0.75;
  if (alpha <= 0.05) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const offsets = [-radius * 0.28, 0, radius * 0.28];
  for (let i = 0; i < offsets.length; i++) {
    const ox = offsets[i];
    const groundX = ox * 1.12;
    const groundY = shadowY * 0.34;
    const bodyX = ox * 0.88;
    const bodyY = groundY + currentHopY;
    const midX = (groundX + bodyX) / 2 + (i === 0 ? -1 : i === 2 ? 1 : 0);
    const midY = (groundY + bodyY) / 2;
    const thick = Math.max(0.6, (1 - progress) * 2.2);

    const tGrd = ctx.createLinearGradient(groundX, groundY, bodyX, bodyY);
    tGrd.addColorStop(0, pal.glowAura);
    tGrd.addColorStop(0.45, pal.bodyFront[1]);
    tGrd.addColorStop(1, pal.bodyFront[0]);

    ctx.fillStyle = tGrd;
    ctx.beginPath();
    ctx.moveTo(groundX - thick * 1.4, groundY);
    ctx.quadraticCurveTo(midX - thick * 0.5, midY, bodyX - thick, bodyY);
    ctx.lineTo(bodyX + thick, bodyY);
    ctx.quadraticCurveTo(midX + thick * 0.5, midY, groundX + thick * 1.4, groundY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Returns color palettes tailored for each slime archetype and state.
 * Emphasizes rich multi-stop volumetric gradients with zero harsh static lines.
 */
function getSlimePalette(type, isSlowed) {
  if (isSlowed) {
    return {
      name: "frost",
      radius: 17,
      baseHue: 200,
      glowAura: "rgba(56, 189, 248, 0.42)",
      bodyBack: ["#082f49", "#0369a1", "rgba(2, 132, 199, 0.85)"],
      bodyFront: ["rgba(224, 242, 254, 0.96)", "rgba(56, 189, 248, 0.86)", "rgba(2, 132, 199, 0.45)"],
      bodyBottom: "rgba(8, 47, 73, 0.72)",
      coreGrad: ["#ffffff", "#e0f2fe", "#38bdf8", "#0284c7"],
      fresnel: "rgba(186, 230, 253, 0.75)",
      highlight: "rgba(255, 255, 255, 0.92)",
      eyeGlow: "#38bdf8",
      pupilColor: "#082f49",
      cheekColor: "rgba(14, 165, 233, 0.4)",
      particleColors: ["#bae6fd", "#7dd3fc", "#38bdf8"]
    };
  }

  if (type === "toxic_slime" || type.includes("toxic") || type.includes("acid")) {
    return {
      name: "toxic",
      radius: 18,
      baseHue: 85,
      glowAura: "rgba(163, 230, 53, 0.48)",
      bodyBack: ["#14532d", "#3f6212", "rgba(77, 124, 15, 0.88)"],
      bodyFront: ["rgba(236, 252, 203, 0.97)", "rgba(163, 230, 53, 0.88)", "rgba(101, 163, 13, 0.48)"],
      bodyBottom: "rgba(20, 83, 45, 0.78)",
      coreGrad: ["#ffffff", "#bef264", "#84cc16", "#4d7c0f"],
      fresnel: "rgba(236, 252, 203, 0.78)",
      highlight: "rgba(255, 255, 255, 0.94)",
      eyeGlow: "#facc15",
      pupilColor: "#14532d",
      cheekColor: "rgba(132, 204, 22, 0.45)",
      particleColors: ["#d9f99d", "#a3e635", "#84cc16"]
    };
  }

  if (type === "magma_slime" || type.includes("magma") || type.includes("lava") || type.includes("fire")) {
    return {
      name: "magma",
      radius: 19,
      baseHue: 25,
      glowAura: "rgba(249, 115, 22, 0.52)",
      bodyBack: ["#450a0a", "#7c2d12", "rgba(154, 52, 18, 0.92)"],
      bodyFront: ["rgba(254, 240, 138, 0.97)", "rgba(249, 115, 22, 0.9)", "rgba(194, 65, 12, 0.48)"],
      bodyBottom: "rgba(69, 10, 10, 0.82)",
      coreGrad: ["#ffffff", "#fef08a", "#f97316", "#b91c1c"],
      fresnel: "rgba(254, 240, 138, 0.82)",
      highlight: "rgba(255, 255, 255, 0.96)",
      eyeGlow: "#fef08a",
      pupilColor: "#450a0a",
      cheekColor: "rgba(239, 68, 68, 0.5)",
      particleColors: ["#fef08a", "#fb923c", "#ef4444"]
    };
  }

  if (type === "frost_slime" || type.includes("frost") || type.includes("ice")) {
    return {
      name: "frost",
      radius: 17,
      baseHue: 195,
      glowAura: "rgba(56, 189, 248, 0.46)",
      bodyBack: ["#082f49", "#0369a1", "rgba(2, 132, 199, 0.88)"],
      bodyFront: ["rgba(224, 242, 254, 0.97)", "rgba(56, 189, 248, 0.88)", "rgba(2, 132, 199, 0.46)"],
      bodyBottom: "rgba(8, 47, 73, 0.78)",
      coreGrad: ["#ffffff", "#e0f2fe", "#38bdf8", "#0284c7"],
      fresnel: "rgba(186, 230, 253, 0.78)",
      highlight: "rgba(255, 255, 255, 0.94)",
      eyeGlow: "#e0f2fe",
      pupilColor: "#082f49",
      cheekColor: "rgba(14, 165, 233, 0.42)",
      particleColors: ["#e0f2fe", "#7dd3fc", "#0284c7"]
    };
  }

  if (type === "elite_slime" || type.includes("elite") || type.includes("gold") || type.includes("golden")) {
    return {
      name: "gold",
      radius: 22,
      baseHue: 45,
      glowAura: "rgba(250, 204, 21, 0.52)",
      bodyBack: ["#713f12", "#a16207", "rgba(202, 138, 4, 0.9)"],
      bodyFront: ["rgba(254, 249, 195, 0.98)", "rgba(250, 204, 21, 0.9)", "rgba(202, 138, 4, 0.48)"],
      bodyBottom: "rgba(113, 63, 18, 0.8)",
      coreGrad: ["#ffffff", "#fef9c3", "#eab308", "#854d0e"],
      fresnel: "rgba(254, 249, 195, 0.88)",
      highlight: "rgba(255, 255, 255, 0.97)",
      eyeGlow: "#ffffff",
      pupilColor: "#713f12",
      cheekColor: "rgba(245, 158, 11, 0.45)",
      particleColors: ["#fef9c3", "#fde047", "#eab308"],
      hasCrown: true
    };
  }

  if (type === "boss_slime") {
    return {
      name: "boss",
      radius: 46,
      baseHue: 210,
      glowAura: "rgba(56, 189, 248, 0.52)",
      bodyBack: ["#082f49", "#0369a1", "rgba(14, 165, 233, 0.92)"],
      bodyFront: ["rgba(224, 242, 254, 0.98)", "rgba(56, 189, 248, 0.92)", "rgba(2, 132, 199, 0.52)"],
      bodyBottom: "rgba(8, 47, 73, 0.82)",
      coreGrad: ["#ffffff", "#e0f2fe", "#0284c7", "#075985"],
      fresnel: "rgba(186, 230, 253, 0.88)",
      highlight: "rgba(255, 255, 255, 0.98)",
      eyeGlow: "#38bdf8",
      pupilColor: "#082f49",
      cheekColor: "rgba(14, 165, 233, 0.5)",
      particleColors: ["#bae6fd", "#38bdf8", "#0284c7"],
      hasCrown: true
    };
  }

  if (type === "slime_heavy") {
    return {
      name: "heavy",
      radius: 24,
      baseHue: 175,
      glowAura: "rgba(45, 212, 191, 0.48)",
      bodyBack: ["#134e4a", "#0f766e", "rgba(13, 148, 136, 0.9)"],
      bodyFront: ["rgba(204, 251, 241, 0.97)", "rgba(45, 212, 191, 0.9)", "rgba(13, 148, 136, 0.48)"],
      bodyBottom: "rgba(19, 78, 74, 0.8)",
      coreGrad: ["#ffffff", "#ccfbf1", "#14b8a6", "#115e59"],
      fresnel: "rgba(204, 251, 241, 0.78)",
      highlight: "rgba(255, 255, 255, 0.94)",
      eyeGlow: "#ccfbf1",
      pupilColor: "#134e4a",
      cheekColor: "rgba(20, 184, 166, 0.4)",
      particleColors: ["#99f6e4", "#2dd4bf", "#0d9488"],
      hasCrystal: true
    };
  }

  // Default: Organic Forest Green Slime
  return {
    name: "forest",
    radius: 17,
    baseHue: 145,
    glowAura: "rgba(74, 222, 128, 0.42)",
    bodyBack: ["#14532d", "#166534", "rgba(22, 163, 74, 0.88)"],
    bodyFront: ["rgba(220, 252, 231, 0.96)", "rgba(74, 222, 128, 0.88)", "rgba(22, 163, 74, 0.48)"],
    bodyBottom: "rgba(20, 83, 45, 0.78)",
    coreGrad: ["#ffffff", "#bbf7d0", "#22c55e", "#15803d"],
    fresnel: "rgba(187, 247, 208, 0.75)",
    highlight: "rgba(255, 255, 255, 0.92)",
    eyeGlow: "#bbf7d0",
    pupilColor: "#14532d",
    cheekColor: "rgba(34, 197, 94, 0.4)",
    particleColors: ["#bbf7d0", "#4ade80", "#16a34a"]
  };
}

export function drawSlimeEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(2, 2);
  ctx.translate(-x, -y);

  const type = ent.type || "slime";
  const isSlowed = !!ent.isSlowed;
  // Crowd level of detail (main.js CrowdLOD): skip ground puddles/ripples, leap tendrils, inner
  // caustic and corona, rising bubbles, eye wake rims and catchlights, and the two minor sheens.
  const lowDetail = typeof window !== "undefined" && !!(window.CrowdLOD && window.CrowdLOD.current);

  // Archetype palette configuration
  const pal = getSlimePaletteCached(type, isSlowed);
  const G = getSlimeGradients(ctx, pal);
  const radius = pal.radius;
  const shadowRx = radius;

  if (ent._seed === undefined) {
    ent._seed = computeFastSeed(ent.id);
  }
  const seed = ent._seed;
  const now = performance.now();

  // World coordinates velocity
  const worldX = (typeof ent.x === "number") ? ent.x : (ent._prevWorldX || 0);
  const worldY = (typeof ent.y === "number") ? ent.y : (ent._prevWorldY || 0);
  if (ent._prevWorldX === undefined) ent._prevWorldX = worldX;
  if (ent._prevWorldY === undefined) ent._prevWorldY = worldY;
  const deltaWorldX = worldX - ent._prevWorldX;
  const deltaWorldY = worldY - ent._prevWorldY;
  const vx = deltaWorldX * 0.4;
  const vy = deltaWorldY * 0.4;
  ent._prevWorldX = worldX;
  ent._prevWorldY = worldY;

  const hasRealVel = (vx * vx + vy * vy) > 0.008;
  const isMoving = !!(ent.moving || ent.isMoving || hasRealVel);

  let walkAngle = 0;
  if (hasRealVel) {
    walkAngle = Math.atan2(vy, vx);
  } else if (typeof ent.facingAngle === "number") {
    walkAngle = ent.facingAngle;
  }

  // Delta time for organic walk hop cycle
  const dtSec = Math.min(0.08, Math.max(0.001, (now - (ent._lastSlimeTime || now)) / 1000));
  ent._lastSlimeTime = now;

  // Walk hop frequency & progress
  const intensity = typeof ent.hopIntensity === "number" ? ent.hopIntensity : 1.0;
  const hopRate = isSlowed ? 2.5 : (type === "boss_slime" ? 3.3 : 5.4);
  if (ent._walkProgress === undefined) {
    ent._walkProgress = (seed % 100) * 0.1;
  }
  if (isMoving) {
    ent._walkProgress += dtSec * hopRate;
  }
  const walkPhase = ((ent._walkProgress % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // Smooth blending of walk weight (idle breathing vs hopping gait)
  if (ent._walkWeight === undefined) ent._walkWeight = isMoving ? 1 : 0;
  const targetWalkWeight = isMoving ? 1 : 0;
  ent._walkWeight += (targetWalkWeight - ent._walkWeight) * Math.min(1, dtSec * 9);
  const wWeight = ent._walkWeight;

  // 4-Phase Slime Hop Kinematics:
  // Phase 1: Crouch & compress (0 <= phase < 0.28 * PI)
  // Phase 2: Elastic spring leap & flight (0.28 * PI <= phase < 0.78 * PI)
  // Phase 3: Impact touchdown & splat squish (0.78 * PI <= phase < 1.15 * PI)
  // Phase 4: Elastic rebound oscillation (1.15 * PI <= phase < 2 * PI)
  let pCrouch = 0, pJump = 0, pSplat = 0, pRebound = 0;
  let hopY = 0, hopScaleX = 1, hopScaleY = 1, hopTilt = 0, driftX = 0;
  const maxHop = radius * (isSlowed ? 0.32 : (type === "boss_slime" ? 0.44 : 0.65)) * intensity;

  if (walkPhase < 0.28 * Math.PI) {
    pCrouch = Math.sin((walkPhase / (0.28 * Math.PI)) * Math.PI);
    hopScaleX = 1 + pCrouch * 0.30 * intensity;
    hopScaleY = 1 - pCrouch * 0.26 * intensity;
    hopY = pCrouch * 1.5;
  } else if (walkPhase < 0.78 * Math.PI) {
    const p = (walkPhase - 0.28 * Math.PI) / (0.50 * Math.PI);
    pJump = Math.sin(p * Math.PI);
    hopY = -pJump * maxHop;
    hopScaleX = 1 - pJump * 0.22 * intensity;
    hopScaleY = 1 + pJump * 0.36 * intensity;
    const facingSign = Math.cos(walkAngle) >= 0 ? 1 : -1;
    hopTilt = Math.sin(p * Math.PI) * 0.20 * facingSign * intensity;
    driftX = (p - 0.5) * (radius * 0.32) * facingSign * intensity;
  } else if (walkPhase < 1.15 * Math.PI) {
    const p = (walkPhase - 0.78 * Math.PI) / (0.37 * Math.PI);
    pSplat = Math.sin(p * Math.PI);
    hopY = 0;
    hopScaleX = 1 + pSplat * 0.42 * intensity;
    hopScaleY = 1 - pSplat * 0.30 * intensity;
  } else {
    const p = (walkPhase - 1.15 * Math.PI) / (0.85 * Math.PI);
    pRebound = Math.sin(p * Math.PI * 3) * Math.exp(-p * 3) * 0.16 * intensity;
    hopScaleX = 1 - pRebound;
    hopScaleY = 1 + pRebound;
    hopY = 0;
  }

  const currentHopY = hopY * wWeight;
  const currentTilt = hopTilt * wWeight;
  const currentDriftX = driftX * wWeight;

  // Attack & Hit states
  let isAttacking = !!ent.isAttacking;
  if (typeof GameState !== "undefined" && GameState && typeof GameState.combatAnimations !== "undefined") {
    for (let i = 0; i < GameState.combatAnimations.length; i++) {
      const anim = GameState.combatAnimations[i];
      if (anim.attackerId === ent.id && now - anim.createdAt < 450) {
        isAttacking = true;
        break;
      }
    }
  }

  const hpRatio = (ent.hp !== undefined && ent.maxHp) ? Math.max(0, ent.hp / ent.maxHp) : 1;
  const isHit = ent.lastHitTime && (now - ent.lastHitTime < 300);

  // Idle kinetic breathing & jiggle
  const timeScale = type === "boss_slime" ? 0.0025 : 0.0055;
  const jiggleAmp = isHit ? 0.35 : (isAttacking ? 0.28 : (type === "boss_slime" ? 0.08 : 0.12));
  const bounce = Math.sin(now * timeScale + seed) * jiggleAmp;
  const secondaryWobble = Math.cos(now * timeScale * 1.7 + seed * 0.5) * (jiggleAmp * 0.45);
  const hitWobble = isHit ? Math.sin(now * 0.06) * 0.16 : 0;

  // Blended composite scale
  const moveStretch = Math.min(0.24, Math.sqrt(vx * vx + vy * vy) * 0.05);
  const idleScaleX = (1 + bounce - moveStretch * 0.4 + hitWobble);
  const idleScaleY = (1 - bounce - secondaryWobble + moveStretch - hitWobble * 0.4);
  const scaleX = idleScaleX * (1 - wWeight) + (hopScaleX + hitWobble) * wWeight;
  const scaleY = idleScaleY * (1 - wWeight) + (hopScaleY - hitWobble * 0.4) * wWeight;
  const moveAngle = walkAngle;

  // Persistent slime puddle & ripple maps
  if (ent._slimeKeyType !== type || ent._slimeKeyId !== ent.id) {
    ent._slimeKeyType = type;
    ent._slimeKeyId = ent.id;
    ent._slimeKey = (ent.id || "preview_mob") + "_" + type;
  }
  const entKey = ent._slimeKey;
  let puddles = _slimePuddleMap.get(entKey);
  if (!puddles) { puddles = []; _slimePuddleMap.set(entKey, puddles); }
  let ripples = _slimeRippleMap.get(entKey);
  if (!ripples) { ripples = []; _slimeRippleMap.set(entKey, ripples); }

  // Landing & Liftoff Transition Events
  const prevPhase = ent._prevWalkPhase !== undefined ? ent._prevWalkPhase : walkPhase;
  ent._prevWalkPhase = walkPhase;
  const isLandingHit = isMoving && (prevPhase < 0.78 * Math.PI && walkPhase >= 0.78 * Math.PI);
  const isLiftoffHit = isMoving && (prevPhase < 0.28 * Math.PI && walkPhase >= 0.28 * Math.PI);

  if (isLandingHit) {
    if (ent.showRipples !== false) {
      ripples.push({
        x: 0,
        y: radius * 1.05,
        createdAt: now,
        duration: 440,
        maxRadius: radius * (type === "boss_slime" ? 2.3 : 1.68),
        color: pal.glowAura,
        fresnel: pal.fresnel
      });
    }

    if (ent.showPuddles !== false) {
      const deltas = [];
      for (let k = 0; k < 8; k++) deltas.push(0.82 + Math.random() * 0.36);
      puddles.push({
        x: (Math.random() - 0.5) * (radius * 0.2),
        y: radius * 1.05 + (Math.random() - 0.5) * 3,
        rx: radius * (0.44 + Math.random() * 0.22) * intensity,
        ry: radius * (0.22 + Math.random() * 0.12) * intensity,
        angle: walkAngle + (Math.random() - 0.5) * 0.4,
        createdAt: now,
        duration: 2500 + Math.random() * 800,
        colorFront: pal.bodyFront[1],
        colorDeep: pal.bodyBack[1],
        glow: pal.glowAura,
        specular: pal.highlight,
        shapeDeltas: deltas
      });
    }

    if (typeof spawnParticle === "function") {
      const pCount = type === "boss_slime" ? 8 : 5;
      for (let s = 0; s < pCount; s++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (22 + Math.random() * 32) * intensity;
        spawnParticle({
          x: worldX + (Math.random() - 0.5) * radius * 0.8,
          y: worldY + radius * 0.7,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd * 0.3 - 4 - Math.random() * 8,
          color: pal.particleColors,
          size: 1.8 + Math.random() * 2.2,
          maxLife: 0.42 + Math.random() * 0.22,
          gravity: 42,
          drag: 0.90,
          shrink: true,
          style: "circle"
        });
      }
    }
  }

  if (isLiftoffHit) {
    if (typeof spawnParticle === "function") {
      for (let u = 0; u < 3; u++) {
        spawnParticle({
          x: worldX + (Math.random() - 0.5) * radius * 0.6,
          y: worldY + radius * 0.5,
          vx: -Math.cos(walkAngle) * 16 + (Math.random() - 0.5) * 18,
          vy: -16 - Math.random() * 18,
          color: pal.particleColors,
          size: 2.0 + Math.random() * 2.0,
          maxLife: 0.48,
          gravity: 30,
          drag: 0.93,
          shrink: true,
          style: "circle"
        });
      }
    }
  }

  // Variant-specific continuous walk particles
  if (!isShadowPass && isMoving && Math.random() < (type === "boss_slime" ? 0.35 : 0.18)) {
    if (typeof spawnParticle === "function") {
      if (type.includes("magma") || type.includes("lava") || type.includes("fire")) {
        spawnParticle({
          x: worldX + (Math.random() - 0.5) * radius,
          y: worldY + radius * 0.3,
          vx: (Math.random() - 0.5) * 12,
          vy: -10 - Math.random() * 16,
          color: ["#fef08a", "#fb923c", "#ef4444"],
          size: 1.8 + Math.random() * 2.2,
          maxLife: 0.55,
          gravity: -15,
          drag: 0.95,
          shrink: true,
          style: "circle"
        });
      } else if (type.includes("frost") || type.includes("ice") || isSlowed) {
        spawnParticle({
          x: worldX + (Math.random() - 0.5) * radius,
          y: worldY + radius * 0.4,
          vx: (Math.random() - 0.5) * 10,
          vy: -6 - Math.random() * 10,
          color: ["#e0f2fe", "#bae6fd", "#ffffff"],
          size: 1.5 + Math.random() * 2,
          maxLife: 0.45,
          gravity: 12,
          drag: 0.92,
          shrink: true,
          style: "circle"
        });
      } else if (type.includes("toxic") || type.includes("acid")) {
        spawnParticle({
          x: worldX + (Math.random() - 0.5) * radius,
          y: worldY + radius * 0.4,
          vx: (Math.random() - 0.5) * 14,
          vy: -8 - Math.random() * 12,
          color: ["#bef264", "#a3e635", "#d9f99d"],
          size: 1.6 + Math.random() * 2,
          maxLife: 0.42,
          gravity: 20,
          drag: 0.92,
          shrink: true,
          style: "circle"
        });
      } else if (pal.hasCrown) {
        spawnParticle({
          x: worldX + (Math.random() - 0.5) * radius,
          y: worldY + radius * 0.2,
          vx: (Math.random() - 0.5) * 12,
          vy: -12 - Math.random() * 12,
          color: ["#fef08a", "#facc15", "#ffffff"],
          size: 1.8 + Math.random() * 2.2,
          maxLife: 0.45,
          gravity: 10,
          drag: 0.94,
          shrink: true,
          style: "circle"
        });
      } else {
        spawnParticle({
          x: worldX + (Math.random() - 0.5) * radius,
          y: worldY + radius * 0.4 + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 16 - vx * 8,
          vy: -4 - Math.random() * 12,
          color: pal.particleColors,
          size: 2 + Math.random() * 3,
          maxLife: 0.35 + Math.random() * 0.25,
          gravity: 25,
          drag: 0.92,
          style: "circle",
          shrink: true
        });
      }
    }
  }

  // Update & drift puddles
  if (isMoving && !hasRealVel) {
    const driftSpd = 20 * intensity;
    for (let i = 0; i < puddles.length; i++) {
      puddles[i].x -= Math.cos(walkAngle) * driftSpd * dtSec;
      puddles[i].y -= Math.sin(walkAngle) * driftSpd * dtSec * 0.35;
    }
  } else if (hasRealVel) {
    for (let i = 0; i < puddles.length; i++) {
      puddles[i].x -= deltaWorldX;
      puddles[i].y -= deltaWorldY;
    }
  }

  // Clean expired puddles and ripples
  // Bolt Opt: Replaced .filter() lambda closures with zero-allocation in-place loops to eliminate transient closure allocations and reduce GC thrashing.
  let pIdx = 0;
  for (let i = 0; i < puddles.length; i++) {
    if (now - puddles[i].createdAt < puddles[i].duration) {
      puddles[pIdx++] = puddles[i];
    }
  }
  puddles.length = pIdx;
  if (puddles.length > 14) puddles.splice(0, puddles.length - 14);

  let rIdx = 0;
  for (let i = 0; i < ripples.length; i++) {
    if (now - ripples[i].createdAt < ripples[i].duration) {
      ripples[rIdx++] = ripples[i];
    }
  }
  ripples.length = rIdx;
  _slimePuddleMap.set(entKey, puddles);
  _slimeRippleMap.set(entKey, ripples);

  ctx.save();
  ctx.translate(x, y);

  // Render ground slime puddles & footprints
  if (!isShadowPass && !lowDetail) {
    for (let i = 0; i < puddles.length; i++) {
      drawFluidPuddle(ctx, puddles[i], now);
    }
    // Render ground impact shockwave ripples
    for (let i = 0; i < ripples.length; i++) {
      drawFluidRipple(ctx, ripples[i], now);
    }
  }

  // 1. Soft Multi-Stop Radial Ambient Occlusion Shadow with Dynamic Air Height Response
  ctx.save();
  ctx.scale(1, 0.34);
  const shadowY = radius * 1.05 + bounce * 4;
  const airRatio = Math.max(0, -currentHopY / (radius * 0.85));
  const dynamicShadowScale = Math.max(0.42, (1 - airRatio * 0.38) * (1 + (scaleX - 1) * 0.45));
  const dynamicShadowAlpha = Math.max(0.18, 1 - airRatio * 0.45);

  // Ground shadow circle removed per design rule: never render solid shadow circles around monsters

  // Translucent colored floor glow reflection (unit gradient scaled to the glow radius)
  const glowR = shadowRx * dynamicShadowScale * 1.45;
  ctx.globalAlpha = dynamicShadowAlpha;
  ctx.translate(0, shadowY);
  ctx.scale(glowR, glowR);
  ctx.fillStyle = G.glowUnit;
  ctx.beginPath();
  ctx.ellipse(0, 0, 1, 0.95 / 1.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (isShadowPass) {
    ctx.restore();
    ctx.restore();
    return;
  }

  // Viscous slime tendrils connecting ground to rising slime base during initial leap
  if (!lowDetail) drawSlimeTendrils(ctx, radius, currentHopY, shadowY, pal);

  // 2. Boss Atmospheric Radial Aura Glow
  if (type === "boss_slime") {
    const bsPulse = Math.sin(now * 0.0035) * 0.15 + 0.85;
    const auraGrd = ctx.createRadialGradient(0, -4, radius * 0.2, 0, 0, radius * 1.9 * bsPulse);
    auraGrd.addColorStop(0, pal.glowAura);
    auraGrd.addColorStop(0.55, "rgba(14, 165, 233, 0.16)");
    auraGrd.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = auraGrd;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.9 * bsPulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Fluid Body Transform (with Walk Hop, Forward Drift, and Tilt)
  ctx.translate(currentDriftX, currentHopY);
  ctx.rotate(currentTilt + (isMoving ? moveAngle * 0.08 : 0));
  ctx.scale(scaleX, scaleY);

  // Compute 24-point harmonic organic fluid membrane with Walk Wave Deformation
  const pointsCount = 24;
  const perimeterPoints = _membranePoints;
  for (let i = 0; i < pointsCount; i++) {
    const angle = (i / pointsCount) * Math.PI * 2;
    const wave1 = Math.sin(now * 0.0075 + angle * 3 + seed) * (radius * 0.055);
    const wave2 = Math.cos(now * 0.011 - angle * 2 + seed) * (radius * 0.038);
    // Organic tear-drop drooping: slightly wider bottom
    const verticalDroop = Math.sin(angle) * (radius * 0.04);
    // Walk kinetic deformation: bottom flares on splat, top stretches on jump
    const bottomFlare = (angle > 0.3 && angle < Math.PI - 0.3) ? pSplat * (radius * 0.14) * Math.sin(angle) * wWeight : 0;
    const topPeak = (angle < -0.3 && angle > -Math.PI + 0.3) ? pJump * (radius * 0.10) * Math.abs(Math.sin(angle)) * wWeight : 0;
    const r = radius + wave1 + wave2 + verticalDroop + bottomFlare + topPeak;
    perimeterPoints[i * 2] = Math.cos(angle) * r;
    perimeterPoints[i * 2 + 1] = Math.sin(angle) * r;
  }

  // 4. Backside Deep Volumetric Jelly Absorption Gradient
  ctx.fillStyle = G.back;
  traceSmoothFluidPathXY(ctx, perimeterPoints, pointsCount);
  ctx.fill();

  // 5. Translucent Sub-Surface Scattering & Front Gel Dome (Multi-Stop Radial Gradient)
  // Same outline as the back layer: the path is still current, refill it with the front gradient.
  ctx.fillStyle = G.front;
  ctx.fill();

  // 6. Internal Ground-Bounce Ambient Liquid Caustic (Soft Refraction Crescent)
  if (!lowDetail) {
    ctx.fillStyle = G.caustic;
    ctx.beginPath();
    ctx.ellipse(radius * 0.12, radius * 0.38, radius * 0.62, radius * 0.32, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. Suspended 3D Bioluminescent Liquid Nucleus Core (Lineless Soft Radiant Falloff)
  ctx.save();
  const nHopLag = (-currentHopY * 0.20 - pSplat * 2.8) * wWeight;
  const nParallaxX = -vx * 3.2 + Math.sin(now * 0.003 + seed) * 1.5;
  const nParallaxY = -vy * 3.2 + bounce * radius * 0.22 + nHopLag;
  ctx.translate(nParallaxX, nParallaxY);

  const coreRadius = radius * 0.46;
  ctx.fillStyle = G.core;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Soft glowing plasma corona around nucleus (zero stroke line)
  if (!lowDetail) {
    ctx.fillStyle = G.corona;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius * 1.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 8. Suspended Relics with Soft Gradients
  ctx.save();
  const relicHopLag = (-currentHopY * 0.14 - pSplat * 2.2) * wWeight;
  const relicParallaxX = -vx * 1.8;
  const relicParallaxY = -vy * 1.8 + Math.sin(now * 0.0022 + seed * 2) * 2 + relicHopLag;
  ctx.translate(relicParallaxX, relicParallaxY);

  if (pal.hasCrown) {
    // Lineless Golden Crown with Rich Metallic Linear Gradients
    const crownSpin = Math.sin(now * 0.002) * 0.15;
    ctx.rotate(crownSpin);

    // Soft Crown Ambient Drop Shadow
    ctx.fillStyle = G.crown.shadow;
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.08, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Metallic Gold Crown Facets
    ctx.fillStyle = G.crown.body;
    ctx.beginPath();
    ctx.moveTo(-13, -radius * 0.1);
    ctx.lineTo(-16, -radius * 0.34);
    ctx.lineTo(-8, -radius * 0.22);
    ctx.lineTo(0, -radius * 0.44);
    ctx.lineTo(8, -radius * 0.22);
    ctx.lineTo(16, -radius * 0.34);
    ctx.lineTo(13, -radius * 0.1);
    ctx.closePath();
    ctx.fill();

    // Soft Crown Rim Highlight
    ctx.fillStyle = G.crown.rim;
    ctx.fillRect(-12, -radius * 0.12, 24, 2);

    // 3 Inlaid Radiant Gemstones with Radial Glows
    const gems = G.crown.gems;
    for (let gi = 0; gi < gems.length; gi++) {
      const gem = gems[gi];
      ctx.fillStyle = gem.grad;
      ctx.beginPath();
      ctx.arc(gem.x, gem.y, gem.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pal.hasCrystal) {
    // Inlaid Volumetric Crystal with Faceted Linear Gradients
    const crystalAngle = (now * 0.001 + seed) % (Math.PI * 2);
    ctx.save();
    ctx.translate(Math.sin(now * 0.001) * 3, -radius * 0.15);
    ctx.rotate(crystalAngle * 0.18);

    // Facet 1 (Deep Refraction)
    ctx.fillStyle = G.crystalDeep;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();

    // Facet 2 (Luminous Face)
    ctx.fillStyle = G.crystalLit;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    // 3D Floating Ancient Clover Leaf with Soft Translucent Gradients
    const cloverRot = Math.sin(now * 0.0015 + seed) * 0.35;
    ctx.save();
    ctx.translate(Math.cos(now * 0.001 + seed) * (radius * 0.25), -radius * 0.12);
    ctx.rotate(cloverRot);

    ctx.fillStyle = G.clover;
    ctx.beginPath();
    ctx.ellipse(-2, -2, 2.6, 1.7, Math.PI / 4, 0, Math.PI * 2);
    ctx.ellipse(2, -2, 2.6, 1.7, -Math.PI / 4, 0, Math.PI * 2);
    ctx.ellipse(-2, 2, 2.6, 1.7, -Math.PI / 4, 0, Math.PI * 2);
    ctx.ellipse(2, 2, 2.6, 1.7, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // 9. Floating Liquid Micro-Bubbles with Radial Lens Flares (Zero Hard Lines)
  // Unit-radius highlight under translate + scale(bSize); the per-bubble fade that used to be baked
  // into the colour stops is applied through globalAlpha instead (same result for white stops).
  const bubbleBaseAlpha = ctx.globalAlpha;
  for (let i = 0, n = lowDetail ? 0 : 4; i < n; i++) {
    const bSeed = seed + i * 512;
    const bCycle = ((now * 0.001 + i * 0.25 + bSeed) % 1.0);
    const bx = Math.sin(bCycle * Math.PI * 2 + bSeed) * (radius * 0.38);
    const by = (radius * 0.42) - bCycle * (radius * 0.95);
    const bAlpha = Math.sin(bCycle * Math.PI) * 0.82;
    const bSize = 1.2 + Math.sin(bCycle * Math.PI) * 1.6;

    ctx.save();
    ctx.globalAlpha = bubbleBaseAlpha * bAlpha;
    ctx.translate(bx, by);
    ctx.scale(bSize, bSize);
    ctx.fillStyle = getBubbleGradient(ctx, bSize);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 10. Separated DVD Screensaver Bouncing Eyes (Roaming Across the Entire Slime Body)
  const isBlinking = (now + seed * 10) % 4200 < 160;
  const eyeR = Math.max(2.8, radius * 0.165);

  let dvd = _dvdEyeMap.get(entKey);
  const baseSpeed = Math.max(24, Math.round(radius * 1.5));

  if (!dvd || dvd.slimeRadius !== radius) {
    // Each eye starts with unique randomized angle and offset
    const ang1 = 0.55 + ((seed * 17) % 100) / 100 * 0.8;
    const ang2 = Math.PI + 0.4 + (((seed + 7) * 23) % 100) / 100 * 0.8;
    dvd = {
      slimeRadius: radius,
      left: {
        x: -radius * 0.45,
        y: -radius * 0.25,
        vx: Math.cos(ang1) * baseSpeed,
        vy: Math.sin(ang1) * baseSpeed,
        seedOffset: (seed % 50) + 1.5,
        colorIndex: seed % DVD_SCREENSAVER_COLORS.length,
        lastBounceTime: now
      },
      right: {
        x: radius * 0.45,
        y: radius * 0.20,
        vx: Math.cos(ang2) * baseSpeed,
        vy: Math.sin(ang2) * baseSpeed,
        seedOffset: ((seed + 13) % 50) + 7.8,
        colorIndex: (seed + 3) % DVD_SCREENSAVER_COLORS.length,
        lastBounceTime: now
      },
      lastTime: now
    };
    _dvdEyeMap.set(entKey, dvd);
  }

  // Smooth frame delta calculation
  const dt = Math.min(0.06, Math.max(0.001, (now - dvd.lastTime) / 1000));
  dvd.lastTime = now;

  // Update and ricochet each eye separately across the entire organic slime body with randomized angles
  const updateSingleEye = (eye, otherEye) => {
    // Dynamic fluid acceleration from slime movement: internal liquid current exerts circulation force
    const fluidSwirlAngle = walkAngle + (eye === dvd.left ? -0.35 : 0.35);
    const fluidPush = isMoving ? 16 * wWeight : 0;
    const swirlForceX = Math.cos(fluidSwirlAngle) * fluidPush;
    const swirlForceY = Math.sin(fluidSwirlAngle) * fluidPush;

    // Gentle fluid wandering so trajectory is organic and not locked to a single rigid slope
    const driftAngle = (Math.sin(now * 0.0022 + eye.seedOffset) + Math.cos(now * 0.0017 + eye.seedOffset * 1.8)) * 0.015;
    let curVAng = Math.atan2(eye.vy + swirlForceY * dt, eye.vx + swirlForceX * dt) + driftAngle;

    // Dynamic speed modulation: acceleration during hop leap, compression drag during landing splat
    const speedMod = 1 + (pJump * 0.32 - pSplat * 0.22) * wWeight;
    const currentSpeed = baseSpeed * Math.max(0.65, speedMod);

    eye.vx = Math.cos(curVAng) * currentSpeed;
    eye.vy = Math.sin(curVAng) * currentSpeed;

    // Inter-eye fluid displacement repulsion when eyes pass close to each other
    if (otherEye) {
      const edx = eye.x - otherEye.x;
      const edy = eye.y - otherEye.y;
      const edist = Math.sqrt((edx) * (edx) + (edy) * (edy));
      const minSeparation = eyeR * 2.2;
      if (edist < minSeparation && edist > 0.001) {
        const repulseForce = ((minSeparation - edist) / minSeparation) * 45;
        eye.vx += (edx / edist) * repulseForce;
        eye.vy += (edy / edist) * repulseForce;
      }
    }

    eye.x += eye.vx * dt;
    eye.y += eye.vy * dt;

    // Evaluate organic slime fluid boundary at current eye angle
    const curDist = Math.sqrt((eye.x) * (eye.x) + (eye.y) * (eye.y));
    const curAngle = Math.atan2(eye.y, eye.x);
    const wave1 = Math.sin(now * 0.0075 + curAngle * 3 + seed) * (radius * 0.055);
    const wave2 = Math.cos(now * 0.011 - curAngle * 2 + seed) * (radius * 0.038);
    const verticalDroop = Math.sin(curAngle) * (radius * 0.04);
    const slimeBoundaryR = radius + wave1 + wave2 + verticalDroop;

    // Full-body travel envelope: eye reaches all regions of the slime body right to the edge
    const maxAllowedR = Math.max(radius * 0.4, slimeBoundaryR - eyeR * 0.85);

    if (curDist >= maxAllowedR) {
      const nx = eye.x / (curDist || 1);
      const ny = eye.y / (curDist || 1);

      // Clamp position just inside the gelatin membrane
      eye.x = nx * (maxAllowedR * 0.985);
      eye.y = ny * (maxAllowedR * 0.985);

      const dot = eye.vx * nx + eye.vy * ny;
      if (dot > 0) {
        // Specular reflection with random angular dispersion
        let rx = eye.vx - 2 * dot * nx;
        let ry = eye.vy - 2 * dot * ny;
        let refAngle = Math.atan2(ry, rx);

        // Add random angular jitter (+/- 25 degrees) to avoid closed repetitive orbits
        const randJitter = (Math.random() - 0.5) * 0.9;
        refAngle += randJitter;

        // Ensure reflected velocity continues pointing inward away from the membrane
        const inwardNormalAngle = Math.atan2(-ny, -nx);
        let angleDiff = refAngle - inwardNormalAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) > Math.PI * 0.45) {
          refAngle = inwardNormalAngle + (Math.random() - 0.5) * 0.8;
        }

        eye.vx = Math.cos(refAngle) * baseSpeed;
        eye.vy = Math.sin(refAngle) * baseSpeed;

        // Shift to the next bright DVD screensaver color on each bounce
        eye.colorIndex = (eye.colorIndex + 1) % DVD_SCREENSAVER_COLORS.length;
        eye.lastBounceTime = now;

        // Corner / apex hit sparkle particle celebration
        const isCorner = Math.abs(nx) > 0.55 && Math.abs(ny) > 0.55;
        if (isCorner && typeof spawnParticle === "function") {
          for (let k = 0; k < 6; k++) {
            spawnParticle({
              x: worldX + eye.x * 2,
              y: worldY + eye.y * 2,
              vx: (Math.random() - 0.5) * 45,
              vy: (Math.random() - 0.5) * 45,
              color: ["#ffffff", DVD_SCREENSAVER_COLORS[eye.colorIndex], "#fef08a"],
              size: 2.2,
              maxLife: 0.45,
              shrink: true
            });
          }
        }
      }
    }
  };

  updateSingleEye(dvd.left, dvd.right);
  updateSingleEye(dvd.right, dvd.left);

  const leftColor = DVD_SCREENSAVER_COLORS[dvd.left.colorIndex];
  const rightColor = DVD_SCREENSAVER_COLORS[dvd.right.colorIndex];

  // Fluid inertia wobble on each separated eye with movement drag and hop lag
  const moveDragX = -Math.cos(walkAngle) * (radius * 0.12) * wWeight - vx * 2.5;
  const moveDragY = -Math.sin(walkAngle) * (radius * 0.07) * wWeight - vy * 2.5;
  const hopInertiaY = (pJump * (radius * 0.16) + pSplat * (radius * 0.22)) * wWeight;
  const elasticJiggle = Math.sin(now * 0.024 + seed) * pSplat * 2.2 * wWeight;

  const leftWobbleX = moveDragX + Math.sin(now * 0.007 + seed) * (radius * 0.025);
  const leftWobbleY = moveDragY + Math.cos(now * 0.008 + seed) * (radius * 0.03) + bounce * radius * 0.15 + hopInertiaY + elasticJiggle;
  const rightWobbleX = moveDragX + Math.sin(now * 0.007 + seed + 2.5) * (radius * 0.025);
  const rightWobbleY = moveDragY + Math.cos(now * 0.008 + seed + 2.5) * (radius * 0.03) + bounce * radius * 0.15 + hopInertiaY + elasticJiggle;

  // Contain rendered eye centers within the organic slime boundary under all motion
  const clampEyePosition = (ex, ey) => {
    const d = Math.sqrt((ex) * (ex) + (ey) * (ey));
    const ang = Math.atan2(ey, ex);
    const w1 = Math.sin(now * 0.0075 + ang * 3 + seed) * (radius * 0.055);
    const w2 = Math.cos(now * 0.011 - ang * 2 + seed) * (radius * 0.038);
    const vDroop = Math.sin(ang) * (radius * 0.04);
    const maxR = (radius + w1 + w2 + vDroop) - eyeR * 0.75;
    if (d > maxR && d > 0.001) {
      return { x: (ex / d) * maxR, y: (ey / d) * maxR };
    }
    return { x: ex, y: ey };
  };

  const leftPos = clampEyePosition(dvd.left.x + leftWobbleX, dvd.left.y + leftWobbleY);
  const rightPos = clampEyePosition(dvd.right.x + rightWobbleX, dvd.right.y + rightWobbleY);

  const leftEyeX = leftPos.x;
  const leftEyeY = leftPos.y;
  const rightEyeX = rightPos.x;
  const rightEyeY = rightPos.y;

  // Dynamic soft-body squash and stretch on each eyeball
  const hopEyeSquashX = 1 + pSplat * 0.32 * wWeight - pJump * 0.16 * wWeight;
  const hopEyeSquashY = 1 - pSplat * 0.25 * wWeight + pJump * 0.26 * wWeight;

  const computeEyeSquash = (eye) => {
    const eyeSpeed = Math.sqrt((eye.vx) * (eye.vx) + (eye.vy) * (eye.vy));
    const speedRatio = Math.min(1, eyeSpeed / baseSpeed);
    const speedStretch = speedRatio * 0.14 * (isMoving ? 1.4 : 1.0);
    const velAngle = Math.atan2(eye.vy, eye.vx);

    return {
      sx: hopEyeSquashX * (1 + speedStretch * 0.5),
      sy: hopEyeSquashY * (1 - speedStretch * 0.35),
      rot: velAngle * 0.20 + currentTilt * 0.4
    };
  };

  const leftDeform = computeEyeSquash(dvd.left);
  const rightDeform = computeEyeSquash(dvd.right);

  // Dynamic pupil offset: gaze tracking + fluid lag + hop inertia
  const maxPupilShift = eyeR * 0.42;
  const lookTargetX = isMoving ? Math.cos(walkAngle) * (eyeR * 0.34) * wWeight : 0;
  const lookTargetY = isMoving ? Math.sin(walkAngle) * (eyeR * 0.26) * wWeight : 0;
  const hopPupilLagY = (pJump * 0.6 + pSplat * 1.1) * wWeight;

  const computePupilOffset = (eye) => {
    const eyeLagX = -(eye.vx / baseSpeed) * (eyeR * 0.22);
    const eyeLagY = -(eye.vy / baseSpeed) * (eyeR * 0.22);
    const rawX = lookTargetX + eyeLagX - vx * 1.6;
    const rawY = lookTargetY + eyeLagY - vy * 1.6 + hopPupilLagY;
    const dist = Math.sqrt((rawX) * (rawX) + (rawY) * (rawY));
    if (dist > maxPupilShift && dist > 0.001) {
      return {
        x: (rawX / dist) * maxPupilShift,
        y: (rawY / dist) * maxPupilShift
      };
    }
    return { x: rawX, y: rawY };
  };

  const leftPupilPos = computePupilOffset(dvd.left);
  const rightPupilPos = computePupilOffset(dvd.right);

  // Dynamic pupil dilation: dilates wide at jump apex, constricts on splat impact
  const basePupilR = (isAttacking || isHit) ? eyeR * 0.65 : eyeR * 0.54;
  const dilationFactor = Math.max(0.72, Math.min(1.22, 1 + (pJump * 0.18 - pSplat * 0.24) * wWeight));
  const dynamicPupilR = basePupilR * dilationFactor;

  // Visual interaction when separated eyes cross paths inside the translucent fluid
  const eyeDx = rightEyeX - leftEyeX;
  const eyeDy = rightEyeY - leftEyeY;
  const eyeDist = Math.sqrt((eyeDx) * (eyeDx) + (eyeDy) * (eyeDy));
  if (eyeDist < eyeR * 2.4) {
    const midX = (leftEyeX + rightEyeX) / 2;
    const midY = (leftEyeY + rightEyeY) / 2;
    const crossAlpha = (1 - eyeDist / (eyeR * 2.4)) * 0.45;
    const crossGrd = ctx.createRadialGradient(midX, midY, 0, midX, midY, eyeR * 1.4);
    crossGrd.addColorStop(0, `rgba(255, 255, 255, ${crossAlpha})`);
    crossGrd.addColorStop(0.5, `rgba(186, 230, 253, ${crossAlpha * 0.5})`);
    crossGrd.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = crossGrd;
    ctx.beginPath();
    ctx.arc(midX, midY, eyeR * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft Rosy Cheeks via Radial Gradients (following each separated eye closely)
  const drawCheek = (cx, cy) => {
    ctx.translate(cx, cy);
    ctx.fillStyle = G.cheek;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeR * 1.1, eyeR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(-cx, -cy);
  };
  drawCheek(leftEyeX - eyeR * 0.45, leftEyeY + eyeR * 0.85);
  drawCheek(rightEyeX + eyeR * 0.45, rightEyeY + eyeR * 0.85);

  if (isBlinking || hpRatio < 0.25) {
    // Soft Lineless Closed Eyelid Creases (Deep Liquid Folds)
    const drawClosedEye = (cx, cy, colorIndex) => {
      ctx.translate(cx, cy);
      ctx.fillStyle = getClosedLidGradient(ctx, G, pal, colorIndex);
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeR, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(-cx, -cy);
    };
    drawClosedEye(leftEyeX, leftEyeY, dvd.left.colorIndex);
    drawClosedEye(rightEyeX, rightEyeY, dvd.right.colorIndex);
  } else {
    // Volumetric Spherical Eyeballs with Dynamic Fluid Deformation & Pupil Inertia
    const drawEye = (ex, ey, pOffX, pOffY, colorIndex, eyeSx, eyeSy, eyeRot) => {
      ctx.save();
      ctx.translate(ex, ey);
      if (eyeRot) ctx.rotate(eyeRot);
      ctx.scale(eyeSx, eyeSy);

      // Liquid Eye Socket Ambient Shadow with dynamic lag shift
      ctx.fillStyle = getSocketGradient(ctx, G, pal, -pOffX * 0.35, -pOffY * 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, eyeR * 1.35, 0, Math.PI * 2);
      ctx.fill();

      // Fluid wake rim / liquid displacement caustic behind moving eye
      if (!lowDetail) {
        ctx.fillStyle = G.wake;
        ctx.beginPath();
        ctx.arc(0, 0, eyeR * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cornea / Sclera Spherical Radial Gradient tinted with DVD bouncing hue
      ctx.fillStyle = getScleraGradient(ctx, G, pal, colorIndex);
      ctx.beginPath();
      ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Deep Liquid Pupil with Dynamic Inertial Lag & Dilation (unit gradient scaled to the pupil)
      ctx.translate(pOffX, pOffY);
      ctx.scale(dynamicPupilR, dynamicPupilR);
      ctx.fillStyle = G.pupilUnit;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.scale(1 / dynamicPupilR, 1 / dynamicPupilR);
      ctx.translate(-pOffX, -pOffY);

      // Primary Specular Cornea Sparkle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pOffX - dynamicPupilR * 0.38, pOffY - dynamicPupilR * 0.38, dynamicPupilR * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Secondary Micro Catchlight
      if (!lowDetail) {
        ctx.beginPath();
        ctx.arc(pOffX + dynamicPupilR * 0.42, pOffY + dynamicPupilR * 0.42, dynamicPupilR * 0.20, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    drawEye(leftEyeX, leftEyeY, leftPupilPos.x, leftPupilPos.y, dvd.left.colorIndex, leftDeform.sx, leftDeform.sy, leftDeform.rot);
    drawEye(rightEyeX, rightEyeY, rightPupilPos.x, rightPupilPos.y, dvd.right.colorIndex, rightDeform.sx, rightDeform.sy, rightDeform.rot);

    if (isAttacking || isHit) {
      // Soft Liquid Furrow Crease above eyes (Gradient-based instead of harsh line)
      const browGrd = ctx.createLinearGradient(leftEyeX, leftEyeY - eyeR, rightEyeX, rightEyeY - eyeR);
      browGrd.addColorStop(0, leftColor);
      browGrd.addColorStop(0.5, "rgba(0, 0, 0, 0.15)");
      browGrd.addColorStop(1, rightColor);
      ctx.fillStyle = browGrd;
      ctx.beginPath();
      ctx.ellipse(leftEyeX, leftEyeY - eyeR * 0.9, eyeR * 0.8, 1.2, -0.2, 0, Math.PI * 2);
      ctx.ellipse(rightEyeX, rightEyeY - eyeR * 0.9, eyeR * 0.8, 1.2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 11. Multi-Lobe Liquid Specular Surface Sheen & Glare (Translucent Glass Dome Over Eyes)
  // Primary Liquid Glare (Top-Left)
  const specX = -radius * 0.36;
  const specY = -radius * 0.40;
  const specRx = radius * 0.36;
  const specRy = radius * 0.20;

  ctx.fillStyle = G.spec;
  ctx.beginPath();
  ctx.ellipse(specX, specY, specRx, specRy, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  if (!lowDetail) {
    // Sun Reflection Micro-Catchlight Glint
    ctx.fillStyle = G.glint;
    ctx.beginPath();
    ctx.arc(-radius * 0.22, -radius * 0.56, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Secondary Soft Ambient Ground-Bounce Sheen (Bottom-Right)
    ctx.fillStyle = G.bounce;
    ctx.beginPath();
    ctx.arc(radius * 0.35, radius * 0.34, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // Scale & Translate
  ctx.restore(); // Master Save
}

// --- Family: Wolf ---
// wolves.js - Procedural Lineless Wolf & Canine Entity Renderer


export function triggerWolfDeathLimbExplosion(ce) {
  if (!ce || ce._limbsExploded) return;
  ce._limbsExploded = true;

  const maxHp = ce.maxHp || 100;
  const hpRatio = ce.hp !== undefined ? Math.max(0, ce.hp / maxHp) : 1;

  const legsCount = ce._lastActiveLegs !== undefined ? ce._lastActiveLegs : (hpRatio < 0.15 ? 1 : hpRatio < 0.40 ? 2 : hpRatio < 0.70 ? 3 : 4);
  const hasTail = ce._lastTailSevered !== undefined ? !ce._lastTailSevered : (hpRatio >= 0.25);

  const type = (ce.type || "").toLowerCase();
  let bodyColor = "#4b5563";
  let accentColor = "#1f2937";
  let pawLen = 8;
  let w = 22;

  if (type === "wolf_alpha" || type === "alpha_wolf" || type.includes("alpha")) {
    bodyColor = "#4a4a4a";
    accentColor = "#2c3e50";
    pawLen = 9;
    w = 23;
  } else if (type === "boss_wolf" || type === "the_wolf_king" || type.startsWith("boss_")) {
    bodyColor = "#2c3e50";
    accentColor = "#1a252f";
    pawLen = 15;
    w = 38;
  } else if (type === "arctic_wolf" || type === "frost_wolf" || type.includes("arctic") || type.includes("white_wolf")) {
    bodyColor = "#e2e8f0";
    accentColor = "#94a3b8";
    pawLen = 8;
    w = 22;
  } else if (type === "corrupted_wolf" || type.includes("corrupted")) {
    bodyColor = "#3b0764";
    accentColor = "#1e1b4b";
    pawLen = 8.5;
    w = 22;
  }

  if (typeof spawnParticle === "function") {
    for (let i = 0; i < legsCount; i++) {
      spawnParticle({
        x: ce.x + (Math.random() - 0.5) * 12,
        y: ce.y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 200,
        vy: -100 - Math.random() * 150,
        color: bodyColor,
        accentColor: accentColor,
        size: pawLen * 1.5,
        maxLife: 2.5,
        drag: 0.94,
        style: "wolf_leg",
        gravity: 250,
        shrink: true,
      });
    }

    if (hasTail) {
      spawnParticle({
        x: ce.x,
        y: ce.y,
        vx: (Math.random() - 0.5) * 200,
        vy: -100 - Math.random() * 150,
        color: bodyColor,
        accentColor: accentColor,
        size: w * 0.4,
        maxLife: 2.5,
        drag: 0.94,
        style: "wolf_tail",
        gravity: 250,
        shrink: true,
      });
    }

    spawnParticle({
      x: ce.x,
      y: ce.y,
      vx: (Math.random() - 0.5) * 150,
      vy: -120 - Math.random() * 120,
      color: bodyColor,
      accentColor: accentColor,
      size: w * 0.5,
      maxLife: 2.5,
      drag: 0.94,
      style: "wolf_head",
      gravity: 250,
      shrink: true,
    });

    for (let b = 0; b < 25; b++) {
      spawnParticle({
        x: ce.x,
        y: ce.y,
        vx: (Math.random() - 0.5) * 160,
        vy: -50 - Math.random() * 120,
        color: ["#991b1b", "#dc2626", "#7f1d1d"],
        size: 2.5 + Math.random() * 3.5,
        maxLife: 1.2 + Math.random() * 0.6,
        drag: 0.93,
        gravity: 150,
        style: "circle",
      });
    }
  }
}

export function drawWolfEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};
  const rawType = (ent.type || "wolf").toLowerCase();
  const isSlowed = !!ent.isSlowed;
  const angle = (typeof ent.facingAngle === "number" && !isNaN(ent.facingAngle)) ? ent.facingAngle : 0;
  if (ent._seed === undefined) {
    ent._seed = computeFastSeed(ent.id || "wolf_entity");
  }
  const seed = ent._seed;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  // Crowd level of detail (main.js CrowdLOD): skip details only a pixel or two wide on screen
  const lowDetail = typeof window !== "undefined" && !!(window.CrowdLOD && window.CrowdLOD.current);

  // Archetype Sizing & Visual Scaling
  const isBoss = rawType === "boss_wolf" || rawType === "the_wolf_king" || rawType.startsWith("boss_");
  const isAlpha = rawType === "wolf_alpha" || rawType === "alpha_wolf" || rawType.includes("alpha");
  const isDire = rawType === "dire_wolf" || rawType.includes("dire");
  const isArctic = rawType === "arctic_wolf" || rawType === "frost_wolf" || rawType.includes("arctic") || rawType.includes("white_wolf");
  const isCorrupted = rawType === "corrupted_wolf" || rawType.includes("corrupted");

  const scale = isBoss ? 2.35 : isDire ? 2.10 : isAlpha ? 2.05 : isCorrupted ? 2.0 : 1.95;

  let w = isBoss ? 30 : isDire ? 22 : isAlpha ? 21 : 20; // body half-length
  let h = isBoss ? 16 : isDire ? 12 : isAlpha ? 11 : 10.5; // body half-width
  let snoutLen = isBoss ? 14 : isDire ? 11 : isAlpha ? 10.5 : 10;
  let earSize = isBoss ? 12 : isDire ? 9 : isAlpha ? 8.5 : 8;
  let pawLen = isBoss ? 11 : isDire ? 8.5 : isAlpha ? 8 : 7.5;

  // Harmonic Archetype Fur Palettes (Pure Lineless Digital Painting)
  let furPrimary = "#475569";   // Timber Wolf: Slate Charcoal
  let furSecondary = "#334155"; // Spine Mantle
  let furUnder = "#64748b";     // Chest / Underbelly
  let furAccent = "#1e293b";    // Deep Shadow
  let furHighlight = "#94a3b8"; // Silver fur glint
  let eyeColor = "#f59e0b";     // Glowing Amber-Gold Eye
  let eyePupil = "#000000";
  let noseColor = "#0f172a";    // Natural Dark Leather Nose
  let innerEar = "#1e293b";

  if (isArctic) {
    furPrimary = "#f1f5f9";     // Arctic Glacier White
    furSecondary = "#cbd5e1";   // Frosted Slate Mantle
    furUnder = "#ffffff";       // Snow Chest
    furAccent = "#94a3b8";      // Pale Slate Shadow
    furHighlight = "#ffffff";   // Glacial Sheen
    eyeColor = "#38bdf8";       // Piercing Ice Cyan Eye
    noseColor = "#1e293b";
    innerEar = "#94a3b8";
  } else if (isDire) {
    furPrimary = "#334155";     // Grizzled Ash-Dark
    furSecondary = "#1e293b";
    furUnder = "#475569";
    furAccent = "#0f172a";
    furHighlight = "#64748b";
    eyeColor = "#38bdf8";       // Piercing Ice Cyan Eye
    noseColor = "#020617";
    innerEar = "#1e293b";
  } else if (isAlpha) {
    furPrimary = "#1e293b";     // Alpha Jet Black & Silver Mane
    furSecondary = "#0f172a";
    furUnder = "#334155";
    furAccent = "#020617";
    furHighlight = "#cbd5e1";   // Frosted Silver Tips
    eyeColor = "#ea580c";       // Blazing Fiery Amber-Orange Eye
    noseColor = "#020617";
    innerEar = "#0f172a";
  } else if (isCorrupted) {
    furPrimary = "#2e1065";     // Abyssal Void Purple
    furSecondary = "#1e1b4b";
    furUnder = "#3b0764";
    furAccent = "#0f051d";
    furHighlight = "#a855f7";   // Void Amethyst Glow
    eyeColor = "#c084fc";       // Eerie Void Fuchsia Eye
    noseColor = "#0f051d";
    innerEar = "#1e1b4b";
  } else if (isBoss) {
    furPrimary = "#182230";     // The Wolf King: Midnight Blue-Black
    furSecondary = "#0c131c";
    furUnder = "#2d3748";
    furAccent = "#05080c";
    furHighlight = "#e2e8f0";   // Royal Silver Highlights
    eyeColor = "#ef4444";       // Fiery Crimson Blood Monarch Eye
    noseColor = "#05080c";
    innerEar = "#0c131c";
  }

  if (isSlowed) {
    furPrimary = "#38bdf8";
    furSecondary = "#0284c7";
    furUnder = "#7dd3fc";
    furAccent = "#0369a1";
    furHighlight = "#bae6fd";
    eyeColor = "#0284c7";
  }

  // Dynamic Wounding & Gait System
  const maxHp = ent.maxHp || 100;
  const currentHp = ent.hp !== undefined ? ent.hp : maxHp;
  const hpRatio = Math.max(0, Math.min(1, currentHp / maxHp));

  const isTailSevered = hpRatio < 0.25;
  const isTailDamaged = hpRatio < 0.60;
  const isTorsoExposed = hpRatio < 0.40;
  const isTorsoDamaged = hpRatio < 0.80;
  const isHeadScarred = hpRatio < 0.35;
  const isEarTorn = hpRatio < 0.75;

  let activeLegs = 4;
  if (hpRatio < 0.15) {
    activeLegs = 1;
  } else if (hpRatio < 0.40) {
    activeLegs = 2;
  } else if (hpRatio < 0.70) {
    activeLegs = 3;
  }

  const isMoving = ent.isMoving !== undefined
    ? !!ent.isMoving
    : !!(ent.moving || (ent.vx !== undefined && ent.vy !== undefined && (ent.vx * ent.vx + ent.vy * ent.vy > 25)));

  // Attack State Detection & Progress Computation
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  if (!isAttacking && typeof GameState !== "undefined" && GameState.combatAnimations && ent && ent.id) {
    for (let i = 0; i < GameState.combatAnimations.length; i++) {
      const anim = GameState.combatAnimations[i];
      const dur = anim.duration || anim.durationMs || 450;
      if (anim.attackerId === ent.id && now - anim.createdAt < dur) {
        isAttacking = true;
        break;
      }
    }
  }
  if (!isAttacking && ent.lastAttackTime && (now - ent.lastAttackTime < 450)) {
    isAttacking = true;
  }
  if (!isAttacking && ent.attackStart && (now - ent.attackStart < 450)) {
    isAttacking = true;
  }

  let attackProgress = 0;
  if (isAttacking) {
    if (ent.currentCast) {
      if (typeof ent.currentCast.progress === "number" && !isNaN(ent.currentCast.progress)) {
        attackProgress = Math.min(1, Math.max(0, ent.currentCast.progress));
      } else if (ent.currentCast.duration > 0) {
        const start = ent.currentCast.startTime || now;
        const currentRef = start > 1e11 ? Date.now() : now;
        const elapsed = Math.max(0, currentRef - start);
        attackProgress = Math.min(1, elapsed / ent.currentCast.duration);
      } else {
        attackProgress = (now % 380) / 380;
      }
    } else {
      let animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime;
      if (!animStart && typeof GameState !== "undefined" && GameState.combatAnimations && ent && ent.id) {
        for (let i = 0; i < GameState.combatAnimations.length; i++) {
          if (GameState.combatAnimations[i].attackerId === ent.id) {
            animStart = GameState.combatAnimations[i].createdAt;
            break;
          }
        }
      }
      if (animStart) {
        const currentRef = animStart > 1e11 ? Date.now() : now;
        const elapsed = Math.max(0, currentRef - animStart);
        attackProgress = Math.min(1, elapsed / 420);
      } else {
        attackProgress = (now % 380) / 380;
      }
    }
  }

  // 3-Phase Wolf Attack Kinematics:
  // Phase 1 (0.00-0.30): Coil back, jaws part wide, ears pin back
  // Phase 2 (0.30-0.62): Explosive whole-body spring forward, jaws snap shut with fangs clamped, strike shockwave
  // Phase 3 (0.62-1.00): Recoil ease-out back to combat stance
  let jawOpenAngle = 0;
  let bodyLungeX = 0;
  let headExtraLungeX = 0;
  let attackEarPin = 0;
  let isSnapStrike = false;

  if (isAttacking && attackProgress > 0) {
    if (attackProgress < 0.30) {
      const t = attackProgress / 0.30;
      bodyLungeX = -t * 3.5;
      jawOpenAngle = t * 0.52;
      attackEarPin = t * 0.40;
    } else if (attackProgress < 0.62) {
      const t = (attackProgress - 0.30) / 0.32;
      const spring = Math.sin(t * Math.PI * 0.5);
      bodyLungeX = -3.5 + spring * (w * 0.40 + 7);
      headExtraLungeX = spring * 4.5;
      attackEarPin = 0.40;
      if (t < 0.45) {
        jawOpenAngle = 0.52 * (1 - t / 0.45 * 0.85);
      } else {
        jawOpenAngle = 0.05 + Math.sin((t - 0.45) / 0.55 * Math.PI) * 0.10;
        isSnapStrike = true;
      }
    } else {
      const t = (attackProgress - 0.62) / 0.38;
      const ease = 1 - Math.sin(t * Math.PI * 0.5);
      bodyLungeX = ease * 6.0;
      headExtraLungeX = ease * 2.0;
      jawOpenAngle = ease * 0.08;
      attackEarPin = ease * 0.20;
    }
  }

  // Walk & Trot Kinematics
  const speedFactor = isSlowed ? 0.5 : 1.0;
  const walkSpeedMult = activeLegs === 1 ? 0.005 : activeLegs === 2 ? 0.007 : activeLegs === 3 ? 0.0085 : 0.010;
  
  let runPhase = 0;
  if (isMoving) {
    // Advance the stored phase by elapsed time so the gait keeps cycling on
    // persistent entities and stays smooth when the walk speed changes.
    const lastT = ent._animWalkTime;
    if (Number.isFinite(ent._animWalkPhase) && Number.isFinite(lastT) && now >= lastT) {
      const dt = Math.min(now - lastT, 100);
      runPhase = (ent._animWalkPhase + dt * walkSpeedMult * speedFactor) % (Math.PI * 2);
    } else {
      runPhase = (now * walkSpeedMult * speedFactor + (seed % 100)) % (Math.PI * 2);
    }
    ent._animWalkPhase = runPhase;
    ent._animWalkTime = now;
  } else if (ent._animWalkTime !== undefined) {
    ent._animWalkTime = undefined;
  }

  // Organic Idle Cycles (alive respiration, alert tension, subtle weight shift)
  const breathPhase = now * 0.0026 + seed;
  const breathCycle = Math.sin(breathPhase);
  const flankBreathing = isMoving ? 0 : (Math.sin(breathPhase) * 0.045);
  const idleSpineArch = isMoving ? 0 : (Math.sin(breathPhase) * 0.022);
  const idleChestElevation = isMoving ? 0 : (Math.sin(breathPhase) * 0.4);

  // Stride Dynamics
  const trotBounceY = isMoving ? (Math.abs(Math.sin(runPhase)) * 1.6) : 0;
  const spineSway = isMoving ? Math.sin(runPhase) * (activeLegs === 4 ? 1.4 : 2.2) : 0;
  const headBob = isMoving ? -Math.cos(runPhase) * 1.2 : 0;

  // Stance Weight Shift in Idle (inhaling eases weight back slightly, exhaling settles weight onto front paws)
  const idleWeightShift = isMoving ? 0 : (Math.sin(breathPhase) * 0.35);
  const idleFrontSquash = isMoving ? 1.0 : (1.0 + Math.max(0, -breathCycle) * 0.04);
  const idleRearSquash = isMoving ? 1.0 : (1.0 + Math.max(0, breathCycle) * 0.04);

  // Natural Staggered Quadruped Idle Paw Placement:
  // Breaks robotic symmetry; reflects natural predatory canine standing poise:
  // Front-Left (lead paw): slightly advanced, firmly planted with subtle outward turnout
  const idlePawFL = { x: w * 0.04 + idleWeightShift * 0.3, y: -h * 0.04, angle: -0.07, squash: idleFrontSquash };
  // Front-Right (supporting paw): set back under chest ruff with subtle outward turnout
  const idlePawFR = { x: -w * 0.06 - idleWeightShift * 0.2, y: -h * 0.02, angle: 0.06, squash: idleFrontSquash };
  // Back-Left (digitigrade hock extended): braced back for athletic stability
  const idlePawBL = { x: -w * 0.07 - idleWeightShift * 0.3, y: -h * 0.06, angle: -0.11, squash: idleRearSquash };
  // Back-Right (haunch support): tucked naturally under flank
  const idlePawBR = { x: w * 0.07 + idleWeightShift * 0.2, y: h * 0.02, angle: 0.09, squash: idleRearSquash };

  // Hit Reaction Flinch
  const hitAge = ent.lastHitTime ? (now - ent.lastHitTime) : 9999;
  let hitRecoilX = 0;
  let hitFlashAlpha = 0;
  if (hitAge >= 0 && hitAge < 180) {
    const t = hitAge / 180;
    hitRecoilX = -Math.sin((1 - t) * Math.PI) * 2.8;
    hitFlashAlpha = (1 - t) * 0.45;
  }

  // Stance tilt and crawl offsets based on wounded leg count
  let bodyTilt = 0;
  let crawlY = 0;
  if (activeLegs === 3) {
    bodyTilt = -0.10 + (isMoving ? Math.sin(runPhase) * 0.06 : 0);
  } else if (activeLegs === 2) {
    bodyTilt = -0.22 + (isMoving ? Math.sin(runPhase) * 0.10 : 0);
    crawlY = 2.5;
  } else if (activeLegs === 1) {
    bodyTilt = 0.35 + (isMoving ? Math.sin(runPhase) * 0.16 : 0);
    crawlY = 5.0;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(angle);

  // Apply attack surge, hit flinch recoil, trot bounce and wounded posture
  ctx.translate(bodyLungeX + hitRecoilX, crawlY - trotBounceY * 0.3);
  ctx.rotate(bodyTilt);

  // -------------------------------------------------------------
  // Boss & Corrupted Ethereal Auras
  // -------------------------------------------------------------
  if (!isShadowPass) {
    if (isBoss) {
      const pulse = Math.sin(now * 0.004) * 0.18 + 0.82;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.8);
      if (glow) {
        glow.addColorStop(0, `rgba(220, 38, 38, ${0.30 * pulse})`);
        glow.addColorStop(0.6, `rgba(153, 27, 27, ${0.12 * pulse})`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, w * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isCorrupted) {
      const pulse = Math.sin(now * 0.005) * 0.15 + 0.85;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.6);
      if (glow) {
        glow.addColorStop(0, `rgba(192, 132, 252, ${0.28 * pulse})`);
        glow.addColorStop(0.6, `rgba(88, 28, 135, ${0.10 * pulse})`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, w * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // -------------------------------------------------------------
  // Realistic Digitigrade Paws & Quadruped Gait
  // Diagonal pair coordination with foot lift and claw flex
  // -------------------------------------------------------------
  const drawDetailedPaw = (px, py, pawPhase, isFront = true, idleOffset = null) => {
    if (isShadowPass) return;
    
    let swingX = 0;
    let liftY = 0;
    let pawAngle = 0;
    let footSquash = 1.0;

    if (isMoving) {
      swingX = Math.sin(pawPhase) * (pawLen * 0.85);
      const isSwingPhase = Math.sin(pawPhase) > 0;
      if (isSwingPhase) {
        liftY = -Math.sin(pawPhase) * 2.0;
        pawAngle = Math.cos(pawPhase) * 0.18;
      } else {
        footSquash = 1.05;
      }
    } else if (isAttacking && attackProgress > 0) {
      if (isFront) {
        swingX = headExtraLungeX * 0.5;
      }
    } else if (idleOffset) {
      swingX = idleOffset.x || 0;
      liftY = idleOffset.y || 0;
      pawAngle = idleOffset.angle || 0;
      footSquash = idleOffset.squash || 1.0;
    }

    ctx.save();
    ctx.translate(px + swingX, py + liftY);
    ctx.rotate(pawAngle);

    // Leg Thigh/Shin Muscle - Pure Lineless
    ctx.fillStyle = furAccent;
    ctx.beginPath();
    ctx.ellipse(0, 0, (isFront ? 3.4 : 3.8) * footSquash, isFront ? 2.4 : 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Paw Foot
    const footSign = py < 0 ? -1 : 1;
    ctx.fillStyle = furSecondary;
    ctx.beginPath();
    ctx.ellipse(isFront ? 1.8 : 1.4, footSign * 0.6, 2.6 * footSquash, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (lowDetail) {
      ctx.restore();
      return;
    }

    // 3 Sharp Obsidian Claws
    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.moveTo(3.6, footSign * 0.6 - 1.2);
    ctx.lineTo(5.2, footSign * 0.6 - 0.8);
    ctx.lineTo(3.8, footSign * 0.6 - 0.2);
    ctx.lineTo(5.6, footSign * 0.6);
    ctx.lineTo(3.8, footSign * 0.6 + 0.2);
    ctx.lineTo(5.2, footSign * 0.6 + 0.8);
    ctx.lineTo(3.6, footSign * 0.6 + 1.2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // Helper for gory severed leg & tail stumps
  const drawGorySeveredStump = (sx, sy, size = 4.5) => {
    ctx.save();
    ctx.fillStyle = "#450a0a";
    ctx.beginPath();
    ctx.arc(sx, sy, size + 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#991b1b";
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(sx, sy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Diagonal Pair Trot Mechanics:
  // Pair 1: Front-Right + Rear-Left (runPhase)
  // Pair 2: Front-Left + Rear-Right (runPhase + Math.PI)
  const phasePair1 = runPhase;
  const phasePair2 = runPhase + Math.PI;

  // Front-Right Leg
  if (activeLegs >= 1) {
    drawDetailedPaw(w * 0.45, h * 0.82, phasePair1, true, idlePawFR);
  }
  // Front-Left Leg
  if (activeLegs >= 2) {
    drawDetailedPaw(w * 0.45, -h * 0.82, phasePair2, true, idlePawFL);
  } else {
    drawGorySeveredStump(w * 0.45, -h * 0.82, 4.0);
  }
  // Back-Left Leg
  if (activeLegs >= 3) {
    drawDetailedPaw(-w * 0.55, -h * 0.82, phasePair1, false, idlePawBL);
  } else {
    drawGorySeveredStump(-w * 0.55, -h * 0.82, 4.2);
  }
  // Back-Right Leg
  if (activeLegs >= 4) {
    drawDetailedPaw(-w * 0.55, h * 0.82, phasePair2, false, idlePawBR);
  } else {
    drawGorySeveredStump(-w * 0.55, h * 0.82, 4.2);
  }

  // -------------------------------------------------------------
  // Bushy Segmented Lupine Tail with Organic Wave Dynamics
  // -------------------------------------------------------------
  let tailWag = 0;
  let tailTipLag = 0;

  if (isMoving) {
    const tailBasePhase = runPhase * 0.85;
    const tailAmp = isTailSevered ? 0.08 : 0.34;
    tailWag = Math.sin(tailBasePhase) * tailAmp;
    tailTipLag = Math.sin(tailBasePhase - 0.6) * (tailAmp * 1.35);
  } else if (isAttacking) {
    tailWag = Math.sin(now * 0.005 + seed) * 0.05;
    tailTipLag = Math.sin(now * 0.005 + seed - 0.5) * 0.07;
  } else {
    // Natural lupine resting tail posture:
    // Gentle downward/lateral resting drape with slow organic breathing waft and lazy tip curl
    const idleTailRestAngle = -0.16; // Elegant natural lupine resting drape
    const idleTailWaft = Math.sin(now * 0.0016 + seed) * 0.075 + Math.sin(now * 0.00085 + seed * 2.1) * 0.04;
    const idleTailSwish = (Math.sin(now * 0.0006 + seed * 3.7) > 0.80) ? Math.sin(now * 0.0035) * 0.12 : 0;
    tailWag = idleTailRestAngle + (isTailSevered ? (idleTailWaft * 0.4) : (idleTailWaft + idleTailSwish));
    tailTipLag = Math.sin(now * 0.0016 + seed - 0.6) * 0.09 + (idleTailRestAngle * 0.35);
  }

  ctx.save();
  ctx.translate(-w * 0.85, spineSway * 0.6);
  ctx.rotate(tailWag);

  if (isTailSevered) {
    drawGorySeveredStump(-2, 0, 4.5);
  } else {
    const tailLen = w * 0.95;
    const tailW = h * 0.55;

    // Tail Base & Bushy Fur Tufts with wave curvature
    ctx.fillStyle = isTailDamaged ? "#7f1d1d" : furPrimary;
    ctx.beginPath();
    ctx.moveTo(0, -tailW * 0.4);
    ctx.quadraticCurveTo(-tailLen * 0.35, -tailW * 1.1 + tailTipLag * 4, -tailLen * 0.65, -tailW * 0.8 + tailTipLag * 7);
    ctx.lineTo(-tailLen * 0.55, -tailW * 0.4 + tailTipLag * 6);
    ctx.lineTo(-tailLen * 0.85, -tailW * 0.5 + tailTipLag * 9);
    ctx.lineTo(-tailLen, tailTipLag * 10);
    ctx.lineTo(-tailLen * 0.85, tailW * 0.5 + tailTipLag * 9);
    ctx.lineTo(-tailLen * 0.55, tailW * 0.4 + tailTipLag * 6);
    ctx.lineTo(-tailLen * 0.65, tailW * 0.8 + tailTipLag * 7);
    ctx.quadraticCurveTo(-tailLen * 0.35, tailW * 1.1 + tailTipLag * 4, 0, tailW * 0.4);
    ctx.closePath();
    ctx.fill();

    // Darker Fur Mantle on top of Tail
    ctx.fillStyle = furSecondary;
    ctx.beginPath();
    ctx.moveTo(0, -tailW * 0.3);
    ctx.quadraticCurveTo(-tailLen * 0.4, -tailW * 0.7 + tailTipLag * 4, -tailLen * 0.75, tailTipLag * 7);
    ctx.quadraticCurveTo(-tailLen * 0.4, tailTipLag * 3, 0, 0);
    ctx.closePath();
    ctx.fill();

    // Silver/Highlighted Tail Tip
    ctx.fillStyle = furHighlight;
    ctx.beginPath();
    ctx.moveTo(-tailLen * 0.75, -tailW * 0.25 + tailTipLag * 7);
    ctx.lineTo(-tailLen, tailTipLag * 10);
    ctx.lineTo(-tailLen * 0.75, tailW * 0.25 + tailTipLag * 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // -------------------------------------------------------------
  // Muscular Lupine Torso & Jagged Fur Mantle
  // -------------------------------------------------------------
  ctx.save();
  ctx.scale(1.0 + (isMoving ? 0 : Math.sin(breathPhase) * 0.012), 1.0 + flankBreathing);
  ctx.translate(isMoving ? 0 : idleChestElevation * 0.25, spineSway * 0.3);
  ctx.rotate(isMoving ? 0 : idleSpineArch);

  ctx.fillStyle = furPrimary;
  ctx.beginPath();
  // Neck top
  ctx.moveTo(w * 0.65, -h * 0.65);
  // Shoulder ruff 1 (fur spike)
  ctx.lineTo(w * 0.45, -h * 1.15);
  ctx.lineTo(w * 0.40, -h * 0.85);
  // Shoulder ruff 2
  ctx.lineTo(w * 0.22, -h * 1.25);
  ctx.lineTo(w * 0.18, -h * 0.85);
  // Mid-back
  ctx.lineTo(-w * 0.20, -h * 0.80);
  // Flank / Haunch fur spike
  ctx.lineTo(-w * 0.45, -h * 1.10);
  ctx.lineTo(-w * 0.40, -h * 0.75);
  // Rump / Rear
  ctx.quadraticCurveTo(-w * 0.90, -h * 0.60, -w * 0.90, 0);
  ctx.quadraticCurveTo(-w * 0.90, h * 0.60, -w * 0.40, h * 0.75);
  // Lower flank spike
  ctx.lineTo(-w * 0.45, h * 1.10);
  ctx.lineTo(-w * 0.20, h * 0.80);
  // Mid-belly
  ctx.lineTo(w * 0.18, h * 0.85);
  // Lower shoulder ruff 2
  ctx.lineTo(w * 0.22, h * 1.25);
  ctx.lineTo(w * 0.40, h * 0.85);
  // Lower shoulder ruff 1
  ctx.lineTo(w * 0.45, h * 1.15);
  ctx.lineTo(w * 0.65, h * 0.65);
  // Front chest curve
  ctx.quadraticCurveTo(w * 0.88, 0, w * 0.65, -h * 0.65);
  ctx.closePath();
  ctx.fill();

  // Darker Spine Fur Mantle
  ctx.fillStyle = furSecondary;
  ctx.beginPath();
  ctx.moveTo(w * 0.55, -h * 0.35);
  ctx.quadraticCurveTo(0, -h * 0.55, -w * 0.75, 0);
  ctx.quadraticCurveTo(0, h * 0.55, w * 0.55, h * 0.35);
  ctx.quadraticCurveTo(w * 0.75, 0, w * 0.55, -h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Alpha / Boss / Arctic Silver Fur Streaks along Spine
  if (isAlpha || isBoss || isArctic) {
    ctx.fillStyle = furHighlight;
    ctx.beginPath();
    ctx.ellipse(w * 0.35, -h * 0.30, w * 0.12, h * 0.08, -0.3, 0, Math.PI * 2);
    ctx.ellipse(w * 0.35, h * 0.30, w * 0.12, h * 0.08, 0.3, 0, Math.PI * 2);
    ctx.ellipse(-w * 0.10, -h * 0.22, w * 0.20, h * 0.07, -0.15, 0, Math.PI * 2);
    ctx.ellipse(-w * 0.10, h * 0.22, w * 0.20, h * 0.07, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft Underbelly / Chest Fur Accent
  ctx.fillStyle = furUnder;
  ctx.beginPath();
  ctx.ellipse(w * 0.15, 0, w * 0.35, h * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // Torso

  // -------------------------------------------------------------
  // Wolf Head, Snout, Biting Fangs & Natural Leather Nose
  // -------------------------------------------------------------
  // Natural alert head scan in idle (predatory territory survey)
  const idleHeadScan = isMoving ? 0 : (Math.sin(now * 0.00075 + seed) * 0.07 + Math.sin(now * 0.0017 + seed * 2.3) * 0.035);
  const idleHeadElevation = isMoving ? 0 : (Math.sin(breathPhase) * 0.45);
  
  // Scent testing / sniffing micro-action
  const isSniffing = !isMoving && !isAttacking && (Math.sin(now * 0.0012 + seed * 3.7) > 0.86);
  const sniffTwitch = isSniffing ? (Math.sin(now * 0.038) * 0.45) : 0;

  ctx.save();
  ctx.translate(
    w * 0.52 + headExtraLungeX + (isMoving ? 0 : idleHeadElevation * 0.25),
    (isMoving ? headBob * 0.5 : idleHeadScan * 1.6)
  );
  ctx.rotate(isMoving ? 0 : idleHeadScan);

  // Wedge-shaped Head with Flared Cheek Ruff Tufts (Lineless)
  ctx.fillStyle = furPrimary;
  ctx.beginPath();
  ctx.moveTo(-w * 0.15, -h * 0.65);
  // Left cheek ruff spike
  ctx.lineTo(w * 0.08, -h * 0.85);
  ctx.lineTo(w * 0.10, -h * 0.45);
  // Snout base
  ctx.lineTo(w * 0.22, -h * 0.30);
  ctx.lineTo(w * 0.22, h * 0.30);
  // Right cheek ruff spike
  ctx.lineTo(w * 0.10, h * 0.45);
  ctx.lineTo(w * 0.08, h * 0.85);
  ctx.lineTo(-w * 0.15, h * 0.65);
  ctx.closePath();
  ctx.fill();

  // Head Top Cap Fur
  ctx.fillStyle = furSecondary;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.18, h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth Interior & Fangs when Biting
  if (jawOpenAngle > 0.03) {
    ctx.fillStyle = "#881337";
    ctx.beginPath();
    ctx.moveTo(w * 0.12, -h * 0.22);
    ctx.lineTo(w * 0.12 + snoutLen * 0.85, -h * 0.10);
    ctx.lineTo(w * 0.12 + snoutLen * 0.85, h * 0.10);
    ctx.lineTo(w * 0.12, h * 0.22);
    ctx.closePath();
    ctx.fill();

    // Tongue
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.ellipse(w * 0.12 + snoutLen * 0.45, 0, snoutLen * 0.32, h * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lower Jaw (Hinges down from snout root)
  ctx.save();
  ctx.translate(w * 0.12, 0);
  ctx.rotate(jawOpenAngle);
  ctx.fillStyle = furAccent;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(snoutLen * 0.88, 0);
  ctx.lineTo(snoutLen * 0.85, h * 0.18);
  ctx.lineTo(0, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Bottom Razor Fangs (Pure Ivory Lineless)
  if (jawOpenAngle > 0.03) {
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.moveTo(snoutLen * 0.48, 0);
    ctx.lineTo(snoutLen * 0.60, -h * 0.28);
    ctx.lineTo(snoutLen * 0.70, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore(); // Lower jaw

  // Upper Snout (Hinges slightly up from snout root)
  ctx.save();
  ctx.translate(w * 0.12, 0);
  ctx.rotate(-jawOpenAngle * 0.7);
  ctx.fillStyle = furPrimary;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.32);
  ctx.lineTo(snoutLen, -h * 0.18);
  ctx.lineTo(snoutLen, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Snout Top Bridge (Dark Fur Streak)
  ctx.fillStyle = furSecondary;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.20);
  ctx.lineTo(snoutLen * 0.85, -h * 0.12);
  ctx.lineTo(snoutLen * 0.85, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Upper Deadly Canines (Pure Ivory Lineless)
  if (jawOpenAngle > 0.03) {
    ctx.fillStyle = "#fffbeb";
    ctx.beginPath();
    ctx.moveTo(snoutLen * 0.52, 0);
    ctx.lineTo(snoutLen * 0.65, h * 0.28);
    ctx.lineTo(snoutLen * 0.75, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Real Leather Wolf Nose with sniffing micro-quiver
  const noseX = snoutLen + (sniffTwitch * 0.4);
  const noseY = -h * 0.08 + (sniffTwitch * 0.2);
  const noseW = isBoss ? 3.6 : 2.6;
  const noseH = isBoss ? 2.8 : 2.0;

  ctx.fillStyle = noseColor;
  ctx.beginPath();
  ctx.ellipse(noseX, noseY, noseW, noseH, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!lowDetail) {
    // Dark nostril indentation
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(noseX - 0.3, noseY, noseH * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Subtle natural specular glint on wet leather nose
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(noseX - noseW * 0.35, noseY - noseH * 0.35, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // Upper snout

  // Pricked Lupine Ears with Inner Fur Cavity & Pinning on attack / twitch
  const drawWolfEar = (isTopSide) => {
    const earSign = isTopSide ? -1 : 1;
    const baseEarY = earSign * h * 0.56;

    let earAngle = 0;
    if (isAttacking) {
      earAngle = -attackEarPin;
    } else if (isMoving) {
      const idleEarTwitch = (Math.sin(now * 0.0018 + seed) > 0.90) ? Math.sin(now * 0.025) * 0.14 : 0;
      earAngle = (isTopSide ? idleEarTwitch : -idleEarTwitch * 0.5);
    } else {
      // Natural independent canine auditory scanning in idle
      const earAmbient = isTopSide 
        ? (-0.05 + Math.sin(now * 0.0011 + seed) * 0.045)
        : (0.05 + Math.cos(now * 0.0014 + seed * 1.8) * 0.045);
      const earTwitch = isTopSide
        ? ((Math.sin(now * 0.0016 + seed * 2.9) > 0.88) ? Math.sin(now * 0.028) * 0.16 : 0)
        : ((Math.sin(now * 0.0022 + seed * 4.7) > 0.91) ? Math.sin(now * 0.032) * 0.15 : 0);
      earAngle = earAmbient + earTwitch;
    }

    ctx.save();
    ctx.translate(-w * 0.05, baseEarY);
    ctx.rotate(earAngle);

    ctx.fillStyle = furSecondary;
    ctx.beginPath();
    ctx.moveTo(-w * 0.07, earSign * 1.5);
    ctx.lineTo(w * 0.11, -earSign * 1.0);
    if ((isTopSide && isEarTorn) || (!isTopSide && isHeadScarred)) {
      ctx.lineTo(-w * 0.09, earSign * (earSize * 0.6));
      ctx.lineTo(-w * 0.05, earSign * (earSize * 0.4));
      ctx.lineTo(-w * 0.13, earSign * (earSize * 0.3));
    } else {
      ctx.lineTo(-w * 0.13, earSign * earSize);
    }
    ctx.closePath();
    ctx.fill();

    // Inner Ear Shaded Cavity
    ctx.fillStyle = innerEar;
    ctx.beginPath();
    ctx.moveTo(-w * 0.03, earSign * 1.0);
    ctx.lineTo(w * 0.07, -earSign * 0.5);
    ctx.lineTo(-w * 0.07, earSign * (earSize * 0.65));
    ctx.closePath();
    ctx.fill();

    // Inner Ear Fur Wisps
    if (!lowDetail) {
      ctx.fillStyle = furHighlight;
      ctx.beginPath();
      ctx.moveTo(-w * 0.01, earSign * 0.5);
      ctx.lineTo(w * 0.05, earSign * 0.2);
      ctx.lineTo(-w * 0.04, earSign * (earSize * 0.35));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  drawWolfEar(true);  // Left / Top Ear
  drawWolfEar(false); // Right / Bottom Ear

  // Natural lupine idle blink cycle (quick ~135ms blink every ~4.5 - 7 seconds)
  const blinkCycleMs = 4500 + (seed % 2500);
  const blinkElapsed = (now + seed * 450) % blinkCycleMs;
  let eyelidCloseRatio = 0;
  if (!isAttacking && blinkElapsed < 135) {
    eyelidCloseRatio = Math.sin((blinkElapsed / 135) * Math.PI);
  }

  // Fierce Predatory Glowing Eyes (Lineless)
  const drawFierceEye = (ex, ey) => {
    if (lowDetail) {
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.ellipse(ex, ey, 2.4, 1.6, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 1.8, 1.1, 0.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.fillStyle = furAccent;
    ctx.beginPath();
    ctx.ellipse(ex, ey - 1.0, 2.5, 0.7, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 2.4, 1.6, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 1.8, 1.1, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = eyePupil;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 0.5, 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex - 0.5, ey - 0.35, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Natural upper eyelid draping during idle blink
    if (eyelidCloseRatio > 0.02) {
      ctx.fillStyle = furSecondary;
      ctx.beginPath();
      ctx.ellipse(ex, ey - 1.2 + eyelidCloseRatio * 1.5, 2.6, 1.6 * eyelidCloseRatio, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  drawFierceEye(w * 0.06, -h * 0.30); // Left Eye
  drawFierceEye(w * 0.06, h * 0.30);  // Right Eye

  // Bite Snap Arc Impact Visuals
  if ((isSnapStrike || (jawOpenAngle > 0.15 && isAttacking)) && !isShadowPass) {
    ctx.save();
    ctx.strokeStyle = isCorrupted ? "#c084fc" : isBoss ? "#ef4444" : isArctic ? "#38bdf8" : "#f59e0b";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(w * 0.12 + snoutLen + 5, 0, 9, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(w * 0.12 + snoutLen + 8, 0, 12, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // Head

  // Hit damage flash overlay
  if (hitFlashAlpha > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(239, 68, 68, ${hitFlashAlpha})`;
    ctx.fillRect(-w * 1.5, -h * 1.5, w * 3, h * 3);
    ctx.restore();
  }

  ctx.restore(); // Body
}

// --- Family: Frost Troll ---
// trolls.js - Procedural 8-Directional Angular Chiseled Frost Troll Entity Renderer


/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * Monsters must never have baked-in dark circular shapes emulating ground shadows.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

/**
 * Draws a sharp 4-pointed prismatic diamond star glint (glass specular flare).
 */
export function drawPrismaticStarGlint(ctx, x, y, size, alpha = 1.0, rotation = 0) {
  if (alpha <= 0.02 || size <= 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);

  // Soft cyan/aurora refraction halo
  ctx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.7);
  ctx.lineTo(size * 0.28, -size * 0.28);
  ctx.lineTo(size * 1.7, 0);
  ctx.lineTo(size * 0.28, size * 0.28);
  ctx.lineTo(0, size * 1.7);
  ctx.lineTo(-size * 0.28, size * 0.28);
  ctx.lineTo(-size * 1.7, 0);
  ctx.lineTo(-size * 0.28, -size * 0.28);
  ctx.closePath();
  ctx.fill();

  // Core brilliant white 4-pointed cross star
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.2, -size * 0.2);
  ctx.lineTo(size, 0);
  ctx.lineTo(size * 0.2, size * 0.2);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.2, size * 0.2);
  ctx.lineTo(-size, 0);
  ctx.lineTo(-size * 0.2, -size * 0.2);
  ctx.closePath();
  ctx.fill();

  // Specular center micro-spark
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-0.7, -0.7, 1.4, 1.4);
  ctx.restore();
}

/**
 * Draws a crisp diagonal glassy specular gloss reflection ribbon across surface facets.
 */
export function drawGlassGlossSheen(ctx, x1, y1, x2, y2, width, alpha = 0.5) {
  if (alpha <= 0.02) return;
  ctx.save();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt((dx) * (dx) + (dy) * (dy)) || 1;
  const nx = -dy / len * (width * 0.5);
  const ny = dx / len * (width * 0.5);

  const grad = ctx.createLinearGradient(x1 + nx, y1 + ny, x1 - nx, y1 - ny);
  grad.addColorStop(0, "rgba(255, 255, 255, 0)");
  grad.addColorStop(0.35, `rgba(224, 242, 254, ${alpha * 0.6})`);
  grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.95})`);
  grad.addColorStop(0.65, `rgba(56, 189, 248, ${alpha * 0.4})`);
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(x1 + nx, y1 + ny);
  ctx.lineTo(x2 + nx, y2 + ny);
  ctx.lineTo(x2 - nx, y2 - ny);
  ctx.lineTo(x1 - nx, y1 - ny);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws subsurface luminous core (spine, ribcage arcs & pulsing heart gem)
 * visible through the translucent glass body shell.
 */
export function drawSubsurfaceLuminousCore(ctx, r, cfg, breathCycle, nowMs, refractionIntensity = 0.85) {
  if (refractionIntensity <= 0.05) return;
  ctx.save();

  const isFront = cfg.view === "front" || cfg.view === "front_diag";
  const isProfile = cfg.view === "side";
  const heartPulse = Math.sin(nowMs * 0.0035) * 0.2 + 0.8;
  const pulseAlpha = heartPulse * refractionIntensity;

  // 1. Arcane Permafrost Heart Gem (Crystalline Core at chest center)
  const heartX = isProfile ? cfg.flip * 4.0 : cfg.flip * 2.0;
  const heartY = -r * 0.22;

  // Heart radial aura
  const heartRadGrd = ctx.createRadialGradient(heartX, heartY, 1, heartX, heartY, 14);
  heartRadGrd.addColorStop(0, `rgba(0, 240, 255, ${0.7 * pulseAlpha})`);
  heartRadGrd.addColorStop(0.45, `rgba(56, 189, 248, ${0.4 * pulseAlpha})`);
  heartRadGrd.addColorStop(1, "rgba(2, 132, 199, 0)");
  ctx.fillStyle = heartRadGrd;
  ctx.beginPath();
  ctx.arc(heartX, heartY, 14, 0, Math.PI * 2);
  ctx.fill();

  // Faceted Inner Heart Diamond
  ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * pulseAlpha})`;
  ctx.beginPath();
  ctx.moveTo(heartX, heartY - 5.5);
  ctx.lineTo(heartX + 4.2, heartY);
  ctx.lineTo(heartX, heartY + 5.5);
  ctx.lineTo(heartX - 4.2, heartY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(0, 240, 255, ${0.95 * pulseAlpha})`;
  ctx.beginPath();
  ctx.moveTo(heartX, heartY - 3.5);
  ctx.lineTo(heartX + 2.5, heartY);
  ctx.lineTo(heartX, heartY + 3.5);
  ctx.lineTo(heartX - 2.5, heartY);
  ctx.closePath();
  ctx.fill();

  // 2. Subsurface Vertebral Spine Nodes
  const spineCount = 5;
  for (let s = -2; s <= 2; s++) {
    const sy = heartY + s * 5.2 + 2.0;
    const sx = isProfile ? -cfg.flip * 5.0 + s * 1.5 : 0;
    const sSize = 2.6 - Math.abs(s) * 0.4;

    // Glowing vertebra node
    ctx.fillStyle = `rgba(0, 240, 255, ${0.65 * refractionIntensity})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy - sSize);
    ctx.lineTo(sx + sSize * 1.3, sy);
    ctx.lineTo(sx, sy + sSize);
    ctx.lineTo(sx - sSize * 1.3, sy);
    ctx.closePath();
    ctx.fill();

    // Node bright white spark
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * refractionIntensity})`;
    ctx.fillRect(sx - 0.7, sy - 0.7, 1.4, 1.4);

    // 3. Subsurface Ribcage Arcs (if facing front or 3/4 front)
    if (isFront && s <= 1) {
      const ribW = (13 - Math.abs(s) * 3) * refractionIntensity;
      const ribGrd = ctx.createLinearGradient(-ribW, sy, ribW, sy);
      ribGrd.addColorStop(0, "rgba(56, 189, 248, 0)");
      ribGrd.addColorStop(0.2, `rgba(0, 240, 255, ${0.45 * refractionIntensity})`);
      ribGrd.addColorStop(0.5, `rgba(224, 242, 254, ${0.6 * refractionIntensity})`);
      ribGrd.addColorStop(0.8, `rgba(0, 240, 255, ${0.45 * refractionIntensity})`);
      ribGrd.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = ribGrd;

      ctx.beginPath();
      ctx.moveTo(-ribW, sy + 1.5);
      ctx.lineTo(0, sy - 1.0);
      ctx.lineTo(ribW, sy + 1.5);
      ctx.lineTo(ribW, sy + 2.6);
      ctx.lineTo(0, sy + 0.2);
      ctx.lineTo(-ribW, sy + 2.6);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 4. Internal Refraction Caustic Shimmer Lines
  for (let c = 0; c < 3; c++) {
    const cPhase = nowMs * 0.002 + c * 2.1;
    const cy = -r * 0.45 + ((cPhase % 1) * r * 0.75);
    const cAlpha = Math.sin((cPhase % 1) * Math.PI) * 0.35 * refractionIntensity;
    if (cAlpha > 0.02) {
      const cGrd = ctx.createLinearGradient(-r * 0.5, cy, r * 0.5, cy + 4);
      cGrd.addColorStop(0, "rgba(255, 255, 255, 0)");
      cGrd.addColorStop(0.5, `rgba(224, 242, 254, ${cAlpha})`);
      cGrd.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = cGrd;

      ctx.beginPath();
      ctx.moveTo(-r * 0.45, cy);
      ctx.lineTo(0, cy + Math.sin(cPhase * 3) * 3);
      ctx.lineTo(r * 0.45, cy);
      ctx.lineTo(r * 0.45, cy + 1.8);
      ctx.lineTo(0, cy + Math.sin(cPhase * 3) * 3 + 1.8);
      ctx.lineTo(-r * 0.45, cy + 1.8);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Helper to classify frost troll variant from type string or entity flags
 */
export function getFrostTrollVariant(type = "frost_troll", ent = {}) {
  const t = (type || ent.type || "frost_troll").toLowerCase();
  const isGlassTroll = t.includes("glass") || t.includes("vitreous");
  const isShaman = t.includes("shaman") || t.includes("mystic") || t.includes("witchdoctor") || t.includes("rimecaller");
  const isWarrior = !isShaman && (t.includes("warrior") || t.includes("armored") || t.includes("iron") || t.includes("guard") || t.includes("vanguard") || t.includes("brute") || t.includes("hunter"));
  const isSnowTroll = !isShaman && !isWarrior && (t.includes("snow") || t.includes("polar") || t.includes("yeti") || t.includes("white"));
  const isTundra = !isShaman && !isWarrior && !isSnowTroll && (t.includes("tundra") || t.includes("mountain") || t.includes("stone") || t.includes("rock") || t.includes("earth"));
  const isCrystal = !isShaman && !isWarrior && (t.includes("crystal") || t.includes("colossus") || t.includes("gem"));
  const isBerserker = !isShaman && !isWarrior && !isCrystal && (t.includes("glacial") || t.includes("berserker") || t.includes("reaver"));
  const isChieftain = !t.includes("spider") && (t.includes("chieftain") || t === "boss_frost_giant" || (t.startsWith("boss_") && (t.includes("giant") || t.includes("jotunn") || t.includes("king") || t.includes("sovereign"))));
  const isJotunn = !t.includes("spider") && !isShaman && !isWarrior && (t.includes("jotunn") || t.includes("giant") || t.includes("titan") || isChieftain);
  const isGlass = isGlassTroll || (ent.forceGlass === true) || (ent.glassEffect === true && !isBerserker && !isJotunn && !isCrystal && !isShaman && !isWarrior && !isSnowTroll && !isTundra && t !== "frost_troll");
  const isAncient = !isGlass && !isJotunn && !isBerserker && !isCrystal && !isShaman && !isWarrior && !isSnowTroll && !isTundra;
  const isBoss = !t.includes("spider") && (t.startsWith("boss_") || isChieftain || isCrystal || isJotunn);

  return {
    isShaman,
    isWarrior,
    isSnowTroll,
    isTundra,
    isCrystal,
    isBerserker,
    isChieftain,
    isJotunn,
    isGlass,
    isAncient,
    isBoss
  };
}

/**
 * Triggers a catastrophic glacial death explosion with shattered permafrost boulder chunks,
 * severed faceted troll limbs, exploding crystalline stalagmites, sub-zero frost vapor clouds,
 * and flying diamond hail motes.
 *
 * @param {Object} ce - Entity state object
 */
export function triggerFrostTrollDeathExplosion(ce) {
  if (!ce || ce._frostTrollExploded) return;
  ce._frostTrollExploded = true;

  const v = getFrostTrollVariant(ce.type, ce);
  const { isGlass, isCrystal, isBerserker, isChieftain, isJotunn, isShaman, isWarrior, isSnowTroll, isTundra, isBoss } = v;

  let primarySkin = "#475569";
  let darkSkin = "#1e293b";
  let iceColor = "#7dd3fc";
  let furColor = "#f8fafc";

  if (isGlass) {
    primarySkin = "rgba(56, 189, 248, 0.75)";
    darkSkin = "rgba(8, 47, 73, 0.85)";
    iceColor = "#e0f2fe";
    furColor = "rgba(224, 242, 254, 0.85)";
  } else if (isShaman) {
    primarySkin = "#6366f1";
    darkSkin = "#312e81";
    iceColor = "#c084fc";
    furColor = "#ddd6fe";
  } else if (isWarrior) {
    primarySkin = "#2563eb";
    darkSkin = "#0f172a";
    iceColor = "#60a5fa";
    furColor = "#cbd5e1";
  } else if (isSnowTroll) {
    primarySkin = "#bae6fd";
    darkSkin = "#0284c7";
    iceColor = "#ffffff";
    furColor = "#ffffff";
  } else if (isTundra) {
    primarySkin = "#475569";
    darkSkin = "#1e293b";
    iceColor = "#84cc16";
    furColor = "#65a30d";
  } else if (isCrystal) {
    primarySkin = "#38bdf8";
    darkSkin = "#0284c7";
    iceColor = "#bae6fd";
    furColor = "#e0f2fe";
  } else if (isBerserker) {
    primarySkin = "#0284c7";
    darkSkin = "#082f49";
    iceColor = "#38bdf8";
    furColor = "#cbd5e1";
  } else if (isChieftain) {
    primarySkin = "#1e40af";
    darkSkin = "#0f172a";
    iceColor = "#bae6fd";
    furColor = "#ffffff";
  } else if (isJotunn) {
    primarySkin = "#334155";
    darkSkin = "#0f172a";
    iceColor = "#7dd3fc";
    furColor = "#94a3b8";
  }

  if (typeof spawnParticle === "function") {
    // 1. Massive Severed Faceted Permafrost Troll Limbs & Angular Glass Segments
    const limbCount = isBoss ? 8 : 5;
    for (let i = 0; i < limbCount; i++) {
      const angle = (i / limbCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const speed = 130 + Math.random() * 160;
      spawnParticle({
        x: ce.x + Math.cos(angle) * 12,
        y: ce.y + Math.sin(angle) * 12 - 10,
        vx: Math.cos(angle) * speed,
        vy: -110 - Math.random() * 150,
        color: i % 2 === 0 ? primarySkin : darkSkin,
        accentColor: iceColor,
        size: isBoss ? 20 + Math.random() * 10 : 14 + Math.random() * 7,
        maxLife: 2.8,
        drag: 0.94,
        style: isGlass ? "glass_shard" : "wolf_leg",
        gravity: 240,
        shrink: true,
      });
    }

    // 2. Shattered Angular Polar Fur Tufts
    const furCount = isBoss ? 8 : 5;
    for (let f = 0; f < furCount; f++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 110;
      spawnParticle({
        x: ce.x + Math.cos(angle) * 8,
        y: ce.y - 18 + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: -90 - Math.random() * 90,
        color: furColor,
        size: isBoss ? 9 : 6,
        maxLife: 2.2,
        drag: 0.92,
        gravity: 130,
        shrink: true,
      });
    }

    // 3. Exploding Prismatic Ice Shards & Diamond Crystals
    const crystalCount = isBoss ? 20 : 12;
    for (let c = 0; c < crystalCount; c++) {
      const angle = (c / crystalCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 150 + Math.random() * 210;
      spawnParticle({
        x: ce.x + Math.cos(angle) * 6,
        y: ce.y - 8 + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: -140 - Math.random() * 140,
        color: c % 3 === 0 ? "#ffffff" : c % 3 === 1 ? "#38bdf8" : "#bae6fd",
        size: isBoss ? 6 + Math.random() * 3 : 3.8 + Math.random() * 2,
        maxLife: 1.8,
        drag: 0.96,
        style: isGlass ? "glass_shard" : "circle",
        gravity: 280,
        shrink: true,
      });
    }

    // 4. Vitreous Razor Glass Shards
    if (isGlass) {
      const glassShardCount = isBoss ? 24 : 14;
      for (let g = 0; g < glassShardCount; g++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 160 + Math.random() * 220;
        spawnParticle({
          x: ce.x + (Math.random() - 0.5) * 14,
          y: ce.y - 10 + (Math.random() - 0.5) * 16,
          vx: Math.cos(angle) * speed,
          vy: -150 - Math.random() * 160,
          color: g % 3 === 0 ? "rgba(255, 255, 255, 0.95)" : g % 3 === 1 ? "rgba(186, 230, 253, 0.85)" : "rgba(56, 189, 248, 0.75)",
          accentColor: "#ffffff",
          size: 6 + Math.random() * 5,
          maxLife: 2.2,
          drag: 0.95,
          style: "glass_shard",
          gravity: 260,
          shrink: true,
        });
      }
    }

    // 5. Sub-Zero Blizzard Frost Mist Shards
    const mistCount = isBoss ? 24 : 14;
    for (let m = 0; m < mistCount; m++) {
      const angle = (m / mistCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const speed = 50 + Math.random() * 120;
      spawnParticle({
        x: ce.x + Math.cos(angle) * 4,
        y: ce.y - 6 + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: -40 - Math.random() * 60,
        color: m % 2 === 0 ? "rgba(224, 242, 254, 0.75)" : "rgba(186, 230, 253, 0.5)",
        size: isBoss ? 12 + Math.random() * 7 : 7 + Math.random() * 5,
        maxLife: 1.4,
        drag: 0.91,
        gravity: -15,
        shrink: true,
      });
    }
  }
}

/**
 * Procedural 8-Directional Angular Chiseled Frost Troll Entity Renderer
 * Fully lineless digital painting: 0 vector strokes, 100% volumetric gradients, rim lighting, and specular glints.
 * - Angular, craggy, faceted permafrost anatomy: hard-edged trapezoidal muscular planes,
 *   chiseled stone pectorals, jagged rock abdomen, faceted blocky knuckles, and jagged polar fur mantle.
 * - ZERO round "circleish" anatomy: no oval collars, no round ball fists, no rounded balloon torsos.
 * - 8-Directional Octagonal Matrix (E, SE, S, SW, W, NW, N, NE) with 5 distinct view perspectives
 * - Dual-arm knuckle stance with dynamic depth sorting (Z-ordering)
 * - Digitigrade knuckle-walking gait with footstep frost kick-up kinetics
 * - 4-Phase Glacial Slam combat animation with faceted ground crevasses and erupting 3D crystalline ice stalagmites
 * - Channeled Blizzard Roar / Frost Breath ability with diamond hail shards
 * - Rich variants: Ancient Frost Troll, Glacial Berserker (Faceted Ice Pauldron & Monolithic Permafrost Maul),
 *   Jotunn Frost Giant Chieftain (Prismatic Glacial Crown & Blizzard Aura), Crystalline Frost Colossus
 * - Invariant spatial weak point mapping (head at Y ≈ -9px on base r=26)
 */
export function drawFrostTrollEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};
  const type = (ent.type || "frost_troll").toLowerCase();
  const isSlowed = !!ent.isSlowed;
  const facingAngle = ent.facingAngle || 0;
  const moving = !!(ent.moving || ent.isMoving);

  if (ent._seed === undefined) {
    const id = ent.id || ("troll_" + Math.round(x) + "_" + Math.round(y));
    ent._seed = typeof computeFastSeed === "function" ? computeFastSeed(id) : 42;
  }
  const seed = ent._seed;

  // Variant Detection
  const v = getFrostTrollVariant(type, ent);
  const {
    isShaman,
    isWarrior,
    isSnowTroll,
    isTundra,
    isCrystal,
    isBerserker,
    isChieftain,
    isJotunn,
    isGlass,
    isAncient,
    isBoss
  } = v;

  const glassRefraction = typeof ent.glassRefraction === "number" ? Math.max(0.1, Math.min(1.0, ent.glassRefraction)) : 0.85;

  const scale = isChieftain ? 2.35 : isJotunn ? 2.15 : isBoss ? 1.85 : isCrystal ? 1.55 : isWarrior ? 1.35 : isTundra ? 1.30 : isBerserker ? 1.25 : isSnowTroll ? 1.20 : isShaman ? 1.12 : isAncient ? 1.10 : 1.05;
  const r = 26;

  // Attack and Ability States
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  let isBreathingFrost = !!(ent.isBreathingFrost || ent.roarActive || (ent.currentCast && ent.currentCast.name === "blizzard_roar"));

  if (!isAttacking && typeof GameState !== "undefined" && GameState.combatAnimations && ent && ent.id) {
    for (let i = 0; i < GameState.combatAnimations.length; i++) {
      const anim = GameState.combatAnimations[i];
      const dur = anim.duration || anim.durationMs || 480;
      if (anim.attackerId === ent.id && nowMs - anim.createdAt < dur) {
        isAttacking = true;
        break;
      }
    }
  }

  // Hit Flash
  const isHitFlashing = ent.lastHitTime && (nowMs - ent.lastHitTime < 180);

  // -------------------------------------------------------------
  // 8-Direction Mathematical Sector Mapping
  // -------------------------------------------------------------
  const normAngle = ((facingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dirIndex = Math.floor(((normAngle + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));

  // Anatomical Octagonal Matrix with Dynamic Z-Depth Sorting
  const octagonalMatrix = [
    // 0: East (E) - Side Profile facing Right
    {
      dir: "E", view: "side", flip: 1, tilt: 0.12,
      headX: 8.0, headY: -8.5,
      rightArmX: -5.0, rightArmY: 2.0, rightArmFront: false,
      leftArmX: 9.5, leftArmY: 6.5, leftArmFront: true,
      hindLegNearX: -3.0, hindLegFarX: -14.0
    },
    // 1: South-East (SE) - 3/4 Front facing Down-Right
    {
      dir: "SE", view: "front_diag", flip: 1, tilt: 0.06,
      headX: 5.5, headY: -9.2,
      rightArmX: -14.0, rightArmY: 4.5, rightArmFront: false,
      leftArmX: 16.0, leftArmY: 7.5, leftArmFront: true,
      hindLegNearX: 8.5, hindLegFarX: -11.0
    },
    // 2: South (S) - Direct Front facing Camera
    {
      dir: "S", view: "front", flip: 1, tilt: 0.00,
      headX: 0.0, headY: -9.5,
      rightArmX: -18.0, rightArmY: 6.5, rightArmFront: true,
      leftArmX: 18.0, leftArmY: 6.5, leftArmFront: true,
      hindLegNearX: 13.0, hindLegFarX: -13.0
    },
    // 3: South-West (SW) - 3/4 Front facing Down-Left
    {
      dir: "SW", view: "front_diag", flip: -1, tilt: -0.06,
      headX: -5.5, headY: -9.2,
      rightArmX: -16.0, rightArmY: 7.5, rightArmFront: true,
      leftArmX: 14.0, leftArmY: 4.5, leftArmFront: false,
      hindLegNearX: -8.5, hindLegFarX: 11.0
    },
    // 4: West (W) - Side Profile facing Left
    {
      dir: "W", view: "side", flip: -1, tilt: -0.12,
      headX: -8.0, headY: -8.5,
      rightArmX: -9.5, rightArmY: 6.5, rightArmFront: true,
      leftArmX: 5.0, leftArmY: 2.0, leftArmFront: false,
      hindLegNearX: 3.0, hindLegFarX: 14.0
    },
    // 5: North-West (NW) - 3/4 Back facing Up-Left
    {
      dir: "NW", view: "back_diag", flip: -1, tilt: -0.06,
      headX: -4.5, headY: -11.0,
      rightArmX: -16.0, rightArmY: 3.0, rightArmFront: true,
      leftArmX: 11.5, leftArmY: 0.5, leftArmFront: false,
      hindLegNearX: -11.0, hindLegFarX: 8.5
    },
    // 6: North (N) - Direct Back facing Up
    {
      dir: "N", view: "back", flip: 1, tilt: 0.00,
      headX: 0.0, headY: -11.5,
      rightArmX: -17.0, rightArmY: 2.5, rightArmFront: false,
      leftArmX: 17.0, leftArmY: 2.5, leftArmFront: false,
      hindLegNearX: 12.0, hindLegFarX: -12.0
    },
    // 7: North-East (NE) - 3/4 Back facing Up-Right
    {
      dir: "NE", view: "back_diag", flip: 1, tilt: 0.06,
      headX: 4.5, headY: -11.0,
      rightArmX: -11.5, rightArmY: 0.5, rightArmFront: false,
      leftArmX: 16.0, leftArmY: 3.0, leftArmFront: true,
      hindLegNearX: 11.0, hindLegFarX: -8.5
    }
  ];

  const cfg = octagonalMatrix[dirIndex] || octagonalMatrix[2];
  const isBackView = cfg.view === "back" || cfg.view === "back_diag";
  const isFrontView = cfg.view === "front" || cfg.view === "front_diag";
  const isProfileView = cfg.view === "side";

  // -------------------------------------------------------------
  // Cohesive Animation Kinetics (Breathing, Knuckle-Walk, Glacial Slam)
  // -------------------------------------------------------------
  const speedFactor = isSlowed ? 0.5 : 1.0;
  const walkSpeedMult = 0.0075;
  const walkPhase = (nowMs * walkSpeedMult * speedFactor + seed) % (Math.PI * 2);
  const breathCycle = Math.sin(nowMs * 0.0035 + seed) * 1.5;

  const bounce = moving ? Math.abs(Math.sin(walkPhase)) * 3.4 : breathCycle;
  const strideSwing = moving ? Math.sin(walkPhase) * 6.5 : 0;
  const torsoSway = moving ? Math.cos(walkPhase) * 0.05 : 0;

  // 4-Phase Glacial Slam Progress
  let attackProgress = 0;
  let attackDuration = 480;
  if (isAttacking) {
    let animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
    if (ent.currentCast && ent.currentCast.duration) {
      attackDuration = ent.currentCast.duration;
      animStart = ent.currentCast.startTime || animStart;
    }
    attackProgress = Math.min(1.0, Math.max(0, (nowMs - animStart) / attackDuration));
  }

  // Directional Attack Lunge Vector & Squash/Stretch
  let lungeX = 0;
  let lungeY = 0;
  let squashX = 1;
  let squashY = 1;
  const atkDirX = Math.cos(facingAngle);
  const atkDirY = Math.sin(facingAngle);

  if (moving) {
    squashY = 1 - Math.abs(Math.sin(walkPhase)) * 0.07;
    squashX = 1 + Math.abs(Math.sin(walkPhase)) * 0.05;
  }

  if (isAttacking && attackProgress > 0) {
    if (attackProgress < 0.28) {
      const t = attackProgress / 0.28;
      squashY = 1 - t * 0.18;
      squashX = 1 + t * 0.12;
      lungeX = -atkDirX * t * 4.2;
      lungeY = -atkDirY * t * 4.2;
    } else if (attackProgress < 0.65) {
      const t = (attackProgress - 0.28) / 0.37;
      const stretch = Math.sin(t * Math.PI);
      squashY = 1 + stretch * 0.24;
      squashX = 1 - stretch * 0.12;
      lungeX = atkDirX * stretch * 12.0;
      lungeY = atkDirY * stretch * 8.5;
    } else {
      const t = (attackProgress - 0.65) / 0.35;
      squashY = 1 - (1 - t) * 0.08;
      squashX = 1 + (1 - t) * 0.05;
    }
  }

  // -------------------------------------------------------------
  // Palette Definition by Variant, Glass Effect & Hit Flash
  // -------------------------------------------------------------
  let skinLit, skinMid, skinShadow, skinOcclusion, rockFacet, runeColor, furLit, furMid, furDark;

  if (isHitFlashing) {
    skinLit = "#ffffff";
    skinMid = "#bae6fd";
    skinShadow = "#7dd3fc";
    skinOcclusion = "#0284c7";
    rockFacet = "#ffffff";
    runeColor = "#ffffff";
    furLit = "#ffffff";
    furMid = "#e2e8f0";
    furDark = "#cbd5e1";
  } else if (isGlass) {
    skinLit = `rgba(224, 242, 254, ${0.72 + 0.18 * (1 - glassRefraction)})`;
    skinMid = `rgba(56, 189, 248, ${0.52 + 0.28 * (1 - glassRefraction)})`;
    skinShadow = `rgba(2, 132, 199, ${0.68 + 0.22 * (1 - glassRefraction)})`;
    skinOcclusion = `rgba(8, 47, 73, ${0.82 + 0.15 * (1 - glassRefraction)})`;
    rockFacet = `rgba(255, 255, 255, ${0.85 * glassRefraction})`;
    runeColor = "#00f0ff";
    furLit = "rgba(255, 255, 255, 0.9)";
    furMid = "rgba(224, 242, 254, 0.75)";
    furDark = "rgba(56, 189, 248, 0.5)";
  } else if (isShaman) {
    // Frost Shaman: Mystical abyssal indigo, glowing purple and aurora cyan
    skinLit = "#c7d2fe";
    skinMid = "#6366f1";
    skinShadow = "#3730a3";
    skinOcclusion = "#1e1b4b";
    rockFacet = "#e0e7ff";
    runeColor = "#c084fc";
    furLit = "#ddd6fe";
    furMid = "#4f46e5";
    furDark = "#1e1b4b";
  } else if (isWarrior) {
    // Armored Frost Vanguard: Chilled navy and blackened forged steel
    skinLit = "#93c5fd";
    skinMid = "#2563eb";
    skinShadow = "#1e3a8a";
    skinOcclusion = "#090d16";
    rockFacet = "#cbd5e1";
    runeColor = "#60a5fa";
    furLit = "#e2e8f0";
    furMid = "#475569";
    furDark = "#1e293b";
  } else if (isSnowTroll) {
    // Polar Snow Troll / Yeti: Stark arctic pale cyan flesh with pristine snowy white fur
    skinLit = "#f0f9ff";
    skinMid = "#bae6fd";
    skinShadow = "#38bdf8";
    skinOcclusion = "#0369a1";
    rockFacet = "#ffffff";
    runeColor = "#0284c7";
    furLit = "#ffffff";
    furMid = "#f8fafc";
    furDark = "#cbd5e1";
  } else if (isTundra) {
    // Mountain / Tundra Troll: Earthy granite stone and alpine lichen moss
    skinLit = "#a3e635";
    skinMid = "#475569";
    skinShadow = "#1e293b";
    skinOcclusion = "#0f172a";
    rockFacet = "#84cc16";
    runeColor = "#a3e635";
    furLit = "#d9f99d";
    furMid = "#65a30d";
    furDark = "#365314";
  } else if (isCrystal) {
    // Crystalline Frost Colossus: Radiant sapphire and aquamarine facets
    skinLit = "#bae6fd";
    skinMid = "#38bdf8";
    skinShadow = "#0284c7";
    skinOcclusion = "#0c4a6e";
    rockFacet = "#e0f2fe";
    runeColor = "#00f0ff";
    furLit = "#ffffff";
    furMid = "#bae6fd";
    furDark = "#38bdf8";
  } else if (isBerserker) {
    // Glacial Berserker: Cobalt war-tone and dark arctic navy
    skinLit = "#38bdf8";
    skinMid = "#0284c7";
    skinShadow = "#075985";
    skinOcclusion = "#082f49";
    rockFacet = "#1e3a8a";
    runeColor = "#00f0ff";
    furLit = "#f1f5f9";
    furMid = "#94a3b8";
    furDark = "#334155";
  } else if (isChieftain) {
    // Jotunn Chieftain: Majestic royal abyssal sapphire-slate
    skinLit = "#bae6fd";
    skinMid = "#2563eb";
    skinShadow = "#1e3a8a";
    skinOcclusion = "#0f172a";
    rockFacet = "#bfdbfe";
    runeColor = "#00f0ff";
    furLit = "#ffffff";
    furMid = "#f1f5f9";
    furDark = "#334155";
  } else if (isJotunn) {
    // Jotunn Frost Giant: Ancient primordial granite-slate and tundra rock
    skinLit = "#7dd3fc";
    skinMid = "#334155";
    skinShadow = "#1e293b";
    skinOcclusion = "#0f172a";
    rockFacet = "#94a3b8";
    runeColor = "#38bdf8";
    furLit = "#e2e8f0";
    furMid = "#94a3b8";
    furDark = "#475569";
  } else {
    // Ancient Frost Troll: Rugged craggy permafrost stone and shaggy polar fur
    skinLit = "#94a3b8";
    skinMid = "#475569";
    skinShadow = "#1e293b";
    skinOcclusion = "#0f172a";
    rockFacet = "#cbd5e1";
    runeColor = "#38bdf8";
    furLit = "#ffffff";
    furMid = "#e2e8f0";
    furDark = "#94a3b8";
  }

  // -------------------------------------------------------------
  // Root Transformation
  // -------------------------------------------------------------
  ctx.save();
  ctx.translate(x + lungeX, y + lungeY - bounce * scale);
  ctx.scale(scale * squashX, scale * squashY);

  // -------------------------------------------------------------
  // Variant Atmospheric & Ground Auras (Blizzard Vortex / Resonating Crystal Hex)
  // -------------------------------------------------------------
  if (isChieftain) {
    ctx.save();
    // Swirling blizzard ground wind arcs & drifting snow flurries around feet
    const vortexRadius = 32;
    for (let v = 0; v < 3; v++) {
      const vAng = (nowMs * 0.0025 + v * (Math.PI * 2 / 3)) % (Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, 0.45)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 15, vortexRadius + v * 4, (vortexRadius + v * 4) * 0.45, 0, vAng, vAng + Math.PI * 0.7);
      ctx.stroke();
    }
    for (let f = 0; f < 6; f++) {
      const fProg = (nowMs * 0.003 + f * 1.05) % (Math.PI * 2);
      const fx = Math.cos(fProg) * (26 + Math.sin(fProg * 2) * 6);
      const fy = 15 + Math.sin(fProg) * 10;
      ctx.fillStyle = "rgba(224, 242, 254, 0.75)";
      ctx.fillRect(fx - 1, fy - 1, 2, 2);
    }
    ctx.restore();
  } else if (isCrystal) {
    ctx.save();
    // Resonating Crystal Hexagon Ground Matrix
    const hexRadius = 24;
    const hexPulse = Math.sin(nowMs * 0.004) * 0.2 + 0.6;
    ctx.strokeStyle = `rgba(0, 240, 255, ${hexPulse * 0.5})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let h = 0; h < 6; h++) {
      const hang = (h / 6) * Math.PI * 2;
      const hx = Math.cos(hang) * hexRadius;
      const hy = 15 + Math.sin(hang) * (hexRadius * 0.45);
      if (h === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  } else if (isShaman) {
    ctx.save();
    // Arcane Frost Ritual Circle on ground
    const rituRad = 22;
    const rituPulse = Math.sin(nowMs * 0.003) * 0.2 + 0.7;
    ctx.strokeStyle = `rgba(168, 85, 247, ${rituPulse * 0.55})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(0, 15, rituRad, rituRad * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating 4 arcane rune sparks
    for (let rk = 0; rk < 4; rk++) {
      const rAng = (nowMs * 0.002 + rk * (Math.PI / 2)) % (Math.PI * 2);
      const rx = Math.cos(rAng) * rituRad;
      const ry = 15 + Math.sin(rAng) * (rituRad * 0.42);
      ctx.fillStyle = rk % 2 === 0 ? "#c084fc" : "#00f0ff";
      ctx.fillRect(rx - 1.2, ry - 1.2, 2.4, 2.4);
    }
    ctx.restore();
  } else if (isSnowTroll) {
    ctx.save();
    // Swirling polar blizzard snow flurry drifts around feet
    for (let sf = 0; sf < 5; sf++) {
      const sPhase = (nowMs * 0.003 + sf * 1.25) % (Math.PI * 2);
      const sx = Math.cos(sPhase) * (20 + Math.sin(sPhase * 2) * 5);
      const sy = 15 + Math.sin(sPhase) * 7;
      ctx.fillStyle = sf % 2 === 0 ? "rgba(255, 255, 255, 0.85)" : "rgba(186, 230, 253, 0.65)";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 1.8);
      ctx.lineTo(sx + 1.8, sy);
      ctx.lineTo(sx, sy + 1.8);
      ctx.lineTo(sx - 1.8, sy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (isTundra) {
    ctx.save();
    // Earthy moss spores and pebble debris around feet
    for (let mb = 0; mb < 4; mb++) {
      const mPhase = (nowMs * 0.002 + mb * 1.5) % (Math.PI * 2);
      const mx = Math.cos(mPhase) * 22;
      const my = 15 + Math.sin(mPhase) * 8;
      ctx.fillStyle = mb % 2 === 0 ? "#84cc16" : "#64748b";
      ctx.fillRect(mx - 1.2, my - 1.2, 2.4, 2.4);
    }
    ctx.restore();
  } else if (isWarrior) {
    ctx.save();
    // Frost steel vapors & sparks around heavy boots
    for (let ws = 0; ws < 4; ws++) {
      const wPhase = (nowMs * 0.0035 + ws * 1.4) % (Math.PI * 2);
      const wx = Math.cos(wPhase) * 20;
      const wy = 15 + Math.sin(wPhase) * 6;
      ctx.fillStyle = ws % 2 === 0 ? "#60a5fa" : "#ffffff";
      ctx.fillRect(wx - 1, wy - 1, 2, 2);
    }
    ctx.restore();
  }

  // Orbiting Floating Crystal Shards Helper (for Crystalline Colossus)
  const drawOrbitingCrystals = (isFrontPass) => {
    if (!isCrystal) return;
    for (let i = 0; i < 4; i++) {
      const orbitAng = (nowMs * 0.0022 + i * (Math.PI / 2)) % (Math.PI * 2);
      const inFront = Math.sin(orbitAng) >= 0;
      if (inFront !== isFrontPass) continue;
      const ox = Math.cos(orbitAng) * 28;
      const oy = -r * 0.25 + Math.sin(orbitAng) * 10;
      const shardRot = orbitAng * 1.5;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(shardRot);
      // Faceted 3D diamond shard
      ctx.fillStyle = "#bae6fd";
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(3.2, 0);
      ctx.lineTo(0, 5.5);
      ctx.lineTo(-3.2, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(3.2, 0);
      ctx.lineTo(0, 1.2);
      ctx.closePath();
      ctx.fill();

      drawPrismaticStarGlint(ctx, 0, -5.5, 3.0, 0.8, 0);
      ctx.restore();
    }
  };

  // -------------------------------------------------------------
  // Footstep Frost Crack Kick-up Kinetics (Walking)
  // -------------------------------------------------------------
  if (moving) {
    const puffCycle = (walkPhase * 2) % (Math.PI * 2);
    const puffAlpha = Math.max(0, Math.sin(puffCycle)) * 0.42;
    if (puffAlpha > 0.05) {
      ctx.save();
      const puffX = -atkDirX * 12 + Math.sin(walkPhase) * 6;
      const puffY = 15 - atkDirY * 4;
      // Angular crystalline frost kick-up shards (no soft circles)
      ctx.fillStyle = `rgba(224, 242, 254, ${puffAlpha})`;
      ctx.beginPath();
      ctx.moveTo(puffX, puffY - 4);
      ctx.lineTo(puffX + 3.5, puffY);
      ctx.lineTo(puffX, puffY + 3.5);
      ctx.lineTo(puffX - 3.5, puffY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(56, 189, 248, ${puffAlpha * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(puffX + 4, puffY - 2);
      ctx.lineTo(puffX + 7, puffY + 1);
      ctx.lineTo(puffX + 3, puffY + 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // -------------------------------------------------------------
  // Glacial Slam Ground Rupture & Shockwave Kinetics
  // -------------------------------------------------------------
  if (isAttacking && attackProgress >= 0.35 && attackProgress <= 0.85) {
    const slamP = (attackProgress - 0.35) / 0.50;
    const slamAlpha = Math.sin(slamP * Math.PI);
    const slamDist = 18 + slamP * 16;
    const impactX = atkDirX * slamDist;
    const impactY = 14 + atkDirY * (slamDist * 0.5);

    ctx.save();
    // 1. Angular Polygonal Permafrost Shockwave Plate (Octagonal Shatter)
    const ringRadius = 14 + slamP * 32;
    ctx.fillStyle = `rgba(56, 189, 248, ${slamAlpha * 0.4})`;
    ctx.beginPath();
    for (let o = 0; o < 8; o++) {
      const oAng = (o / 8) * Math.PI * 2;
      const ox = impactX + Math.cos(oAng) * (ringRadius * 1.25);
      const oy = impactY + Math.sin(oAng) * (ringRadius * 0.6);
      if (o === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.closePath();
    ctx.fill();

    // 2. Jagged Ground Frost Fissures (Lineless Angular Chisel Crevasses)
    for (let f = -2; f <= 2; f++) {
      const fAng = facingAngle + (f * 0.34);
      const fLen = (13 + Math.abs(f) * 6) * slamP;
      const fx = impactX + Math.cos(fAng) * fLen;
      const fy = impactY + Math.sin(fAng) * (fLen * 0.5);
      const midx = (impactX + fx) * 0.5 + Math.sin(f * 2) * 2;
      const midy = (impactY + fy) * 0.5;

      const crackGrd = ctx.createLinearGradient(impactX, impactY, fx, fy);
      crackGrd.addColorStop(0, `rgba(0, 240, 255, ${slamAlpha * 0.85})`);
      crackGrd.addColorStop(0.5, `rgba(56, 189, 248, ${slamAlpha * 0.6})`);
      crackGrd.addColorStop(1, "rgba(8, 47, 73, 0)");
      ctx.fillStyle = crackGrd;

      ctx.beginPath();
      ctx.moveTo(impactX - 1.8, impactY);
      ctx.lineTo(midx, midy - 2);
      ctx.lineTo(fx, fy - 1.2);
      ctx.lineTo(midx + 1.5, midy + 1);
      ctx.lineTo(impactX + 1.8, impactY);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Erupting 3D Glacial Rupture Spikes (Faceted Diamond Stalagmites)
    const spikeCount = 5;
    for (let s = 0; s < spikeCount; s++) {
      const sOffset = (s - 2) * 8.5;
      const sHeight = (15 + Math.sin(s * 1.5) * 8) * Math.sin(slamP * Math.PI);
      const sx = impactX + Math.cos(facingAngle + Math.PI / 2) * sOffset + atkDirX * (s * 3);
      const sy = impactY + Math.sin(facingAngle + Math.PI / 2) * (sOffset * 0.4);

      if (sHeight > 2) {
        // Facet Left
        const spikeLeftGrd = ctx.createLinearGradient(sx - 4, sy, sx, sy - sHeight);
        spikeLeftGrd.addColorStop(0, "#082f49");
        spikeLeftGrd.addColorStop(0.5, "#0284c7");
        spikeLeftGrd.addColorStop(1, "#bae6fd");
        ctx.fillStyle = spikeLeftGrd;
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy);
        ctx.lineTo(sx, sy - sHeight);
        ctx.lineTo(sx, sy);
        ctx.closePath();
        ctx.fill();

        // Facet Right (lit)
        const spikeRightGrd = ctx.createLinearGradient(sx, sy, sx + 4, sy - sHeight);
        spikeRightGrd.addColorStop(0, "#0284c7");
        spikeRightGrd.addColorStop(0.4, "#38bdf8");
        spikeRightGrd.addColorStop(1, "#ffffff");
        ctx.fillStyle = spikeRightGrd;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy - sHeight);
        ctx.lineTo(sx + 4, sy);
        ctx.closePath();
        ctx.fill();

        // Prismatic diamond glint at the tip
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(sx, sy - sHeight - 2);
        ctx.lineTo(sx + 1.5, sy - sHeight);
        ctx.lineTo(sx, sy - sHeight + 1.5);
        ctx.lineTo(sx - 1.5, sy - sHeight);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // Channeled Blizzard Roar / Frost Breath Cone
  // -------------------------------------------------------------
  if (isBreathingFrost) {
    ctx.save();
    const breathHeadX = cfg.headX * scale;
    const breathHeadY = (cfg.headY + 6.0) * scale;

    for (let c = 0; c < 4; c++) {
      const cDist = 20 + c * 22;
      const cWidth = 12 + c * 15;
      const coneX = breathHeadX + atkDirX * cDist;
      const coneY = breathHeadY + atkDirY * cDist;

      // Angular diamond frost burst (not soft blur circles)
      const breathGrd = ctx.createLinearGradient(coneX - cWidth, coneY, coneX + cWidth, coneY);
      breathGrd.addColorStop(0, "rgba(8, 47, 73, 0)");
      breathGrd.addColorStop(0.3, "rgba(56, 189, 248, 0.4)");
      breathGrd.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
      breathGrd.addColorStop(0.7, "rgba(56, 189, 248, 0.4)");
      breathGrd.addColorStop(1, "rgba(8, 47, 73, 0)");
      ctx.fillStyle = breathGrd;

      ctx.beginPath();
      ctx.moveTo(coneX, coneY - cWidth * 0.75);
      ctx.lineTo(coneX + cWidth, coneY);
      ctx.lineTo(coneX, coneY + cWidth * 0.75);
      ctx.lineTo(coneX - cWidth, coneY);
      ctx.closePath();
      ctx.fill();
    }

    // Flying Diamond Hail Crystals in Breath Stream
    for (let h = 0; h < 6; h++) {
      const hProg = ((nowMs * 0.006 + h * 0.18) % 1.0);
      const hDist = 12 + hProg * 75;
      const hSpread = Math.sin(nowMs * 0.01 + h) * (hDist * 0.28);
      const hx = breathHeadX + atkDirX * hDist - atkDirY * hSpread;
      const hy = breathHeadY + atkDirY * hDist + atkDirX * hSpread;
      const sz = 1.4 + hProg * 1.6;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(hx, hy - sz);
      ctx.lineTo(hx + sz, hy);
      ctx.lineTo(hx, hy + sz);
      ctx.lineTo(hx - sz, hy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // Leg Drawing Helper (Digitigrade Chiseled Craggy Limbs - ENLARGED)
  // -------------------------------------------------------------
  const drawLeg = (footX, footY, isNearLeg, isFacingBack) => {
    ctx.save();
    const legGrd = ctx.createLinearGradient(footX - 12, footY - 26, footX + 12, footY + 4);
    if (isNearLeg) {
      legGrd.addColorStop(0, skinLit);
      legGrd.addColorStop(0.45, skinMid);
      legGrd.addColorStop(1, skinOcclusion);
    } else {
      legGrd.addColorStop(0, skinMid);
      legGrd.addColorStop(0.55, skinShadow);
      legGrd.addColorStop(1, "#04192b");
    }
    ctx.fillStyle = legGrd;

    // Muscular Angular Thigh & Calf (Elongated, Powerful Polygonal Planes)
    ctx.beginPath();
    ctx.moveTo(footX - 7.5, footY - 26);                       // Upper hip connection
    ctx.lineTo(footX - (isNearLeg ? 11.5 : 9.5), footY - 14); // Massive quad peak
    ctx.lineTo(footX - (isNearLeg ? 10.5 : 8.5), footY - 8);  // Hamstring flare
    ctx.lineTo(footX - 6.0, footY - 2);                       // Outer shin transition
    ctx.lineTo(footX + 6.0, footY - 2);                       // Inner shin base
    ctx.lineTo(footX + (isNearLeg ? 9.5 : 7.5), footY - 8);   // Medial calf / gastrocnemius bulge
    ctx.lineTo(footX + (isNearLeg ? 10.5 : 8.5), footY - 15); // Inner thigh
    ctx.lineTo(footX + 7.5, footY - 26);                       // Inner hip connection
    ctx.closePath();
    ctx.fill();

    // Quadriceps Muscle Facet Highlight (Volumetric Planar Chisel)
    if (isNearLeg) {
      ctx.fillStyle = "rgba(224, 242, 254, 0.35)";
      ctx.beginPath();
      ctx.moveTo(footX - 1.5, footY - 24);
      ctx.lineTo(footX - 7.0, footY - 14);
      ctx.lineTo(footX - 3.0, footY - 8);
      ctx.lineTo(footX + 3.0, footY - 14);
      ctx.closePath();
      ctx.fill();
    }

    // Prominent Chiseled Diamond/Hexagonal Knee Patella Plate (Heavy Armor Joint)
    if (isNearLeg) {
      const kneeGrd = ctx.createLinearGradient(footX, footY - 14, footX, footY - 6);
      kneeGrd.addColorStop(0, "#e0f2fe");
      kneeGrd.addColorStop(1, skinMid);
      ctx.fillStyle = kneeGrd;
      ctx.beginPath();
      ctx.moveTo(footX, footY - 13.5);
      ctx.lineTo(footX + 4.2, footY - 9.5);
      ctx.lineTo(footX + 2.8, footY - 6.0);
      ctx.lineTo(footX - 2.8, footY - 6.0);
      ctx.lineTo(footX - 4.2, footY - 9.5);
      ctx.closePath();
      ctx.fill();

      // Sharp Specular Knee Edge
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(footX, footY - 13.0);
      ctx.lineTo(footX + 3.2, footY - 9.5);
      ctx.lineTo(footX, footY - 9.0);
      ctx.closePath();
      ctx.fill();
    }

    // Heavy Blocky Permafrost Paw Base (Angular Chiseled Metatarsal)
    ctx.fillStyle = isNearLeg ? skinOcclusion : "#04192b";
    ctx.beginPath();
    ctx.moveTo(footX - 7.5, footY - 2);
    ctx.lineTo(footX + 7.5, footY - 2);
    ctx.lineTo(footX + 9.0, footY + 4.0);
    ctx.lineTo(footX - 9.0, footY + 4.0);
    ctx.closePath();
    ctx.fill();

    // 3 Sharp Splayed Stone Claws (Elongated Triangular Dagger Talons)
    const clawColor = isNearLeg ? skinMid : skinShadow;
    ctx.fillStyle = clawColor;
    for (let c = -1; c <= 1; c++) {
      const cx = footX + c * 4.6;
      const cy = footY + (isFacingBack ? -1.0 : 3.5);
      const clawLen = isFacingBack ? -4.5 : 5.8;

      // Faceted Claw Body
      ctx.beginPath();
      ctx.moveTo(cx - 2.0, cy - 0.5);
      ctx.lineTo(cx, cy + clawLen);
      ctx.lineTo(cx + 2.0, cy - 0.5);
      ctx.closePath();
      ctx.fill();

      // Sharp Specular Ridge
      if (isNearLeg) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + clawLen * 0.88);
        ctx.lineTo(cx + 0.8, cy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = clawColor;
      }
    }

    // Glass Visual Effect: Glossy Specular Sheen Ribbons & Diamond Knee Glints
    if (isGlass) {
      drawGlassGlossSheen(ctx, footX - 4, footY - 24, footX - 2, footY - 10, 4.0, 0.55 * glassRefraction);
      drawGlassGlossSheen(ctx, footX - 1, footY - 8, footX + 1, footY + 1, 3.0, 0.45 * glassRefraction);
      if (isNearLeg) {
        ctx.fillStyle = `rgba(0, 240, 255, ${0.75 * glassRefraction})`;
        ctx.fillRect(footX - 3.8, footY - 10.0, 7.6, 1.0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(footX - 2.5, footY - 10.5, 5.0, 0.8);
        const kneeGlintPhase = (nowMs * 0.003 + (isFacingBack ? 1.5 : 0)) % (Math.PI * 2);
        const glintA = Math.max(0, Math.sin(kneeGlintPhase) - 0.45) * 1.8;
        if (glintA > 0.05) {
          drawPrismaticStarGlint(ctx, footX, footY - 9.5, 4.8, glintA * glassRefraction, 0.25);
        }
      }
    }
    ctx.restore();
  };

  // -------------------------------------------------------------
  // Weapon Drawing Helper (Colossal Monolithic Glacial Stalagmite Maul)
  // -------------------------------------------------------------
  const drawFrozenMaul = (fistY) => {
    ctx.save();
    ctx.translate(0, fistY);

    // Maul Shaft (Faceted Permafrost Timber Monolith)
    const shaftGrd = ctx.createLinearGradient(-3.5, -24, 3.5, 16);
    shaftGrd.addColorStop(0, "#082f49");
    shaftGrd.addColorStop(0.4, "#0f172a");
    shaftGrd.addColorStop(1, "#1e293b");
    ctx.fillStyle = shaftGrd;
    ctx.beginPath();
    ctx.moveTo(-3.0, -24);
    ctx.lineTo(3.0, -24);
    ctx.lineTo(2.4, 16);
    ctx.lineTo(-2.4, 16);
    ctx.closePath();
    ctx.fill();

    // Maul Wrappings (Chiseled Leather Bands)
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(-2.8, -4);
    ctx.lineTo(2.8, -2);
    ctx.lineTo(2.8, 1);
    ctx.lineTo(-2.8, -1);
    ctx.closePath();
    ctx.fill();

    // Giant Spiked Faceted Glacial Stalagmite Hammer Head (Chiseled Polygonal Monolith)
    // Left Shadow Facet
    const headLeftGrd = ctx.createLinearGradient(-15, -30, 0, -10);
    headLeftGrd.addColorStop(0, "#082f49");
    headLeftGrd.addColorStop(0.6, "#0284c7");
    headLeftGrd.addColorStop(1, "#0369a1");
    ctx.fillStyle = headLeftGrd;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(-15, -24);
    ctx.lineTo(-12, -10);
    ctx.lineTo(0, -14);
    ctx.closePath();
    ctx.fill();

    // Right Lit Facet
    const headRightGrd = ctx.createLinearGradient(0, -32, 15, -10);
    headRightGrd.addColorStop(0, "#ffffff");
    headRightGrd.addColorStop(0.35, "#38bdf8");
    headRightGrd.addColorStop(1, "#0284c7");
    ctx.fillStyle = headRightGrd;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(15, -24);
    ctx.lineTo(12, -10);
    ctx.lineTo(0, -14);
    ctx.closePath();
    ctx.fill();

    // Center Chiseled Ridge Specular Highlight
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(1.4, -20);
    ctx.lineTo(0, -14);
    ctx.lineTo(-0.8, -20);
    ctx.closePath();
    ctx.fill();

    // Runic Angular Frost Inscription on Hammer (Sharp Elder Futhark Glyph)
    ctx.fillStyle = "rgba(0, 240, 255, 0.95)";
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(3.5, -20);
    ctx.lineTo(0, -15);
    ctx.lineTo(-3.5, -20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(1.5, -20);
    ctx.lineTo(0, -18);
    ctx.lineTo(-1.5, -20);
    ctx.closePath();
    ctx.fill();

    // Lateral Faceted Stalactite Ice Spikes
    for (let sp = -1; sp <= 1; sp += 2) {
      const spikeX = sp * 14;
      const spikeTipX = sp * 22;
      ctx.fillStyle = sp > 0 ? "#e0f2fe" : "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(spikeX, -22);
      ctx.lineTo(spikeTipX, -18);
      ctx.lineTo(spikeX, -13);
      ctx.closePath();
      ctx.fill();

      // Specular Needle Tip
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(spikeTipX - sp * 1.5, -18.5);
      ctx.lineTo(spikeTipX, -18);
      ctx.lineTo(spikeTipX - sp * 1.5, -17.5);
      ctx.closePath();
      ctx.fill();
    }

    if (isGlass) {
      drawGlassGlossSheen(ctx, -12, -26, 12, -14, 6.0, 0.75 * glassRefraction);
      drawPrismaticStarGlint(ctx, 0, -32, 5.5, 0.9 * glassRefraction, 0);
      drawPrismaticStarGlint(ctx, -22, -18, 4.2, 0.8 * glassRefraction, -0.3);
      drawPrismaticStarGlint(ctx, 22, -18, 4.2, 0.8 * glassRefraction, 0.3);
    }
    ctx.restore();
  };

  // Shaman Gnarled Frostwood Staff with Floating Glacial Orb
  const drawShamanStaff = (fistY) => {
    ctx.save();
    ctx.translate(0, fistY);
    // Gnarled Frostwood Timber Staff Shaft
    const staffGrd = ctx.createLinearGradient(-3, -34, 3, 24);
    staffGrd.addColorStop(0, "#312e81");
    staffGrd.addColorStop(0.4, "#4338ca");
    staffGrd.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = staffGrd;
    ctx.beginPath();
    ctx.moveTo(-2.5, -34);
    ctx.lineTo(2.5, -34);
    ctx.lineTo(2.0, 24);
    ctx.lineTo(-2.0, 24);
    ctx.closePath();
    ctx.fill();

    // Runic Leather Bindings & Dangling Bone Beads
    ctx.fillStyle = "#e0e7ff";
    ctx.fillRect(-3, -6, 6, 2.5);
    ctx.fillRect(-3, 6, 6, 2.5);
    for (let b = -1; b <= 1; b++) {
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(b * 3, -4, 1.8, 3.2);
    }

    // Gnarled Antler Prongs at the top of staff holding the orb
    ctx.fillStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(-7, -34);
    ctx.lineTo(-2, -32);
    ctx.lineTo(0, -30);
    ctx.lineTo(2, -32);
    ctx.lineTo(7, -34);
    ctx.lineTo(8.5, -42);
    ctx.lineTo(6.5, -42);
    ctx.lineTo(4, -36);
    ctx.lineTo(0, -34);
    ctx.lineTo(-4, -36);
    ctx.lineTo(-6.5, -42);
    ctx.lineTo(-8.5, -42);
    ctx.closePath();
    ctx.fill();

    // Hovering, Pulsing Arcane Permafrost Glacial Orb
    const orbY = -42;
    const orbPulse = Math.sin(nowMs * 0.005) * 0.2 + 0.8;
    const orbRadGrd = ctx.createRadialGradient(0, orbY, 1, 0, orbY, 9);
    orbRadGrd.addColorStop(0, "#ffffff");
    orbRadGrd.addColorStop(0.4, `rgba(0, 240, 255, ${0.9 * orbPulse})`);
    orbRadGrd.addColorStop(0.8, `rgba(168, 85, 247, ${0.6 * orbPulse})`);
    orbRadGrd.addColorStop(1, "rgba(55, 48, 163, 0)");
    ctx.fillStyle = orbRadGrd;
    ctx.beginPath();
    ctx.arc(0, orbY, 9, 0, Math.PI * 2);
    ctx.fill();

    // Spinning Arcane Orbit Rings around Orb
    const ringAng = nowMs * 0.004;
    ctx.strokeStyle = `rgba(192, 132, 252, ${0.85 * orbPulse})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(0, orbY, 8.5, 3.2, ringAng, 0, Math.PI * 2);
    ctx.stroke();

    drawPrismaticStarGlint(ctx, 0, orbY, 5.0, 0.95 * orbPulse, ringAng);
    ctx.restore();
  };

  // Warrior Spiked Permafrost Flanged Mace / Morningstar
  const drawWarriorMace = (fistY) => {
    ctx.save();
    ctx.translate(0, fistY);
    // Shaft
    const maceShaft = ctx.createLinearGradient(-3, -26, 3, 16);
    maceShaft.addColorStop(0, "#0f172a");
    maceShaft.addColorStop(0.5, "#334155");
    maceShaft.addColorStop(1, "#1e293b");
    ctx.fillStyle = maceShaft;
    ctx.beginPath();
    ctx.moveTo(-2.6, -26);
    ctx.lineTo(2.6, -26);
    ctx.lineTo(2.2, 16);
    ctx.lineTo(-2.2, 16);
    ctx.closePath();
    ctx.fill();

    // Flanged Spiked Permafrost Steel Mace Head
    const maceGrd = ctx.createLinearGradient(-10, -32, 10, -16);
    maceGrd.addColorStop(0, "#e2e8f0");
    maceGrd.addColorStop(0.4, "#475569");
    maceGrd.addColorStop(0.8, "#0f172a");
    ctx.fillStyle = maceGrd;

    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(7, -29);
    ctx.lineTo(9, -22);
    ctx.lineTo(4, -16);
    ctx.lineTo(-4, -16);
    ctx.lineTo(-9, -22);
    ctx.lineTo(-7, -29);
    ctx.closePath();
    ctx.fill();

    // Sharp spikes on mace
    ctx.fillStyle = "#38bdf8";
    for (let sp = -1; sp <= 1; sp += 2) {
      ctx.beginPath();
      ctx.moveTo(sp * 8, -24);
      ctx.lineTo(sp * 14, -22);
      ctx.lineTo(sp * 8, -20);
      ctx.closePath();
      ctx.fill();
    }
    // Crown Spike
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(-3, -32);
    ctx.lineTo(0, -39);
    ctx.lineTo(3, -32);
    ctx.closePath();
    ctx.fill();
    drawPrismaticStarGlint(ctx, 0, -39, 3.5, 0.85, 0);
    ctx.restore();
  };

  // Warrior Spiked Permafrost Kite Shield
  const drawWarriorShield = (fistY) => {
    ctx.save();
    ctx.translate(0, fistY);
    // Heavy Spiked Permafrost Tower Kite Shield
    const shieldGrd = ctx.createLinearGradient(-12, -22, 12, 18);
    shieldGrd.addColorStop(0, "#e2e8f0");
    shieldGrd.addColorStop(0.35, "#38bdf8");
    shieldGrd.addColorStop(0.7, "#0f172a");
    shieldGrd.addColorStop(1, "#0284c7");
    ctx.fillStyle = shieldGrd;

    ctx.beginPath();
    ctx.moveTo(-11, -22);
    ctx.lineTo(11, -22);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 20); // Bottom point
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();

    // Riveted Outer Steel Border
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Center Spiked Umbo / Boss
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, -2);
    ctx.lineTo(0, 4);
    ctx.lineTo(-5, -2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3, -2);
    ctx.lineTo(0, 1);
    ctx.lineTo(-3, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Tundra Boulder Cudgel bound with vines
  const drawBoulderClub = (fistY) => {
    ctx.save();
    ctx.translate(0, fistY);
    // Tree Trunk Shaft
    const trunkGrd = ctx.createLinearGradient(-4, -24, 4, 18);
    trunkGrd.addColorStop(0, "#451a03");
    trunkGrd.addColorStop(0.5, "#78350f");
    trunkGrd.addColorStop(1, "#292524");
    ctx.fillStyle = trunkGrd;
    ctx.fillRect(-3, -24, 6, 40);

    // Massive Jagged Granite Boulder Head bound with tundra moss & roots
    const rockGrd = ctx.createLinearGradient(-14, -34, 14, -12);
    rockGrd.addColorStop(0, "#64748b");
    rockGrd.addColorStop(0.5, "#334155");
    rockGrd.addColorStop(1, "#0f172a");
    ctx.fillStyle = rockGrd;

    ctx.beginPath();
    ctx.moveTo(-12, -30);
    ctx.lineTo(-3, -36);
    ctx.lineTo(11, -32);
    ctx.lineTo(14, -20);
    ctx.lineTo(8, -12);
    ctx.lineTo(-6, -14);
    ctx.lineTo(-14, -22);
    ctx.closePath();
    ctx.fill();

    // Moss Lichen Tuft on Boulder
    ctx.fillStyle = "#84cc16";
    ctx.beginPath();
    ctx.moveTo(-8, -32);
    ctx.lineTo(2, -35);
    ctx.lineTo(7, -30);
    ctx.lineTo(-1, -28);
    ctx.closePath();
    ctx.fill();

    // Binding Roots
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-10, -26);
    ctx.lineTo(10, -18);
    ctx.moveTo(-9, -19);
    ctx.lineTo(9, -27);
    ctx.stroke();
    ctx.restore();
  };

  // Jotunn Colossal Mammoth Timber Pillar
  const drawJotunnPillar = (fistY) => {
    ctx.save();
    ctx.translate(0, fistY);
    const pilGrd = ctx.createLinearGradient(-5, -28, 5, 20);
    pilGrd.addColorStop(0, "#1e293b");
    pilGrd.addColorStop(0.5, "#334155");
    pilGrd.addColorStop(1, "#0f172a");
    ctx.fillStyle = pilGrd;
    ctx.fillRect(-4.5, -28, 9, 48);

    ctx.fillStyle = "#7dd3fc";
    ctx.fillRect(-3, -24, 6, 4);
    ctx.fillRect(-3, 10, 6, 4);
    ctx.restore();
  };

  // -------------------------------------------------------------
  // Arm & Blocky Knuckle Gauntlet Helper (NO MORE CIRCLE FISTS)
  // -------------------------------------------------------------
  const drawArm = (armX, armY, isRightArm, isNearArm) => {
    ctx.save();
    ctx.translate(armX, armY);

    const armDirSign = isRightArm ? -1 : 1;
    let armRot = isBackView ? -0.22 * armDirSign : 0.18 * armDirSign;
    const walkArmSwing = moving ? (isRightArm ? -strideSwing * 0.04 : strideSwing * 0.04) : 0;

    if (isAttacking && attackProgress > 0) {
      if (attackProgress < 0.28) {
        const t = attackProgress / 0.28;
        armRot += -armDirSign * t * 1.35;
      } else if (attackProgress < 0.65) {
        const t = (attackProgress - 0.28) / 0.37;
        armRot += armDirSign * (-1.35 + t * 2.15);
      }
    }

    ctx.rotate(armRot + walkArmSwing);

    // Chiseled Faceted Deltoid, Bicep & Forearm Planes
    const armGrd = ctx.createLinearGradient(-6, -6, 6, 16);
    if (isNearArm) {
      armGrd.addColorStop(0, skinLit);
      armGrd.addColorStop(0.4, skinMid);
      armGrd.addColorStop(1, skinOcclusion);
    } else {
      armGrd.addColorStop(0, skinMid);
      armGrd.addColorStop(0.5, skinShadow);
      armGrd.addColorStop(1, "#04192b");
    }
    ctx.fillStyle = armGrd;

    // Angular Chiseled Muscle Silhouette (Polygonal cuts, no smooth round balls)
    ctx.beginPath();
    ctx.moveTo(-5.5, -4.5);
    ctx.lineTo(-9.5, 3.5);  // Sharp lateral deltoid peak
    ctx.lineTo(-7.5, 11.5); // Brachioradialis forearm cut
    ctx.lineTo(-5.0, 13.5); // Wrist transition
    ctx.lineTo(5.0, 13.5);
    ctx.lineTo(7.5, 11.5);
    ctx.lineTo(9.5, 3.5);   // Medial deltoid peak
    ctx.lineTo(5.5, -4.5);
    ctx.closePath();
    ctx.fill();

    // Muscle Ridge Facet Plane (Volumetric Chisel Highlight)
    if (isNearArm) {
      ctx.fillStyle = "rgba(224, 242, 254, 0.4)";
      ctx.beginPath();
      ctx.moveTo(-armDirSign * 1.5, -2.5);
      ctx.lineTo(-armDirSign * 4.5, 4.0);
      ctx.lineTo(-armDirSign * 2.0, 10.0);
      ctx.lineTo(armDirSign * 1.5, 4.0);
      ctx.closePath();
      ctx.fill();
    }

    // Heavy Faceted Pauldrons by Variant
    if (isNearArm && isBerserker) {
      // Angular Berserker Pauldron Slab
      const pauldronGrd = ctx.createLinearGradient(-10, -11, 10, 4);
      pauldronGrd.addColorStop(0, "#cbd5e1");
      pauldronGrd.addColorStop(0.35, "#38bdf8");
      pauldronGrd.addColorStop(0.75, "#0284c7");
      pauldronGrd.addColorStop(1, "#082f49");
      ctx.fillStyle = pauldronGrd;

      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, -6);
      ctx.lineTo(8, 5);
      ctx.lineTo(-8, 5);
      ctx.lineTo(-10, -6);
      ctx.closePath();
      ctx.fill();

      // Sharp Faceted Pauldron Bevel
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(1.5, -3);
      ctx.lineTo(0, 5);
      ctx.lineTo(-1.5, -3);
      ctx.closePath();
      ctx.fill();

      // Protruding Glacial Spikes on Pauldron
      for (let psp = -1; psp <= 1; psp++) {
        const px = psp * 5.5;
        const pTipY = -16 - Math.abs(psp) * 3;
        ctx.fillStyle = "#e0f2fe";
        ctx.beginPath();
        ctx.moveTo(px - 2.5, -7);
        ctx.lineTo(px, pTipY);
        ctx.lineTo(px + 2.5, -7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(px, pTipY - 1.5);
        ctx.lineTo(px + 1, pTipY);
        ctx.lineTo(px, pTipY + 1);
        ctx.lineTo(px - 1, pTipY);
        ctx.closePath();
        ctx.fill();
      }
    } else if (isNearArm && isChieftain) {
      // Golden Runic Frost Pauldron for Chieftain
      const pauldronGrd = ctx.createLinearGradient(-11, -12, 11, 5);
      pauldronGrd.addColorStop(0, "#fde68a");
      pauldronGrd.addColorStop(0.4, "#d97706");
      pauldronGrd.addColorStop(1, "#1e3a8a");
      ctx.fillStyle = pauldronGrd;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, -6);
      ctx.lineTo(9, 6);
      ctx.lineTo(-9, 6);
      ctx.lineTo(-11, -6);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#00f0ff";
      ctx.fillRect(-2, -3, 4, 6);
      ctx.fillRect(-4, -1, 8, 2);
    } else if (isWarrior) {
      // Forged Blackened Iron Spiked Pauldron
      const pauldronGrd = ctx.createLinearGradient(-11, -12, 11, 6);
      pauldronGrd.addColorStop(0, "#94a3b8");
      pauldronGrd.addColorStop(0.4, "#334155");
      pauldronGrd.addColorStop(1, "#090d16");
      ctx.fillStyle = pauldronGrd;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, -6);
      ctx.lineTo(9, 6);
      ctx.lineTo(-9, 6);
      ctx.lineTo(-11, -6);
      ctx.closePath();
      ctx.fill();

      // Iron Skull Spike
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.moveTo(-3, -8);
      ctx.lineTo(0, -16);
      ctx.lineTo(3, -8);
      ctx.closePath();
      ctx.fill();
    } else if (isShaman) {
      // Runic Bone Talisman Pauldron with Crow Feather
      ctx.fillStyle = "#3730a3";
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, -8);
      ctx.lineTo(6, 4);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#c084fc";
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(2.5, 12);
      ctx.lineTo(0, 16);
      ctx.lineTo(-2.5, 12);
      ctx.closePath();
      ctx.fill();
    } else if (isTundra) {
      // Moss-covered Granite Shoulder Crag
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(-10, -9);
      ctx.lineTo(10, -7);
      ctx.lineTo(8, 4);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#84cc16";
      ctx.beginPath();
      ctx.moveTo(-7, -9);
      ctx.lineTo(2, -10);
      ctx.lineTo(6, -7);
      ctx.lineTo(-4, -6);
      ctx.closePath();
      ctx.fill();
    } else if (isSnowTroll) {
      // Heavy Polar Fur Shoulder Mantle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-11, -9);
      ctx.lineTo(11, -9);
      ctx.lineTo(9, 5);
      ctx.lineTo(0, 8);
      ctx.lineTo(-9, 5);
      ctx.closePath();
      ctx.fill();
    } else if (isCrystal) {
      // Living Crystal Cluster Spikes erupting from Shoulder & Elbow
      for (let csp = -1; csp <= 1; csp++) {
        const cx = csp * 5.0;
        const cy = -8 - Math.abs(csp) * 3;
        ctx.fillStyle = csp === 0 ? "#ffffff" : "#bae6fd";
        ctx.beginPath();
        ctx.moveTo(cx - 2.5, -4);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + 2.5, -4);
        ctx.closePath();
        ctx.fill();
        drawPrismaticStarGlint(ctx, cx, cy, 3.2, 0.8, 0);
      }
    } else if (isJotunn && isNearArm) {
      // Mammoth Fur Shoulder Wrap with Granite Slab
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(-9, -8);
      ctx.lineTo(9, -8);
      ctx.lineTo(7, 3);
      ctx.lineTo(-7, 3);
      ctx.closePath();
      ctx.fill();
    }

    const fistY = 14.5;

    // Distinct Weapons per Variant
    if (isBerserker && isNearArm) {
      drawFrozenMaul(fistY);
    } else if (isShaman && isNearArm) {
      drawShamanStaff(fistY);
    } else if (isWarrior && isNearArm) {
      drawWarriorMace(fistY);
    } else if (isWarrior && !isNearArm) {
      drawWarriorShield(fistY);
    } else if (isTundra && isNearArm) {
      drawBoulderClub(fistY);
    } else if (isJotunn && !isChieftain && isNearArm) {
      drawJotunnPillar(fistY);
    } else if (isShaman && !isNearArm) {
      // Floating frost rune in casting hand
      const spellPulse = Math.sin(nowMs * 0.006) * 0.25 + 0.75;
      ctx.fillStyle = `rgba(192, 132, 252, ${0.9 * spellPulse})`;
      ctx.beginPath();
      ctx.arc(0, fistY + 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, fistY + 4, 2.0, 0, Math.PI * 2);
      ctx.fill();
      drawPrismaticStarGlint(ctx, 0, fistY + 4, 3.5, spellPulse, nowMs * 0.003);
    }

    // ---------------------------------------------------------
    // BLOCKY CHISELED KNUCKLE GAUNTLET
    // ---------------------------------------------------------
    // Main Hexagonal Knuckle Core
    const fistGrd = ctx.createLinearGradient(-8, fistY - 5, 8, fistY + 8);
    if (isCrystal) {
      fistGrd.addColorStop(0, "#bae6fd");
      fistGrd.addColorStop(0.5, "#0284c7");
      fistGrd.addColorStop(1, "#0c4a6e");
    } else if (isChieftain) {
      fistGrd.addColorStop(0, "#fbbf24");
      fistGrd.addColorStop(0.5, "#d97706");
      fistGrd.addColorStop(1, "#1e3a8a");
    } else if (isWarrior) {
      fistGrd.addColorStop(0, "#cbd5e1");
      fistGrd.addColorStop(0.5, "#334155");
      fistGrd.addColorStop(1, "#090d16");
    } else if (isShaman) {
      fistGrd.addColorStop(0, "#c7d2fe");
      fistGrd.addColorStop(0.5, "#4338ca");
      fistGrd.addColorStop(1, "#1e1b4b");
    } else if (isSnowTroll) {
      fistGrd.addColorStop(0, "#ffffff");
      fistGrd.addColorStop(0.5, "#bae6fd");
      fistGrd.addColorStop(1, "#0369a1");
    } else if (isTundra) {
      fistGrd.addColorStop(0, "#84cc16");
      fistGrd.addColorStop(0.5, "#475569");
      fistGrd.addColorStop(1, "#1e293b");
    } else if (isBerserker) {
      fistGrd.addColorStop(0, "#64748b");
      fistGrd.addColorStop(0.5, "#334155");
      fistGrd.addColorStop(1, "#0f172a");
    } else {
      fistGrd.addColorStop(0, isNearArm ? "#94a3b8" : "#64748b");
      fistGrd.addColorStop(0.45, isNearArm ? "#475569" : "#334155");
      fistGrd.addColorStop(1, "#0f172a");
    }
    ctx.fillStyle = fistGrd;

    ctx.beginPath();
    ctx.moveTo(-7.5, fistY - 3.5);
    ctx.lineTo(7.5, fistY - 3.5);
    ctx.lineTo(9.5, fistY + 2.5);
    ctx.lineTo(6.5, fistY + 8.5);
    ctx.lineTo(-6.5, fistY + 8.5);
    ctx.lineTo(-9.5, fistY + 2.5);
    ctx.closePath();
    ctx.fill();

    // 4 Distinct Chiseled Knuckle Plates
    const plateWidth = 3.6;
    for (let kp = 0; kp < 4; kp++) {
      const kx = -5.4 + kp * plateWidth;
      const plateGrd = ctx.createLinearGradient(kx, fistY - 2, kx, fistY + 6);
      if (isCrystal) {
        plateGrd.addColorStop(0, "#ffffff");
        plateGrd.addColorStop(0.5, "#38bdf8");
        plateGrd.addColorStop(1, "#0284c7");
      } else if (isChieftain) {
        plateGrd.addColorStop(0, "#fef08a");
        plateGrd.addColorStop(0.6, "#d97706");
        plateGrd.addColorStop(1, "#082f49");
      } else {
        plateGrd.addColorStop(0, isNearArm ? "#cbd5e1" : "#94a3b8");
        plateGrd.addColorStop(0.6, isNearArm ? "#64748b" : "#475569");
        plateGrd.addColorStop(1, "#1e293b");
      }
      ctx.fillStyle = plateGrd;

      ctx.beginPath();
      ctx.moveTo(kx - 1.5, fistY - 2.5);
      ctx.lineTo(kx + 1.5, fistY - 2.5);
      ctx.lineTo(kx + 1.2, fistY + 6.0);
      ctx.lineTo(kx - 1.2, fistY + 6.0);
      ctx.closePath();
      ctx.fill();

      // Specular Chisel Top Edge
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(kx - 1.5, fistY - 2.5);
      ctx.lineTo(kx + 1.5, fistY - 2.5);
      ctx.lineTo(kx + 1.0, fistY - 1.2);
      ctx.lineTo(kx - 1.0, fistY - 1.2);
      ctx.closePath();
      ctx.fill();
    }

    // Protruding Knuckle Ice / Stone Spikes
    const crystalGrd = ctx.createLinearGradient(-4, fistY - 6, 4, fistY + 8);
    crystalGrd.addColorStop(0, "#ffffff");
    crystalGrd.addColorStop(0.3, isCrystal ? "#bae6fd" : isAncient ? "#cbd5e1" : "#00f0ff");
    crystalGrd.addColorStop(0.7, isAncient ? "#475569" : "#0284c7");
    crystalGrd.addColorStop(1, "#082f49");
    ctx.fillStyle = crystalGrd;

    // Crystal 1 (Left Spike)
    ctx.beginPath();
    ctx.moveTo(-5.5, fistY + 2.0);
    ctx.lineTo(-4.0, fistY + 8.5);
    ctx.lineTo(-2.2, fistY + 2.0);
    ctx.lineTo(-3.8, fistY - 3.5);
    ctx.closePath();
    ctx.fill();

    // Crystal 2 (Center Spike)
    ctx.beginPath();
    ctx.moveTo(-2.0, fistY + 1.0);
    ctx.lineTo(0.0, fistY + 10.5);
    ctx.lineTo(2.0, fistY + 1.0);
    ctx.lineTo(0.0, fistY - 5.0);
    ctx.closePath();
    ctx.fill();

    // Crystal 3 (Right Spike)
    ctx.beginPath();
    ctx.moveTo(2.2, fistY + 2.0);
    ctx.lineTo(4.0, fistY + 8.5);
    ctx.lineTo(5.5, fistY + 2.0);
    ctx.lineTo(3.8, fistY - 3.5);
    ctx.closePath();
    ctx.fill();

    // Sharp Prismatic Diamond Glints on Crystals
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, fistY + 8.5);
    ctx.lineTo(1.2, fistY + 10.5);
    ctx.lineTo(0, fistY + 12.0);
    ctx.lineTo(-1.2, fistY + 10.5);
    ctx.closePath();
    ctx.fill();

    // Glass Visual Effect: Glossy Arm Sheen, Pauldron Prisms & Knuckle Glints
    if (isGlass) {
      drawGlassGlossSheen(ctx, -armDirSign * 3, -3, -armDirSign * 1, 12, 3.8, 0.6 * glassRefraction);
      drawGlassGlossSheen(ctx, -6, fistY - 1, 6, fistY + 4, 3.5, 0.65 * glassRefraction);
      for (let kp = -1; kp <= 1; kp++) {
        const kpx = kp * 3.6;
        const kpy = fistY + (kp === 0 ? 10.5 : 8.5);
        const kPhase = (nowMs * 0.0035 + (isRightArm ? 1 : 0) + kp * 1.5) % (Math.PI * 2);
        const kGlintA = Math.max(0, Math.sin(kPhase) - 0.4) * 1.7;
        if (kGlintA > 0.05) {
          drawPrismaticStarGlint(ctx, kpx, kpy, 3.8, kGlintA * glassRefraction, kp * 0.25);
        }
      }
    }

    // Gathering frost aura on fists during attack windup (Angular polygonal burst)
    if (isAttacking && attackProgress > 0 && attackProgress < 0.35) {
      const glowT = Math.sin((attackProgress / 0.35) * Math.PI);
      ctx.fillStyle = `rgba(0, 240, 255, ${glowT * 0.55})`;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        const rad = 13.0 * glowT;
        const gx = Math.cos(ang) * rad;
        const gy = fistY + Math.sin(ang) * rad;
        if (a === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  // -------------------------------------------------------------
  // Layer Sorting: Background Limbs
  // -------------------------------------------------------------
  // Hind Leg (Far)
  const farLegStep = moving ? -Math.sin(walkPhase) * 3.2 : 0;
  drawLeg(cfg.hindLegFarX, 12.0 + farLegStep, false, isBackView);

  // Background Arm (if designated behind torso)
  if (!cfg.rightArmFront) {
    drawArm(cfg.rightArmX, cfg.rightArmY, true, false);
  }
  if (!cfg.leftArmFront) {
    drawArm(cfg.leftArmX, cfg.leftArmY, false, false);
  }

  // Hind Leg (Near)
  const nearLegStep = moving ? Math.sin(walkPhase) * 3.2 : 0;
  drawLeg(cfg.hindLegNearX, 12.0 + nearLegStep, true, isBackView);

  // -------------------------------------------------------------
  // Main Chiseled Torso & Muscular Crag Planes (NO BALLOON TORSO)
  // -------------------------------------------------------------
  ctx.save();
  ctx.rotate(cfg.tilt + torsoSway);

  // Glass Visual Effect: Render Subsurface Luminous Core & Spine inside body volume
  if (isGlass) {
    drawSubsurfaceLuminousCore(ctx, r, cfg, breathCycle, nowMs, glassRefraction);
  }

  const torsoGrd = ctx.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.6);
  torsoGrd.addColorStop(0, skinLit);
  torsoGrd.addColorStop(0.35, skinMid);
  torsoGrd.addColorStop(0.72, skinShadow);
  torsoGrd.addColorStop(1, skinOcclusion);
  ctx.fillStyle = torsoGrd;

  if (cfg.view === "front") {
    // Symmetrical Direct Front Chiseled Permafrost Torso (Inverted Trapezoid / Hexagonal Monolith)
    ctx.beginPath();
    ctx.moveTo(-r * 0.70, r * 0.48);       // Waist Left
    ctx.lineTo(-r * 0.88, -r * 0.15);      // Lats flare
    ctx.lineTo(-r * 0.82, -r * 0.68);      // Trapezius peak Left
    ctx.lineTo(-r * 0.35, -r * 0.78);      // Left neck saddle
    ctx.lineTo(0, -r * 0.72);              // Center collar notch
    ctx.lineTo(r * 0.35, -r * 0.78);       // Right neck saddle
    ctx.lineTo(r * 0.82, -r * 0.68);       // Trapezius peak Right
    ctx.lineTo(r * 0.88, -r * 0.15);       // Lats flare
    ctx.lineTo(r * 0.70, r * 0.48);        // Waist Right
    ctx.lineTo(0, r * 0.55);               // Pelvis notch
    ctx.closePath();
    ctx.fill();

    // Dual Chiseled Armor-Plate Pectorals (Polygonal Rock Slabs with Crisp Bevels)
    const drawPecPlate = (dirSign) => {
      const pecGrd = ctx.createLinearGradient(dirSign * r * 0.1, -r * 0.45, dirSign * r * 0.6, -r * 0.05);
      pecGrd.addColorStop(0, isGlass ? "rgba(224, 242, 254, 0.65)" : "rgba(224, 242, 254, 0.45)");
      pecGrd.addColorStop(0.5, isGlass ? "rgba(56, 189, 248, 0.45)" : "rgba(56, 189, 248, 0.25)");
      pecGrd.addColorStop(1, isGlass ? "rgba(2, 132, 199, 0.25)" : "rgba(8, 47, 73, 0.1)");
      ctx.fillStyle = pecGrd;

      // Hexagonal Pectoral Slab
      ctx.beginPath();
      ctx.moveTo(dirSign * 1.5, -r * 0.42);
      ctx.lineTo(dirSign * r * 0.62, -r * 0.48);
      ctx.lineTo(dirSign * r * 0.70, -r * 0.20);
      ctx.lineTo(dirSign * r * 0.52, -r * 0.04);
      ctx.lineTo(dirSign * 2.0, -r * 0.08);
      ctx.closePath();
      ctx.fill();

      // Sharp Pectoral Ridge Bevel
      ctx.fillStyle = isGlass ? "rgba(255, 255, 255, 0.65)" : "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.moveTo(dirSign * 2.0, -r * 0.40);
      ctx.lineTo(dirSign * r * 0.60, -r * 0.46);
      ctx.lineTo(dirSign * r * 0.58, -r * 0.42);
      ctx.lineTo(dirSign * 2.0, -r * 0.37);
      ctx.closePath();
      ctx.fill();
    };

    drawPecPlate(-1);
    drawPecPlate(1);

    // Deep Chiseled Sternum Crease & Abdominal Rock Strata
    ctx.fillStyle = skinOcclusion;
    ctx.beginPath();
    ctx.moveTo(-1.2, -r * 0.45);
    ctx.lineTo(1.2, -r * 0.45);
    ctx.lineTo(1.5, r * 0.40);
    ctx.lineTo(-1.5, r * 0.40);
    ctx.closePath();
    ctx.fill();

    // 4 Chiseled Abdominal Rock Slabs (Faceted 4-Pack)
    for (let ab = 0; ab < 2; ab++) {
      const aby = -r * 0.02 + ab * (r * 0.22);
      for (let s = -1; s <= 1; s += 2) {
        ctx.fillStyle = isGlass ? "rgba(56, 189, 248, 0.45)" : "rgba(2, 132, 199, 0.35)";
        ctx.beginPath();
        ctx.moveTo(s * 2.5, aby);
        ctx.lineTo(s * r * 0.35, aby - 1);
        ctx.lineTo(s * r * 0.32, aby + r * 0.16);
        ctx.lineTo(s * 2.5, aby + r * 0.18);
        ctx.closePath();
        ctx.fill();

        // Abdominal Slab Highlight
        ctx.fillStyle = isGlass ? "rgba(255, 255, 255, 0.45)" : "rgba(224, 242, 254, 0.25)";
        ctx.beginPath();
        ctx.moveTo(s * 3.0, aby + 1);
        ctx.lineTo(s * r * 0.32, aby);
        ctx.lineTo(s * r * 0.30, aby + 2.5);
        ctx.lineTo(s * 3.0, aby + 3);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Glass Visual Effect: Sweeping Double Diagonal Specular Gloss Reflection Ribbons
    if (isGlass) {
      drawGlassGlossSheen(ctx, -r * 0.55, -r * 0.60, r * 0.35, -r * 0.15, 6.5, 0.75 * glassRefraction);
      drawGlassGlossSheen(ctx, -r * 0.35, -r * 0.65, r * 0.55, -r * 0.20, 3.2, 0.55 * glassRefraction);
      drawGlassGlossSheen(ctx, -r * 0.40, -r * 0.10, r * 0.20, r * 0.32, 4.5, 0.6 * glassRefraction);

      // Chromatic dispersion bevels on pectoral and sternum ridges
      ctx.fillStyle = `rgba(0, 240, 255, ${0.75 * glassRefraction})`;
      ctx.fillRect(-r * 0.55, -r * 0.44, r * 1.1, 1.2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * glassRefraction})`;
      ctx.fillRect(-r * 0.35, -r * 0.45, r * 0.7, 1.0);

      // Star glint on pectoral apex
      const chestGlintPhase = (nowMs * 0.003) % (Math.PI * 2);
      const chestGlintA = Math.max(0, Math.sin(chestGlintPhase) - 0.4) * 1.6;
      if (chestGlintA > 0.05) {
        drawPrismaticStarGlint(ctx, 0, -r * 0.42, 6.0, chestGlintA * glassRefraction, 0);
      }
    }

    // Variant Chest Markings, Runes, War Paint, Armor or Crystalline Cores
    if (isCrystal) {
      // Hexagonal Crystal Matrix Core in Sternum
      const corePulse = Math.sin(nowMs * 0.005) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(0, 240, 255, ${0.95 * corePulse})`;
      ctx.beginPath();
      for (let h = 0; h < 6; h++) {
        const hang = (h / 6) * Math.PI * 2;
        const hx = Math.cos(hang) * 5.0;
        const hy = -r * 0.20 + Math.sin(hang) * 5.0;
        if (h === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();

      // Radiant Circuit Lattice Lines to Shoulders and Abs
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.75 * corePulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-5.0, -r * 0.20);
      ctx.lineTo(-r * 0.45, -r * 0.32);
      ctx.moveTo(5.0, -r * 0.20);
      ctx.lineTo(r * 0.45, -r * 0.32);
      ctx.moveTo(0, -r * 0.20 + 5.0);
      ctx.lineTo(0, r * 0.20);
      ctx.stroke();
      drawPrismaticStarGlint(ctx, 0, -r * 0.20, 5.0, 0.9 * corePulse, 0);
    } else if (isWarrior) {
      // Forged Blackened Iron Riveted Chestplate with embossed skull
      const plateGrd = ctx.createLinearGradient(-r * 0.55, -r * 0.45, r * 0.55, r * 0.35);
      plateGrd.addColorStop(0, "#475569");
      plateGrd.addColorStop(0.5, "#1e293b");
      plateGrd.addColorStop(1, "#090d16");
      ctx.fillStyle = plateGrd;

      ctx.beginPath();
      ctx.moveTo(-r * 0.58, -r * 0.42);
      ctx.lineTo(r * 0.58, -r * 0.42);
      ctx.lineTo(r * 0.48, r * 0.25);
      ctx.lineTo(-r * 0.48, r * 0.25);
      ctx.closePath();
      ctx.fill();

      // Steel Rivets
      ctx.fillStyle = "#cbd5e1";
      for (let rv = -2; rv <= 2; rv++) {
        ctx.fillRect(rv * (r * 0.2) - 1, -r * 0.38, 2, 2);
        ctx.fillRect(rv * (r * 0.18) - 1, r * 0.20, 2, 2);
      }

      // Embossed Skull Emblem in Center
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.moveTo(-3, -r * 0.15);
      ctx.lineTo(3, -r * 0.15);
      ctx.lineTo(2, -r * 0.05);
      ctx.lineTo(-2, -r * 0.05);
      ctx.closePath();
      ctx.fill();
    } else if (isShaman) {
      // Arcane Runic Seal on Chest & Bone Necklace
      const sealPulse = Math.sin(nowMs * 0.005) * 0.25 + 0.75;
      ctx.strokeStyle = `rgba(192, 132, 252, ${0.85 * sealPulse})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -r * 0.15, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(0, 240, 255, ${0.9 * sealPulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.20);
      ctx.lineTo(3.5, -r * 0.15);
      ctx.lineTo(0, -r * 0.10);
      ctx.lineTo(-3.5, -r * 0.15);
      ctx.closePath();
      ctx.fill();

      // Bone Amulet Beads
      ctx.fillStyle = "#e0e7ff";
      for (let ba = -2; ba <= 2; ba++) {
        ctx.fillRect(ba * 4 - 1, -r * 0.38 + Math.abs(ba) * 2, 2, 3);
      }
    } else if (isSnowTroll) {
      // Dense Stark Arctic White Polar Coat over chest
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-r * 0.60, -r * 0.45);
      ctx.lineTo(r * 0.60, -r * 0.45);
      ctx.lineTo(r * 0.45, r * 0.28);
      ctx.lineTo(0, r * 0.35);
      ctx.lineTo(-r * 0.45, r * 0.28);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#bae6fd";
      for (let st = -2; st <= 2; st++) {
        ctx.beginPath();
        ctx.moveTo(st * 5, -r * 0.25);
        ctx.lineTo(st * 5 + 2, -r * 0.15);
        ctx.lineTo(st * 5 - 2, -r * 0.15);
        ctx.closePath();
        ctx.fill();
      }
    } else if (isTundra) {
      // Alpine Tundra Lichen & Moss Patches across rocky chest
      ctx.fillStyle = "#65a30d";
      ctx.beginPath();
      ctx.moveTo(-r * 0.40, -r * 0.35);
      ctx.lineTo(-r * 0.15, -r * 0.20);
      ctx.lineTo(-r * 0.30, -r * 0.05);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#84cc16";
      ctx.beginPath();
      ctx.moveTo(r * 0.15, -r * 0.30);
      ctx.lineTo(r * 0.45, -r * 0.15);
      ctx.lineTo(r * 0.25, -r * 0.05);
      ctx.closePath();
      ctx.fill();
    } else if (isBerserker) {
      // Bold Tribal War Paint Slashes across Pectorals
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.38);
      ctx.lineTo(-r * 0.20, -r * 0.12);
      ctx.lineTo(-r * 0.15, -r * 0.12);
      ctx.lineTo(-r * 0.50, -r * 0.38);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(0, 240, 255, 0.9)";
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.38);
      ctx.lineTo(r * 0.20, -r * 0.12);
      ctx.lineTo(r * 0.15, -r * 0.12);
      ctx.lineTo(r * 0.50, -r * 0.38);
      ctx.closePath();
      ctx.fill();

      // Studded Iron War Belt at waist
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-r * 0.45, r * 0.40, r * 0.9, 4.0);
      ctx.fillStyle = "#94a3b8";
      for (let st = -2; st <= 2; st++) {
        ctx.fillRect(st * 4.5 - 1, r * 0.40 + 1, 2, 2);
      }
    } else if (isChieftain) {
      // Golden Runic Torc Necklace with Embedded Permafrost Sapphire
      const torcGrd = ctx.createLinearGradient(-r * 0.4, -r * 0.65, r * 0.4, -r * 0.4);
      torcGrd.addColorStop(0, "#fbbf24");
      torcGrd.addColorStop(0.5, "#fef08a");
      torcGrd.addColorStop(1, "#d97706");

      ctx.beginPath();
      ctx.ellipse(0, -r * 0.50, r * 0.38, 4.5, 0, 0, Math.PI);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = torcGrd;
      ctx.stroke();

      // Sapphire Permafrost Gem at Center
      ctx.fillStyle = "#00f0ff";
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.46);
      ctx.lineTo(3.2, -r * 0.38);
      ctx.lineTo(0, -r * 0.30);
      ctx.lineTo(-3.2, -r * 0.38);
      ctx.closePath();
      ctx.fill();
      drawPrismaticStarGlint(ctx, 0, -r * 0.38, 4.5, 0.9, 0);

      // Pulsating Frost Veins
      const veinPulse = Math.sin(nowMs * 0.0035) * 0.25 + 0.75;
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.65 * veinPulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-2, -r * 0.30);
      ctx.lineTo(-r * 0.35, -r * 0.15);
      ctx.lineTo(-r * 0.48, r * 0.10);
      ctx.moveTo(2, -r * 0.30);
      ctx.lineTo(r * 0.35, -r * 0.15);
      ctx.lineTo(r * 0.48, r * 0.10);
      ctx.stroke();
    } else if (isJotunn) {
      // Ancient Elder Futhark Rune Bands carved into Granite Chest
      const runePulse = Math.sin(nowMs * 0.003) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(56, 189, 248, ${0.85 * runePulse})`;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.32);
      ctx.lineTo(4.0, -r * 0.18);
      ctx.lineTo(0, -r * 0.06);
      ctx.lineTo(-4.0, -r * 0.18);
      ctx.closePath();
      ctx.fill();

      // Mammoth pelt kilt trim at hips
      ctx.fillStyle = "#334155";
      ctx.fillRect(-r * 0.50, r * 0.42, r * 1.0, 4.5);
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(-3, r * 0.42);
      ctx.lineTo(3, r * 0.42);
      ctx.lineTo(2, r * 0.42 + 5);
      ctx.lineTo(-2, r * 0.42 + 5);
      ctx.closePath();
      ctx.fill();
    } else if (isAncient) {
      // Rugged Frost Rime Stone Cracks
      ctx.fillStyle = "rgba(224, 242, 254, 0.4)";
      ctx.beginPath();
      ctx.moveTo(-1, -r * 0.35);
      ctx.lineTo(2, -r * 0.20);
      ctx.lineTo(-1, -r * 0.05);
      ctx.lineTo(1, r * 0.15);
      ctx.lineTo(0, r * 0.15);
      ctx.lineTo(-2, -r * 0.05);
      ctx.lineTo(1, -r * 0.20);
      ctx.closePath();
      ctx.fill();
    }
  } else if (cfg.view === "back") {
    // Symmetrical Direct Back Chiseled Gorilla/Troll Torso
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, r * 0.48);
    ctx.lineTo(-r * 0.90, -r * 0.15);
    ctx.lineTo(-r * 0.82, -r * 0.72);
    ctx.lineTo(0, -r * 0.84);
    ctx.lineTo(r * 0.82, -r * 0.72);
    ctx.lineTo(r * 0.90, -r * 0.15);
    ctx.lineTo(r * 0.72, r * 0.48);
    ctx.lineTo(0, r * 0.58);
    ctx.closePath();
    ctx.fill();

    // Angular Vertebral Spine Nodes Running Down Center (Faceted Diamond Plates)
    for (let s = -4; s <= 2; s++) {
      const spy = s * 4.6 - 2.0;
      ctx.fillStyle = isGlass ? "rgba(8, 47, 73, 0.75)" : "#04192b";
      ctx.beginPath();
      ctx.moveTo(0, spy - 2.8);
      ctx.lineTo(2.8, spy);
      ctx.lineTo(0, spy + 2.8);
      ctx.lineTo(-2.8, spy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isGlass ? "#00f0ff" : "#0284c7";
      ctx.beginPath();
      ctx.moveTo(0, spy - 1.8);
      ctx.lineTo(1.8, spy);
      ctx.lineTo(0, spy + 1.8);
      ctx.lineTo(-1.8, spy);
      ctx.closePath();
      ctx.fill();
    }

    if (isGlass) {
      drawGlassGlossSheen(ctx, -r * 0.5, -r * 0.65, r * 0.4, -r * 0.1, 5.5, 0.7 * glassRefraction);
      drawGlassGlossSheen(ctx, -r * 0.3, 0, r * 0.35, r * 0.4, 4.0, 0.55 * glassRefraction);
    }
  } else if (isProfileView) {
    // Pure Side Profile Hunched Craggy Torso (Angular Predatory Slope)
    const f = cfg.flip;
    ctx.beginPath();
    ctx.moveTo(-f * r * 0.65, r * 0.48);
    ctx.lineTo(-f * r * 0.85, -r * 0.20);
    ctx.lineTo(-f * r * 0.60, -r * 0.78); // Sharp Dorsal Hump
    ctx.lineTo(0, -r * 0.86);
    ctx.lineTo(f * r * 0.55, -r * 0.62);  // Jutting Chest Plate
    ctx.lineTo(f * r * 0.78, -r * 0.10);
    ctx.lineTo(f * r * 0.45, r * 0.48);
    ctx.lineTo(0, r * 0.58);
    ctx.closePath();
    ctx.fill();

    if (isGlass) {
      drawGlassGlossSheen(ctx, -f * r * 0.45, -r * 0.65, f * r * 0.35, -r * 0.15, 5.5, 0.75 * glassRefraction);
      drawGlassGlossSheen(ctx, -f * r * 0.30, -r * 0.10, f * r * 0.25, r * 0.30, 4.0, 0.55 * glassRefraction);
    }
  } else {
    // Diagonal 3/4 Chiseled Torso
    const f = cfg.flip;
    ctx.beginPath();
    ctx.moveTo(-f * r * 0.72, r * 0.48);
    ctx.lineTo(-f * r * 0.88, -r * 0.15);
    ctx.lineTo(-f * r * 0.72, -r * 0.74);
    ctx.lineTo(0, -r * 0.82);
    ctx.lineTo(f * r * 0.72, -r * 0.64);
    ctx.lineTo(f * r * 0.86, -r * 0.05);
    ctx.lineTo(f * r * 0.66, r * 0.48);
    ctx.lineTo(0, r * 0.58);
    ctx.closePath();
    ctx.fill();

    if (isGlass) {
      drawGlassGlossSheen(ctx, -f * r * 0.45, -r * 0.65, f * r * 0.40, -r * 0.15, 5.8, 0.75 * glassRefraction);
      drawGlassGlossSheen(ctx, -f * r * 0.35, -r * 0.05, f * r * 0.30, r * 0.32, 4.2, 0.58 * glassRefraction);
    }
  }

  // -------------------------------------------------------------
  // Volumetric Jagged Polar Fur Mantle / Crystal Cluster Mantle
  // -------------------------------------------------------------
  if (isCrystal) {
    // Sharp Geometric Sapphire Crystal Spikes Mantle (No organic fur)
    const cryMantleGrd = ctx.createLinearGradient(0, -r * 0.85, 0, -r * 0.20);
    cryMantleGrd.addColorStop(0, "#ffffff");
    cryMantleGrd.addColorStop(0.35, "#bae6fd");
    cryMantleGrd.addColorStop(0.7, "#38bdf8");
    cryMantleGrd.addColorStop(1, "#0284c7");
    ctx.fillStyle = cryMantleGrd;

    for (let c = -4; c <= 4; c++) {
      const cx = c * (r * 0.22);
      const cy = -r * 0.48;
      const ch = 12 + Math.abs(c) * 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, cy);
      ctx.lineTo(cx, cy - ch);
      ctx.lineTo(cx + 3.5, cy);
      ctx.closePath();
      ctx.fill();

      drawPrismaticStarGlint(ctx, cx, cy - ch, 3.2, 0.8, c * 0.2);
    }
  } else {
    // Layer A: Under-fur Shadow Base
    const furBaseGrd = ctx.createLinearGradient(0, -r * 0.80, 0, -r * 0.20);
    furBaseGrd.addColorStop(0, furLit);
    furBaseGrd.addColorStop(0.45, furMid);
    furBaseGrd.addColorStop(0.85, furDark);
    furBaseGrd.addColorStop(1, skinOcclusion);
    ctx.fillStyle = furBaseGrd;

    ctx.beginPath();
    ctx.moveTo(0, -r * 0.75);
    ctx.lineTo(-r * 0.40, -r * 0.78);
    ctx.lineTo(-r * 0.85, -r * 0.55); // Left Shoulder Fur Spike 1
    ctx.lineTo(-r * 0.68, -r * 0.48);
    ctx.lineTo(-r * 0.92, -r * 0.35); // Left Shoulder Fur Spike 2
    ctx.lineTo(-r * 0.65, -r * 0.30);
    ctx.lineTo(-r * 0.78, -r * 0.15); // Left Chest Fur Spike 3
    ctx.lineTo(-r * 0.42, -r * 0.22);
    ctx.lineTo(0, -r * 0.26);         // Center Fur Dip
    ctx.lineTo(r * 0.42, -r * 0.22);
    ctx.lineTo(r * 0.78, -r * 0.15);  // Right Chest Fur Spike 3
    ctx.lineTo(r * 0.65, -r * 0.30);
    ctx.lineTo(r * 0.92, -r * 0.35);  // Right Shoulder Fur Spike 2
    ctx.lineTo(r * 0.68, -r * 0.48);
    ctx.lineTo(r * 0.85, -r * 0.55);  // Right Shoulder Fur Spike 1
    ctx.lineTo(r * 0.40, -r * 0.78);
    ctx.closePath();
    ctx.fill();

    // Layer B: Mid-fur Overlapping Chiseled Tufts
    const furMidGrd = ctx.createLinearGradient(0, -r * 0.70, 0, -r * 0.25);
    furMidGrd.addColorStop(0, furLit);
    furMidGrd.addColorStop(0.55, furMid);
    furMidGrd.addColorStop(1, furDark);
    ctx.fillStyle = furMidGrd;

    const furTuftPoints = [
      [-r * 0.70, -r * 0.50, -r * 0.52, -r * 0.38],
      [-r * 0.48, -r * 0.58, -r * 0.30, -r * 0.34],
      [-r * 0.24, -r * 0.62, 0, -r * 0.36],
      [r * 0.24, -r * 0.62, 0, -r * 0.36],
      [r * 0.48, -r * 0.58, r * 0.30, -r * 0.34],
      [r * 0.70, -r * 0.50, r * 0.52, -r * 0.38]
    ];

    for (let tp = 0; tp < furTuftPoints.length; tp++) {
      const [tx1, ty1, tx2, ty2] = furTuftPoints[tp];
      ctx.beginPath();
      ctx.moveTo(tx1, ty1);
      ctx.lineTo((tx1 + tx2) * 0.5 + (tp % 2 === 0 ? -3 : 3), (ty1 + ty2) * 0.5 + 4);
      ctx.lineTo(tx2, ty2);
      ctx.closePath();
      ctx.fill();
    }

    // Special Ermine Fur Tail Tips for Chieftain
    if (isChieftain) {
      ctx.fillStyle = "#020617";
      for (let em = -2; em <= 2; em++) {
        const emX = em * (r * 0.28);
        const emY = -r * 0.28 + Math.abs(em) * 2;
        ctx.beginPath();
        ctx.moveTo(emX - 1.4, emY);
        ctx.lineTo(emX, emY + 4.2);
        ctx.lineTo(emX + 1.4, emY);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Layer C: Razor Frost Specular Edges on Fur Tufts
      ctx.fillStyle = furLit;
      for (let s = -3; s <= 3; s++) {
        const sx = s * (r * 0.24);
        const sy = -r * 0.45 + Math.abs(s) * 2;
        ctx.beginPath();
        ctx.moveTo(sx - 2, sy);
        ctx.lineTo(sx, sy + 6.5);
        ctx.lineTo(sx + 2, sy);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Dorsal Ice Crystal Spines (in Back and 3/4 Back views - Faceted Prisms)
  if (isBackView) {
    const spineCrystalGrd = ctx.createLinearGradient(0, -r * 0.7, 0, 0);
    spineCrystalGrd.addColorStop(0, "#ffffff");
    spineCrystalGrd.addColorStop(0.3, isCrystal ? "#bae6fd" : "#00f0ff");
    spineCrystalGrd.addColorStop(0.7, "#0284c7");
    spineCrystalGrd.addColorStop(1, "#082f49");
    ctx.fillStyle = spineCrystalGrd;

    const spineCount = isBoss ? 4 : 3;
    for (let sp = -spineCount + 1; sp <= 1; sp++) {
      const spy = sp * 7.5 - 6.0;
      // Faceted Diamond Spine
      ctx.beginPath();
      ctx.moveTo(0, spy - 8.5);
      ctx.lineTo(3.2, spy + 1.0);
      ctx.lineTo(0, spy + 4.5);
      ctx.lineTo(-3.2, spy + 1.0);
      ctx.closePath();
      ctx.fill();

      // Specular diamond glint
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(0, spy - 8.5);
      ctx.lineTo(1.2, spy - 4.0);
      ctx.lineTo(0, spy - 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = spineCrystalGrd;
    }
  }

  ctx.restore(); // End Torso

  // -------------------------------------------------------------
  // Neanderthal Chiseled Head & Facial Features (NO ROUND BALL SKULL)
  // -------------------------------------------------------------
  ctx.save();
  const headX = cfg.headX;
  const headY = cfg.headY;
  ctx.translate(headX, headY);
  ctx.rotate(cfg.tilt * 0.7);

  // Skull Base: Angular Faceted Neanderthal Cranium & Jaw
  const headGrd = ctx.createLinearGradient(-10, -12, 10, 10);
  headGrd.addColorStop(0, skinLit);
  headGrd.addColorStop(0.4, skinMid);
  headGrd.addColorStop(0.85, skinShadow);
  headGrd.addColorStop(1, skinOcclusion);
  ctx.fillStyle = headGrd;

  // Polygonal Chiseled Cranium & Square Cut Mandible
  ctx.beginPath();
  ctx.moveTo(0, -13.0);          // Top Cranium Peak
  ctx.lineTo(8.5, -11.0);        // Right Temple Cut
  ctx.lineTo(10.5, -4.5);        // Right Cheekbone Peak
  ctx.lineTo(9.0, 3.5);          // Right Mandible Angle
  ctx.lineTo(5.5, 9.0);          // Right Chin Point
  ctx.lineTo(-5.5, 9.0);         // Left Chin Point
  ctx.lineTo(-9.0, 3.5);         // Left Mandible Angle
  ctx.lineTo(-10.5, -4.5);       // Left Cheekbone Peak
  ctx.lineTo(-8.5, -11.0);       // Left Temple Cut
  ctx.closePath();
  ctx.fill();

  // Cranial Facet Bevel (Light & Shadow Planes)
  ctx.fillStyle = isGlass ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  ctx.moveTo(0, -13.0);
  ctx.lineTo(6.5, -10.5);
  ctx.lineTo(7.5, -4.5);
  ctx.lineTo(0, -5.5);
  ctx.closePath();
  ctx.fill();

  // Glass Visual Effect: Convex Cranium Reflection Sweep
  if (isGlass) {
    drawGlassGlossSheen(ctx, -7, -13, 7, -5, 4.0, 0.75 * glassRefraction);
  }

  // -------------------------------------------------------------
  // Cranial Horns, Crowns, Mohawk Crest & Crystal Formations
  // -------------------------------------------------------------
  if (isChieftain) {
    // Jotunn Giant Chieftain: Majestic Royal Glacial Crown of 5 Horns
    const crownGrd = ctx.createLinearGradient(0, -12, 0, -32);
    crownGrd.addColorStop(0, "#082f49");
    crownGrd.addColorStop(0.35, "#0284c7");
    crownGrd.addColorStop(0.7, "#38bdf8");
    crownGrd.addColorStop(1, "#ffffff");
    ctx.fillStyle = crownGrd;

    // 5-Spike Royal Glacial Horn Crown
    const crownSpikes = [
      { x: 0, height: 26, width: 3.5 },
      { x: -6.5, height: 22, width: 3.0 },
      { x: 6.5, height: 22, width: 3.0 },
      { x: -12.5, height: 16, width: 2.6 },
      { x: 12.5, height: 16, width: 2.6 }
    ];

    for (let c = 0; c < crownSpikes.length; c++) {
      const sp = crownSpikes[c];
      const hx = sp.x;
      const hy = -11.0;
      ctx.beginPath();
      ctx.moveTo(hx - sp.width, hy);
      ctx.lineTo(hx * 1.15, hy - sp.height);
      ctx.lineTo(hx + sp.width, hy);
      ctx.closePath();
      ctx.fill();

      // Sharp central specular ridge
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx * 1.15, hy - sp.height);
      ctx.lineTo(hx * 1.15 + (hx >= 0 ? -0.8 : 0.8), hy - sp.height * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = crownGrd;

      // Gleaming diamond tip glint
      drawPrismaticStarGlint(ctx, hx * 1.15, hy - sp.height, 4.5, 0.9, c * 0.2);
    }
  } else if (isJotunn) {
    // Jotunn Frost Giant: Colossal sweeping mammoth-curved glacial horns
    const hornGrd = ctx.createLinearGradient(0, -12, 0, -28);
    hornGrd.addColorStop(0, "#0f172a");
    hornGrd.addColorStop(0.4, "#0369a1");
    hornGrd.addColorStop(0.85, "#7dd3fc");
    hornGrd.addColorStop(1, "#ffffff");
    ctx.fillStyle = hornGrd;

    const hornSpreads = [-9.5, 9.5];
    for (let h = 0; h < 2; h++) {
      const hx = hornSpreads[h];
      const hDir = h === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(hx - 3.0, -11.0);
      ctx.lineTo(hx + hDir * 8.0, -28.0);
      ctx.lineTo(hx + 3.0, -11.0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(hx, -11.0);
      ctx.lineTo(hx + hDir * 8.0, -28.0);
      ctx.lineTo(hx + hDir * 6.5, -23.0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hornGrd;
    }
  } else if (isCrystal) {
    // Crystalline Frost Colossus: Geometric Faceted Crystal Crest
    const crestGrd = ctx.createLinearGradient(0, -12, 0, -26);
    crestGrd.addColorStop(0, "#0284c7");
    crestGrd.addColorStop(0.5, "#38bdf8");
    crestGrd.addColorStop(1, "#ffffff");
    ctx.fillStyle = crestGrd;

    for (let cp = -1; cp <= 1; cp++) {
      const cpx = cp * 6.5;
      const cpH = 15 - Math.abs(cp) * 4;
      ctx.beginPath();
      ctx.moveTo(cpx - 2.5, -11.0);
      ctx.lineTo(cpx, -11.0 - cpH);
      ctx.lineTo(cpx + 2.5, -11.0);
      ctx.closePath();
      ctx.fill();

      drawPrismaticStarGlint(ctx, cpx, -11.0 - cpH, 4.0, 0.85, cp * 0.3);
    }
  } else if (isBerserker) {
    // Glacial Berserker: Spiky war mohawk mane + asymmetrical combat horn
    ctx.fillStyle = "#f1f5f9";
    for (let m = 0; m < 5; m++) {
      const mx = (m - 2) * 3.5;
      const my = -12.5;
      const mH = 7.5 + Math.sin(m * 1.2) * 3.5;
      ctx.beginPath();
      ctx.moveTo(mx - 2.0, my);
      ctx.lineTo(mx, my - mH);
      ctx.lineTo(mx + 2.0, my);
      ctx.closePath();
      ctx.fill();
    }
    // Single combat horn on right temple
    const hornGrd = ctx.createLinearGradient(0, -12, 8, -24);
    hornGrd.addColorStop(0, "#082f49");
    hornGrd.addColorStop(0.5, "#0284c7");
    hornGrd.addColorStop(1, "#bae6fd");
    ctx.fillStyle = hornGrd;
    ctx.beginPath();
    ctx.moveTo(6.0, -11.0);
    ctx.lineTo(13.0, -23.0);
    ctx.lineTo(9.5, -11.0);
    ctx.closePath();
    ctx.fill();
  } else if (isShaman) {
    // Frost Shaman: Branching Caribou Antler Headdress & Bone Skull Visor
    const antlerGrd = ctx.createLinearGradient(0, -12, 0, -32);
    antlerGrd.addColorStop(0, "#cbd5e1");
    antlerGrd.addColorStop(0.5, "#f1f5f9");
    antlerGrd.addColorStop(1, "#312e81");
    ctx.fillStyle = antlerGrd;

    // Dual Branching Caribou Antlers
    for (let side = -1; side <= 1; side += 2) {
      const ax = side * 7.5;
      // Main Beam
      ctx.beginPath();
      ctx.moveTo(ax - side * 2.0, -11.0);
      ctx.lineTo(ax + side * 10.0, -28.0);
      ctx.lineTo(ax + side * 8.0, -28.0);
      ctx.lineTo(ax, -11.0);
      ctx.closePath();
      ctx.fill();

      // Brow Tine
      ctx.beginPath();
      ctx.moveTo(ax + side * 3.0, -18.0);
      ctx.lineTo(ax + side * 9.0, -18.0);
      ctx.lineTo(ax + side * 4.0, -15.0);
      ctx.closePath();
      ctx.fill();

      // Crown Point
      ctx.beginPath();
      ctx.moveTo(ax + side * 7.0, -24.0);
      ctx.lineTo(ax + side * 13.0, -32.0);
      ctx.lineTo(ax + side * 9.0, -26.0);
      ctx.closePath();
      ctx.fill();

      // Glowing purple star glints on antler tips
      drawPrismaticStarGlint(ctx, ax + side * 13.0, -32.0, 3.2, 0.8, side * 0.2);
    }

    // Carved Bone Skull Half-Mask across upper face
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(0, -13.0);
    ctx.lineTo(8.0, -9.0);
    ctx.lineTo(6.5, -3.0);
    ctx.lineTo(0, -5.0);
    ctx.lineTo(-6.5, -3.0);
    ctx.lineTo(-8.0, -9.0);
    ctx.closePath();
    ctx.fill();
  } else if (isWarrior) {
    // Armored Frost Vanguard: Forged Barbarian Iron Horned War Helm
    const helmGrd = ctx.createLinearGradient(0, -14, 0, -2);
    helmGrd.addColorStop(0, "#475569");
    helmGrd.addColorStop(0.5, "#1e293b");
    helmGrd.addColorStop(1, "#090d16");
    ctx.fillStyle = helmGrd;

    ctx.beginPath();
    ctx.moveTo(0, -14.5);
    ctx.lineTo(9.5, -10.0);
    ctx.lineTo(8.5, -2.5);
    ctx.lineTo(2.0, -2.0);
    ctx.lineTo(1.5, 3.5); // Nasal bridge guard
    ctx.lineTo(-1.5, 3.5);
    ctx.lineTo(-2.0, -2.0);
    ctx.lineTo(-8.5, -2.5);
    ctx.lineTo(-9.5, -10.0);
    ctx.closePath();
    ctx.fill();

    // Steel Rivets on Helm
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(-6, -11, 2, 2);
    ctx.fillRect(0, -13, 2, 2);
    ctx.fillRect(4, -11, 2, 2);

    // Forward Curved Iron Battle Horns on Helm
    const hornGrd = ctx.createLinearGradient(0, -10, 0, -24);
    hornGrd.addColorStop(0, "#334155");
    hornGrd.addColorStop(0.5, "#94a3b8");
    hornGrd.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = hornGrd;
    for (let h = -1; h <= 1; h += 2) {
      const hx = h * 8.5;
      ctx.beginPath();
      ctx.moveTo(hx - 2, -9);
      ctx.lineTo(hx + h * 9, -21);
      ctx.lineTo(hx + 2, -9);
      ctx.closePath();
      ctx.fill();
    }
  } else if (isSnowTroll) {
    // Polar Snow Troll / Yeti: Massive wild arctic blizzard fur ruff framing skull
    ctx.fillStyle = "#ffffff";
    for (let ym = -3; ym <= 3; ym++) {
      const ymx = ym * 3.8;
      const ymy = -12.5;
      const ymH = 7.0 + Math.abs(ym) * 2.2;
      ctx.beginPath();
      ctx.moveTo(ymx - 2.5, ymy);
      ctx.lineTo(ymx, ymy - ymH);
      ctx.lineTo(ymx + 2.5, ymy);
      ctx.closePath();
      ctx.fill();
    }
  } else if (isTundra) {
    // Mountain / Tundra Troll: Rocky Crag Brow with Alpine Lichen Moss
    ctx.fillStyle = "#475569";
    for (let rk = -2; rk <= 2; rk++) {
      const rkx = rk * 4.5;
      const rkH = 6.0 + Math.abs(rk) * 2.0;
      ctx.beginPath();
      ctx.moveTo(rkx - 3, -11.0);
      ctx.lineTo(rkx, -11.0 - rkH);
      ctx.lineTo(rkx + 3, -11.0);
      ctx.closePath();
      ctx.fill();

      // Moss on rock horn
      ctx.fillStyle = "#84cc16";
      ctx.fillRect(rkx - 1.5, -11.0 - rkH * 0.7, 3, 2);
      ctx.fillStyle = "#475569";
    }
  } else if (isGlass) {
    // Vitreous Glass Troll: Twin Prismatic Glass Horns
    const hornGrd = ctx.createLinearGradient(0, -12, 0, -24);
    hornGrd.addColorStop(0, "rgba(2, 132, 199, 0.7)");
    hornGrd.addColorStop(0.4, "rgba(56, 189, 248, 0.85)");
    hornGrd.addColorStop(1, "#ffffff");
    ctx.fillStyle = hornGrd;
    for (let h = -1; h <= 1; h += 2) {
      const hx = h * 7.5;
      ctx.beginPath();
      ctx.moveTo(hx - 2.5, -11.0);
      ctx.lineTo(hx * 1.25, -23.0);
      ctx.lineTo(hx + 2.5, -11.0);
      ctx.closePath();
      ctx.fill();
      drawPrismaticStarGlint(ctx, hx * 1.25, -23.0, 4.5, 0.85 * glassRefraction, h * 0.3);
    }
  }

  // Pointed Angular Troll Ears with Sharp Cartilage Cuts
  const earSpread = isProfileView ? 8.5 : 13.0;
  const earFlip = cfg.flip;

  const drawEar = (earDir) => {
    ctx.save();
    const ex = earDir * earSpread;
    const ey = -4.5;
    const earGrd = ctx.createLinearGradient(ex, ey, ex + earDir * 6.0, ey - 6.5);
    earGrd.addColorStop(0, skinMid);
    earGrd.addColorStop(0.6, skinLit);
    earGrd.addColorStop(1, "#e0f2fe");
    ctx.fillStyle = earGrd;

    // Sharp Triangular Elf/Troll Ear
    ctx.beginPath();
    ctx.moveTo(ex * 0.75, ey - 1.5);
    ctx.lineTo(ex + earDir * 7.0, ey - 7.5); // Sharp needle ear tip
    ctx.lineTo(ex + earDir * 2.0, ey + 3.5);
    ctx.lineTo(ex * 0.8, ey + 4.0);
    ctx.closePath();
    ctx.fill();

    // Inner Cartilage Chisel Cut
    ctx.fillStyle = skinOcclusion;
    ctx.beginPath();
    ctx.moveTo(ex * 0.8, ey);
    ctx.lineTo(ex + earDir * 4.5, ey - 5.0);
    ctx.lineTo(ex + earDir * 1.5, ey + 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  if (!isProfileView) {
    drawEar(-1);
    drawEar(1);
  } else {
    drawEar(earFlip);
  }

  // Front & Profile Facial Features
  if (isFrontView || isProfileView) {
    // Heavy Angular Neanderthal Brow Ridge (Sharp V-Cut Wedge, NO FLAT OVAL DISC)
    const browGrd = ctx.createLinearGradient(0, -7.0, 0, -2.0);
    browGrd.addColorStop(0, "#e0f2fe");
    browGrd.addColorStop(0.4, skinMid);
    browGrd.addColorStop(1, skinOcclusion);
    ctx.fillStyle = browGrd;

    ctx.beginPath();
    ctx.moveTo(0, -3.2);                                  // Center brow V-notch
    ctx.lineTo(isProfileView ? 6.5 : 9.0, -5.5);          // Outer right brow peak
    ctx.lineTo(isProfileView ? 6.0 : 8.5, -2.5);          // Right orbital shelf
    ctx.lineTo(0, -1.8);                                  // Lower glabella notch
    ctx.lineTo(isProfileView ? -6.0 : -8.5, -2.5);        // Left orbital shelf
    ctx.lineTo(isProfileView ? -6.5 : -9.0, -5.5);        // Outer left brow peak
    ctx.closePath();
    ctx.fill();

    // Deep Chiseled Eye Sockets
    ctx.fillStyle = "#04192b";
    const eyeOffsetX = isProfileView ? (earFlip > 0 ? 2.8 : -2.8) : 4.2;

    const drawEye = (ex) => {
      // Angular Diamond Eye Socket
      ctx.fillStyle = "#04192b";
      ctx.beginPath();
      ctx.moveTo(ex, -4.8);
      ctx.lineTo(ex + 3.2, -3.2);
      ctx.lineTo(ex, -1.6);
      ctx.lineTo(ex - 3.2, -3.2);
      ctx.closePath();
      ctx.fill();

      // Variant-Specific Glowing Eye / Diamond Prism
      const eyeColor = isShaman ? "#c084fc" : isSnowTroll ? "#f59e0b" : isWarrior ? "#60a5fa" : isTundra ? "#a3e635" : "#00f0ff";
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.moveTo(ex, -4.2);
      ctx.lineTo(ex + 2.2, -3.2);
      ctx.lineTo(ex, -2.2);
      ctx.lineTo(ex - 2.2, -3.2);
      ctx.closePath();
      ctx.fill();

      // Pure White Horizontal Specular Slit (Fierce Menacing Gaze)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(ex - 1.8, -3.2);
      ctx.lineTo(ex + 1.8, -3.2);
      ctx.lineTo(ex, -3.6);
      ctx.closePath();
      ctx.fill();
    };

    if (isFrontView) {
      drawEye(-eyeOffsetX);
      drawEye(eyeOffsetX);
    } else {
      drawEye(earFlip * 2.4);
    }

    // Ancient Frost Troll 3rd Mystic Forehead Eye
    if (isAncient) {
      const thX = isProfileView ? earFlip * 2.2 : 0;
      const thY = -7.5;
      ctx.fillStyle = "#04192b";
      ctx.beginPath();
      ctx.moveTo(thX, thY - 3.2);
      ctx.lineTo(thX + 2.4, thY);
      ctx.lineTo(thX, thY + 3.2);
      ctx.lineTo(thX - 2.4, thY);
      ctx.closePath();
      ctx.fill();

      const eyePulse = Math.sin(nowMs * 0.005) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(0, 240, 255, ${0.95 * eyePulse})`;
      ctx.beginPath();
      ctx.moveTo(thX, thY - 2.2);
      ctx.lineTo(thX + 1.8, thY);
      ctx.lineTo(thX, thY + 2.2);
      ctx.lineTo(thX - 1.8, thY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(thX, thY, 0.8, 0, Math.PI * 2);
      ctx.fill();

      drawPrismaticStarGlint(ctx, thX, thY, 3.5, 0.75 * eyePulse, 0.2);
    }

    // Tribal War Paint Slashes across Face for Berserker
    if (isBerserker) {
      ctx.fillStyle = "#ffffff";
      const wx = isProfileView ? earFlip * 2.0 : 0;
      ctx.beginPath();
      ctx.moveTo(wx - 7, -2);
      ctx.lineTo(wx - 2, 4);
      ctx.lineTo(wx - 2, 6);
      ctx.lineTo(wx - 7, 0);
      ctx.closePath();
      ctx.fill();

      if (!isProfileView) {
        ctx.beginPath();
        ctx.moveTo(wx + 7, -2);
        ctx.lineTo(wx + 2, 4);
        ctx.lineTo(wx + 2, 6);
        ctx.lineTo(wx + 7, 0);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Heavy Chiseled Nose Bridge (Polygonal Wedge)
    ctx.fillStyle = skinMid;
    ctx.beginPath();
    ctx.moveTo(0, -2.5);
    ctx.lineTo(2.2, 2.0);
    ctx.lineTo(0, 3.2);
    ctx.lineTo(-2.2, 2.0);
    ctx.closePath();
    ctx.fill();

    // 3D Carved Ivory / Optical Glass Underbite Canines (Sharp Faceted Dagger Tusks)
    const tuskGrd = ctx.createLinearGradient(0, 7, 0, -3);
    if (isGlass) {
      tuskGrd.addColorStop(0, "rgba(2, 132, 199, 0.65)");
      tuskGrd.addColorStop(0.35, "rgba(56, 189, 248, 0.85)");
      tuskGrd.addColorStop(1, "#ffffff");
    } else {
      tuskGrd.addColorStop(0, "#713f12");
      tuskGrd.addColorStop(0.3, "#fef08a");
      tuskGrd.addColorStop(1, "#ffffff");
    }
    ctx.fillStyle = tuskGrd;

    const drawTusk = (tx, dirSign) => {
      // Faceted Dagger-Tusk (Polygonal Bevel)
      ctx.beginPath();
      ctx.moveTo(tx - 1.6, 6.5);
      ctx.lineTo(tx + dirSign * 2.8, -3.5); // Needle Tip
      ctx.lineTo(tx + 1.6, 6.5);
      ctx.closePath();
      ctx.fill();

      // Sharp Specular Edge
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(tx, 6.0);
      ctx.lineTo(tx + dirSign * 2.8, -3.5);
      ctx.lineTo(tx + dirSign * 1.2, -3.5);
      ctx.closePath();
      ctx.fill();

      // Glass Tip Diamond Star Glint
      if (isGlass) {
        drawPrismaticStarGlint(ctx, tx + dirSign * 2.8, -3.5, 3.2, 0.85 * glassRefraction, dirSign * 0.25);
      }
      ctx.fillStyle = tuskGrd;
    };

    if (isFrontView) {
      drawTusk(-4.8, -1);
      drawTusk(4.8, 1);
    } else {
      drawTusk(earFlip * 3.8, earFlip);
    }

    // Ancient Frost Troll Chin Icicle Stalactites
    if (isAncient) {
      ctx.fillStyle = "#bae6fd";
      for (let c = -1; c <= 1; c++) {
        const cx = isProfileView ? (earFlip * 3.5 + c * 2.2) : (c * 3.2);
        const cy = 8.8;
        const clen = 4.5 + Math.abs(c) * 2.2;
        ctx.beginPath();
        ctx.moveTo(cx - 1.2, cy);
        ctx.lineTo(cx, cy + clen);
        ctx.lineTo(cx + 1.2, cy);
        ctx.closePath();
        ctx.fill();
      }
    } else if (isSnowTroll) {
      // Ferocious Upper Sabre Fangs (curving downwards) + White Fur Chin Tuft
      ctx.fillStyle = "#ffffff";
      const fx1 = isProfileView ? earFlip * 2.5 : -3.8;
      const fx2 = isProfileView ? earFlip * 2.5 : 3.8;
      ctx.beginPath();
      ctx.moveTo(fx1 - 1.2, -1.0);
      ctx.lineTo(fx1, 6.0);
      ctx.lineTo(fx1 + 1.2, -1.0);
      ctx.closePath();
      ctx.fill();
      if (!isProfileView) {
        ctx.beginPath();
        ctx.moveTo(fx2 - 1.2, -1.0);
        ctx.lineTo(fx2, 6.0);
        ctx.lineTo(fx2 + 1.2, -1.0);
        ctx.closePath();
        ctx.fill();
      }
      // Snowy chin tuft
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(-4.5, 8.5);
      ctx.lineTo(4.5, 8.5);
      ctx.lineTo(0, 15.0);
      ctx.closePath();
      ctx.fill();
    } else if (isShaman) {
      // Dangling Bone Talisman & Purple Runic Bead on chin
      const bx = isProfileView ? earFlip * 2.5 : 0;
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(bx - 1.5, 9.0, 3.0, 3.0);
      ctx.fillStyle = "#c084fc";
      ctx.fillRect(bx - 1.0, 12.0, 2.0, 2.0);
      ctx.fillStyle = "#3730a3";
      ctx.beginPath();
      ctx.moveTo(bx - 1.5, 14.0);
      ctx.lineTo(bx + 1.5, 14.0);
      ctx.lineTo(bx, 20.0);
      ctx.closePath();
      ctx.fill();
    } else if (isTundra) {
      // Moss-tufted chin beard
      const bx = isProfileView ? earFlip * 3.0 : 0;
      ctx.fillStyle = "#84cc16";
      ctx.beginPath();
      ctx.moveTo(bx - 3.5, 8.5);
      ctx.lineTo(bx + 3.5, 8.5);
      ctx.lineTo(bx, 14.5);
      ctx.closePath();
      ctx.fill();
    } else if (isWarrior) {
      // Iron chin guard plate
      const bx = isProfileView ? earFlip * 3.0 : 0;
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(bx - 4.5, 8.0);
      ctx.lineTo(bx + 4.5, 8.0);
      ctx.lineTo(bx + 3.0, 13.0);
      ctx.lineTo(bx - 3.0, 13.0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(bx - 1, 9.5, 2, 2);
    }

    // Long Braided Frozen Beard for Jotunn & Chieftain
    if (isJotunn) {
      const bFlip = cfg.flip;
      const bx = isProfileView ? bFlip * 3.5 : 0;
      const by = 8.5;
      const beardLen = isChieftain ? 18.0 : 15.0;

      if (isChieftain) {
        // Twin Braids with Golden Clasps
        for (let side = -1; side <= 1; side += 2) {
          const braidX = isProfileView ? (bx + side * 2) : (side * 4.5);
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath();
          ctx.moveTo(braidX - 2.5, by);
          ctx.lineTo(braidX + 2.5, by);
          ctx.lineTo(braidX + 1.5, by + beardLen);
          ctx.lineTo(braidX, by + beardLen + 4);
          ctx.lineTo(braidX - 1.5, by + beardLen);
          ctx.closePath();
          ctx.fill();

          // Golden Clasps
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(braidX - 2.0, by + 5, 4.0, 2.2);
          ctx.fillRect(braidX - 1.8, by + 11, 3.6, 2.2);

          // Ice stalactite tip
          ctx.fillStyle = "#7dd3fc";
          ctx.beginPath();
          ctx.moveTo(braidX - 1.2, by + beardLen);
          ctx.lineTo(braidX, by + beardLen + 6);
          ctx.lineTo(braidX + 1.2, by + beardLen);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // Single massive braided beard with runic stone bead
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath();
        ctx.moveTo(bx - 4.5, by);
        ctx.lineTo(bx + 4.5, by);
        ctx.lineTo(bx + 2.5, by + beardLen);
        ctx.lineTo(bx, by + beardLen + 4.5);
        ctx.lineTo(bx - 2.5, by + beardLen);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#64748b";
        ctx.fillRect(bx - 3.0, by + 6, 6.0, 3.0);
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(bx - 1.0, by + 7, 2.0, 1.0);

        ctx.fillStyle = "#93c5fd";
        ctx.beginPath();
        ctx.moveTo(bx - 2.0, by + beardLen);
        ctx.lineTo(bx, by + beardLen + 5.5);
        ctx.lineTo(bx + 2.0, by + beardLen);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else {
    // Back View: Clean Snowy Cranial Ridge (No Clutter)
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -12.5);
    ctx.lineTo(7.0, -10.5);
    ctx.lineTo(5.5, -9.0);
    ctx.lineTo(0, -10.0);
    ctx.lineTo(-5.5, -9.0);
    ctx.lineTo(-7.0, -10.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore(); // End Head

  // -------------------------------------------------------------
  // Layer Sorting: Foreground Limbs
  // -------------------------------------------------------------
  if (cfg.rightArmFront) {
    drawArm(cfg.rightArmX, cfg.rightArmY, true, true);
  }
  if (cfg.leftArmFront) {
    drawArm(cfg.leftArmX, cfg.leftArmY, false, true);
  }

  // Front half of Orbiting Floating Crystal Shards (for Crystalline Colossus)
  drawOrbitingCrystals(true);

  // -------------------------------------------------------------
  // Ambient Blizzard Snowflake & Prismatic Glass Motes
  // -------------------------------------------------------------
  if (isChieftain) {
    // Floating Runic Motes around Chieftain Crown
    for (let rm = 0; rm < 3; rm++) {
      const rmPhase = (nowMs * 0.002 + rm * 2.1) % (Math.PI * 2);
      const rmX = Math.cos(rmPhase) * 22;
      const rmY = -r * 0.85 + Math.sin(rmPhase) * 8;
      ctx.fillStyle = "rgba(0, 240, 255, 0.85)";
      ctx.beginPath();
      ctx.moveTo(rmX, rmY - 3);
      ctx.lineTo(rmX + 2, rmY);
      ctx.lineTo(rmX, rmY + 3);
      ctx.lineTo(rmX - 2, rmY);
      ctx.closePath();
      ctx.fill();
      drawPrismaticStarGlint(ctx, rmX, rmY, 3.2, 0.75, rmPhase);
    }
  } else if (isGlass) {
    const moteCount = isBoss ? 8 : 5;
    for (let gm = 0; gm < moteCount; gm++) {
      const gmPhase = (nowMs * 0.0014 + gm * 1.45 + seed) % (Math.PI * 2);
      const gmDist = 24 + Math.sin(gmPhase * 1.3) * 14;
      const gmAng = gmPhase * 1.35 + gm * 1.1;
      const gmX = Math.cos(gmAng) * gmDist;
      const gmY = Math.sin(gmAng) * (gmDist * 0.62) - 6;
      const gmAlpha = (Math.sin(gmPhase) * 0.45 + 0.5) * glassRefraction;
      const gmRot = gmPhase * 2.2;
      const gmSize = 1.8 + Math.sin(gmPhase * 2.0) * 0.8;
      drawPrismaticStarGlint(ctx, gmX, gmY, gmSize, gmAlpha, gmRot);
    }
  } else if (isCrystal) {
    const moteCount = 5;
    for (let cm = 0; cm < moteCount; cm++) {
      const cmPhase = (nowMs * 0.0018 + cm * 1.3) % (Math.PI * 2);
      const cmDist = 22 + Math.sin(cmPhase * 1.5) * 10;
      const cmAng = cmPhase * 1.4 + cm;
      const cmX = Math.cos(cmAng) * cmDist;
      const cmY = Math.sin(cmAng) * (cmDist * 0.55) - 8;
      drawPrismaticStarGlint(ctx, cmX, cmY, 2.6, 0.7, cmPhase);
    }
  } else if (isShaman) {
    // Floating mystical aurora motes & elder runes
    for (let sm = 0; sm < 4; sm++) {
      const smPhase = (nowMs * 0.0025 + sm * 1.5) % (Math.PI * 2);
      const smX = Math.cos(smPhase) * 24;
      const smY = -r * 0.7 + Math.sin(smPhase) * 12;
      ctx.fillStyle = sm % 2 === 0 ? "rgba(192, 132, 252, 0.85)" : "rgba(0, 240, 255, 0.85)";
      ctx.fillRect(smX - 1.5, smY - 1.5, 3, 3);
      drawPrismaticStarGlint(ctx, smX, smY, 2.8, 0.7, smPhase);
    }
  } else if (isSnowTroll) {
    // Swirling blizzard snow flurry trail
    for (let fl = 0; fl < 8; fl++) {
      const flPhase = (nowMs * 0.0028 + fl * 0.8) % (Math.PI * 2);
      const flDist = 18 + Math.sin(flPhase * 1.5) * 16;
      const flX = Math.cos(flPhase * 2) * flDist;
      const flY = Math.sin(flPhase) * (flDist * 0.7) - 6;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillRect(flX - 1, flY - 1, 2, 2);
    }
  } else if (isBerserker || isJotunn || isAncient || isWarrior || isTundra) {
    const flakeCount = isBoss ? 6 : 4;
    for (let fl = 0; fl < flakeCount; fl++) {
      const flPhase = (nowMs * 0.0015 + fl * 1.8 + seed) % (Math.PI * 2);
      const flDist = 24 + Math.sin(flPhase) * 12;
      const flAng = flPhase * 1.5 + fl;
      const flX = Math.cos(flAng) * flDist;
      const flY = Math.sin(flAng) * (flDist * 0.6) - 4;
      const flAlpha = Math.sin(flPhase) * 0.5 + 0.5;

      ctx.fillStyle = `rgba(255, 255, 255, ${flAlpha * 0.85})`;
      ctx.beginPath();
      ctx.moveTo(flX, flY - 1.5);
      ctx.lineTo(flX + 1.5, flY);
      ctx.lineTo(flX, flY + 1.5);
      ctx.lineTo(flX - 1.5, flY);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore(); // Root
}

export function drawFrostTroll(ctx, screenX, screenY, sSize, type, ent, isShadowPass = false) {
  if (!ent) ent = {};
  if (type && typeof type === "string") ent.type = type;
  drawFrostTrollEntity(ctx, screenX, screenY, ent, isShadowPass);
}

// --- Family: Goblin ---
// goblins.js - Procedural 8-Directional Segmented Goblin Entity Renderer


const MAGE_REGEX = /mage|shaman|occult/i;
const ARCHER_REGEX = /archer|bow|hunter|ranger/i;
const THIEF_REGEX = /thief|rogue|assassin|dagger|scout/i;

// Persistent cycle tracker ensuring exactly 1 arrow release per archer attack cycle across frames
const _archerFiredCycleMap = new Map();

export function drawGoblinEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};
  const type = ent.type || "goblin";
  const lowDetail = typeof window !== "undefined" && !!(window.CrowdLOD && window.CrowdLOD.current);
  const isSlowed = !!ent.isSlowed;
  const facingAngle = ent.facingAngle || 0;
  const moving = !!(ent.moving || ent.isMoving);
  if (ent._seed === undefined) {
    const id = ent.id || ("goblin_" + Math.round(x) + "_" + Math.round(y));
    // Bolt Opt: String Allocation Elimination - Replaced parseInt and .substring with zero-allocation computeFastSeed
    ent._seed = computeFastSeed(id);
  }
  const seed = ent._seed;

  // Attack state detection
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  const nowMs = performance.now();
  if (!isAttacking && typeof GameState !== "undefined" && GameState.combatAnimations && ent && ent.id) {
    for (let i = 0; i < GameState.combatAnimations.length; i++) {
      const anim = GameState.combatAnimations[i];
      const dur = anim.duration || anim.durationMs || 450;
      if (anim.attackerId === ent.id && nowMs - anim.createdAt < dur) {
        isAttacking = true;
        break;
      }
    }
  }

  // Archetype & Identity Mapping
  const isBasicGoblin = type === "goblin";
  const isMage = MAGE_REGEX.test(type);
  const isArcher = ARCHER_REGEX.test(type);
  const isThief = THIEF_REGEX.test(type);
  const isBrute = type.includes("brute");
  const isWarrior = type.includes("warrior") || isBrute;
  const isKing = type === "boss_goblin_king";
  const isChieftain = type === "boss_goblin" || type.includes("chieftain") || type === "chieftain";
  const isBoss = isKing || isChieftain || /^boss_/.test(type);
  const scale = isKing ? 2.9 : isBrute ? 2.3 : isBoss ? 2.25 : isBasicGoblin ? 1.7 : 1.8;

  // -------------------------------------------------------------
  // 8-Direction Mathematical Sector Mapping
  // 0: E, 1: SE, 2: S, 3: SW, 4: W, 5: NW, 6: N, 7: NE
  // -------------------------------------------------------------
  const normAngle = ((facingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dirIndex = Math.floor(((normAngle + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));

  // -------------------------------------------------------------
  // True 3D Anatomical Octagonal Matrix
  // Dual-Arm Coordination with Dynamic Depth Sorting in All 8 Angles
  // -------------------------------------------------------------
  const octagonalMatrix = [
    // 0: East (E) - Side Profile facing Right (Right arm far side = behind, Left arm near side = front)
    {
      dir: "E", view: "side", flip: 1, tilt: 0.14,
      headX: 2.0, headY: -18.5, earSpread: 15.0,
      tailX: -10.0, tailY: -2.0, tailFront: false,
      rightArmX: 2.0, rightArmY: -9.5, rightArmFront: false,
      leftArmX: -1.2, leftArmY: -8.8, leftArmFront: true,
      rightLegHipX: -0.6, rightLegFootX: -1.2, rightLegFront: false,
      leftLegHipX: 0.6, leftLegFootX: 1.4,
      facingDirX: 1.0,
      earringVisible: false
    },
    // 1: South-East (SE) - 3/4 Front facing Down-Right (Right arm far side = behind, Left arm near side = front)
    {
      dir: "SE", view: "front_diag", flip: 1, tilt: 0.08,
      headX: 1.4, headY: -18.0, earSpread: 17.5,
      tailX: -7.5, tailY: -0.5, tailFront: false,
      rightArmX: -3.2, rightArmY: -9.5, rightArmFront: false,
      leftArmX: 4.2, leftArmY: -9.0, leftArmFront: true,
      rightLegHipX: -2.4, rightLegFootX: -2.6, rightLegFront: false,
      leftLegHipX: 2.2, leftLegFootX: 3.4,
      facingDirX: 0.7,
      earringVisible: true, earringScreenRight: true
    },
    // 2: South (S) - Direct Front facing Camera (Both arms in foreground)
    {
      dir: "S", view: "front", flip: 1, tilt: 0.00,
      headX: 0.0, headY: -17.8, earSpread: 18.5,
      tailX: 0.0, tailY: 1.0, tailFront: false,
      rightArmX: -4.4, rightArmY: -9.5, rightArmFront: true,
      leftArmX: 4.4, leftArmY: -9.5, leftArmFront: true,
      rightLegHipX: -3.2, rightLegFootX: -3.6, rightLegFront: true,
      leftLegHipX: 3.2, leftLegFootX: 3.6,
      facingDirX: 0.0,
      earringVisible: true, earringScreenRight: true
    },
    // 3: South-West (SW) - 3/4 Front facing Down-Left (Right arm near side = front, Left arm far side = behind)
    {
      dir: "SW", view: "front_diag", flip: -1, tilt: -0.08,
      headX: -1.4, headY: -18.0, earSpread: 17.5,
      tailX: 7.5, tailY: -0.5, tailFront: false,
      rightArmX: -3.8, rightArmY: -9.5, rightArmFront: true,
      leftArmX: 3.2, leftArmY: -9.0, leftArmFront: false,
      rightLegHipX: -2.2, rightLegFootX: -3.4, rightLegFront: true,
      leftLegHipX: 2.4, leftLegFootX: 2.6,
      facingDirX: -0.7,
      earringVisible: true, earringScreenRight: true
    },
    // 4: West (W) - Side Profile facing Left (Right arm near side = front, Left arm far side = behind)
    {
      dir: "W", view: "side", flip: -1, tilt: -0.14,
      headX: -2.0, headY: -18.5, earSpread: 15.0,
      tailX: 10.0, tailY: -2.0, tailFront: false,
      rightArmX: -2.8, rightArmY: -9.5, rightArmFront: true,
      leftArmX: 1.2, leftArmY: -8.8, leftArmFront: false,
      rightLegHipX: -0.6, rightLegFootX: -1.4, rightLegFront: true,
      leftLegHipX: 0.6, leftLegFootX: 1.2,
      facingDirX: -1.0,
      earringVisible: true, earringScreenRight: false
    },
    // 5: North-West (NW) - 3/4 Back facing Up-Left (Right arm far side = behind, Left arm near side = front)
    {
      dir: "NW", view: "back_diag", flip: -1, tilt: -0.08,
      headX: -1.2, headY: -19.2, earSpread: 17.5,
      tailX: 6.5, tailY: 5.5, tailFront: true,
      rightArmX: 3.5, rightArmY: -9.5, rightArmFront: false,
      leftArmX: -3.8, leftArmY: -9.0, leftArmFront: true,
      rightLegHipX: -2.2, rightLegFootX: -3.0, rightLegFront: true,
      leftLegHipX: 2.4, leftLegFootX: 2.4,
      facingDirX: -0.7,
      earringVisible: true, earringScreenRight: false
    },
    // 6: North (N) - Direct Back facing Up (Both arms layered in background)
    {
      dir: "N", view: "back", flip: 1, tilt: 0.00,
      headX: 0.0, headY: -19.5, earSpread: 18.0,
      tailX: 0.0, tailY: 6.5, tailFront: true,
      rightArmX: 4.4, rightArmY: -9.5, rightArmFront: false,
      leftArmX: -4.4, leftArmY: -9.5, leftArmFront: false,
      rightLegHipX: -3.2, rightLegFootX: -3.6, rightLegFront: false,
      leftLegHipX: 3.2, leftLegFootX: 3.6,
      facingDirX: 0.0,
      earringVisible: true, earringScreenRight: false
    },
    // 7: North-East (NE) - 3/4 Back facing Up-Right (Right arm near side = front, Left arm far side = behind)
    {
      dir: "NE", view: "back_diag", flip: 1, tilt: 0.08,
      headX: 1.2, headY: -19.2, earSpread: 17.5,
      tailX: -6.5, tailY: 5.5, tailFront: true,
      rightArmX: 3.5, rightArmY: -9.5, rightArmFront: true,
      leftArmX: -3.2, leftArmY: -9.0, leftArmFront: false,
      rightLegHipX: -2.4, rightLegFootX: -2.4, rightLegFront: false,
      leftLegHipX: 2.2, leftLegFootX: 3.0,
      facingDirX: 0.7,
      earringVisible: true, earringScreenRight: false
    }
  ];

  const cfg = octagonalMatrix[dirIndex] || octagonalMatrix[2];
  const isBackView = cfg.view === "back" || cfg.view === "back_diag";
  const isFrontView = cfg.view === "front" || cfg.view === "front_diag";
  const isProfileView = cfg.view === "side";
  const isDiagView = cfg.view === "front_diag" || cfg.view === "back_diag";

  // -------------------------------------------------------------
  // Cohesive Animation Kinetics (Breathing, Scampering, Lunging)
  // -------------------------------------------------------------
  const speedFactor = isSlowed ? 0.5 : 1.0;
  const walkSpeedMult = isBasicGoblin ? 0.012 : 0.010;
  const walkPhase = (nowMs * walkSpeedMult * speedFactor + seed) % (Math.PI * 2);
  const breathCycle = Math.sin(nowMs * 0.003 + seed) * 0.35;

  const bounce = moving ? Math.abs(Math.sin(walkPhase)) * 2.6 : breathCycle;
  const legSwing = moving ? Math.sin(walkPhase) * 4.8 : 0;

  // Attack 4-Phase Progress
  let attackProgress = 0;
  if (isAttacking) {
    let animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
    if (typeof GameState !== "undefined" && GameState.combatAnimations) {
      for (let i = 0; i < GameState.combatAnimations.length; i++) {
        if (GameState.combatAnimations[i].attackerId === ent.id) {
          animStart = GameState.combatAnimations[i].createdAt;
          break;
        }
      }
    }
    attackProgress = Math.min(1.0, Math.max(0, (nowMs - animStart) / 360));
  }

  // Directional Attack Lunge Vector
  let lungeX = 0;
  let lungeY = 0;
  let squashX = 1;
  let squashY = 1;

  if (moving) {
    squashY = 1 - Math.abs(Math.sin(walkPhase)) * 0.06;
    squashX = 1 + Math.abs(Math.sin(walkPhase)) * 0.04;
  }

  if (isAttacking && attackProgress > 0) {
    const atkDirX = Math.cos(facingAngle);
    const atkDirY = Math.sin(facingAngle);
    if (isArcher) {
      if (attackProgress < 0.52) {
        // Draw bow: steady archer footing, subtle lean back
        const t = attackProgress / 0.52;
        squashY = 1 - t * 0.04;
        squashX = 1 + t * 0.03;
        lungeX = -atkDirX * t * 1.6;
        lungeY = -atkDirY * t * 1.6;
      } else {
        // Release: bow recoil bump
        const t = (attackProgress - 0.52) / 0.48;
        const recoil = Math.sin(t * Math.PI) * Math.exp(-t * 3);
        lungeX = -atkDirX * 1.6 + atkDirX * recoil * 1.8;
        lungeY = -atkDirY * 1.6 + atkDirY * recoil * 1.8;
      }
    } else if (attackProgress < 0.25) {
      const t = attackProgress / 0.25;
      squashY = 1 - t * 0.10;
      squashX = 1 + t * 0.06;
      lungeX = -atkDirX * t * 2.2;
      lungeY = -atkDirY * t * 2.2;
    } else if (attackProgress < 0.65) {
      const t = (attackProgress - 0.25) / 0.40;
      const stretch = Math.sin(t * Math.PI);
      squashY = 1 + stretch * 0.15;
      squashX = 1 - stretch * 0.07;
      lungeX = atkDirX * stretch * 6.0;
      lungeY = atkDirY * stretch * 4.0;
    }
  }

  // Automatic Arrow Release for Goblin Archer (Guaranteed exactly 1 arrow per basic attack cycle)
  const archerEntKey = ent.id || ("goblin_" + Math.round(x) + "_" + Math.round(y));
  if (!isShadowPass && isArcher && isAttacking && attackProgress >= 0.52) {
    const animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || (ent.currentCast ? ent.currentCast.startTime : null);
    let cycleKey = animStart;
    if (!cycleKey) {
      if (!ent._attackCycleStart) {
        ent._attackCycleStart = nowMs;
      }
      cycleKey = ent._attackCycleStart;
    }

    const lastFired = _archerFiredCycleMap.get(archerEntKey) || ent._lastArrowFiredCycle;
    if (lastFired !== cycleKey) {
      _archerFiredCycleMap.set(archerEntKey, cycleKey);
      ent._lastArrowFiredCycle = cycleKey;
      const launchX = x + Math.cos(facingAngle) * 16 * scale;
      const launchY = y - (9.5 * scale) + Math.sin(facingAngle) * 16 * scale;
      shootGoblinArrow({
        x: launchX,
        y: launchY,
        angle: facingAngle,
        sourceId: ent.id || "goblin_archer",
        speed: 720
      });
    }
  } else if (!isAttacking) {
    _archerFiredCycleMap.delete(archerEntKey);
    ent._lastArrowFiredCycle = null;
    ent._attackCycleStart = null;
  }

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // Harmonic Natural Goblin Palette (Earthy Moss & Forest Darks)
  // -------------------------------------------------------------
  const skinBase = isSlowed ? "#38bdf8" : isThief ? "#1f5f30" : isMage ? "#1b6350" : isChieftain ? "#1e5e32" : isWarrior ? "#287038" : isBrute ? "#1e562c" : isKing ? "#34853d" : "#2d7a38";
  const skinDark = isSlowed ? "#0284c7" : isThief ? "#123d1e" : isMage ? "#104235" : isChieftain ? "#103c1e" : isWarrior ? "#164622" : isBrute ? "#10361a" : isKing ? "#1d5225" : "#1a4c23";
  const innerEar = isSlowed ? "#0284c7" : isMage ? "#0d3b2f" : "#14401e";
  const eyeColor = isMage ? "#c084fc" : isKing ? "#fbbf24" : isChieftain ? "#ea580c" : isThief ? "#f97316" : isWarrior ? "#ea580c" : "#facc15";

  // Ground shadow circle removed per design rule: never render solid shadow circles around monsters

  ctx.save();
  ctx.translate(x + lungeX, y + lungeY - bounce);
  ctx.scale(scale * squashX, scale * squashY);

  // Invariant Anatomical Anchors
  const torsoX = 0;
  const torsoY = -9.5;
  const hunchTilt = cfg.tilt;
  const headX = cfg.headX;
  const headY = cfg.headY;

  // -------------------------------------------------------------
  // 2. Sinewy Whiplike Tail (Anchored to Pelvis) - Lineless
  // -------------------------------------------------------------
  const drawTail = () => {
    ctx.save();
    const tailWave = Math.sin(nowMs * 0.008 + seed) * 2.8 + (moving ? -cfg.flip * Math.cos(walkPhase) * 3.6 : 0);
    const tailBaseX = torsoX - (isProfileView ? cfg.flip * 4.5 : 0);
    const tailBaseY = torsoY + 4.2;
    const tailTipX = tailBaseX + cfg.tailX + (isProfileView ? tailWave * 0.3 : tailWave * 0.8);
    const tailTipY = tailBaseY + cfg.tailY + (isProfileView ? tailWave * 0.7 : Math.abs(tailWave) * 0.4);

    // Lineless tail body with natural skin tone
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 2.0;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailBaseX, tailBaseY);
    ctx.quadraticCurveTo(tailBaseX - (isProfileView ? cfg.flip * 4.0 : 0), tailBaseY + 1.8, tailTipX, tailTipY);
    ctx.stroke();

    // Sharp Tail Barb (Lineless filled shape)
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.moveTo(tailTipX, tailTipY);
    ctx.lineTo(tailTipX - cfg.flip * 2.2, tailTipY - 1.8);
    ctx.lineTo(tailTipX - cfg.flip * 0.8, tailTipY);
    ctx.lineTo(tailTipX - cfg.flip * 2.2, tailTipY + 1.8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  if (!cfg.tailFront) {
    drawTail();
  }

  // -------------------------------------------------------------
  // Dedicated Procedural 8-Direction & Continuous Aiming Goblin Archer System
  // Physically connects bow arm, draw arm, bowstring, and arrow at facingAngle
  // -------------------------------------------------------------
  const drawArcherEquipment = (isForegroundPass) => {
    if (isShadowPass || !isArcher) return;

    const aimAngle = normAngle;
    const dx = Math.cos(aimAngle);
    const dy = Math.sin(aimAngle);
    const px = -dy; // perpendicular vector X (-sin)
    const py = dx;  // perpendicular vector Y (cos)

    // 2.5D Layer depth:
    // When aiming upward/North (dy < -0.2), the extended bow is in the background behind the torso.
    const isBowInBackground = dy < -0.2;

    // Draw cycle kinematics
    let drawTension = 0;
    let stringTwang = 0;
    let isArrowLoaded = true;
    let arrowLoadProgress = 1.0;

    if (isAttacking) {
      if (attackProgress < 0.52) {
        drawTension = Math.sin((attackProgress / 0.52) * (Math.PI / 2));
        isArrowLoaded = true;
        arrowLoadProgress = 1.0;
      } else if (attackProgress < 0.72) {
        const relT = attackProgress - 0.52;
        stringTwang = Math.sin(relT * 60) * Math.exp(-relT * 12) * 2.8;
        drawTension = 0;
        isArrowLoaded = false;
      } else {
        const nockT = (attackProgress - 0.72) / 0.28;
        drawTension = 0;
        isArrowLoaded = true;
        arrowLoadProgress = nockT;
      }
    } else {
      drawTension = 0.0;
      isArrowLoaded = true;
      arrowLoadProgress = 1.0;
    }

    const chestX = torsoX;
    const chestY = torsoY;

    // Bow reach from chest along aim direction
    const bowReach = 11.2 + drawTension * 1.5;
    const bowHandleX = chestX + dx * bowReach;
    const bowHandleY = chestY + dy * bowReach;

    // Nock position along aim vector behind bow handle
    const baseNockDist = 5.0;
    const pullDist = 6.2 * drawTension;
    const nockDist = baseNockDist + pullDist - stringTwang;
    const drawHandX = bowHandleX - dx * nockDist;
    const drawHandY = bowHandleY - dy * nockDist;

    // Anatomical shoulders on goblin torso
    const bowShoulderX = chestX + px * 2.6 + dx * 1.0;
    const bowShoulderY = chestY + py * 2.6 + dy * 1.0;
    const drawShoulderX = chestX - px * 2.6 - dx * 1.2;
    const drawShoulderY = chestY - py * 2.6 - dy * 1.2;

    // If bow is in background and this is foreground pass:
    // Only render the draw arm and hand over the torso/back!
    if (isBowInBackground && isForegroundPass) {
      ctx.save();
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.ellipse(drawShoulderX, drawShoulderY, 2.4, 2.0, aimAngle, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = skinDark;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(drawShoulderX, drawShoulderY);
      ctx.lineTo(drawHandX, drawHandY);
      ctx.stroke();

      ctx.fillStyle = "#5c2b09";
      ctx.beginPath();
      ctx.arc(drawHandX, drawHandY, 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(drawHandX + dx * 0.4, drawHandY + dy * 0.4, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // If bow is in foreground and this is background pass:
    // Render far shoulder behind the torso in side views
    if (!isBowInBackground && !isForegroundPass) {
      const farX = dx >= 0 ? drawShoulderX : bowShoulderX;
      const farY = dx >= 0 ? drawShoulderY : bowShoulderY;
      ctx.save();
      ctx.fillStyle = skinDark;
      ctx.beginPath();
      ctx.ellipse(farX, farY, 2.4, 1.9, aimAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Main Bow & Arms Pass
    ctx.save();

    // 1. Bow Arm
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.ellipse(bowShoulderX, bowShoulderY, 2.6, 2.1, aimAngle, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bowShoulderX, bowShoulderY);
    ctx.lineTo(bowHandleX, bowHandleY);
    ctx.stroke();

    // Leather Bracer on bow arm
    const bracerMidX = (bowShoulderX + bowHandleX * 2) / 3;
    const bracerMidY = (bowShoulderY + bowHandleY * 2) / 3;
    ctx.strokeStyle = "#3b2314";
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(bracerMidX - dx * 1.5, bracerMidY - dy * 1.5);
    ctx.lineTo(bracerMidX + dx * 1.5, bracerMidY + dy * 1.5);
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(bracerMidX, bracerMidY, 0.65, 0, Math.PI * 2);
    ctx.fill();

    // 2. Draw Arm (if bow is in foreground)
    if (!isBowInBackground) {
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.ellipse(drawShoulderX, drawShoulderY, 2.4, 2.0, aimAngle, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = skinDark;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(drawShoulderX, drawShoulderY);
      ctx.lineTo(drawHandX, drawHandY);
      ctx.stroke();

      ctx.fillStyle = "#5c2b09";
      ctx.beginPath();
      ctx.arc(drawHandX, drawHandY, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Bow, Bowstring, Arrow & Claws (Transformed to bow handle and rotated along aimAngle)
    ctx.save();
    ctx.translate(bowHandleX, bowHandleY);
    ctx.rotate(aimAngle);

    // Bow Limb Flexing under tension
    const flexX = -1.8 - drawTension * 3.4;
    const topTipX = flexX;
    const topTipY = -12.5;
    const botTipX = flexX;
    const botTipY = 12.5;

    // Upper Recurve Limb
    ctx.strokeStyle = "#5a2d0c";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2.6 + flexX * 0.4, -6.5, topTipX, topTipY);
    ctx.stroke();

    // Upper inner belly laminate
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2.0 + flexX * 0.4, -6.5, topTipX - 0.5, topTipY);
    ctx.stroke();

    // Lower Recurve Limb
    ctx.strokeStyle = "#5a2d0c";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2.6 + flexX * 0.4, 6.5, botTipX, botTipY);
    ctx.stroke();

    // Lower inner belly laminate
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2.0 + flexX * 0.4, 6.5, botTipX - 0.5, botTipY);
    ctx.stroke();

    // Horn tip reinforcement on limbs
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(topTipX, topTipY, 1.2, 0, Math.PI * 2);
    ctx.arc(botTipX, botTipY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Ivory nock grooves on limb tips
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(topTipX - 0.4, topTipY, 0.5, 0, Math.PI * 2);
    ctx.arc(botTipX - 0.4, botTipY, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Riser / Handle Wrap (Tanned leather with cross-stitches)
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.8, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carved arrow shelf on riser
    ctx.fillStyle = "#5c2b09";
    ctx.fillRect(-0.8, -1.8, 1.6, 0.8);

    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-0.8, -2.0); ctx.lineTo(0.8, 2.0);
    ctx.moveTo(0.8, -2.0);  ctx.lineTo(-0.8, 2.0);
    ctx.stroke();

    // Bowstring (Braided sinew)
    const localNockX = -nockDist;
    ctx.strokeStyle = "rgba(241, 245, 249, 0.88)";
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(topTipX, topTipY);
    if (drawTension > 0.02 || isArrowLoaded) {
      ctx.lineTo(localNockX, 0);
      ctx.lineTo(botTipX, botTipY);
    } else if (Math.abs(stringTwang) > 0.15) {
      ctx.quadraticCurveTo(flexX + stringTwang, 0, botTipX, botTipY);
    } else {
      ctx.lineTo(botTipX, botTipY);
    }
    ctx.stroke();

    // NOCKED ARROW
    if (isArrowLoaded) {
      let arrowHeadDist = 13.5 - drawTension * 4.2;
      if (arrowLoadProgress < 1.0) {
        arrowHeadDist = 7.0 + arrowLoadProgress * 6.5;
      }

      const arrowHeadX = arrowHeadDist;
      const arrowTailX = localNockX;
      const arrowShelfY = -0.5;

      // 1. High-Density Cedar Shaft
      const shaftLen = arrowHeadX - arrowTailX;
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(arrowTailX, arrowShelfY - 0.8, shaftLen, 1.6);

      // Wood grain specular highlight
      ctx.fillStyle = "#b45309";
      ctx.fillRect(arrowTailX, arrowShelfY - 0.8, shaftLen, 0.5);

      // Lower ambient shadow
      ctx.fillStyle = "#5c2b09";
      ctx.fillRect(arrowTailX, arrowShelfY + 0.4, shaftLen, 0.4);

      // 2. Sinew Thread Bindings
      ctx.fillStyle = "#3b1d06";
      ctx.fillRect(arrowHeadX - 1.8, arrowShelfY - 0.9, 1.4, 1.8);
      ctx.fillRect(arrowTailX + 4.2, arrowShelfY - 0.9, 1.2, 1.8);
      ctx.fillRect(arrowTailX + 0.8, arrowShelfY - 0.9, 1.0, 1.8);

      // 3. Chipped Flint / Obsidian Broadhead Blade
      ctx.save();
      ctx.translate(arrowHeadX, arrowShelfY);
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(5.2, 0);
      ctx.lineTo(0.2, -2.6);
      ctx.lineTo(0.9, -0.6);
      ctx.lineTo(0.9, 0.6);
      ctx.lineTo(0.2, 2.6);
      ctx.closePath();
      ctx.fill();

      // Obsidian facet highlight
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(5.2, 0);
      ctx.lineTo(0.8, -1.8);
      ctx.lineTo(1.8, 0);
      ctx.closePath();
      ctx.fill();

      // Razor edge specular glint
      ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(5.2, 0);
      ctx.lineTo(0.3, -2.5);
      ctx.stroke();
      ctx.restore();

      // 4. Split-Feather Fletchings
      // Upper Vane
      ctx.fillStyle = "#166534";
      ctx.beginPath();
      ctx.moveTo(arrowTailX, arrowShelfY - 0.4);
      ctx.lineTo(arrowTailX - 4.2, arrowShelfY - 2.8);
      ctx.lineTo(arrowTailX - 1.4, arrowShelfY - 2.8);
      ctx.lineTo(arrowTailX + 0.4, arrowShelfY - 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.moveTo(arrowTailX - 2.8, arrowShelfY - 0.4);
      ctx.lineTo(arrowTailX - 3.4, arrowShelfY - 2.6);
      ctx.lineTo(arrowTailX - 2.4, arrowShelfY - 2.6);
      ctx.lineTo(arrowTailX - 1.8, arrowShelfY - 0.4);
      ctx.closePath();
      ctx.fill();

      // Lower Vane
      ctx.fillStyle = "#15803d";
      ctx.beginPath();
      ctx.moveTo(arrowTailX, arrowShelfY + 0.4);
      ctx.lineTo(arrowTailX - 4.2, arrowShelfY + 2.8);
      ctx.lineTo(arrowTailX - 1.4, arrowShelfY + 2.8);
      ctx.lineTo(arrowTailX + 0.4, arrowShelfY + 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.moveTo(arrowTailX - 2.8, arrowShelfY + 0.4);
      ctx.lineTo(arrowTailX - 3.4, arrowShelfY + 2.6);
      ctx.lineTo(arrowTailX - 2.4, arrowShelfY + 2.6);
      ctx.lineTo(arrowTailX - 1.8, arrowShelfY + 0.4);
      ctx.closePath();
      ctx.fill();

      // 5. Polished Bone Nock
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(arrowTailX - 1.2, arrowShelfY - 0.8, 1.4, 1.6);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(arrowTailX - 0.4, arrowShelfY - 0.5, 0.6, 1.0);

      // 6. Draw Hand Claws gripping the arrow nock (when not in background view)
      if (!isBowInBackground) {
        ctx.save();
        ctx.translate(arrowTailX, arrowShelfY);

        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.ellipse(0.2, -1.4, 1.2, 0.9, 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(0.6, -1.8);
        ctx.lineTo(1.8, -0.7);
        ctx.lineTo(0.8, -0.4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.ellipse(0.2, 1.4, 1.2, 0.9, -0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(0.6, 1.8);
        ctx.lineTo(1.8, 0.7);
        ctx.lineTo(0.8, 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = skinDark;
        ctx.beginPath();
        ctx.arc(-0.6, 0, 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(1.4, -0.8, 0.25, 0, Math.PI * 2);
        ctx.arc(1.4, 0.8, 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    // 7. Bow Hand Grip on Riser
    for (let f = 0; f < 3; f++) {
      const fY = 1.0 + f * 1.3;
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.ellipse(0.5, fY, 1.0, 0.75, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(1.2, fY - 0.4);
      ctx.lineTo(2.1, fY);
      ctx.lineTo(1.2, fY + 0.4);
      ctx.closePath();
      ctx.fill();
    }

    if (isArrowLoaded) {
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.ellipse(0.5, -1.2, 1.2, 0.9, -0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(1.0, -1.8);
      ctx.lineTo(2.2, -0.8);
      ctx.lineTo(1.1, -0.4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(1.8, -0.9, 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // End local bow & arrow
    ctx.restore(); // End archer main pass
  };

  // -------------------------------------------------------------
  // 3. Feral Left Arm (Off-Hand Claws / Dagger & Wrist Wrap)
  // -------------------------------------------------------------
  const drawLeftArmOffHand = () => {
    if (isShadowPass || isArcher) return;
    ctx.save();
    const armX = cfg.leftArmX;
    const armY = cfg.leftArmY;
    ctx.translate(armX, armY);

    const armDirSign = armX < 0 ? -1 : 1;
    let baseArmRot = isArcher
      ? (isBackView ? -0.25 * armDirSign : -0.15 * armDirSign)
      : (isBackView ? -0.45 * armDirSign : 0.40 * armDirSign);

    // Feral sneak / guard pose micro-motion
    const idleOffHandWave = Math.sin(nowMs * 0.004 + seed + 1.2) * (isArcher ? 0.04 : 0.08);
    const walkOffHandSwing = moving ? -Math.sin(walkPhase) * (isArcher ? 0.08 : 0.22) : 0;
    let attackReaction = 0;
    if (isAttacking && attackProgress > 0) {
      if (isArcher) {
        if (attackProgress < 0.52) {
          // Draw bowstring back towards chest/jaw
          const drawT = attackProgress / 0.52;
          attackReaction = -armDirSign * drawT * 0.55;
        } else if (attackProgress < 0.72) {
          // Follow-through release recoil
          const relT = (attackProgress - 0.52) / 0.20;
          attackReaction = -armDirSign * 0.55 + armDirSign * Math.sin(relT * Math.PI) * 0.22;
        } else {
          // Re-nocking next arrow smoothly
          const nockT = (attackProgress - 0.72) / 0.28;
          attackReaction = -armDirSign * (0.35 * (1 - nockT));
        }
      } else {
        attackReaction = attackProgress < 0.3 ? -0.35 : 0.25;
      }
    }
    ctx.rotate(baseArmRot + idleOffHandWave + walkOffHandSwing + attackReaction);

    // Shoulder / Deltoid
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6, 2.0, armDirSign * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Warty freckle on shoulder
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.arc(armDirSign * 0.5, -0.6, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Forearm angled inward in defensive/prowling posture
    const handX = armDirSign * 4.8;
    const handY = isArcher ? 1.4 : 2.4;

    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.moveTo(-0.8, -0.4);
    ctx.lineTo(handX, handY - 0.4);
    ctx.lineTo(handX - armDirSign * 0.8, handY + 1.4);
    ctx.lineTo(-0.8, 1.4);
    ctx.closePath();
    ctx.fill();

    if (isArcher) {
      // Archer's Reinforced Leather Bracer (Forearm guard against bowstring slap)
      ctx.fillStyle = "#3b2314";
      ctx.fillRect(handX - armDirSign * 2.8, handY - 1.2, 2.6, 2.4);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(handX - armDirSign * 2.5, handY - 0.8, 0.8, 1.6);
    } else {
      // Tattered Leather / Cord Wrist Wrap
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.ellipse(handX - armDirSign * 1.4, handY + 0.4, 1.3, 1.1, armDirSign * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hand Knuckle & Weapon / Grip
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.arc(handX, handY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    if (isThief) {
      // Thief / Assassin: Off-Hand Poison Stiletto
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(-armDirSign * 0.8);
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(0, -1.0);
      ctx.lineTo(-armDirSign * 0.8, -9.0);
      ctx.lineTo(armDirSign * 2.2, -10.5);
      ctx.lineTo(armDirSign * 1.5, -4.0);
      ctx.closePath();
      ctx.fill();

      // Poison Drip Highlight
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(armDirSign * 2.0, -10.0, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (isArcher) {
      // Archer's Draw Hand: Anatomical pinch grip with hooked claws holding arrow nock
      ctx.fillStyle = "#5c2b09"; // Archer leather shooting tab
      ctx.beginPath();
      ctx.ellipse(handX + armDirSign * 0.5, handY, 1.3, 1.1, armDirSign * 0.2, 0, Math.PI * 2);
      ctx.fill();

      const isReleasing = isAttacking && attackProgress >= 0.52 && attackProgress < 0.70;
      ctx.fillStyle = "#0f172a"; // Sharp obsidian claws
      if (isReleasing) {
        // Claws splayed open from release follow-through
        ctx.beginPath();
        ctx.moveTo(handX + armDirSign * 0.4, handY - 1.2);
        ctx.lineTo(handX + armDirSign * 2.4, handY - 1.8);
        ctx.lineTo(handX + armDirSign * 1.0, handY - 0.4);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(handX + armDirSign * 0.6, handY + 0.2);
        ctx.lineTo(handX + armDirSign * 2.8, handY + 0.6);
        ctx.lineTo(handX + armDirSign * 1.0, handY + 1.0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Claws hooked tightly in locked Mediterranean draw pinch around nock
        // Claw 1 (Index claw curling over nock)
        ctx.beginPath();
        ctx.moveTo(handX, handY - 1.2);
        ctx.lineTo(handX + armDirSign * 2.0, handY - 0.6);
        ctx.lineTo(handX + armDirSign * 1.2, handY + 0.1);
        ctx.lineTo(handX - armDirSign * 0.2, handY - 0.4);
        ctx.closePath();
        ctx.fill();

        // Claw 2 (Middle claw curling under string)
        ctx.beginPath();
        ctx.moveTo(handX + armDirSign * 0.2, handY + 0.2);
        ctx.lineTo(handX + armDirSign * 2.2, handY + 0.8);
        ctx.lineTo(handX + armDirSign * 1.0, handY + 1.4);
        ctx.lineTo(handX - armDirSign * 0.2, handY + 0.6);
        ctx.closePath();
        ctx.fill();

        // Claw 3 (Thumb support)
        ctx.beginPath();
        ctx.moveTo(handX - armDirSign * 0.4, handY - 0.8);
        ctx.lineTo(handX + armDirSign * 1.2, handY - 1.2);
        ctx.lineTo(handX + armDirSign * 0.6, handY - 0.2);
        ctx.closePath();
        ctx.fill();

        // Specular glint on hooked claw tips
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(handX + armDirSign * 1.8, handY - 0.4, 0.35, 0, Math.PI * 2);
        ctx.arc(handX + armDirSign * 1.9, handY + 0.9, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isWarrior || isChieftain) {
      // Warrior / Chieftain: Reinforced Wooden Plank Shield with Iron Boss & Spikes
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(armDirSign * 0.15);

      const shieldR = isChieftain ? 7.2 : 5.8;
      // Round wooden plank shield
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.arc(0, 0, shieldR, 0, Math.PI * 2);
      ctx.fill();

      // Wood plank seams
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-shieldR * 0.8, -shieldR * 0.4); ctx.lineTo(shieldR * 0.8, -shieldR * 0.4);
      ctx.moveTo(-shieldR, 0); ctx.lineTo(shieldR, 0);
      ctx.moveTo(-shieldR * 0.8, shieldR * 0.4); ctx.lineTo(shieldR * 0.8, shieldR * 0.4);
      ctx.stroke();

      // Iron rim
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, shieldR - 0.8, 0, Math.PI * 2);
      ctx.stroke();

      // Central iron boss
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(0, 0, shieldR * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Iron boss spike
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(0, 0, shieldR * 0.18, 0, Math.PI * 2);
      ctx.fill();

      if (isChieftain) {
        // Tribal red war crest painted on shield
        ctx.fillStyle = "#dc2626";
        ctx.beginPath();
        ctx.moveTo(0, -shieldR * 0.65);
        ctx.lineTo(shieldR * 0.4, shieldR * 0.3);
        ctx.lineTo(0, shieldR * 0.1);
        ctx.lineTo(-shieldR * 0.4, shieldR * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else {
      // 3 Sharp Curved Talons / Claws (Lineless)
      ctx.fillStyle = "#0f172a";

      // Claw 1 (Thumb / inner)
      ctx.beginPath();
      ctx.moveTo(handX + armDirSign * 0.4, handY - 1.0);
      ctx.lineTo(handX + armDirSign * 2.2, handY - 1.4);
      ctx.lineTo(handX + armDirSign * 1.0, handY - 0.2);
      ctx.closePath();
      ctx.fill();

      // Claw 2 (Middle)
      ctx.beginPath();
      ctx.moveTo(handX + armDirSign * 0.8, handY - 0.2);
      ctx.lineTo(handX + armDirSign * 2.6, handY + 0.4);
      ctx.lineTo(handX + armDirSign * 0.8, handY + 0.8);
      ctx.closePath();
      ctx.fill();

      // Claw 3 (Outer)
      ctx.beginPath();
      ctx.moveTo(handX + armDirSign * 0.4, handY + 0.6);
      ctx.lineTo(handX + armDirSign * 2.0, handY + 1.6);
      ctx.lineTo(handX, handY + 1.2);
      ctx.closePath();
      ctx.fill();

      // Specular glint on claws
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(handX + armDirSign * 1.8, handY + 0.2, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // Draw background arms if layered behind
  if (isArcher) {
    drawArcherEquipment(false);
  } else if (!cfg.leftArmFront) {
    drawLeftArmOffHand();
  }

  // -------------------------------------------------------------
  // 4. Dominant Right-Hand Weapon (100% Consistent Anatomical Right Hand)
  // -------------------------------------------------------------
  const drawRightHandWeapon = () => {
    if (isShadowPass || isArcher) return;
    ctx.save();
    const armX = cfg.rightArmX;
    const armY = cfg.rightArmY;
    const armDirSign = armX < 0 ? -1 : 1;
    ctx.translate(armX, armY);

    let swingAngle = 0;
    if (isArcher) {
      if (isAttacking) {
        if (attackProgress < 0.52) {
          // Raise & steady bow arm into aim
          const t = attackProgress / 0.52;
          swingAngle = -armDirSign * 0.22 * t;
        } else if (attackProgress < 0.72) {
          // Release recoil forward spring
          const rel = (attackProgress - 0.52) / 0.20;
          swingAngle = -armDirSign * 0.22 + armDirSign * Math.sin(rel * Math.PI) * 0.12;
        } else {
          // Return to ready stance
          const nockT = (attackProgress - 0.72) / 0.28;
          swingAngle = -armDirSign * 0.22 * (1 - nockT);
        }
      }
    } else if (isAttacking) {
      if (attackProgress < 0.25) {
        swingAngle = -cfg.flip * (attackProgress / 0.25) * 1.0;
      } else if (attackProgress < 0.65) {
        const t = (attackProgress - 0.25) / 0.40;
        swingAngle = cfg.flip * (-1.0 + t * 2.2);

        // Dynamic Stylized Weapon Slash Arc & Particle Spark VFX
        const arcAlpha = Math.sin(t * Math.PI) * 0.88;
        if (arcAlpha > 0.05) {
          ctx.save();
          const slashGrad = ctx.createLinearGradient(-15, -15, 15, 15);
          if (isMage) {
            slashGrad.addColorStop(0, `rgba(192, 132, 252, ${arcAlpha})`);
            slashGrad.addColorStop(1, `rgba(244, 114, 182, 0)`);
          } else if (isKing) {
            slashGrad.addColorStop(0, `rgba(253, 224, 71, ${arcAlpha})`);
            slashGrad.addColorStop(1, `rgba(245, 158, 11, 0)`);
          } else if (isChieftain) {
            slashGrad.addColorStop(0, `rgba(249, 115, 22, ${arcAlpha})`);
            slashGrad.addColorStop(1, `rgba(220, 38, 38, 0)`);
          } else if (isWarrior) {
            slashGrad.addColorStop(0, `rgba(248, 113, 113, ${arcAlpha})`);
            slashGrad.addColorStop(1, `rgba(220, 38, 38, 0)`);
          } else {
            slashGrad.addColorStop(0, `rgba(248, 250, 252, ${arcAlpha})`);
            slashGrad.addColorStop(1, `rgba(148, 163, 184, 0)`);
          }
          ctx.strokeStyle = slashGrad;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(0, 0, 18.0, facingAngle - 0.7, facingAngle + 0.7, false);
          ctx.stroke();

          // Particle Sparks at blade perimeter
          ctx.fillStyle = isMage ? "#f0abfc" : isKing ? "#fef08a" : isChieftain ? "#fb923c" : isWarrior ? "#fca5a5" : "#fef08a";
          ctx.beginPath();
          const sparkAngle = facingAngle + 0.4;
          ctx.arc(Math.cos(sparkAngle) * 18.5, Math.sin(sparkAngle) * 18.5, 0.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        const t = (attackProgress - 0.65) / 0.35;
        swingAngle = cfg.flip * (1.2 * (1 - t));
      }
    }

    const baseArmRot = isBackView
      ? (isArcher ? -0.45 * armDirSign : -0.70 * armDirSign)
      : (isArcher ? 0.35 * armDirSign : 0.55 * armDirSign);
    ctx.rotate(baseArmRot + swingAngle);

    // Upper Arm / Shoulder Deltoid
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.9, 2.1, armDirSign * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Forearm
    const handX = armDirSign * 5.8;
    const handY = 2.8;

    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.moveTo(-1.0, 0);
    ctx.lineTo(handX, handY);
    ctx.lineTo(handX - armDirSign * 1.0, handY + 1.5);
    ctx.lineTo(-1.0, 1.7);
    ctx.closePath();
    ctx.fill();

    // Tattered Leather / Cord Wrist Wrap on weapon hand
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.ellipse(handX - armDirSign * 1.8, handY + 0.4, 1.4, 1.2, armDirSign * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Warrior / Brute / Chieftain Spiked Pauldron on weapon shoulder
    if (isWarrior || isChieftain) {
      ctx.fillStyle = isChieftain ? "#1e293b" : "#475569";
      ctx.beginPath();
      ctx.arc(0, -0.6, isChieftain ? 3.4 : 2.8, Math.PI * 0.8, Math.PI * 2.2, false);
      ctx.closePath();
      ctx.fill();

      // Primary Spike
      ctx.fillStyle = isChieftain ? "#f59e0b" : "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(-armDirSign * 1.2, -1.8);
      ctx.lineTo(0, isChieftain ? -5.2 : -4.2);
      ctx.lineTo(armDirSign * 1.2, -1.8);
      ctx.closePath();
      ctx.fill();

      if (isChieftain) {
        // Forward secondary spike
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(armDirSign * 0.8, -1.2);
        ctx.lineTo(armDirSign * 3.6, -3.2);
        ctx.lineTo(armDirSign * 1.8, 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(handX, handY);

    if (isMage) {
      // Occult Shaman Staff with Ornate Skull & Orb
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, 9.0);
      ctx.lineTo(0, -15.0);
      ctx.stroke();

      const pulse = Math.sin(nowMs * 0.007 + seed) * 0.15 + 0.85;
      ctx.fillStyle = "rgba(192, 132, 252, 0.4)";
      ctx.beginPath();
      ctx.arc(0, -16.5, 5.5 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#c084fc";
      ctx.beginPath();
      ctx.arc(0, -16.5, 3.0, 0, Math.PI * 2);
      ctx.fill();
    } else if (isArcher) {
      // Procedural Recurve Hunting Bow & Authentically Held Arrow System
      ctx.save();

      // State determination: Tension, release recoil, and loaded arrow status
      let drawTension = 0;
      let stringTwang = 0;
      let isArrowLoaded = true;
      let arrowLoadProgress = 1.0; // 0 to 1

      if (isAttacking) {
        if (attackProgress < 0.52) {
          // Drawing the bow: tension increases smoothly to full draw
          drawTension = Math.sin((attackProgress / 0.52) * (Math.PI / 2));
          isArrowLoaded = true;
          arrowLoadProgress = 1.0;
        } else if (attackProgress < 0.72) {
          // Release & twang: arrow has been shot and launched
          const relT = attackProgress - 0.52;
          stringTwang = Math.sin(relT * 60) * Math.exp(-relT * 12) * 2.8;
          drawTension = 0;
          isArrowLoaded = false;
        } else {
          // Re-nocking next arrow smoothly from quiver (0.72 to 1.0)
          const nockT = (attackProgress - 0.72) / 0.28;
          drawTension = 0;
          isArrowLoaded = true;
          arrowLoadProgress = nockT; // fresh arrow sliding into place
        }
      } else {
        // IDLE / WALKING / READY STANCE: Arrow is ALWAYS securely held and ready!
        drawTension = 0.0;
        isArrowLoaded = true;
        arrowLoadProgress = 1.0;
      }

      // Bow Limb Flexing under tension:
      // When drawn, limb tips bend backward (toward archer)
      const flexX = -armDirSign * drawTension * 3.4;
      const topTipX = armDirSign * 3.2 + flexX;
      const topTipY = -12.5;
      const botTipX = armDirSign * 3.2 + flexX;
      const botTipY = 12.5;

      // Upper Recurve Limb (Wood & Horn laminates)
      ctx.strokeStyle = "#5a2d0c";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(armDirSign * 5.2 + flexX * 0.5, -6.5, topTipX, topTipY);
      ctx.stroke();

      // Upper inner belly laminate
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(armDirSign * 4.6 + flexX * 0.5, -6.5, topTipX - armDirSign * 0.6, topTipY);
      ctx.stroke();

      // Lower Recurve Limb
      ctx.strokeStyle = "#5a2d0c";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(armDirSign * 5.2 + flexX * 0.5, 6.5, botTipX, botTipY);
      ctx.stroke();

      // Lower inner belly laminate
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(armDirSign * 4.6 + flexX * 0.5, 6.5, botTipX - armDirSign * 0.6, botTipY);
      ctx.stroke();

      // Horn tip reinforcement on limbs
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(topTipX, topTipY, 1.2, 0, Math.PI * 2);
      ctx.arc(botTipX, botTipY, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Ivory nock groove on limb tips
      ctx.fillStyle = "#fef3c7";
      ctx.beginPath();
      ctx.arc(topTipX - armDirSign * 0.4, topTipY, 0.5, 0, Math.PI * 2);
      ctx.arc(botTipX - armDirSign * 0.4, botTipY, 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Riser / Handle Wrap (Tanned leather with cross-stitches)
      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.8, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Carved arrow shelf on riser
      ctx.fillStyle = "#5c2b09";
      ctx.fillRect(-armDirSign * 0.8, -1.8, 1.6, 0.8);

      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-0.8, -2.0); ctx.lineTo(0.8, 2.0);
      ctx.moveTo(0.8, -2.0);  ctx.lineTo(-0.8, 2.0);
      ctx.stroke();

      // Bowstring (Braided sinew)
      // When drawn or ready, string forms a clean V-notch pulled back to draw hand
      const restingNockX = -armDirSign * 2.2;
      const drawNockX = restingNockX - armDirSign * (drawTension * 8.6) + (stringTwang * armDirSign);
      const drawNockY = 0;

      ctx.strokeStyle = "rgba(241, 245, 249, 0.88)";
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(topTipX, topTipY);
      if (drawTension > 0.02 || isArrowLoaded) {
        ctx.lineTo(drawNockX, drawNockY);
        ctx.lineTo(botTipX, botTipY);
      } else if (Math.abs(stringTwang) > 0.15) {
        ctx.quadraticCurveTo(armDirSign * 2.8 + stringTwang, 0, botTipX, botTipY);
      } else {
        ctx.lineTo(botTipX, botTipY);
      }
      ctx.stroke();

      // -------------------------------------------------------------
      // NOCKED ARROW - ALWAYS VISIBLE IN READY / AIM STANCE
      // Beautifully rendered with authentic cedar wood shaft, obsidian
      // arrowhead, sinew bindings, feather fletchings, bone nock, and
      // visible clawed goblin fingers securing the arrow!
      // -------------------------------------------------------------
      if (isArrowLoaded) {
        ctx.save();
        let arrowHeadDist = 13.5 - drawTension * 4.2;
        if (arrowLoadProgress < 1.0) {
          arrowHeadDist = 7.0 + arrowLoadProgress * 6.5;
        }

        const arrowHeadX = armDirSign * arrowHeadDist;
        const arrowTailX = drawNockX;
        const arrowShelfY = -0.5; // Rest line along the arrow shelf

        // 1. High-Density Cedar Shaft
        const shaftMinX = Math.min(arrowHeadX, arrowTailX);
        const shaftMaxX = Math.max(arrowHeadX, arrowTailX);
        const shaftLen = Math.abs(arrowHeadX - arrowTailX);

        // Main shaft body
        ctx.fillStyle = "#854d0e";
        ctx.fillRect(shaftMinX, arrowShelfY - 0.8, shaftLen, 1.6);

        // Wood grain specular highlight along upper edge
        ctx.fillStyle = "#b45309";
        ctx.fillRect(shaftMinX, arrowShelfY - 0.8, shaftLen, 0.5);

        // Lower ambient shadow along bottom edge
        ctx.fillStyle = "#5c2b09";
        ctx.fillRect(shaftMinX, arrowShelfY + 0.4, shaftLen, 0.4);

        // 2. Sinew Thread Bindings
        ctx.fillStyle = "#3b1d06";
        // Head binding
        ctx.fillRect(arrowHeadX - armDirSign * 1.8, arrowShelfY - 0.9, 1.4, 1.8);
        // Fletching front binding
        ctx.fillRect(arrowTailX + armDirSign * 4.2, arrowShelfY - 0.9, 1.2, 1.8);
        // Nock base binding
        ctx.fillRect(arrowTailX + armDirSign * 0.8, arrowShelfY - 0.9, 1.0, 1.8);

        // 3. Chipped Flint / Obsidian Broadhead Blade
        ctx.save();
        ctx.translate(arrowHeadX, arrowShelfY);
        // Broadhead shape
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.moveTo(armDirSign * 5.2, 0);              // Point
        ctx.lineTo(armDirSign * 0.2, -2.6);           // Upper barb
        ctx.lineTo(armDirSign * 0.9, -0.6);           // Inner notch
        ctx.lineTo(armDirSign * 0.9, 0.6);            // Inner notch
        ctx.lineTo(armDirSign * 0.2, 2.6);            // Lower barb
        ctx.closePath();
        ctx.fill();

        // Obsidian facet highlight (chiseled stone reflection)
        ctx.fillStyle = "#475569";
        ctx.beginPath();
        ctx.moveTo(armDirSign * 5.2, 0);
        ctx.lineTo(armDirSign * 0.8, -1.8);
        ctx.lineTo(armDirSign * 1.8, 0);
        ctx.closePath();
        ctx.fill();

        // Keen razor edge specular glint
        ctx.strokeStyle = "rgba(248, 250, 252, 0.9)";
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(armDirSign * 5.2, 0);
        ctx.lineTo(armDirSign * 0.3, -2.5);
        ctx.stroke();
        ctx.restore();

        // 4. Split-Feather Fletchings at the Nock
        // Upper Vane (Forest green with gold striping)
        ctx.fillStyle = "#166534";
        ctx.beginPath();
        ctx.moveTo(arrowTailX, arrowShelfY - 0.4);
        ctx.lineTo(arrowTailX - armDirSign * 4.2, arrowShelfY - 2.8);
        ctx.lineTo(arrowTailX - armDirSign * 1.4, arrowShelfY - 2.8);
        ctx.lineTo(arrowTailX + armDirSign * 0.4, arrowShelfY - 0.4);
        ctx.closePath();
        ctx.fill();

        // Upper Vane Accent Stripe
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.moveTo(arrowTailX - armDirSign * 2.8, arrowShelfY - 0.4);
        ctx.lineTo(arrowTailX - armDirSign * 3.4, arrowShelfY - 2.6);
        ctx.lineTo(arrowTailX - armDirSign * 2.4, arrowShelfY - 2.6);
        ctx.lineTo(arrowTailX - armDirSign * 1.8, arrowShelfY - 0.4);
        ctx.closePath();
        ctx.fill();

        // Lower Vane (Deep emerald green)
        ctx.fillStyle = "#15803d";
        ctx.beginPath();
        ctx.moveTo(arrowTailX, arrowShelfY + 0.4);
        ctx.lineTo(arrowTailX - armDirSign * 4.2, arrowShelfY + 2.8);
        ctx.lineTo(arrowTailX - armDirSign * 1.4, arrowShelfY + 2.8);
        ctx.lineTo(arrowTailX + armDirSign * 0.4, arrowShelfY + 0.4);
        ctx.closePath();
        ctx.fill();

        // Lower Vane Accent Stripe
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.moveTo(arrowTailX - armDirSign * 2.8, arrowShelfY + 0.4);
        ctx.lineTo(arrowTailX - armDirSign * 3.4, arrowShelfY + 2.6);
        ctx.lineTo(arrowTailX - armDirSign * 2.4, arrowShelfY + 2.6);
        ctx.lineTo(arrowTailX - armDirSign * 1.8, arrowShelfY + 0.4);
        ctx.closePath();
        ctx.fill();

        // 5. Polished Bone Nock
        ctx.fillStyle = "#fef3c7";
        ctx.beginPath();
        ctx.fillRect(arrowTailX - armDirSign * 1.2, arrowShelfY - 0.8, 1.4, 1.6);
        ctx.fill();

        // Nock string notch slot
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(arrowTailX - armDirSign * 0.4, arrowShelfY - 0.5, 0.6, 1.0);

        // -------------------------------------------------------------
        // 6. DRAW HAND FINGERS GRIPPING THE ARROW NOCK & BOWSTRING!
        // Clawed goblin fingers physically pinch and hook the nock
        // -------------------------------------------------------------
        ctx.save();
        ctx.translate(arrowTailX, arrowShelfY);

        // Index finger knuckle curling over top of the nock
        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.ellipse(armDirSign * 0.2, -1.4, 1.2, 0.9, armDirSign * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Sharp obsidian claw curling over the arrow shaft
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(armDirSign * 0.6, -1.8);
        ctx.lineTo(armDirSign * 1.8, -0.7);
        ctx.lineTo(armDirSign * 0.8, -0.4);
        ctx.closePath();
        ctx.fill();

        // Middle finger knuckle curling under the nock & string
        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.ellipse(armDirSign * 0.2, 1.4, 1.2, 0.9, -armDirSign * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Sharp obsidian claw curling under the string
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(armDirSign * 0.6, 1.8);
        ctx.lineTo(armDirSign * 1.8, 0.7);
        ctx.lineTo(armDirSign * 0.8, 0.4);
        ctx.closePath();
        ctx.fill();

        // Thumb pad locking the shaft
        ctx.fillStyle = skinDark;
        ctx.beginPath();
        ctx.arc(-armDirSign * 0.6, 0, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Specular glint on claw hooks
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(armDirSign * 1.4, -0.8, 0.25, 0, Math.PI * 2);
        ctx.arc(armDirSign * 1.4, 0.8, 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // Nock fingers

        ctx.restore(); // Arrow
      }

      // -------------------------------------------------------------
      // 7. BOW HAND GRIP - CLAWED GOBLIN HAND SECURING THE ARROW TO THE RISER!
      // The hand grips the bow handle and the index knuckle & claw hold
      // the arrow shaft securely against the arrow shelf so it won't slip!
      // -------------------------------------------------------------
      ctx.save();
      // Bow hand palm / wrist wrap behind handle
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.ellipse(-armDirSign * 0.4, 1.0, 1.8, 2.6, armDirSign * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Lower 3 fingers wrapped around the lower handle grip (below arrow shelf)
      for (let f = 0; f < 3; f++) {
        const fY = 1.2 + f * 1.4;
        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.ellipse(armDirSign * 0.6, fY, 1.0, 0.75, armDirSign * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Sharp claw tip curling around handle
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(armDirSign * 1.3, fY - 0.4);
        ctx.lineTo(armDirSign * 2.2, fY);
        ctx.lineTo(armDirSign * 1.3, fY + 0.4);
        ctx.closePath();
        ctx.fill();
      }

      // Goblin Thumb wrapped around inner handle
      ctx.fillStyle = skinDark;
      ctx.beginPath();
      ctx.ellipse(-armDirSign * 0.8, -0.2, 1.1, 0.8, -armDirSign * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // INDEX FINGER CURLED OVER THE ARROW SHAFT!
      // Key archery anatomy: index finger sits right over the arrow pass,
      // locking the shaft securely down onto the shelf!
      if (isArrowLoaded) {
        ctx.fillStyle = skinBase;
        ctx.beginPath();
        ctx.ellipse(armDirSign * 0.5, -1.2, 1.2, 0.9, -armDirSign * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Sharp obsidian claw clamping over the top of the shaft
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.moveTo(armDirSign * 1.0, -1.8);
        ctx.lineTo(armDirSign * 2.2, -0.8);
        ctx.lineTo(armDirSign * 1.1, -0.4);
        ctx.closePath();
        ctx.fill();

        // Highlight glint on index claw
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(armDirSign * 1.8, -0.9, 0.28, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // Bow hand grip

      ctx.restore(); // Recurve Bow & Arrow System
    } else if (isKing) {
      // Royal Golden Great Cleaver (Lineless)
      ctx.rotate(armDirSign * 0.4);
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(0, -2.5);
      ctx.lineTo(-armDirSign * 1.4, -16.0);
      ctx.lineTo(armDirSign * 7.0, -18.0);
      ctx.lineTo(armDirSign * 9.0, -12.0);
      ctx.lineTo(armDirSign * 6.5, -9.0);
      ctx.lineTo(armDirSign * 8.0, -5.5);
      ctx.lineTo(0, -2.5);
      ctx.closePath();
      ctx.fill();

      // Gleaming Gold Fullers & Gem
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(armDirSign * 7.0, -17.5);
      ctx.lineTo(armDirSign * 8.8, -12.0);
      ctx.stroke();

      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(armDirSign * 3.2, -10.0, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (isChieftain) {
      // Chieftain Heavy Jagged Iron War Axe / Cleaver (Lineless)
      ctx.rotate(armDirSign * 0.45);
      // Heavy cord-wrapped shaft
      ctx.fillStyle = "#451a03";
      ctx.fillRect(-1.4, -3.0, 2.8, 14.0);
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-1.1, -1.0, 2.2, 5.0); // Grip wrap
      // Bone pommel spike
      ctx.fillStyle = "#fef3c7";
      ctx.beginPath();
      ctx.moveTo(-1.2, 11.0); ctx.lineTo(0, 14.0); ctx.lineTo(1.2, 11.0);
      ctx.closePath();
      ctx.fill();

      // Brutal double-notched battle axe blade
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(0, -2.5);
      ctx.lineTo(-armDirSign * 1.5, -16.5);
      ctx.lineTo(armDirSign * 8.5, -18.5);
      ctx.lineTo(armDirSign * 10.5, -13.0);
      ctx.lineTo(armDirSign * 7.5, -9.5);
      ctx.lineTo(armDirSign * 9.5, -5.5);
      ctx.lineTo(0, -2.5);
      ctx.closePath();
      ctx.fill();

      // Razor steel edge
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(armDirSign * 8.5, -18.0);
      ctx.lineTo(armDirSign * 10.2, -13.0);
      ctx.stroke();

      // Tribal red blood groove / war rune
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.moveTo(armDirSign * 2.0, -9.0);
      ctx.lineTo(armDirSign * 5.5, -12.0);
      ctx.lineTo(armDirSign * 3.5, -8.0);
      ctx.closePath();
      ctx.fill();
    } else if (isThief) {
      // Assassin Serrated Poison Dagger (Lineless)
      ctx.rotate(armDirSign * 0.45);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(-1.0, -2.0, 2.0, 4.0);
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(0, -2.0);
      ctx.lineTo(-armDirSign * 1.0, -13.0);
      ctx.lineTo(armDirSign * 3.5, -15.0);
      ctx.lineTo(armDirSign * 4.5, -10.0);
      ctx.lineTo(armDirSign * 2.8, -7.0);
      ctx.lineTo(armDirSign * 4.2, -4.0);
      ctx.lineTo(0, -2.0);
      ctx.closePath();
      ctx.fill();

      // Toxic Poison Edge & Glow
      ctx.strokeStyle = "rgba(34, 197, 94, 0.85)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(armDirSign * 3.5, -14.5);
      ctx.lineTo(armDirSign * 4.5, -10.0);
      ctx.stroke();

      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(armDirSign * 3.2, -14.0, 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (isBrute) {
      // Heavy Spiked Iron Club (Lineless)
      ctx.rotate(armDirSign * 0.4);
      ctx.fillStyle = "#451a03";
      ctx.fillRect(-1.5, -2.0, 3.0, 6.0); // Thick Handle

      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(-armDirSign * 2.0, -2.0);
      ctx.lineTo(-armDirSign * 3.5, -16.0);
      ctx.lineTo(armDirSign * 4.5, -16.0);
      ctx.lineTo(armDirSign * 3.0, -2.0);
      ctx.closePath();
      ctx.fill();

      // Spikes on Club Head
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.moveTo(-armDirSign * 3.5, -14.0); ctx.lineTo(-armDirSign * 6.5, -14.0); ctx.lineTo(-armDirSign * 3.2, -12.0);
      ctx.moveTo(armDirSign * 4.5, -14.0);  ctx.lineTo(armDirSign * 7.5, -14.0);  ctx.lineTo(armDirSign * 4.2, -12.0);
      ctx.moveTo(-armDirSign * 3.5, -8.0);  ctx.lineTo(-armDirSign * 6.0, -8.0);  ctx.lineTo(-armDirSign * 3.2, -6.0);
      ctx.moveTo(armDirSign * 4.5, -8.0);   ctx.lineTo(armDirSign * 7.0, -8.0);   ctx.lineTo(armDirSign * 4.2, -6.0);
      ctx.closePath();
      ctx.fill();
    } else if (isWarrior) {
      // Heavy Notched Iron Cleaver (Lineless)
      ctx.rotate(armDirSign * 0.4);
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.moveTo(0, -2.5);
      ctx.lineTo(-armDirSign * 1.2, -15.0);
      ctx.lineTo(armDirSign * 6.5, -17.0);
      ctx.lineTo(armDirSign * 8.5, -11.5);
      ctx.lineTo(armDirSign * 6.0, -8.5);
      ctx.lineTo(armDirSign * 7.5, -5.0);
      ctx.lineTo(0, -2.5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(armDirSign * 6.5, -16.5);
      ctx.lineTo(armDirSign * 8.2, -11.5);
      ctx.stroke();
    } else {
      // Basic Goblin Scavenger Shiv (Lineless)
      ctx.rotate(armDirSign * 0.45);
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(-1.0, -2.0, 2.0, 4.0);
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.moveTo(0, -2.0);
      ctx.lineTo(-armDirSign * 1.0, -12.0);
      ctx.lineTo(armDirSign * 5.5, -14.0);
      ctx.lineTo(armDirSign * 6.5, -9.5);
      ctx.lineTo(armDirSign * 4.5, -7.0);
      ctx.lineTo(armDirSign * 5.8, -4.0);
      ctx.lineTo(0, -2.0);
      ctx.closePath();
      ctx.fill();

      // Sharp Honed Razor Edge
      ctx.strokeStyle = "rgba(248, 250, 252, 0.75)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(armDirSign * 5.5, -13.5);
      ctx.lineTo(armDirSign * 6.2, -9.5);
      ctx.stroke();
    }

    // Hand Knuckle holding weapon
    if (!isArcher) {
      ctx.fillStyle = skinBase;
      ctx.beginPath();
      ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // Weapon
    ctx.restore(); // Arm
  };

  // Draw background weapon arm if layered behind
  if (!isArcher && !cfg.rightArmFront) {
    drawRightHandWeapon();
  }

  // -------------------------------------------------------------
  // 5. Digitigrade Legs, Ankle Wraps & 3-Toed Talon Feet
  // -------------------------------------------------------------
  const drawClawedLegs = () => {
    ctx.save();

    const rightStep = moving ? Math.sin(walkPhase) * 2.8 : 0;
    const leftStep = moving ? -Math.sin(walkPhase) * 2.8 : 0;

    const draw3ClawFoot = (footX, footY, dirX, isFacingBack) => {
      if (isShadowPass) return;

      // 1. Ragged Ankle Bandage Wrap (Lineless)
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.ellipse(footX, footY - 1.0, 1.4, 0.85, (dirX || 0) * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Wrap highlight
      ctx.fillStyle = "#78350f";
      ctx.fillRect(footX - 0.8, footY - 1.3, 1.6, 0.5);

      // 2. Obsidian Talons / Toes (Lineless)
      ctx.fillStyle = "#0f172a";

      if (isFacingBack) {
        // Back View: Heel spur + claws gripping away
        ctx.beginPath();
        ctx.moveTo(footX - 1.2, footY - 0.2);
        ctx.lineTo(footX - 1.6, footY + 0.8);
        ctx.lineTo(footX - 0.5, footY + 0.5);
        ctx.lineTo(footX + 0.5, footY + 0.5);
        ctx.lineTo(footX + 1.6, footY + 0.8);
        ctx.lineTo(footX + 1.2, footY - 0.2);
        ctx.closePath();
        ctx.fill();

        // Sharp heel spur pointing back
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.moveTo(footX - 0.5, footY - 0.5);
        ctx.lineTo(footX, footY - 1.6);
        ctx.lineTo(footX + 0.5, footY - 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (Math.abs(dirX) > 0.3) {
        // Profile or 3/4 Diagonal View: 3 forward-gripping curved obsidian talons
        const d = dirX > 0 ? 1 : -1;

        // Claw 1 (Inner / Far)
        ctx.beginPath();
        ctx.moveTo(footX - d * 0.8, footY - 0.2);
        ctx.lineTo(footX + d * 1.8, footY + 0.4);
        ctx.lineTo(footX - d * 0.2, footY + 0.6);
        ctx.closePath();
        ctx.fill();

        // Claw 2 (Center Main Talon - Longest)
        ctx.beginPath();
        ctx.moveTo(footX - d * 0.4, footY - 0.3);
        ctx.lineTo(footX + d * 2.8, footY + 0.3);
        ctx.lineTo(footX + d * 0.3, footY + 0.7);
        ctx.closePath();
        ctx.fill();

        // Claw 3 (Outer / Near)
        ctx.beginPath();
        ctx.moveTo(footX, footY - 0.1);
        ctx.lineTo(footX + d * 1.9, footY + 0.6);
        ctx.lineTo(footX + d * 0.5, footY + 0.7);
        ctx.closePath();
        ctx.fill();

        // Specular glint on main talon
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(footX + d * 1.8, footY + 0.25, 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Direct Front View: Splayed forward claws (pointing down towards viewer)
        // Claw 1 (Screen-left)
        ctx.beginPath();
        ctx.moveTo(footX - 1.2, footY - 0.2);
        ctx.lineTo(footX - 1.9, footY + 0.8);
        ctx.lineTo(footX - 0.6, footY + 0.6);
        ctx.closePath();
        ctx.fill();

        // Claw 2 (Center)
        ctx.beginPath();
        ctx.moveTo(footX - 0.4, footY - 0.3);
        ctx.lineTo(footX, footY + 1.1);
        ctx.lineTo(footX + 0.4, footY - 0.3);
        ctx.closePath();
        ctx.fill();

        // Claw 3 (Screen-right)
        ctx.beginPath();
        ctx.moveTo(footX + 0.6, footY + 0.6);
        ctx.lineTo(footX + 1.9, footY + 0.8);
        ctx.lineTo(footX + 1.2, footY - 0.2);
        ctx.closePath();
        ctx.fill();

        // Specular glint on center claw
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(footX, footY + 0.65, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawSingleLeg = (hipX, footX, isNearLeg, legStep, legDirX) => {
      if (isShadowPass) return;
      ctx.save();

      const hipY = torsoY + 5.8; // Pelvis connection: -9.5 + 5.8 = -3.7
      const actualFootX = footX + (moving ? legStep * 0.45 : 0);
      const footLift = moving ? Math.max(0, -legStep) * 0.45 : 0;
      const actualFootY = 1.0 - footLift;

      // Forward knee displacement based on facing direction and stance
      const kneeForward = (isProfileView ? 2.0 : isFrontView ? 0.4 : 1.2) * (legDirX !== 0 ? legDirX : (hipX < 0 ? -0.8 : 0.8));
      const kneeX = (hipX + actualFootX) * 0.5 + kneeForward;
      const kneeY = -1.4 - footLift * 0.25;

      // Digitigrade hock displacement (bends backward from knee / ankle)
      const hockBack = (isProfileView ? 1.0 : 0.5) * (legDirX !== 0 ? legDirX : (hipX < 0 ? -0.4 : 0.4));
      const hockX = actualFootX - hockBack;
      const hockY = actualFootY - 1.2;

      ctx.fillStyle = isNearLeg ? skinBase : skinDark;

      // Muscular Lineless Digitigrade Leg Silhouette
      ctx.beginPath();
      // Outer hip edge
      const hipW = 1.6;
      ctx.moveTo(hipX - hipW, hipY);
      // Outer thigh curve down to knobby knee
      ctx.quadraticCurveTo(kneeX - (legDirX >= 0 ? 0.8 : -0.8), kneeY - 0.7, kneeX - 0.5, kneeY);
      // Knobby knee front apex
      ctx.quadraticCurveTo(kneeX + (legDirX >= 0 ? 1.0 : -1.0), kneeY + 0.5, hockX, hockY);
      // Hock down to ankle
      ctx.lineTo(actualFootX - 1.0, actualFootY);
      ctx.lineTo(actualFootX + 1.0, actualFootY);
      // Inner ankle up along calf / groin to inner hip
      ctx.quadraticCurveTo(kneeX + (legDirX >= 0 ? 0.6 : -0.6), kneeY + 0.8, hipX + hipW, hipY);
      ctx.closePath();
      ctx.fill();

      // Knee joint depth accent
      ctx.strokeStyle = isNearLeg ? (isSlowed ? "#0284c7" : "#1a4c23") : "rgba(0, 0, 0, 0.22)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(kneeX, kneeY, 0.65, 0, Math.PI * 2);
      ctx.stroke();

      // Talon foot
      draw3ClawFoot(actualFootX, actualFootY, legDirX, isBackView);

      ctx.restore();
    };

    // Layer depth sorting: Far leg drawn first in shadow, Near leg drawn second
    const isRightNear = isFrontView ? true : cfg.rightLegFront;
    const isLeftNear = isFrontView ? true : !cfg.rightLegFront;

    if (cfg.rightLegFront) {
      // Left leg is far leg, Right leg is near leg
      drawSingleLeg(cfg.leftLegHipX, cfg.leftLegFootX, isLeftNear, leftStep, cfg.facingDirX);
      drawSingleLeg(cfg.rightLegHipX, cfg.rightLegFootX, isRightNear, rightStep, cfg.facingDirX);
    } else {
      // Right leg is far leg, Left leg is near leg
      drawSingleLeg(cfg.rightLegHipX, cfg.rightLegFootX, isRightNear, rightStep, cfg.facingDirX);
      drawSingleLeg(cfg.leftLegHipX, cfg.leftLegFootX, isLeftNear, leftStep, cfg.facingDirX);
    }

    ctx.restore();
  };

  drawClawedLegs();

  // Quiver for Goblin Archer (Slung across the back)
  const drawQuiver = () => {
    if (isShadowPass || !isArcher) return;
    ctx.save();
    const qX = torsoX - cfg.flip * (isProfileView ? 3.0 : 1.8);
    const qY = torsoY - 2.5;
    ctx.translate(qX, qY);
    ctx.rotate(cfg.flip * -0.32 + hunchTilt);

    // Cylindrical leather quiver
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.2, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shaded side
    ctx.fillStyle = "#271003";
    ctx.beginPath();
    ctx.ellipse(cfg.flip * 0.8, 0, 1.8, 8.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stitched leather collar rim at top
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.ellipse(0, -7.5, 3.4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brass rivets
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(-1.5, -4.0, 0.5, 0, Math.PI * 2);
    ctx.arc(1.5, -4.0, 0.5, 0, Math.PI * 2);
    ctx.arc(0, 2.0, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 4 Arrows sticking out of the open mouth
    const arrowOffsets = [
      { x: -1.6, y: -7.5, rot: -0.22 },
      { x: -0.5, y: -8.0, rot: -0.08 },
      { x: 0.6, y: -8.0, rot: 0.10 },
      { x: 1.8, y: -7.5, rot: 0.25 }
    ];
    for (let i = 0; i < arrowOffsets.length; i++) {
      const ao = arrowOffsets[i];
      ctx.save();
      ctx.translate(ao.x, ao.y);
      ctx.rotate(ao.rot);

      // Shaft
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(-0.4, -6.5, 0.8, 7.0);

      // Feather Fletchings
      ctx.fillStyle = (i % 2 === 0) ? "#166534" : "#15803d";
      ctx.beginPath();
      ctx.moveTo(-0.4, -6.5);
      ctx.lineTo(-1.8, -5.2);
      ctx.lineTo(-1.8, -2.5);
      ctx.lineTo(-0.4, -2.0);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0.4, -6.5);
      ctx.lineTo(1.8, -5.2);
      ctx.lineTo(1.8, -2.5);
      ctx.lineTo(0.4, -2.0);
      ctx.closePath();
      ctx.fill();

      // Ivory tips on feathers
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.moveTo(-1.8, -5.2);
      ctx.lineTo(-1.8, -4.2);
      ctx.lineTo(-0.4, -4.6);
      ctx.lineTo(-0.4, -5.6);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(1.8, -5.2);
      ctx.lineTo(1.8, -4.2);
      ctx.lineTo(0.4, -4.6);
      ctx.lineTo(0.4, -5.6);
      ctx.closePath();
      ctx.fill();

      // Bone nock
      ctx.fillStyle = "#fef3c7";
      ctx.fillRect(-0.5, -7.2, 1.0, 1.0);

      ctx.restore();
    }

    ctx.restore();
  };

  if (!isBackView) {
    drawQuiver();
  }

  // -------------------------------------------------------------
  // 6. Hunched Torso & Sculpted Musculature & Ragged Loincloth
  // -------------------------------------------------------------
  ctx.save();
  ctx.translate(torsoX, torsoY);
  ctx.rotate(hunchTilt);

  const buildTorsoPath = () => {
    ctx.beginPath();
    if (cfg.view === "front") {
      ctx.moveTo(-5.8, -6.8);
      ctx.lineTo(5.8, -6.8);
      ctx.quadraticCurveTo(6.8, 0, 4.6, 6.8);
      ctx.lineTo(-4.6, 6.8);
      ctx.quadraticCurveTo(-6.8, 0, -5.8, -6.8);
    } else if (cfg.view === "back") {
      ctx.moveTo(-6.8, -7.2);
      ctx.quadraticCurveTo(0, -8.6, 6.8, -7.2);
      ctx.quadraticCurveTo(7.2, 0, 4.8, 6.8);
      ctx.lineTo(-4.8, 6.8);
      ctx.quadraticCurveTo(-7.2, 0, -6.8, -7.2);
    } else if (cfg.view === "front_diag") {
      ctx.moveTo(cfg.flip * 1.8, -7.2);
      ctx.quadraticCurveTo(cfg.flip * 6.2, -4.8, cfg.flip * 5.5, 1.0);
      ctx.quadraticCurveTo(cfg.flip * 4.5, 6.8, 0, 7.2);
      ctx.quadraticCurveTo(-cfg.flip * 6.2, 3.8, -cfg.flip * 6.5, -1.8);
      ctx.quadraticCurveTo(-cfg.flip * 7.6, -6.2, -cfg.flip * 1.4, -7.8);
    } else if (cfg.view === "back_diag") {
      ctx.moveTo(-cfg.flip * 1.4, -7.8);
      ctx.quadraticCurveTo(-cfg.flip * 7.2, -6.8, -cfg.flip * 6.2, 1.0);
      ctx.quadraticCurveTo(-cfg.flip * 4.2, 6.8, 0, 7.2);
      ctx.quadraticCurveTo(cfg.flip * 5.8, 3.8, cfg.flip * 6.2, -1.8);
      ctx.quadraticCurveTo(cfg.flip * 7.2, -6.2, cfg.flip * 1.8, -7.8);
    } else {
      // Side Profile
      ctx.moveTo(cfg.flip * 0.8, -7.2);
      ctx.quadraticCurveTo(cfg.flip * 5.8, -5.2, cfg.flip * 5.2, 1.0);
      ctx.quadraticCurveTo(cfg.flip * 4.2, 6.8, 0, 7.2);
      ctx.quadraticCurveTo(-cfg.flip * 6.8, 3.8, -cfg.flip * 7.2, -1.4);
      ctx.quadraticCurveTo(-cfg.flip * 8.6, -6.2, -cfg.flip * 2.2, -7.8);
    }
    ctx.closePath();
  };

  buildTorsoPath();
  ctx.fillStyle = isShadowPass ? "#000000" : skinBase;
  ctx.fill();

  // Internal Anatomical Shading & Muscular Sculpting (Soft Lineless Shading)
  if (!isShadowPass) {
    const softShadowColor = isSlowed ? "rgba(2, 132, 199, 0.35)" : "rgba(16, 60, 25, 0.35)";
    if (isFrontView) {
      // 1. Wiry Pectoral Contours & Sternum Crease (Soft Volumetric Shading)
      ctx.strokeStyle = softShadowColor;
      ctx.lineWidth = 0.6;

      if (cfg.view === "front") {
        // Dual Pectoral Plates
        ctx.beginPath();
        ctx.arc(-2.4, -3.2, 2.2, 0.2, Math.PI * 0.9, false);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(2.4, -3.2, 2.2, 0.1, Math.PI * 0.8, false);
        ctx.stroke();

        // Central Sternum Shadow
        ctx.beginPath();
        ctx.moveTo(0, -5.2);
        ctx.lineTo(0, -1.8);
        ctx.stroke();

        // Lateral Ribcage Contours
        ctx.beginPath();
        ctx.moveTo(-4.8, -0.6); ctx.lineTo(-3.2, 0.4);
        ctx.moveTo(-4.6, 1.2);  ctx.lineTo(-3.0, 2.2);
        ctx.moveTo(4.8, -0.6);  ctx.lineTo(3.2, 0.4);
        ctx.moveTo(4.6, 1.2);   ctx.lineTo(3.0, 2.2);
        ctx.stroke();
      } else {
        // 3/4 Front Pectoral
        const pX = cfg.flip * 1.4;
        ctx.beginPath();
        ctx.arc(pX, -3.2, 2.5, 0.1, Math.PI * 0.85, false);
        ctx.stroke();
      }
    } else if (isBackView) {
      // 2. Sculpted Scapulae (Shoulder Blades) & Vertebral Nodes (Soft Volumetric)
      ctx.strokeStyle = softShadowColor;
      ctx.lineWidth = 0.6;

      if (cfg.view === "back") {
        // Dual Scapular Ridges
        ctx.beginPath();
        ctx.moveTo(-4.2, -4.8); ctx.lineTo(-2.2, -2.4); ctx.lineTo(-3.8, -0.8);
        ctx.moveTo(4.2, -4.8);  ctx.lineTo(2.2, -2.4);  ctx.lineTo(3.8, -0.8);
        ctx.stroke();

        // Vertebral Spine Nodes with Deep Shading
        ctx.fillStyle = skinDark;
        ctx.beginPath();
        ctx.arc(0, -5.8, 0.75, 0, Math.PI * 2);
        ctx.arc(0, -3.2, 0.75, 0, Math.PI * 2);
        ctx.arc(0, -0.6, 0.70, 0, Math.PI * 2);
        ctx.arc(0, 2.0, 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 3/4 Back Spine Curve
        ctx.beginPath();
        ctx.moveTo(-cfg.flip * 5.8, -2.0);
        ctx.quadraticCurveTo(-cfg.flip * 7.0, -5.2, -cfg.flip * 1.8, -6.8);
        ctx.stroke();
      }
    } else {
      // Side View Spine Curve
      ctx.strokeStyle = softShadowColor;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-cfg.flip * 5.2, -1.8);
      ctx.quadraticCurveTo(-cfg.flip * 6.6, -4.8, -cfg.flip * 1.6, -6.4);
      ctx.stroke();
    }

    // -----------------------------------------------------------
    // Ragged Dynamic Loincloth & Archetype Apparel (Seamless Clipped, Lineless)
    // -----------------------------------------------------------
    ctx.save();
    buildTorsoPath();
    ctx.clip();

    if (isBasicGoblin || isThief) {
      // Basic Goblin / Thief: Rugged Distressed Leather Loincloth (Lineless)
      ctx.fillStyle = isThief ? "#1e293b" : "#78350f";
      ctx.beginPath();
      ctx.moveTo(-20, 0.8);
      ctx.lineTo(20, 0.8);
      ctx.lineTo(20, 20);
      ctx.lineTo(-20, 20);
      ctx.closePath();
      ctx.fill();

      // Jagged Hem Fringes
      ctx.fillStyle = isThief ? "#0f172a" : "#451a03";
      ctx.beginPath();
      ctx.moveTo(-15, 6.2);
      ctx.lineTo(-12, 3.8); ctx.lineTo(-9, 6.8);
      ctx.lineTo(-6, 4.2);  ctx.lineTo(-3, 7.2);
      ctx.lineTo(0, 4.0);   ctx.lineTo(3, 7.2);
      ctx.lineTo(6, 4.2);   ctx.lineTo(9, 6.8);
      ctx.lineTo(12, 3.8);  ctx.lineTo(15, 6.2);
      ctx.lineTo(15, 10);   ctx.lineTo(-15, 10);
      ctx.closePath();
      ctx.fill();

      // Stitched Leather Patch
      ctx.fillStyle = isThief ? "#334155" : "#92400e";
      ctx.fillRect(-3.5, 2.2, 3.2, 2.8);

      // Central Pelvic Flap (Lineless)
      ctx.fillStyle = isThief ? "#1e293b" : "#78350f";
      ctx.beginPath();
      ctx.moveTo(-2.2, 1.2);
      ctx.lineTo(2.2, 1.2);
      ctx.lineTo(1.8, 6.8);
      ctx.lineTo(0, 7.6);
      ctx.lineTo(-1.8, 6.8);
      ctx.closePath();
      ctx.fill();

      // Braided Twine Belt & Knot
      ctx.fillStyle = isThief ? "#475569" : "#b45309";
      ctx.fillRect(-20, 0.8, 40, 1.6);
      ctx.fillStyle = isThief ? "#94a3b8" : "#fde68a";
      ctx.fillRect(-20, 1.2, 40, 0.6);

      // Carved Bone Toggle / Knot
      ctx.fillStyle = "#fef3c7";
      ctx.beginPath();
      ctx.ellipse(0.8, 1.6, 1.2, 0.7, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Scavenger Side Coin Pouch
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.ellipse(-3.8, 2.2, 1.2, 1.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (isKing) {
      // King: Royal Ermine Fur Tunic & Ruby-Set Golden Belt (Lineless)
      ctx.fillStyle = "#831843"; // Royal Crimson Velvet
      ctx.fillRect(-20, -20, 40, 40);

      // Ermine White Fur Collar
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(-20, -15, 40, 7.5);
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(-3.0, -11.0, 0.5, 0, Math.PI * 2);
      ctx.arc(3.0, -11.0, 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Gold Belt Plate with Ruby
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(-20, 1.2, 40, 2.6);

      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(0, 2.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (isChieftain) {
      // Chieftain: Heavy Studded Beast-Pelt Cuirass, Shaggy Fur Collar & Spiked War Belt
      // 1. Hardened dark leather cuirass
      ctx.fillStyle = "#2d1b0d";
      ctx.fillRect(-20, -20, 40, 40);

      // 2. Shaggy Wolf Fur Collar draping over shoulders
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(-15, -12);
      ctx.lineTo(-12, -4); ctx.lineTo(-8, -6);
      ctx.lineTo(-4, -2);  ctx.lineTo(0, -5);
      ctx.lineTo(4, -2);   ctx.lineTo(8, -6);
      ctx.lineTo(12, -4);  ctx.lineTo(15, -12);
      ctx.lineTo(15, -20); ctx.lineTo(-15, -20);
      ctx.closePath();
      ctx.fill();

      // Fur tuft highlights
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(-9, -8); ctx.lineTo(-6, -4); ctx.lineTo(-3, -7);
      ctx.moveTo(3, -7);  ctx.lineTo(6, -4);  ctx.lineTo(9, -8);
      ctx.fill();

      // 3. Crossed Beast Fang Trophy Necklace (front view)
      if (isFrontView) {
        ctx.strokeStyle = "#451a03";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-5.5, -6.5);
        ctx.quadraticCurveTo(0, -1.0, 5.5, -6.5);
        ctx.stroke();

        // Hanging carved beast fangs
        const fangXs = [-3.0, 0.0, 3.0];
        ctx.fillStyle = "#fffbeb";
        for (let f = 0; f < fangXs.length; f++) {
          const fx = fangXs[f];
          ctx.beginPath();
          ctx.moveTo(fx - 0.7, -3.5 + Math.abs(fx) * 0.4);
          ctx.lineTo(fx, -0.6 + Math.abs(fx) * 0.4);
          ctx.lineTo(fx + 0.7, -3.5 + Math.abs(fx) * 0.4);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 4. Heavy Spiked War Belt
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(-20, 0.6, 40, 3.2);

      // Bronze studs on belt
      ctx.fillStyle = "#f59e0b";
      for (let b = -12; b <= 12; b += 4) {
        ctx.fillRect(b - 0.5, 1.8, 1.2, 1.0);
      }

      // 5. Beast Skull Belt Buckle
      ctx.fillStyle = "#fef3c7";
      ctx.beginPath();
      ctx.moveTo(-2.2, 0.8);
      ctx.lineTo(2.2, 0.8);
      ctx.lineTo(1.8, 4.4);
      ctx.lineTo(0, 5.2);
      ctx.lineTo(-1.8, 4.4);
      ctx.closePath();
      ctx.fill();

      // Skull eye sockets
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-0.8, 2.2, 0.45, 0, Math.PI * 2);
      ctx.arc(0.8, 2.2, 0.45, 0, Math.PI * 2);
      ctx.fill();

      // 6. Layered Tribal War Pelt Loincloth
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.moveTo(-15, 3.8);
      ctx.lineTo(15, 3.8);
      ctx.lineTo(15, 20);
      ctx.lineTo(-15, 20);
      ctx.closePath();
      ctx.fill();

      // Jagged war pelt fringes
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.moveTo(-12, 7.5);
      ctx.lineTo(-9, 4.5); ctx.lineTo(-6, 7.8);
      ctx.lineTo(-3, 5.0); ctx.lineTo(0, 8.5);
      ctx.lineTo(3, 5.0);  ctx.lineTo(6, 7.8);
      ctx.lineTo(9, 4.5);  ctx.lineTo(12, 7.5);
      ctx.lineTo(15, 12);  ctx.lineTo(-15, 12);
      ctx.closePath();
      ctx.fill();

      // Central armored groin guard flap
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(-2.4, 3.5);
      ctx.lineTo(2.4, 3.5);
      ctx.lineTo(1.8, 8.2);
      ctx.lineTo(0, 9.2);
      ctx.lineTo(-1.8, 8.2);
      ctx.closePath();
      ctx.fill();
    } else if (isWarrior) {
      // Warrior: Studded Iron Plate Harness & Chainmail Trim (Lineless)
      ctx.fillStyle = "#475569";
      ctx.fillRect(-20, -20, 40, 40);

      // Reinforced Iron Belt Plate
      ctx.fillStyle = "#334155";
      ctx.fillRect(-20, 1.0, 40, 3.0);
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(-3.5, 2.5, 0.7, 0, Math.PI * 2);
      ctx.arc(0, 2.5, 0.8, 0, Math.PI * 2);
      ctx.arc(3.5, 2.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (isMage) {
      // Mage: Occult Runes & Bone Talisman Chest Piece (Lineless)
      ctx.fillStyle = "#4c1d95";
      ctx.fillRect(-20, -20, 40, 40);

      // Gold Embroidered Sash
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(-20, 1.8, 40, 2.2);

      // Bone Talisman on Chest
      if (isFrontView) {
        ctx.strokeStyle = "rgba(254, 243, 199, 0.8)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-2.8, -5.2); ctx.lineTo(0, -3.2); ctx.lineTo(2.8, -5.2);
        ctx.stroke();

        ctx.fillStyle = "#fef3c7";
        ctx.beginPath();
        ctx.arc(0, -3.0, 1.0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isArcher) {
      // Archer: Hunting Leather Harness & Quiver Strap (Lineless)
      ctx.fillStyle = "#3b2314";
      ctx.fillRect(-20, -20, 40, 40);

      // Cross-Body Leather Strap
      ctx.fillStyle = "#271003";
      ctx.beginPath();
      ctx.moveTo(-7.0, -7.0); ctx.lineTo(7.0, 5.0);
      ctx.lineTo(5.0, 7.0);   ctx.lineTo(-9.0, -5.0);
      ctx.closePath();
      ctx.fill();

      // Belt
      ctx.fillStyle = "#1e1008";
      ctx.fillRect(-20, 1.5, 40, 2.2);
    } else {
      // Universal Fallback: Rugged Distressed Leather Loincloth (Guarantees no goblin is ever naked)
      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.moveTo(-20, 0.8);
      ctx.lineTo(20, 0.8);
      ctx.lineTo(20, 20);
      ctx.lineTo(-20, 20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.moveTo(-15, 6.2);
      ctx.lineTo(-12, 3.8); ctx.lineTo(-9, 6.8);
      ctx.lineTo(-6, 4.2);  ctx.lineTo(-3, 7.2);
      ctx.lineTo(0, 4.0);   ctx.lineTo(3, 7.2);
      ctx.lineTo(6, 4.2);   ctx.lineTo(9, 6.8);
      ctx.lineTo(12, 3.8);  ctx.lineTo(15, 6.2);
      ctx.lineTo(15, 10);   ctx.lineTo(-15, 10);
      ctx.closePath();
      ctx.fill();

      // Belt
      ctx.fillStyle = "#b45309";
      ctx.fillRect(-20, 0.8, 40, 1.6);
      ctx.fillStyle = "#fde68a";
      ctx.fillRect(-20, 1.2, 40, 0.6);
    }

    ctx.restore(); // End Apparel Clip
  }

  ctx.restore(); // End Torso

  if (isBackView) {
    drawQuiver();
  }

  if (cfg.tailFront) {
    drawTail();
  }

  // -------------------------------------------------------------
  // 7. Expressive Goblin Head, Bat Ears & Pointy Snout
  // -------------------------------------------------------------
  ctx.save();
  const headTilt = (cfg.flip !== 0) ? cfg.flip * (moving ? 0.09 : 0.04) * (isProfileView ? 1 : 0.6) : 0;

  // Secondary Ear Motion: Dynamic Inertia Lag & Micro-Twitch
  const earLag = moving ? Math.sin(walkPhase) * 0.14 : 0;
  const earTwitch = Math.sin(nowMs * 0.005 + seed) * 0.06;

  // Masterwork Bat Ear Geometry (Notched Cartilage & Left Earring)
  const drawBatEar = (isRightSide) => {
    ctx.save();
    const earSign = isRightSide ? 1 : -1;
    let earSpreadX = cfg.earSpread;
    let earAngleY = -7.2;

    if (isProfileView) {
      earSpreadX = (isRightSide === (cfg.flip > 0)) ? 15.0 : 10.5;
    } else if (isDiagView) {
      earSpreadX = (isRightSide === (cfg.flip > 0)) ? 18.5 : 14.5;
    }

    const earTipX = headX + earSign * earSpreadX;
    const earTipY = headY + earAngleY + (isRightSide ? -(earLag - earTwitch) : (earLag + earTwitch)) * 8.5;

    // Temporal Ear Roots
    const rootUpperX = headX + earSign * (isProfileView ? 1.4 : 2.6);
    const rootUpperY = headY - 2.2;
    const rootLowerX = headX + earSign * (isProfileView ? 3.2 : 4.6);
    const rootLowerY = headY + 2.2;
    const notchOuterX = headX + earSign * (earSpreadX * 0.68);
    const notchOuterY = earTipY + 4.8;
    const notchInnerX = headX + earSign * (earSpreadX * 0.58);
    const notchInnerY = earTipY + 3.4;

    ctx.fillStyle = isShadowPass ? "#000000" : skinBase;

    // 1. Outer Cartilage Blade with Iconic Feral Notch (Lineless)
    ctx.beginPath();
    ctx.moveTo(rootUpperX, rootUpperY);
    ctx.quadraticCurveTo(headX + earSign * (earSpreadX * 0.52), headY - 7.8, earTipX, earTipY);
    ctx.quadraticCurveTo(headX + earSign * (earSpreadX * 0.88), earTipY + 2.6, notchOuterX, notchOuterY);
    ctx.lineTo(notchInnerX, notchInnerY);
    ctx.quadraticCurveTo(headX + earSign * (earSpreadX * 0.72), headY + 3.4, rootLowerX, rootLowerY);
    ctx.closePath();
    ctx.fill();

    if (!isShadowPass) {
      // 2. Deep Shaded Inner Pinna & Cartilage Ridge (Lineless)
      if (isFrontView || isProfileView) {
        ctx.fillStyle = innerEar;
        ctx.beginPath();
        ctx.moveTo(rootUpperX + earSign * 1.2, rootUpperY + 0.8);
        ctx.quadraticCurveTo(headX + earSign * (earSpreadX * 0.48), headY - 5.4, earTipX - earSign * 2.8, earTipY + 1.8);
        ctx.quadraticCurveTo(headX + earSign * (earSpreadX * 0.62), earTipY + 3.0, notchInnerX, notchInnerY);
        ctx.quadraticCurveTo(headX + earSign * (earSpreadX * 0.50), headY + 1.8, rootLowerX - earSign * 0.6, rootLowerY - 0.8);
        ctx.closePath();
        ctx.fill();

        // Delicate Cartilage Fold Line (Soft Subtle Accent)
        ctx.strokeStyle = isSlowed ? "rgba(2, 132, 199, 0.4)" : "rgba(16, 60, 25, 0.4)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(rootUpperX + earSign * 2.0, rootUpperY + 1.4);
        ctx.quadraticCurveTo(headX + earSign * (earSpreadX * 0.42), headY - 3.2, earTipX - earSign * 4.6, earTipY + 2.6);
        ctx.stroke();
      }

      // 3. Hand-Forged Gold Earring Hoop (Consistent Left Ear)
      const isThisEarringEar = !lowDetail && cfg.earringVisible && (isRightSide === !!cfg.earringScreenRight);
      if (isThisEarringEar) {
        const ringX = notchOuterX + (earSign * 0.6);
        const ringY = notchOuterY + 0.6;
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(ringX, ringY, 1.6, 0, Math.PI * 2);
        ctx.stroke();

        // Specular glint
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ringX - 0.5, ringY - 0.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  if (cfg.view === "front" || cfg.view === "back") {
    drawBatEar(false);
    drawBatEar(true);
  } else if (cfg.flip > 0) {
    drawBatEar(false);
    drawBatEar(true);
  } else {
    drawBatEar(true);
    drawBatEar(false);
  }

  // Bare Sculpted Goblin Cranium (Lineless)
  ctx.fillStyle = isShadowPass ? "#000000" : skinBase;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 7.8, 7.0, headTilt, 0, Math.PI * 2);
  ctx.fill();

  if (!isShadowPass) {
    // Warty freckles on cheekbones
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.arc(headX - 4.2, headY + 1.2, 0.45, 0, Math.PI * 2);
    ctx.arc(headX + 4.2, headY + 1.2, 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Directional Face across 8 Directions with Hooked Snout & Needle Underbite
    if (isFrontView || isProfileView) {
      const drawEye = (ex, ey, isProfile = false) => {
        // Furrowed sinister brow line (Soft Subtle Line)
        ctx.strokeStyle = isSlowed ? "rgba(2, 132, 199, 0.5)" : "rgba(16, 60, 25, 0.5)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(ex - 1.8, ey - 2.0);
        ctx.lineTo(ex + 1.8, ey - 1.5);
        ctx.stroke();

        ctx.fillStyle = "#052e16";
        ctx.beginPath();
        ctx.ellipse(ex, ey, isProfile ? 1.9 : 2.3, isProfile ? 1.5 : 1.7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        ctx.ellipse(ex, ey, isProfile ? 1.3 : 1.5, isProfile ? 1.0 : 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        const pupilShiftX = isArcher ? Math.cos(facingAngle) * 0.55 : 0;
        const pupilShiftY = isArcher ? Math.sin(facingAngle) * 0.45 : 0;

        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(ex + pupilShiftX, ey + pupilShiftY, 0.42, 0.95, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ex + pupilShiftX * 0.5 - 0.35, ey + pupilShiftY * 0.5 - 0.35, 0.38, 0, Math.PI * 2);
        ctx.fill();
      };

      if (cfg.view === "front") {
        drawEye(headX - 2.6, headY - 1.0);
        drawEye(headX + 2.6, headY - 1.0);

        // Defined Hooked Snout Nasal Ridge (Soft Line)
        ctx.strokeStyle = isSlowed ? "rgba(2, 132, 199, 0.4)" : "rgba(16, 60, 25, 0.4)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(headX, headY - 0.6);
        ctx.lineTo(headX, headY + 1.2);
        ctx.stroke();

        // Dark Nostril Slits
        ctx.fillStyle = "#052e16";
        ctx.beginPath();
        ctx.ellipse(headX - 0.9, headY + 1.5, 0.38, 0.65, -0.2, 0, Math.PI * 2);
        ctx.ellipse(headX + 0.9, headY + 1.5, 0.38, 0.65, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Front Snarl, Dual Ivory Tusks & Needle Teeth (Soft Lip Line)
        ctx.strokeStyle = isSlowed ? "rgba(2, 132, 199, 0.6)" : "rgba(5, 46, 22, 0.6)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(headX, headY + 4.0, 2.8, 0.1, Math.PI - 0.1, false);
        ctx.stroke();

        ctx.fillStyle = "#fffbeb";
        ctx.beginPath();
        // Left Main Tusk
        ctx.moveTo(headX - 2.0, headY + 4.3); ctx.lineTo(headX - 1.5, headY + 2.0); ctx.lineTo(headX - 0.9, headY + 4.3);
        // Middle Needle Teeth
        ctx.moveTo(headX - 0.6, headY + 4.4); ctx.lineTo(headX - 0.3, headY + 3.2); ctx.lineTo(headX, headY + 4.4);
        ctx.moveTo(headX, headY + 4.4); ctx.lineTo(headX + 0.3, headY + 3.2); ctx.lineTo(headX + 0.6, headY + 4.4);
        // Right Main Tusk
        ctx.moveTo(headX + 0.9, headY + 4.3); ctx.lineTo(headX + 1.5, headY + 2.0); ctx.lineTo(headX + 2.0, headY + 4.3);
        ctx.closePath();
        ctx.fill();
      } else {
        const eyeX = headX + cfg.flip * (isProfileView ? 2.8 : 2.4);
        const eyeY = headY - 1.0;
        drawEye(eyeX, eyeY, isProfileView);

        if (isDiagView) {
          drawEye(headX - cfg.flip * 1.4, headY - 1.0, true);
        }

        // Pointy Hooked Snout Contour (Soft Line)
        const snoutTipX = headX + cfg.flip * (isProfileView ? 4.6 : 3.8);
        const snoutTipY = headY + 1.4;

        ctx.strokeStyle = isSlowed ? "rgba(2, 132, 199, 0.45)" : "rgba(16, 60, 25, 0.45)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(headX + cfg.flip * 1.8, headY - 0.4);
        ctx.quadraticCurveTo(snoutTipX + cfg.flip * 0.8, snoutTipY - 0.8, snoutTipX, snoutTipY);
        ctx.lineTo(snoutTipX - cfg.flip * 1.2, snoutTipY + 1.2);
        ctx.stroke();

        // Dark Nostril Slit
        ctx.fillStyle = "#052e16";
        ctx.beginPath();
        ctx.ellipse(snoutTipX - cfg.flip * 0.8, snoutTipY + 0.2, 0.42, 0.7, cfg.flip * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Sleek Jawline Snarl & Underbite Tusks (Soft Lip Line)
        const mouthX = headX + cfg.flip * 1.4;
        const mouthY = headY + 3.8;
        ctx.strokeStyle = isSlowed ? "rgba(2, 132, 199, 0.6)" : "rgba(5, 46, 22, 0.6)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(mouthX, mouthY, 2.5, 0.1, Math.PI - 0.1, false);
        ctx.stroke();

        ctx.fillStyle = "#fffbeb";
        ctx.beginPath();
        // Main Tusk
        ctx.moveTo(mouthX + cfg.flip * 0.8, mouthY + 0.9);
        ctx.lineTo(mouthX + cfg.flip * 1.3, mouthY - 2.4);
        ctx.lineTo(mouthX + cfg.flip * 2.1, mouthY + 0.9);
        // Needle tooth
        ctx.moveTo(mouthX - cfg.flip * 0.4, mouthY + 0.9);
        ctx.lineTo(mouthX - cfg.flip * 0.1, mouthY - 0.4);
        ctx.lineTo(mouthX + cfg.flip * 0.4, mouthY + 0.9);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Archetype Headwear (Lineless)
    if (isKing) {
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(headX - 6.2, headY - 3.4);
      ctx.lineTo(headX - 5.2, headY - 9.2);
      ctx.lineTo(headX - 2.6, headY - 6.0);
      ctx.lineTo(headX, headY - 11.2);
      ctx.lineTo(headX + 2.6, headY - 6.0);
      ctx.lineTo(headX + 5.2, headY - 9.2);
      ctx.lineTo(headX + 6.2, headY - 3.4);
      ctx.closePath();
      ctx.fill();

      if (!isBackView) {
        ctx.fillStyle = "#e11d48";
        ctx.beginPath();
        ctx.arc(headX, headY - 6.8, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isChieftain) {
      // Chieftain: Horned War Headdress with Curled Horns & Tribal Feathers (Lineless)
      // Spiked Bronze Browband
      ctx.fillStyle = "#78350f";
      ctx.fillRect(headX - 6.5, headY - 3.4, 13.0, 2.4);
      ctx.fillStyle = "#b45309";
      ctx.fillRect(headX - 6.5, headY - 2.8, 13.0, 1.0);

      // Bronze studs
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(headX - 4.5, headY - 2.2, 0.7, 0, Math.PI * 2);
      ctx.arc(headX - 1.5, headY - 2.2, 0.7, 0, Math.PI * 2);
      ctx.arc(headX + 1.5, headY - 2.2, 0.7, 0, Math.PI * 2);
      ctx.arc(headX + 4.5, headY - 2.2, 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Left Ram / Beast War Horn (Curling out and up)
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(headX - 5.5, headY - 3.2);
      ctx.quadraticCurveTo(headX - 11.5, headY - 6.5, headX - 12.0, headY - 11.5);
      ctx.quadraticCurveTo(headX - 9.0, headY - 13.0, headX - 7.5, headY - 9.5);
      ctx.quadraticCurveTo(headX - 6.0, headY - 6.5, headX - 4.0, headY - 3.5);
      ctx.closePath();
      ctx.fill();

      // Horn ridge highlights
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(headX - 8.5, headY - 6.0);
      ctx.lineTo(headX - 11.2, headY - 10.8);
      ctx.lineTo(headX - 9.5, headY - 9.5);
      ctx.closePath();
      ctx.fill();

      // Right Ram / Beast War Horn
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(headX + 5.5, headY - 3.2);
      ctx.quadraticCurveTo(headX + 11.5, headY - 6.5, headX + 12.0, headY - 11.5);
      ctx.quadraticCurveTo(headX + 9.0, headY - 13.0, headX + 7.5, headY - 9.5);
      ctx.quadraticCurveTo(headX + 6.0, headY - 6.5, headX + 4.0, headY - 3.5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(headX + 8.5, headY - 6.0);
      ctx.lineTo(headX + 11.2, headY - 10.8);
      ctx.lineTo(headX + 9.5, headY - 9.5);
      ctx.closePath();
      ctx.fill();

      // Central Tall Tribal War Feather / Plume
      const plumeFlutter = Math.sin(nowMs * 0.007 + seed) * 1.5;
      ctx.fillStyle = "#dc2626"; // Crimson war feather
      ctx.beginPath();
      ctx.moveTo(headX - 1.2, headY - 3.5);
      ctx.quadraticCurveTo(headX - 2.5 + plumeFlutter, headY - 11.0, headX + plumeFlutter * 1.2, headY - 15.5);
      ctx.quadraticCurveTo(headX + 2.5 + plumeFlutter, headY - 11.0, headX + 1.2, headY - 3.5);
      ctx.closePath();
      ctx.fill();

      // Inner feather stripe
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.moveTo(headX - 0.4, headY - 4.0);
      ctx.lineTo(headX + plumeFlutter * 0.8, headY - 13.5);
      ctx.lineTo(headX + 0.4, headY - 4.0);
      ctx.closePath();
      ctx.fill();
    } else if (isThief) {
      // Thief: Dark Hood / Cowl (Lineless)
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.arc(headX, headY - 1.8, 8.4, Math.PI * 0.72, Math.PI * 2.28, false);
      ctx.lineTo(headX - cfg.flip * 7.8, headY - 5.8);
      ctx.closePath();
      ctx.fill();
    } else if (isWarrior) {
      // Warrior / Brute: Spiked War Helmet with Crest & Visor Slit (Lineless)
      const plumeWave = Math.sin(nowMs * 0.008 + seed) * 2.0;
      ctx.fillStyle = isBrute ? "#7f1d1d" : "#dc2626";
      ctx.beginPath();
      ctx.moveTo(headX, headY - 6.2);
      ctx.quadraticCurveTo(headX - cfg.flip * 4.2 + plumeWave, headY - 11.5, headX - cfg.flip * 8.0 + plumeWave, headY - 12.5);
      ctx.lineTo(headX - cfg.flip * 2.4, headY - 5.2);
      ctx.closePath();
      ctx.fill();

      // Iron Dome
      ctx.fillStyle = "#475569";
      ctx.beginPath();
      ctx.arc(headX, headY - 2.0, 8.0, Math.PI * 0.85, Math.PI * 2.15, false);
      ctx.closePath();
      ctx.fill();

      // Reinforced Iron Browband
      ctx.fillStyle = "#334155";
      ctx.fillRect(headX - 6.5, headY - 2.8, 13.0, 2.2);

      // Narrow Glowing Visor Eye Slit (Only in front/profile views)
      if (isFrontView || isProfileView) {
        ctx.fillStyle = "#0f172a";
        const visorW = isProfileView ? 5.8 : 10.0;
        const visorX = isProfileView ? (headX + (cfg.flip > 0 ? 0.5 : -6.3)) : (headX - 5.0);
        ctx.fillRect(visorX, headY - 1.2, visorW, 1.5);

        // Glowing fierce amber / orange eyes peering from the visor
        ctx.fillStyle = "#f59e0b";
        if (cfg.view === "front") {
          ctx.fillRect(headX - 3.8, headY - 0.9, 2.2, 0.8);
          ctx.fillRect(headX + 1.6, headY - 0.9, 2.2, 0.8);
        } else {
          ctx.fillRect(headX + cfg.flip * 1.5, headY - 0.9, 3.2, 0.8);
        }
      }
    } else if (isMage) {
      // Mage: Occult Cowl & Gold Runic Trim (Lineless)
      ctx.fillStyle = "#4c1d95";
      ctx.beginPath();
      ctx.arc(headX, headY - 1.6, 8.2, Math.PI * 0.75, Math.PI * 2.25, false);
      ctx.lineTo(headX - cfg.flip * 7.6, headY - 6.2);
      ctx.closePath();
      ctx.fill();

      // Golden Runic Hem Trim
      ctx.strokeStyle = "rgba(251, 191, 36, 0.8)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(headX, headY - 1.6, 8.2, Math.PI * 0.82, Math.PI * 2.18, false);
      ctx.stroke();
    }
  }
  ctx.restore(); // End Head

  // -------------------------------------------------------------
  // Foreground Arms (Layered over Torso and Head)
  // -------------------------------------------------------------
  if (isArcher) {
    drawArcherEquipment(true);
  } else {
    if (cfg.leftArmFront) {
      drawLeftArmOffHand();
    }
    if (cfg.rightArmFront) {
      drawRightHandWeapon();
    }
  }

  ctx.restore(); // Root
}

function drawSegmentedGoblin(ctx, x, y, opts = {}) {
  const ent = {
    type: opts.type || "goblin",
    facingAngle: opts.facingAngle || 0,
    moving: opts.moving || false,
    isAttacking: opts.isAttacking || false,
    isSlowed: opts.isSlowed || false,
    id: opts.entityId || "goblin",
    equippedWeapon: opts.equippedWeapon,
    armor: opts.armor,
  };
  drawGoblinEntity(ctx, x, y, ent, opts.isShadowPass || false);
}

export function drawGoblin(ctx, screenX, screenY, sSize, type, ent, isShadowPass = false) {
  if (!ent) ent = {};
  if (type && typeof type === "string") ent.type = type;
  drawGoblinEntity(ctx, screenX, screenY, ent, isShadowPass);
}

export { drawSegmentedGoblin };

// =============================================================
// Goblin Archer Projectile System
// High-performance procedural lineless arrows with authentic physics
// =============================================================
export const goblinArrows = [];

export function shootGoblinArrow(opts = {}) {
  const x = opts.x || 0;
  const y = opts.y || 0;
  const angle = opts.angle || 0;
  const speed = opts.speed || 720;
  const damage = opts.damage || 20;
  const sourceId = opts.sourceId || "goblin_archer";
  const maxDistance = opts.maxDistance || 1500;

  const arrow = {
    id: "arrow_" + Math.random().toString(36).substr(2, 9),
    x,
    y,
    startX: x,
    startY: y,
    angle,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    speed,
    damage,
    sourceId,
    maxDistance,
    distanceTraveled: 0,
    state: "flying", // "flying" | "stuck" | "spent"
    createdAt: performance.now(),
    stuckTime: 0,
    vibration: 0,
    trail: []
  };

  goblinArrows.push(arrow);
  return arrow;
}

export function shootGoblinArrowVolley(opts = {}) {
  const baseAngle = opts.angle || 0;
  const angles = [baseAngle - 0.16, baseAngle, baseAngle + 0.16];
  const spawned = [];
  for (let i = 0; i < angles.length; i++) {
    spawned.push(shootGoblinArrow({
      ...opts,
      angle: angles[i],
      speed: (opts.speed || 720) * (0.95 + i * 0.05)
    }));
  }
  return spawned;
}

export function updateGoblinArrows(dt, bounds = null, targets = null) {
  const now = performance.now();
  for (let i = goblinArrows.length - 1; i >= 0; i--) {
    const a = goblinArrows[i];

    if (a.state === "flying") {
      const stepX = a.vx * dt;
      const stepY = a.vy * dt;
      a.x += stepX;
      a.y += stepY;
      a.distanceTraveled += Math.sqrt((stepX) * (stepX) + (stepY) * (stepY));

      // Trailing motion history
      a.trail.push({ x: a.x, y: a.y, time: now });
      if (a.trail.length > 8) a.trail.shift();

      // Subtle aerodynamic feather / dust particle
      if (typeof window !== "undefined" && window.spawnParticle && Math.random() < 0.35) {
        window.spawnParticle({
          x: a.x - Math.cos(a.angle) * 12,
          y: a.y - Math.sin(a.angle) * 12,
          vx: -Math.cos(a.angle) * 35 + (Math.random() - 0.5) * 20,
          vy: -Math.sin(a.angle) * 35 + (Math.random() - 0.5) * 20,
          color: ["#166534", "#22c55e", "#fef08a", "#e2e8f0"],
          size: 1.5,
          maxLife: 0.3,
          drag: 0.92,
          shrink: true
        });
      }

      // Check collision with targets if provided
      let hitTarget = false;
      if (targets && Array.isArray(targets)) {
        for (const target of targets) {
          const dx = a.x - target.x;
          const dy = a.y - target.y;
          const r = target.radius || 30;
          if (dx * dx + dy * dy < r * r) {
            hitTarget = true;
            a.state = "stuck";
            a.stuckTime = now;
            a.targetHit = target;
            if (typeof target.onHit === "function") {
              target.onHit(a);
            }
            break;
          }
        }
      }

      // Check collision with bounds if provided
      if (!hitTarget && bounds) {
        if (
          a.x < bounds.minX || a.x > bounds.maxX ||
          a.y < bounds.minY || a.y > bounds.maxY
        ) {
          a.state = "stuck";
          a.stuckTime = now;
          a.x = Math.max(bounds.minX, Math.min(bounds.maxX, a.x));
          a.y = Math.max(bounds.minY, Math.min(bounds.maxY, a.y));
        }
      }

      // Max range
      if (!hitTarget && a.distanceTraveled >= a.maxDistance) {
        a.state = "stuck";
        a.stuckTime = now;
      }

      // If just stuck: spawn wood splinters and impact spark particles
      if (a.state === "stuck") {
        if (typeof window !== "undefined" && window.spawnParticle) {
          for (let p = 0; p < 7; p++) {
            const pAngle = a.angle + Math.PI + (Math.random() - 0.5) * 1.6;
            const pSpd = 40 + Math.random() * 90;
            window.spawnParticle({
              x: a.x,
              y: a.y,
              vx: Math.cos(pAngle) * pSpd,
              vy: Math.sin(pAngle) * pSpd,
              color: ["#854d0e", "#b45309", "#94a3b8", "#e2e8f0", "#166534"],
              size: 2.0,
              maxLife: 0.45,
              drag: 0.90,
              gravity: 120,
              shrink: true
            });
          }
        }
      }
    } else if (a.state === "stuck") {
      const elapsed = (now - a.stuckTime) / 1000;
      // Authentic damped spring vibration on impact
      a.vibration = Math.sin(elapsed * 45) * Math.exp(-elapsed * 9) * 0.18;

      // Clean up after 3.5 seconds
      if (elapsed > 3.5) {
        goblinArrows.splice(i, 1);
      }
    }
  }
}

export function drawGoblinArrow(ctx, arrow) {
  if (!arrow) return;
  const now = performance.now();
  const isStuck = arrow.state === "stuck";
  const stuckAge = isStuck ? (now - arrow.stuckTime) / 1000 : 0;
  const alpha = isStuck && stuckAge > 2.5 ? Math.max(0, 1 - (stuckAge - 2.5)) : 1.0;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Aerodynamic speed motion blur streak behind flying arrow
  if (!isStuck && arrow.trail && arrow.trail.length > 2) {
    ctx.save();
    for (let t = 0; t < arrow.trail.length - 1; t++) {
      const p1 = arrow.trail[t];
      const p2 = arrow.trail[t + 1];
      const trailAlpha = (t / arrow.trail.length) * 0.35;
      ctx.strokeStyle = `rgba(226, 232, 240, ${trailAlpha})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Position and orient arrow along trajectory
  ctx.translate(arrow.x, arrow.y);
  ctx.rotate(arrow.angle + (arrow.vibration || 0));

  // 1. Shaft (Hardwood Cedar)
  ctx.fillStyle = "#854d0e";
  ctx.fillRect(-16, -1.0, 22, 2.0);

  // Shaft specular wood grain
  ctx.fillStyle = "#a16207";
  ctx.fillRect(-16, -1.0, 22, 0.7);

  // 2. Sinew wrapping at arrowhead socket
  ctx.fillStyle = "#451a03";
  ctx.fillRect(4.5, -1.2, 2.0, 2.4);

  // 3. Arrowhead (Chipped Flint / Obsidian Broadhead Blade)
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.moveTo(11.0, 0);       // Tip
  ctx.lineTo(5.5, -3.2);     // Upper barb
  ctx.lineTo(6.5, -0.6);     // Inner notch
  ctx.lineTo(6.5, 0.6);      // Inner notch
  ctx.lineTo(5.5, 3.2);      // Lower barb
  ctx.closePath();
  ctx.fill();

  // Razor edge specular glint
  ctx.strokeStyle = "rgba(241, 245, 249, 0.85)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(11.0, 0);
  ctx.lineTo(5.8, -3.0);
  ctx.stroke();

  // 4. Feather Fletchings (Authentic Hunter Green & Pale Gold)
  // Upper Vane
  ctx.fillStyle = "#166534";
  ctx.beginPath();
  ctx.moveTo(-16.0, -0.5);
  ctx.lineTo(-15.0, -3.6);
  ctx.lineTo(-10.5, -3.6);
  ctx.lineTo(-9.0, -0.5);
  ctx.closePath();
  ctx.fill();

  // Upper Vane Accent Stripe
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.moveTo(-13.5, -0.5);
  ctx.lineTo(-13.0, -3.4);
  ctx.lineTo(-12.0, -3.4);
  ctx.lineTo(-12.5, -0.5);
  ctx.closePath();
  ctx.fill();

  // Lower Vane
  ctx.fillStyle = "#15803d";
  ctx.beginPath();
  ctx.moveTo(-16.0, 0.5);
  ctx.lineTo(-15.0, 3.6);
  ctx.lineTo(-10.5, 3.6);
  ctx.lineTo(-9.0, 0.5);
  ctx.closePath();
  ctx.fill();

  // Lower Vane Accent Stripe
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.moveTo(-13.5, 0.5);
  ctx.lineTo(-13.0, 3.4);
  ctx.lineTo(-12.0, 3.4);
  ctx.lineTo(-12.5, 0.5);
  ctx.closePath();
  ctx.fill();

  // Thread binding securing fletching to shaft
  ctx.fillStyle = "#78350f";
  ctx.fillRect(-16.0, -1.2, 1.2, 2.4);
  ctx.fillRect(-9.2, -1.2, 1.2, 2.4);

  // 5. Bone Nock at the rear
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(-17.5, -0.9, 1.5, 1.8);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-17.5, -0.4, 0.8, 0.8);

  ctx.restore();
}

export function drawGoblinArrows(ctx) {
  for (let i = 0; i < goblinArrows.length; i++) {
    drawGoblinArrow(ctx, goblinArrows[i]);
  }
}

export function clearGoblinArrows() {
  goblinArrows.length = 0;
}

// --- Family: Kobold ---
// kobolds.js - Procedural Lineless Kobold Entity Renderer


/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * Monsters must never have baked-in dark circular shapes emulating ground shadows.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

/**
 * Triggers a procedural limb and debris explosion upon Kobold death.
 * Produces severed digitigrade reptilian paws, tail segments,
 * tallow candle shards, and miner pickaxe fragments.
 * @param {Object} ce - Combat entity
 */
export function triggerKoboldDeathExplosion(ce) {
  if (!ce || ce._limbsExploded) return;
  ce._limbsExploded = true;

  const rawType = (ce.type || "kobold").toLowerCase();
  const scaleTone = "#9a3412"; // Rust crimson kobold scales
  const bellyTone = "#fed7aa"; // Cream underbelly scutes
  const hornTone = "#374151";  // Dark horn slate
  const ironTone = "#475569";  // Chipped iron pickaxe head
  const woodTone = "#78350f";  // Shaft wood
  const waxTone = "#fef08a";   // Candle wax

  if (typeof spawnParticle === "function") {
    // 1. Digitigrade Reptilian Paws and Claws
    for (let i = 0; i < 4; i++) {
      spawnParticle({
        x: (ce.x || 0) + (Math.random() - 0.5) * 16,
        y: (ce.y || 0) + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 180,
        vy: -80 - Math.random() * 110,
        color: scaleTone,
        accentColor: hornTone,
        size: 4.5,
        maxLife: 1.8,
        drag: 0.94,
        style: "circle",
        gravity: 210,
        shrink: true,
      });
    }

    // 2. Sinewy Scaly Tail Segments
    for (let t = 0; t < 2; t++) {
      const tAngle = (t / 2) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      spawnParticle({
        x: (ce.x || 0) - 6 + Math.cos(tAngle) * 5,
        y: (ce.y || 0) + Math.sin(tAngle) * 5,
        vx: Math.cos(tAngle) * 140,
        vy: -70 - Math.random() * 90,
        color: scaleTone,
        accentColor: bellyTone,
        size: 8,
        maxLife: 2.0,
        drag: 0.94,
        style: "circle",
        gravity: 190,
        shrink: true,
      });
    }

    // 3. Miner Pickaxe Shards & Candle Tallow
    const debrisColors = [ironTone, woodTone, waxTone, "#f59e0b", "#d97706"];
    for (let d = 0; d < 8; d++) {
      spawnParticle({
        x: (ce.x || 0) + (Math.random() - 0.5) * 12,
        y: (ce.y || 0) - 10 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 200,
        vy: -100 - Math.random() * 120,
        color: debrisColors[d % debrisColors.length],
        accentColor: ironTone,
        size: 3.5 + Math.random() * 2.5,
        maxLife: 1.9,
        drag: 0.93,
        style: "circle",
        gravity: 220,
        shrink: true,
      });
    }

    // 4. Candle Fire Spark Burst
    for (let f = 0; f < 6; f++) {
      spawnParticle({
        x: (ce.x || 0) + (Math.random() - 0.5) * 6,
        y: (ce.y || 0) - 22 + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 120,
        vy: -60 - Math.random() * 80,
        color: ["#f59e0b", "#f97316", "#ef4444", "#fef08a"],
        size: 2.2 + Math.random() * 2.0,
        maxLife: 0.9 + Math.random() * 0.4,
        drag: 0.91,
        gravity: -20,
        style: "circle",
        shrink: true,
      });
    }
  }
}

/**
 * Universal Lineless Procedural Kobold Entity Renderer
 * Features:
 * - Scavenger / Miner anatomy: reptilian draconic head, elongated snout, sharp fangs, glowing slit eyes.
 * - Pair of swept-back draconic horns.
 * - Miner headgear with tallow candle stub and dynamic flickering flame.
 * - Balanced digitigrade reptilian legs and clawed feet.
 * - Sinewy scaly tail with counterbalancing movement.
 * - Sturdy iron pickaxe in dominant hand with dynamic excavation swing kinetics.
 * - 8-directional perspective matrix for clean depth layering.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {Object} ent
 * @param {boolean} isShadowPass - Strictly prohibited from drawing solid shadows
 */
export function drawKoboldEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};

  const type = ent.type || "kobold_miner";
  const isSlowed = !!ent.isSlowed;
  const facingAngle = ent.facingAngle || 0;
  const moving = !!(ent.moving || ent.isMoving);

  if (ent._seed === undefined) {
    const id = ent.id || ("kobold_" + Math.round(x) + "_" + Math.round(y));
    ent._seed = computeFastSeed(id);
  }
  const seed = ent._seed;

  // Attack state detection
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  const nowMs = performance.now();
  if (!isAttacking && typeof GameState !== "undefined" && GameState.combatAnimations && ent && ent.id) {
    for (let i = 0; i < GameState.combatAnimations.length; i++) {
      const anim = GameState.combatAnimations[i];
      const dur = anim.duration || anim.durationMs || 450;
      if (anim.attackerId === ent.id && nowMs - anim.createdAt < dur) {
        isAttacking = true;
        break;
      }
    }
  }

  const scale = 1.85;

  // -------------------------------------------------------------
  // 8-Direction Mathematical Sector Mapping
  // 0: E, 1: SE, 2: S, 3: SW, 4: W, 5: NW, 6: N, 7: NE
  // -------------------------------------------------------------
  const normAngle = ((facingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const dirIndex = Math.floor(((normAngle + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4));

  // 8-Direction Matrix for Kobold Perspective
  const octagonalMatrix = [
    // 0: East (E) - Side Profile facing Right
    {
      dir: "E", view: "side", flip: 1, tilt: 0.12,
      headX: 2.6, headY: -17.5,
      tailX: -9.5, tailY: -1.5, tailFront: false,
      rightArmX: 2.2, rightArmY: -9.0, rightArmFront: false,
      leftArmX: -1.0, leftArmY: -8.5, leftArmFront: true,
      rightLegHipX: -0.8, rightLegFootX: -1.2, rightLegFront: false,
      leftLegHipX: 0.8, leftLegFootX: 1.6,
      facingDirX: 1.0,
      candleTilt: 0.08
    },
    // 1: South-East (SE) - 3/4 Front facing Down-Right
    {
      dir: "SE", view: "front_diag", flip: 1, tilt: 0.06,
      headX: 1.8, headY: -17.0,
      tailX: -7.0, tailY: -0.2, tailFront: false,
      rightArmX: -2.8, rightArmY: -9.0, rightArmFront: false,
      leftArmX: 3.8, leftArmY: -8.8, leftArmFront: true,
      rightLegHipX: -2.2, rightLegFootX: -2.4, rightLegFront: false,
      leftLegHipX: 2.0, leftLegFootX: 3.0,
      facingDirX: 0.7,
      candleTilt: 0.04
    },
    // 2: South (S) - Direct Front facing Camera
    {
      dir: "S", view: "front", flip: 1, tilt: 0.00,
      headX: 0.0, headY: -16.8,
      tailX: 0.0, tailY: 1.5, tailFront: false,
      rightArmX: -4.0, rightArmY: -9.0, rightArmFront: true,
      leftArmX: 4.0, leftArmY: -9.0, leftArmFront: true,
      rightLegHipX: -2.8, rightLegFootX: -3.2, rightLegFront: true,
      leftLegHipX: 2.8, leftLegFootX: 3.2,
      facingDirX: 0.0,
      candleTilt: 0.00
    },
    // 3: South-West (SW) - 3/4 Front facing Down-Left
    {
      dir: "SW", view: "front_diag", flip: -1, tilt: -0.06,
      headX: -1.8, headY: -17.0,
      tailX: 7.0, tailY: -0.2, tailFront: false,
      rightArmX: -3.8, rightArmY: -9.0, rightArmFront: true,
      leftArmX: 2.8, leftArmY: -8.8, leftArmFront: false,
      rightLegHipX: -2.0, rightLegFootX: -3.0, rightLegFront: true,
      leftLegHipX: 2.2, leftLegFootX: 2.4,
      facingDirX: -0.7,
      candleTilt: -0.04
    },
    // 4: West (W) - Side Profile facing Left
    {
      dir: "W", view: "side", flip: -1, tilt: -0.12,
      headX: -2.6, headY: -17.5,
      tailX: 9.5, tailY: -1.5, tailFront: false,
      rightArmX: -2.6, rightArmY: -9.0, rightArmFront: true,
      leftArmX: 1.0, leftArmY: -8.5, leftArmFront: false,
      rightLegHipX: -0.8, rightLegFootX: -1.6, rightLegFront: true,
      leftLegHipX: 0.8, leftLegFootX: 1.2,
      facingDirX: -1.0,
      candleTilt: -0.08
    },
    // 5: North-West (NW) - 3/4 Back facing Up-Left
    {
      dir: "NW", view: "back_diag", flip: -1, tilt: -0.06,
      headX: -1.4, headY: -18.0,
      tailX: 6.0, tailY: 5.0, tailFront: true,
      rightArmX: 3.2, rightArmY: -9.0, rightArmFront: false,
      leftArmX: -3.4, leftArmY: -8.6, leftArmFront: true,
      rightLegHipX: -2.0, rightLegFootX: -2.6, rightLegFront: true,
      leftLegHipX: 2.2, leftLegFootX: 2.2,
      facingDirX: -0.7,
      candleTilt: -0.03
    },
    // 6: North (N) - Direct Back facing Up
    {
      dir: "N", view: "back", flip: 1, tilt: 0.00,
      headX: 0.0, headY: -18.2,
      tailX: 0.0, tailY: 5.8, tailFront: true,
      rightArmX: 3.8, rightArmY: -9.0, rightArmFront: false,
      leftArmX: -3.8, leftArmY: -9.0, leftArmFront: false,
      rightLegHipX: -2.8, rightLegFootX: -3.2, rightLegFront: false,
      leftLegHipX: 2.8, leftLegFootX: 3.2,
      facingDirX: 0.0,
      candleTilt: 0.00
    },
    // 7: North-East (NE) - 3/4 Back facing Up-Right
    {
      dir: "NE", view: "back_diag", flip: 1, tilt: 0.06,
      headX: 1.4, headY: -18.0,
      tailX: -6.0, tailY: 5.0, tailFront: true,
      rightArmX: 3.2, rightArmY: -9.0, rightArmFront: true,
      leftArmX: -2.8, leftArmY: -8.6, leftArmFront: false,
      rightLegHipX: -2.2, rightLegFootX: -2.2, rightLegFront: false,
      leftLegHipX: 2.0, leftLegFootX: 2.6,
      facingDirX: 0.7,
      candleTilt: 0.03
    }
  ];

  const cfg = octagonalMatrix[dirIndex] || octagonalMatrix[2];
  const isBackView = cfg.view === "back" || cfg.view === "back_diag";
  const isFrontView = cfg.view === "front" || cfg.view === "front_diag";
  const isProfileView = cfg.view === "side";

  // Locomotion & Scamper Kinetics
  const speedFactor = isSlowed ? 0.5 : 1.0;
  const walkPhase = (nowMs * 0.014 * speedFactor + seed) % (Math.PI * 2);
  const breathCycle = Math.sin(nowMs * 0.0035 + seed) * 0.4;
  const bounce = moving ? Math.abs(Math.sin(walkPhase)) * 2.8 : breathCycle;

  // Attack 4-Phase Progress
  let attackProgress = 0;
  if (isAttacking) {
    if (ent.currentCast && typeof ent.currentCast.progress === "number") {
      attackProgress = Math.min(1.0, Math.max(0, ent.currentCast.progress));
    } else {
      let animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
      if (typeof GameState !== "undefined" && GameState.combatAnimations) {
        for (let i = 0; i < GameState.combatAnimations.length; i++) {
          if (GameState.combatAnimations[i].attackerId === ent.id) {
            animStart = GameState.combatAnimations[i].createdAt;
            break;
          }
        }
      }
      const dur = ent.attackDuration || 480;
      attackProgress = Math.min(1.0, Math.max(0, (nowMs - animStart) / dur));
    }
  }

  // Directional Attack Lunge Vector
  let lungeX = 0;
  let lungeY = 0;
  let squashX = 1;
  let squashY = 1;

  if (moving) {
    squashY = 1 - Math.abs(Math.sin(walkPhase)) * 0.08;
    squashX = 1 + Math.abs(Math.sin(walkPhase)) * 0.05;
  }

  if (isAttacking && attackProgress > 0) {
    const atkDirX = Math.cos(facingAngle);
    const atkDirY = Math.sin(facingAngle);
    if (attackProgress < 0.28) {
      // Wind-up: Kobold draws pickaxe high above head, coils back
      const t = attackProgress / 0.28;
      squashY = 1 - t * 0.12;
      squashX = 1 + t * 0.07;
      lungeX = -atkDirX * t * 2.5;
      lungeY = -atkDirY * t * 2.5;
    } else if (attackProgress < 0.70) {
      // Downward Excavation Slam: Rapid swing into earth
      const t = (attackProgress - 0.28) / 0.42;
      const stretch = Math.sin(t * Math.PI);
      squashY = 1 + stretch * 0.16;
      squashX = 1 - stretch * 0.08;
      lungeX = atkDirX * stretch * 6.5;
      lungeY = atkDirY * stretch * 4.5;
    } else {
      // Recovery
      const t = (attackProgress - 0.70) / 0.30;
      lungeX = atkDirX * (1 - t) * 1.5;
      lungeY = atkDirY * (1 - t) * 1.0;
    }
  }

  // Reptilian Palette
  const skinBase = isSlowed ? "#38bdf8" : "#9a3412";   // Rust-crimson scales
  const skinDark = isSlowed ? "#0284c7" : "#7c2d12";   // Shaded scale plates
  const bellyBase = isSlowed ? "#bae6fd" : "#fed7aa";  // Pale underbelly scutes
  const hornDark = "#1f2937";                          // Dark horn slate
  const eyeColor = "#facc15";                          // Glowing amber draconic eye
  const vestTone = "#451a03";                          // Tattered miner leather vest
  const candleWax = "#fef08a";                         // Tallow candle
  const ironHead = "#475569";                          // Pickaxe iron
  const ironEdge = "#94a3b8";                          // Chisel point highlight
  const woodHandle = "#78350f";                        // Wooden shaft

  ctx.save();
  ctx.translate(x + lungeX, y + lungeY - bounce);
  ctx.scale(scale * squashX, scale * squashY);

  const torsoX = 0;
  const torsoY = -9.0;

  // -------------------------------------------------------------
  // 1. Flexible Scaly Reptilian Tail
  // -------------------------------------------------------------
  const drawTail = () => {
    ctx.save();
    const tailWave = Math.sin(nowMs * 0.009 + seed) * 3.2 + (moving ? -cfg.flip * Math.cos(walkPhase) * 4.2 : 0);
    const tailBaseX = torsoX - (isProfileView ? cfg.flip * 4.0 : 0);
    const tailBaseY = torsoY + 4.5;
    const tailTipX = tailBaseX + cfg.tailX + (isProfileView ? tailWave * 0.3 : tailWave * 0.85);
    const tailTipY = tailBaseY + cfg.tailY + (isProfileView ? tailWave * 0.7 : Math.abs(tailWave) * 0.4);

    // Main tail curve
    ctx.strokeStyle = skinBase;
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailBaseX, tailBaseY);
    ctx.quadraticCurveTo(tailBaseX - (isProfileView ? cfg.flip * 3.8 : 0), tailBaseY + 2.0, tailTipX, tailTipY);
    ctx.stroke();

    // Pale underbelly strip on tail
    ctx.strokeStyle = bellyBase;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(tailBaseX, tailBaseY + 0.8);
    ctx.quadraticCurveTo(tailBaseX - (isProfileView ? cfg.flip * 3.6 : 0), tailBaseY + 2.4, tailTipX, tailTipY + 0.4);
    ctx.stroke();

    // Scaly dorsal ridges along tail
    for (let r = 1; r <= 3; r++) {
      const tr = r / 4;
      const rx = tailBaseX + (tailTipX - tailBaseX) * tr;
      const ry = tailBaseY + (tailTipY - tailBaseY) * tr - 1.2;
      ctx.fillStyle = skinDark;
      ctx.beginPath();
      ctx.arc(rx, ry, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  if (!cfg.tailFront) {
    drawTail();
  }

  // -------------------------------------------------------------
  // 2. Digitigrade Reptilian Legs & Clawed Feet
  // -------------------------------------------------------------
  const drawLeg = (hipX, footOffsetX, isFrontLeg) => {
    ctx.save();
    const legPhaseOffset = isFrontLeg ? 0 : Math.PI;
    const legSwing = moving ? Math.sin(walkPhase + legPhaseOffset) * 4.0 : 0;
    const legLift = moving ? Math.max(0, -Math.cos(walkPhase + legPhaseOffset) * 2.2) : 0;

    const thighStartX = torsoX + hipX;
    const thighStartY = torsoY + 4.8;
    const footX = thighStartX + footOffsetX + legSwing;
    const footY = 0 - legLift;

    // Knee bends backward in digitigrade posture
    const kneeX = thighStartX + (footX - thighStartX) * 0.4 - (cfg.facingDirX >= 0 ? 2.0 : -2.0);
    const kneeY = thighStartY + (footY - thighStartY) * 0.48;

    // Thigh
    ctx.strokeStyle = isFrontLeg ? skinBase : skinDark;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(thighStartX, thighStartY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    // Shin / Shank
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // Clawed 3-toed foot
    ctx.fillStyle = hornDark;
    const footDir = cfg.facingDirX >= 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(footX - footDir * 0.6, footY);
    ctx.lineTo(footX + footDir * 2.6, footY);
    ctx.lineTo(footX + footDir * 1.0, footY - 1.2);
    ctx.closePath();
    ctx.fill();

    // Tiny talon highlight
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(footX + footDir * 2.2, footY - 0.2, 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Draw background leg first
  if (cfg.rightLegFront) {
    drawLeg(cfg.leftLegHipX, cfg.leftLegFootX, false);
  } else {
    drawLeg(cfg.rightLegHipX, cfg.rightLegFootX, false);
  }

  // -------------------------------------------------------------
  // 3. Off-hand Arm (Holding Chisel or Clenched Claw)
  // -------------------------------------------------------------
  const drawLeftArm = () => {
    ctx.save();
    const armX = cfg.leftArmX;
    const armY = cfg.leftArmY;
    const armDirSign = armX < 0 ? -1 : 1;
    ctx.translate(armX, armY);

    const idleWave = Math.sin(nowMs * 0.005 + seed + 1.0) * 0.08;
    const walkSwing = moving ? -Math.sin(walkPhase) * 0.25 : 0;
    ctx.rotate(idleWave + walkSwing);

    // Scaly Shoulder
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.2, 1.8, armDirSign * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Forearm
    const handX = armDirSign * 4.2;
    const handY = 2.2;
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.moveTo(-0.6, 0);
    ctx.lineTo(handX, handY);
    ctx.lineTo(handX - armDirSign * 0.6, handY + 1.2);
    ctx.lineTo(-0.6, 1.4);
    ctx.closePath();
    ctx.fill();

    // Clenched scaly hand
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.arc(handX, handY, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Sharp talons on fingers
    ctx.fillStyle = hornDark;
    ctx.beginPath();
    ctx.moveTo(handX + armDirSign * 0.4, handY - 0.8);
    ctx.lineTo(handX + armDirSign * 2.2, handY);
    ctx.lineTo(handX + armDirSign * 0.4, handY + 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  if (!cfg.leftArmFront) {
    drawLeftArm();
  }

  // -------------------------------------------------------------
  // 4. Kobold Torso & Tattered Miner Leather Tunic
  // -------------------------------------------------------------
  ctx.save();
  ctx.translate(torsoX, torsoY);
  ctx.rotate(cfg.tilt);

  // Muscular Scaly Core
  ctx.fillStyle = skinBase;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.4, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pale Underbelly Scutes (Visible on front and front-diagonal angles)
  if (isFrontView || isProfileView) {
    ctx.fillStyle = bellyBase;
    ctx.beginPath();
    const bellyShiftX = isProfileView ? cfg.flip * 1.8 : cfg.facingDirX * 1.2;
    ctx.ellipse(bellyShiftX, 0.4, 2.4, 4.5, isProfileView ? cfg.flip * 0.15 : 0, 0, Math.PI * 2);
    ctx.fill();

    // Scute horizontal segment grooves
    ctx.strokeStyle = skinDark;
    ctx.lineWidth = 0.65;
    for (let s = -2; s <= 2; s++) {
      const sy = s * 1.5;
      ctx.beginPath();
      ctx.moveTo(bellyShiftX - 1.4, sy);
      ctx.lineTo(bellyShiftX + 1.4, sy);
      ctx.stroke();
    }
  }

  // Tattered Miner Leather Vest
  ctx.fillStyle = vestTone;
  ctx.beginPath();
  ctx.ellipse(0, 1.2, 4.6, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Leather shoulder straps
  ctx.strokeStyle = "#291305";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-3.2, -3.2); ctx.lineTo(-1.2, 2.5);
  ctx.moveTo(3.2, -3.2);  ctx.lineTo(1.2, 2.5);
  ctx.stroke();

  // Scavenged bronze buckle
  ctx.fillStyle = "#d97706";
  ctx.fillRect(-0.9, 1.0, 1.8, 1.4);
  ctx.fillStyle = "#fef3c7";
  ctx.fillRect(-0.4, 1.3, 0.8, 0.8);

  ctx.restore();

  // Foreground leg
  if (cfg.rightLegFront) {
    drawLeg(cfg.rightLegHipX, cfg.rightLegFootX, true);
  } else {
    drawLeg(cfg.leftLegHipX, cfg.leftLegFootX, true);
  }

  // -------------------------------------------------------------
  // 5. Kobold Cranium, Draconic Muzzle, Horns & Candle Helmet
  // -------------------------------------------------------------
  ctx.save();
  ctx.translate(cfg.headX, cfg.headY);

  const headBob = moving ? Math.sin(walkPhase * 2) * 0.6 : Math.sin(nowMs * 0.004 + seed) * 0.3;
  ctx.translate(0, headBob);

  // Neck
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(0, 3.2, 2.8, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Swept-back Draconic Horns (Drawn behind skull)
  const drawHorns = () => {
    ctx.fillStyle = hornDark;
    const hornTilt = cfg.facingDirX * 0.3;

    // Horn 1 (Left)
    ctx.beginPath();
    ctx.moveTo(-1.8, -3.0);
    ctx.quadraticCurveTo(-4.5 + hornTilt, -8.0, -5.2 - cfg.facingDirX * 2.0, -9.5);
    ctx.quadraticCurveTo(-3.2 + hornTilt, -7.0, -0.6, -3.8);
    ctx.closePath();
    ctx.fill();

    // Horn 2 (Right)
    ctx.beginPath();
    ctx.moveTo(1.8, -3.0);
    ctx.quadraticCurveTo(4.5 + hornTilt, -8.0, 5.2 - cfg.facingDirX * 2.0, -9.5);
    ctx.quadraticCurveTo(3.2 + hornTilt, -7.0, 0.6, -3.8);
    ctx.closePath();
    ctx.fill();

    // Horn ridged texture
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-2.4, -5.0); ctx.lineTo(-1.6, -5.6);
    ctx.moveTo(2.4, -5.0);  ctx.lineTo(1.6, -5.6);
    ctx.stroke();
  };
  drawHorns();

  // Cranium base
  ctx.fillStyle = skinBase;
  ctx.beginPath();
  ctx.ellipse(0, -0.5, 4.6, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draconic Elongated Muzzle / Snout
  if (!isBackView) {
    const snoutDir = cfg.facingDirX >= 0 ? 1 : -1;
    const snoutLen = isProfileView ? 5.5 : 3.8;
    const snoutX = isProfileView ? snoutDir * 2.8 : cfg.facingDirX * 2.0;

    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.moveTo(snoutX - snoutDir * 1.5, -2.0);
    ctx.lineTo(snoutX + snoutDir * snoutLen, 0.4);
    ctx.lineTo(snoutX + snoutDir * (snoutLen - 0.6), 2.2);
    ctx.lineTo(snoutX - snoutDir * 1.5, 2.0);
    ctx.closePath();
    ctx.fill();

    // Lower jaw & Ivory fangs
    ctx.fillStyle = bellyBase;
    ctx.beginPath();
    ctx.moveTo(snoutX - snoutDir * 0.8, 1.2);
    ctx.lineTo(snoutX + snoutDir * (snoutLen - 1.0), 1.6);
    ctx.lineTo(snoutX + snoutDir * (snoutLen - 1.4), 2.6);
    ctx.lineTo(snoutX - snoutDir * 0.8, 2.4);
    ctx.closePath();
    ctx.fill();

    // Sharp little fangs poking out
    ctx.fillStyle = "#ffffff";
    const fangX = snoutX + snoutDir * (snoutLen - 1.8);
    ctx.beginPath();
    ctx.moveTo(fangX, 0.8);
    ctx.lineTo(fangX + snoutDir * 0.8, 2.6);
    ctx.lineTo(fangX - snoutDir * 0.4, 1.6);
    ctx.closePath();
    ctx.fill();

    // Nostril slit
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.arc(snoutX + snoutDir * (snoutLen - 0.8), -0.2, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Draconic Amber Eye with Slit Pupil
    const eyeX = isProfileView ? snoutDir * 1.4 : cfg.facingDirX * 1.6 + (cfg.facingDirX >= 0 ? 0.8 : -0.8);
    const eyeY = -1.2;

    // Glowing socket
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 1.5, 1.2, cfg.facingDirX * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Slit pupil
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 0.4, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Specular eye shine
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(eyeX - 0.4, eyeY - 0.4, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------
  // 6. Signature Miner Helmet & Burning Tallow Candle
  // -------------------------------------------------------------
  // Leather Headband / Miner skullcap band
  ctx.fillStyle = "#3b1d06";
  ctx.beginPath();
  ctx.ellipse(0, -3.2, 4.4, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iron candle mount plate
  ctx.fillStyle = ironHead;
  ctx.fillRect(-1.6, -4.8, 3.2, 1.5);
  ctx.fillStyle = ironEdge;
  ctx.fillRect(-1.2, -4.5, 2.4, 0.6);

  // Tallow Candle Stub
  const candleBaseX = cfg.candleTilt * 10;
  const candleBaseY = -4.8;
  const candleH = 5.2;

  ctx.fillStyle = candleWax;
  ctx.fillRect(candleBaseX - 1.2, candleBaseY - candleH, 2.4, candleH);

  // Wax drip streaks
  ctx.fillStyle = "#fef9c3";
  ctx.fillRect(candleBaseX - 1.2, candleBaseY - candleH, 0.8, candleH);
  ctx.beginPath();
  ctx.arc(candleBaseX + 1.2, candleBaseY - candleH * 0.4, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Burning Candle Wick & Dynamic Flickering Flame
  const wickX = candleBaseX;
  const wickY = candleBaseY - candleH;

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(wickX, wickY);
  ctx.lineTo(wickX, wickY - 2.0);
  ctx.stroke();

  // Animated flame kinetics
  const flameFlicker = Math.sin(nowMs * 0.025 + seed) * 0.6 + Math.cos(nowMs * 0.018) * 0.4;
  const flameTipX = wickX + flameFlicker * 0.8 - cfg.facingDirX * 0.6;
  const flameTipY = wickY - 6.5;

  // Outer ambient warm glow (safe radial gradient)
  const glowGrad = safeCreateRadialGradient(ctx, wickX, wickY - 3.0, 0.5, wickX, wickY - 3.0, 14.0);
  if (glowGrad) {
    glowGrad.addColorStop(0, "rgba(251, 191, 36, 0.45)");
    glowGrad.addColorStop(0.5, "rgba(249, 115, 22, 0.18)");
    glowGrad.addColorStop(1, "rgba(249, 115, 22, 0.0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(wickX, wickY - 3.0, 14.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Teardrop Flame Body
  ctx.fillStyle = "#f97316"; // Orange flame outer
  ctx.beginPath();
  ctx.moveTo(wickX - 1.6, wickY - 1.2);
  ctx.quadraticCurveTo(wickX - 1.8, wickY - 4.0, flameTipX, flameTipY);
  ctx.quadraticCurveTo(wickX + 1.8, wickY - 4.0, wickX + 1.6, wickY - 1.2);
  ctx.closePath();
  ctx.fill();

  // Flame Inner Core
  ctx.fillStyle = "#fef08a"; // Bright yellow core
  ctx.beginPath();
  ctx.moveTo(wickX - 0.9, wickY - 1.2);
  ctx.quadraticCurveTo(wickX - 0.9, wickY - 3.2, flameTipX * 0.6 + wickX * 0.4, flameTipY + 2.0);
  ctx.quadraticCurveTo(wickX + 0.9, wickY - 3.2, wickX + 0.9, wickY - 1.2);
  ctx.closePath();
  ctx.fill();

  // White hottest flame root
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(wickX, wickY - 1.4, 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // End head

  // Foreground Left Arm if not drawn yet
  if (cfg.leftArmFront) {
    drawLeftArm();
  }

  // -------------------------------------------------------------
  // 7. Dominant Right-Hand Weapon (Chipped Iron Mining Pickaxe)
  // -------------------------------------------------------------
  const drawRightArmAndPickaxe = () => {
    ctx.save();
    const armX = cfg.rightArmX;
    const armY = cfg.rightArmY;
    const armDirSign = armX < 0 ? -1 : 1;
    ctx.translate(armX, armY);

    let swingAngle = 0;
    if (isAttacking) {
      if (attackProgress < 0.28) {
        // Raise pickaxe high overhead
        const t = attackProgress / 0.28;
        swingAngle = -cfg.flip * t * 1.5;
      } else if (attackProgress < 0.70) {
        // Excavate slam downward
        const t = (attackProgress - 0.28) / 0.42;
        swingAngle = cfg.flip * (-1.5 + t * 2.8);
      } else {
        // Recovery
        const t = (attackProgress - 0.70) / 0.30;
        swingAngle = cfg.flip * (1.3 * (1 - t));
      }
    }

    const baseArmRot = isBackView ? -0.55 * armDirSign : 0.45 * armDirSign;
    ctx.rotate(baseArmRot + swingAngle);

    // Scaly Upper Arm & Deltoid
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.4, 1.9, armDirSign * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Forearm
    const handX = armDirSign * 5.0;
    const handY = 2.4;
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.moveTo(-0.8, 0);
    ctx.lineTo(handX, handY);
    ctx.lineTo(handX - armDirSign * 0.8, handY + 1.4);
    ctx.lineTo(-0.8, 1.5);
    ctx.closePath();
    ctx.fill();

    // Leather wrist cord
    ctx.fillStyle = "#451a03";
    ctx.fillRect(handX - armDirSign * 1.5, handY - 0.6, 1.4, 1.6);

    // Clenched scaly hand
    ctx.fillStyle = skinBase;
    ctx.beginPath();
    ctx.arc(handX, handY, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // -----------------------------------------------------------
    // The Chipped Iron Mining Pickaxe
    // -----------------------------------------------------------
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(armDirSign * 0.6);

    // Wooden shaft
    ctx.strokeStyle = woodHandle;
    ctx.lineWidth = 2.0;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 4.5);
    ctx.lineTo(0, -13.5);
    ctx.stroke();

    // Leather grip wrapping around lower handle
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 2.0);
    ctx.lineTo(0, -2.0);
    ctx.stroke();

    // Chipped Double-Sided Iron Pickaxe Head
    const headCenterY = -12.5;

    // Curved Chisel Pick Beak (Front side)
    ctx.fillStyle = ironHead;
    ctx.beginPath();
    ctx.moveTo(0, headCenterY - 1.6);
    ctx.quadraticCurveTo(armDirSign * 4.5, headCenterY - 1.2, armDirSign * 8.5, headCenterY + 4.2);
    ctx.lineTo(armDirSign * 7.5, headCenterY + 4.8);
    ctx.quadraticCurveTo(armDirSign * 3.8, headCenterY + 0.6, 0, headCenterY + 1.6);
    ctx.closePath();
    ctx.fill();

    // Razor Chisel Point Highlight
    ctx.strokeStyle = ironEdge;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(armDirSign * 4.0, headCenterY - 0.4);
    ctx.lineTo(armDirSign * 8.5, headCenterY + 4.2);
    ctx.stroke();

    // Flat Hammer Back (Rear counter-head)
    ctx.fillStyle = ironHead;
    ctx.beginPath();
    ctx.moveTo(0, headCenterY - 1.5);
    ctx.lineTo(-armDirSign * 4.0, headCenterY - 1.8);
    ctx.lineTo(-armDirSign * 4.2, headCenterY + 1.8);
    ctx.lineTo(0, headCenterY + 1.5);
    ctx.closePath();
    ctx.fill();

    // Hammer face reinforcement
    ctx.fillStyle = ironEdge;
    ctx.fillRect(-armDirSign * 4.4, headCenterY - 1.6, 0.8, 3.2);

    // Central Iron Collar Eyelet
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(0, headCenterY, 1.8, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bronze wedge pin
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.arc(0, headCenterY, 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Dynamic Chisel Strike Trail & Mineral Sparks
    if (isAttacking && attackProgress >= 0.28 && attackProgress < 0.70) {
      const t = (attackProgress - 0.28) / 0.42;
      const arcAlpha = Math.sin(t * Math.PI) * 0.95;
      if (arcAlpha > 0.05) {
        ctx.save();
        const tipX = armDirSign * 8.5;
        const tipY = headCenterY + 4.2;

        const slashGrad = ctx.createLinearGradient(tipX, tipY, tipX + armDirSign * 5, tipY + 8);
        slashGrad.addColorStop(0, `rgba(251, 191, 36, ${arcAlpha})`);
        slashGrad.addColorStop(1, `rgba(249, 115, 22, 0)`);
        ctx.strokeStyle = slashGrad;
        ctx.lineWidth = 2.0;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tipX - armDirSign * 2.5, tipY - 3.5);
        ctx.quadraticCurveTo(tipX, tipY, tipX + armDirSign * 4, tipY + 6);
        ctx.stroke();

        ctx.fillStyle = `rgba(254, 240, 138, ${arcAlpha})`;
        ctx.beginPath();
        ctx.arc(tipX + armDirSign * 1.5, tipY + 1.2, 1.2, 0, Math.PI * 2);
        ctx.arc(tipX + armDirSign * 3.2, tipY + 3.5, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore(); // End Pickaxe
    ctx.restore(); // End Right Arm
  };

  drawRightArmAndPickaxe();

  // If tail is front-layered, draw it now
  if (cfg.tailFront) {
    drawTail();
  }

  ctx.restore();
}

// --- Family: Void Terror ---
// voidTerror.js - Procedural Lineless Void Terror Leviathan & Eldritch Cosmic Entity Renderer



/**
 * CORE DESIGN RULE: NEVER RENDER SOLID SHADOW CIRCLES
 * Never draw solid or flat circle/ellipse ground shadows beneath monsters.
 * Monsters must never have baked-in dark circular shapes emulating ground shadows.
 * All artificial solid ground shadow discs are strictly prohibited.
 */

/**
 * Triggers a clean cosmic void collapse with an imploding singularity pulse,
 * smooth tendril fragments, and astral spark motes.
 *
 * @param {Object} ce - Entity state object
 */
export function triggerVoidDeathExplosion(ce) {
  if (!ce || ce._voidExploded) return;
  ce._voidExploded = true;

  const type = (ce.type || "void_terror").toLowerCase();
  const isBoss = type.startsWith("boss_") || type.includes("colossus") || type.includes("leviathan");
  const isDevourer = type.includes("devourer");
  const isNullGazer = type.includes("gazer");

  const primaryColor = isDevourer ? "#4c0519" : isNullGazer ? "#1e1b4b" : "#1e0836";
  const accentColor = isDevourer ? "#f43f5e" : isNullGazer ? "#38bdf8" : "#c084fc";
  const coreGlow = isDevourer ? "#fb7185" : isNullGazer ? "#7dd3fc" : "#e879f9";

  const particleFn = (typeof window !== "undefined" && typeof window.spawnParticle === "function")
    ? window.spawnParticle
    : (typeof spawnParticle === "function" ? spawnParticle : null);

  if (particleFn) {
    // 1. Sleek severed tendril fragments radiating outward
    const fragmentCount = isBoss ? 8 : 4;
    for (let i = 0; i < fragmentCount; i++) {
      const angle = (i / fragmentCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 110 + Math.random() * 140;
      particleFn({
        x: ce.x + Math.cos(angle) * 10,
        y: ce.y + Math.sin(angle) * 10,
        vx: Math.cos(angle) * speed,
        vy: -75 - Math.random() * 95,
        color: primaryColor,
        accentColor: accentColor,
        size: isBoss ? 11 : 6.5,
        maxLife: 1.8,
        drag: 0.94,
        style: "wolf_leg",
        gravity: 140,
        shrink: true,
      });
    }

    // 2. Cosmic astral spark motes
    const moteCount = isBoss ? 48 : 22;
    const sparkPalette = isDevourer
      ? ["#f43f5e", "#fda4af", "#e11d48", "#ffffff"]
      : isNullGazer
      ? ["#38bdf8", "#bae6fd", "#818cf8", "#ffffff"]
      : ["#e879f9", "#c084fc", "#d946ef", "#ffffff", "#7dd3fc"];

    for (let m = 0; m < moteCount; m++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 200;
      particleFn({
        x: ce.x + (Math.random() - 0.5) * 12,
        y: ce.y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        color: sparkPalette,
        size: 2.0 + Math.random() * 3.2,
        maxLife: 1.0 + Math.random() * 0.8,
        drag: 0.93,
        gravity: 35,
        shrink: true,
        style: "circle",
      });
    }

    // 3. Central implosion pulse
    particleFn({
      x: ce.x,
      y: ce.y,
      vx: 0,
      vy: -15,
      color: coreGlow,
      size: isBoss ? 32 : 16,
      maxLife: 0.6,
      drag: 0.88,
      gravity: 0,
      shrink: true,
      style: "circle",
    });
  }
}

/**
 * Draws a single sleek, procedural lineless tendril with smooth volumetric
 * gradient, tapered bezier contour, glowing spine, optional rune nodes, and tip droplet.
 */
function drawSleekTendril(ctx, params) {
  const {
    baseX,
    baseY,
    length,
    baseWidth,
    tipWidth,
    angle,
    wavePhase,
    waveAmp,
    primaryColor,
    shadowColor,
    glowColor,
    segments = 10,
    attackStretch = 0,
    curviness = 0,
    straighten = 0,
    runeNodes = false
  } = params;

  const totalLen = length * (1 + attackStretch * 0.5);
  const segLen = totalLen / segments;
  const nodes = [];

  let curX = baseX;
  let curY = baseY;
  let curAngle = angle;

  nodes.push({ x: curX, y: curY, w: baseWidth, perpX: 0, perpY: 0 });

  for (let s = 1; s <= segments; s++) {
    const t = s / segments;
    // Harmonious flowing wave along the tendril, softened if straightened for lance attacks
    const wave = Math.sin(wavePhase + t * Math.PI * 2.0) * waveAmp * (0.3 + t * 0.7) * (1 - straighten);
    const curveStep = curviness * (1 - straighten);
    curAngle += wave + curveStep;

    curX += Math.cos(curAngle) * segLen;
    curY += Math.sin(curAngle) * segLen;

    const w = (baseWidth * (1 - t * 0.82) + tipWidth * t) * (1 - straighten * 0.2);
    const perpX = -Math.sin(curAngle);
    const perpY = Math.cos(curAngle);

    nodes.push({ x: curX, y: curY, w, perpX, perpY });
  }

  // Draw smooth tapered contour
  ctx.beginPath();
  const first = nodes[0];
  ctx.moveTo(first.x + first.perpX * (first.w * 0.5), first.y + first.perpY * (first.w * 0.5));

  for (let i = 1; i < nodes.length; i++) {
    const node = nodes[i];
    const prev = nodes[i - 1];
    const mx = (prev.x + prev.perpX * (prev.w * 0.5) + node.x + node.perpX * (node.w * 0.5)) * 0.5;
    const my = (prev.y + prev.perpY * (prev.w * 0.5) + node.y + node.perpY * (node.w * 0.5)) * 0.5;
    ctx.quadraticCurveTo(
      prev.x + prev.perpX * (prev.w * 0.5),
      prev.y + prev.perpY * (prev.w * 0.5),
      mx,
      my
    );
  }

  const tip = nodes[nodes.length - 1];
  ctx.lineTo(tip.x, tip.y);

  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const rx = node.x - node.perpX * (node.w * 0.5);
    const ry = node.y - node.perpY * (node.w * 0.5);
    ctx.lineTo(rx, ry);
  }
  ctx.closePath();

  // Smooth volumetric gradient along length
  const grad = ctx.createLinearGradient(baseX, baseY, tip.x, tip.y);
  grad.addColorStop(0, shadowColor);
  grad.addColorStop(0.5, primaryColor);
  grad.addColorStop(1, glowColor);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle luminous core spine ribbon
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  for (let i = 1; i < nodes.length - 1; i++) {
    const p = nodes[i];
    const next = nodes[i + 1];
    ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) * 0.5, (p.y + next.y) * 0.5);
  }
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = Math.max(1, baseWidth * 0.22);
  ctx.lineCap = "round";
  ctx.stroke();

  // Bioluminescent Rune Nodes along the Leviathan tendrils
  if (runeNodes && nodes.length >= 6) {
    const nodeIndices = [Math.floor(nodes.length * 0.35), Math.floor(nodes.length * 0.65)];
    for (const idx of nodeIndices) {
      const n = nodes[idx];
      const nodeR = Math.max(1.8, n.w * 0.42);
      ctx.beginPath();
      ctx.arc(n.x, n.y, nodeR, 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, nodeR * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
  }

  // Glowing ethereal tip droplet
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, Math.max(1.5, tipWidth * 1.5), 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Procedural Lineless Void Terror Zone of Attack Effect Renderer
 * Renders a clean telegraph warning zone without noise.
 */
export function drawVoidAttackZone(ctx, centerX, centerY, params = {}) {
  const {
    radius = 64,
    progress = 0,
    archetype = "void_terror",
    isSpin = false,
    spinAngle = 0
  } = params;

  if (radius <= 0) return;

  let colorGlow = "rgba(192, 132, 252, 0.22)";
  let colorProgress = "rgba(217, 70, 239, 0.45)";
  let colorShock = "rgba(232, 121, 249, 0.65)";

  if (archetype === "devourer") {
    colorGlow = "rgba(244, 63, 94, 0.22)";
    colorProgress = "rgba(244, 63, 94, 0.45)";
    colorShock = "rgba(251, 113, 133, 0.65)";
  } else if (archetype === "null_gazer") {
    colorGlow = "rgba(56, 189, 248, 0.22)";
    colorProgress = "rgba(56, 189, 248, 0.45)";
    colorShock = "rgba(125, 211, 252, 0.65)";
  }

  const isWindup = progress < 0.22;
  const isStrike = progress >= 0.22 && progress < 0.80;
  const windupP = Math.min(1, Math.max(0, progress / 0.22));
  const strikeP = isStrike ? (progress - 0.22) / 0.58 : 0;

  ctx.save();
  ctx.translate(centerX, centerY);

  // 1. Base Danger Warning Zone Fill
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius * 0.60, 0, 0, Math.PI * 2);
  ctx.fillStyle = colorGlow;
  ctx.fill();

  // 2. Windup Progress Fill
  if (isWindup) {
    const fillR = radius * windupP;
    if (fillR > 0.5) {
      ctx.beginPath();
      ctx.ellipse(0, 0, fillR, fillR * 0.60, 0, 0, Math.PI * 2);
      ctx.fillStyle = colorProgress;
      ctx.fill();
    }
  }

  // 3. Strike Whirlwind Flash & Rotating Vortex Indicator
  if (isStrike) {
    const flashAlpha = Math.sin(strikeP * Math.PI);
    if (flashAlpha > 0.02) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.60, 0, 0, Math.PI * 2);
      ctx.fill();

      if (isSpin) {
        ctx.strokeStyle = colorShock;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.94, radius * 0.56, spinAngle * 0.5, 0, Math.PI * 1.5);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${flashAlpha * 0.6})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.72, radius * 0.43, -spinAngle * 0.7, 0, Math.PI * 1.2);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

/**
 * Draws the Abyssal Rift Beam effect erupting from the Leviathan's central eye.
 */
function drawVoidBeamEffect(ctx, originX, originY, angle, length, beamProgress, isBoss, glowColor, highlightColor) {
  if (beamProgress <= 0 || beamProgress >= 1) return;

  // Pulse intensity curve
  const peak = Math.sin(beamProgress * Math.PI);
  const coreAlpha = peak;
  const beamWidth = (isBoss ? 26 : 18) * (0.8 + peak * 0.4);
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angle);

  // 1. Outer Ethereal Ionization Corona
  const coronaGrad = ctx.createLinearGradient(0, 0, length, 0);
  coronaGrad.addColorStop(0, "rgba(232, 121, 249, 0.45)");
  coronaGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.28)");
  coronaGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

  ctx.beginPath();
  ctx.moveTo(0, -beamWidth * 1.6);
  ctx.lineTo(length, -beamWidth * 2.4);
  ctx.lineTo(length, beamWidth * 2.4);
  ctx.lineTo(0, beamWidth * 1.6);
  ctx.closePath();
  ctx.fillStyle = coronaGrad;
  ctx.fill();

  // 2. High-Energy Concentrated Plasma Body
  const plasmaGrad = ctx.createLinearGradient(0, 0, length, 0);
  plasmaGrad.addColorStop(0, glowColor);
  plasmaGrad.addColorStop(0.7, highlightColor);
  plasmaGrad.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.beginPath();
  ctx.moveTo(0, -beamWidth * 0.65);
  ctx.lineTo(length, -beamWidth * 0.9);
  ctx.lineTo(length, beamWidth * 0.9);
  ctx.lineTo(0, beamWidth * 0.65);
  ctx.closePath();
  ctx.fillStyle = plasmaGrad;
  ctx.globalAlpha = coreAlpha * 0.85;
  ctx.fill();

  // 3. Piercing Diamond-White Core Laser
  ctx.beginPath();
  ctx.moveTo(0, -beamWidth * 0.22);
  ctx.lineTo(length, -beamWidth * 0.28);
  ctx.lineTo(length, beamWidth * 0.28);
  ctx.lineTo(0, beamWidth * 0.22);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = coreAlpha;
  ctx.fill();

  // 4. Crackling Transverse Void Lightning Bolts
  ctx.globalAlpha = coreAlpha * 0.9;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  const boltCount = 3;
  for (let b = 0; b < boltCount; b++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const steps = 6;
    for (let s = 1; s <= steps; s++) {
      const segX = (s / steps) * length;
      const seedJitter = Math.sin(nowMs * 0.03 + b * 4.2 + s * 2.1);
      const segY = seedJitter * (beamWidth * 0.85);
      ctx.lineTo(segX, segY);
    }
    ctx.stroke();
  }

  // 5. Aperture Eye Shock Rings
  for (let r = 0; r < 3; r++) {
    const ringP = ((beamProgress * 3.5 + r * 0.33) % 1);
    const ringDist = ringP * length * 0.6;
    const ringW = (1 - ringP) * (beamWidth * 1.8);
    ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - ringP) * 0.75})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(ringDist, 0, beamWidth * 0.4, ringW, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 6. Impact Terminus Starburst
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(length, 0, beamWidth * 1.4 * peak, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Procedural Lineless Void Terror & Eldritch Cosmic Entity Master Renderer
 * Features streamlined cosmic silhouette, dynamic Leviathan boss crown spires,
 * orbiting accretion motes, and multiple distinct eldritch attack styles:
 *
 * 1. Tentacle Whirlwind (360 Vortex Spin)
 * 2. Abyssal Rift Beam (Searing Singularity Laser)
 * 3. Event Horizon Singularity (Accretion Cage Collapse)
 * 4. Abyssal Cleave / Tendril Slam (Heavy Frontal Thrash)
 * 5. Void Nova (Astral Supernova Burst)
 * 6. Void Skewer (Rapid Staccato Lance Barrage)
 * 7. Singularity Strike (Directional Lunge)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Target X coordinate
 * @param {number} y - Target Y coordinate
 * @param {Object} ent - Entity state object
 * @param {boolean} isShadowPass - Shadow pass flag (strictly prohibits solid ground shadows)
 */
export function drawVoidTerrorEntity(ctx, x, y, ent, isShadowPass = false) {
  if (isShadowPass) return;
  if (!ent) ent = {};

  const type = (ent.type || "boss_void_terror").toLowerCase();
  const facingAngle = (typeof ent.facingAngle === "number" && !isNaN(ent.facingAngle)) ? ent.facingAngle : 0;
  const isMoving = !!(ent.moving || ent.isMoving);
  const isSlowed = !!ent.isSlowed;

  if (ent._seed === undefined) {
    const id = ent.id || ("void_" + Math.round(x) + "_" + Math.round(y));
    ent._seed = typeof computeFastSeed === "function" ? computeFastSeed(id) : 42;
  }
  const seed = ent._seed;
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();

  // Attack State & Animation Progress
  let isAttacking = !!(ent.isAttacking || ent.currentCast);
  let attackProgress = 0;
  if (ent.currentCast && ent.currentCast.duration > 0) {
    const elapsed = Math.max(0, nowMs - (ent.currentCast.startTime || nowMs));
    attackProgress = Math.min(1, elapsed / ent.currentCast.duration);
    isAttacking = true;
  } else if (isAttacking) {
    const animStart = ent.attackStart || ent.lastAttackTime || ent.attackTime || nowMs;
    const dur = (ent.attackDuration && ent.attackDuration > 0) ? ent.attackDuration : 850;
    attackProgress = Math.min(1, (nowMs - animStart) / dur);
    if (attackProgress >= 1) isAttacking = false;
  }

  // Preview Mode in Studio
  if (!isAttacking && (ent.showZonePreview || ent.loopZonePreview)) {
    isAttacking = true;
    attackProgress = ((nowMs * 0.0009 + seed * 0.1) % 1);
  }

  // Attack Style Dispatch
  const attackType = (ent.voidAttackType || ent.attackType || "spin").toLowerCase();
  const isSpin = isAttacking && (attackType.includes("spin") || attackType === "whirlwind");
  const isBeam = isAttacking && (attackType.includes("beam") || attackType.includes("rift") || attackType.includes("null_ray"));
  const isSingularity = isAttacking && (attackType.includes("singularity") || attackType.includes("black_hole") || attackType.includes("collapse") || attackType.includes("gravity_well"));
  const isSlam = isAttacking && (attackType.includes("slam") || attackType.includes("cleave") || attackType.includes("thrash"));
  const isNova = isAttacking && (attackType.includes("nova") || attackType.includes("supernova") || attackType.includes("cataclysm"));
  const isSkewer = isAttacking && (attackType.includes("skewer") || attackType.includes("pierce") || attackType.includes("barrage"));

  // Hit Flash
  let isFlashing = false;
  let flashAmt = 0;
  if (ent.lastHitTime && nowMs - ent.lastHitTime < 160) {
    isFlashing = true;
    flashAmt = Math.max(0, 1 - (nowMs - ent.lastHitTime) / 160);
  }

  // Archetype Sizing
  const isBoss = type.startsWith("boss_") || type.includes("colossus") || type.includes("leviathan");
  const isDevourer = type.includes("devourer");
  const isNullGazer = type.includes("gazer");
  const isSpawn = type.includes("spawn") || type.includes("larva");

  const baseScale = isBoss ? 2.25 : isSpawn ? 1.1 : isNullGazer ? 1.6 : isDevourer ? 1.7 : 1.6;
  const r = isBoss ? 38 : isSpawn ? 18 : isNullGazer ? 30 : 31;

  // Harmonious Color Palettes (Rich Lineless Digital Painting)
  let shadowColor = "#06010c";
  let primaryColor = "#1a062f";
  let midColor = "#3b0764";
  let rimColor = "#7e22ce";
  let highlightColor = "#c084fc";
  let glowColor = "#d946ef";
  let eyeCore = "#f5d0fe";
  let eyeIris = "#a855f7";
  let eyePupil = "#06010c";
  let auraGlow = "rgba(217, 70, 239, 0.35)";

  if (isDevourer) {
    shadowColor = "#0a0106";
    primaryColor = "#260211";
    midColor = "#4c0519";
    rimColor = "#9f1239";
    highlightColor = "#f43f5e";
    glowColor = "#fb7185";
    eyeCore = "#ffe4e6";
    eyeIris = "#e11d48";
    eyePupil = "#0a0106";
    auraGlow = "rgba(244, 63, 94, 0.38)";
  } else if (isNullGazer) {
    shadowColor = "#020617";
    primaryColor = "#0b1329";
    midColor = "#1e1b4b";
    rimColor = "#0369a1";
    highlightColor = "#38bdf8";
    glowColor = "#7dd3fc";
    eyeCore = "#e0f2fe";
    eyeIris = "#0284c7";
    eyePupil = "#020617";
    auraGlow = "rgba(56, 189, 248, 0.38)";
  }

  // Smooth, Ethereal Floating Motion
  const speedMult = isSlowed ? 0.45 : 1.0;
  let floatWave = Math.sin(nowMs * 0.003 * speedMult + seed) * (isBoss ? 4.5 : 3.0);
  const breathPulse = Math.sin(nowMs * 0.004 * speedMult + seed * 2) * (isBoss ? 2.2 : 1.5);
  let rotWobble = Math.sin(nowMs * 0.0018 * speedMult + seed) * 0.04;

  // Attack Kinematics Calculations
  let attackSquashX = 1;
  let attackSquashY = 1;
  let attackLungeX = 0;
  let attackLungeY = 0;
  let attackStretch = 0;
  let corePulse = 0;
  let spinAngle = 0;
  let radialScale = 1;
  let vortexIntensity = 0;
  let eyeSquashY = 1;
  let tendrilCurviness = 0;
  let tendrilStraighten = 0;
  let beamFiringProgress = 0;
  let skewerThrustDist = 0;
  let activeSkewerIndex = -1;

  if (isSpin) {
    // -------------------------------------------------------------
    // STYLE 1: TENTACLE SPIN ATTACK (360 Whirlwind Vortex)
    // -------------------------------------------------------------
    if (attackProgress < 0.22) {
      const p = attackProgress / 0.22;
      const ease = Math.sin(p * Math.PI * 0.5);
      attackSquashX = 1 + ease * 0.12;
      attackSquashY = 1 - ease * 0.16;
      radialScale = 1 - ease * 0.20;
      spinAngle = -ease * 0.5;
      corePulse = ease * 0.6;
      eyeSquashY = 1 - ease * 0.45;
    } else if (attackProgress < 0.80) {
      const p = (attackProgress - 0.22) / 0.58;
      const peak = Math.sin(p * Math.PI);
      vortexIntensity = peak;
      const spinRevolutions = 3.2;
      spinAngle = -0.5 + p * (spinRevolutions * Math.PI * 2 + 0.5);
      radialScale = 1.0 + peak * 0.45;
      attackStretch = peak * 0.65;
      corePulse = 0.5 + peak * 0.5;
      attackSquashX = 1 + peak * 0.08;
      attackSquashY = 1 - peak * 0.08;
      eyeSquashY = 1 - peak * 0.25;
    } else {
      const p = (attackProgress - 0.80) / 0.20;
      const easeOut = Math.sin(p * Math.PI * 0.5);
      spinAngle = (1 - easeOut) * 0.7;
      radialScale = 1.0 + (1 - p) * 0.15;
      corePulse = (1 - p) * 0.3;
      attackSquashX = 1 + (1 - p) * 0.05;
      attackSquashY = 1 - (1 - p) * 0.05;
      eyeSquashY = 1 - (1 - p) * 0.2;
    }
  } else if (isBeam) {
    // -------------------------------------------------------------
    // STYLE 2: ABYSSAL RIFT BEAM (Dimensional Singularity Laser)
    // -------------------------------------------------------------
    if (attackProgress < 0.32) {
      // Phase 1: Draw backward, gather dark matter into the eye
      const p = attackProgress / 0.32;
      const ease = Math.sin(p * Math.PI * 0.5);
      attackLungeX = -Math.cos(facingAngle) * (14 * ease);
      attackLungeY = -Math.sin(facingAngle) * (14 * ease);
      attackSquashX = 1 - ease * 0.14;
      attackSquashY = 1 + ease * 0.18;
      corePulse = ease * 0.9;
      eyeSquashY = 1 + ease * 0.35;
      eyeCore = "#ffffff";
    } else if (attackProgress < 0.82) {
      // Phase 2: Searing laser eruption with sustained recoil vibration
      const p = (attackProgress - 0.32) / 0.50;
      beamFiringProgress = p;
      const peak = Math.sin(p * Math.PI);
      const tremor = Math.sin(nowMs * 0.08) * (isBoss ? 2.5 : 1.5);
      attackLungeX = Math.cos(facingAngle) * 4 + Math.cos(facingAngle + Math.PI * 0.5) * tremor;
      attackLungeY = Math.sin(facingAngle) * 4 + Math.sin(facingAngle + Math.PI * 0.5) * tremor;
      attackSquashX = 1 + peak * 0.22;
      attackSquashY = 1 - peak * 0.12;
      corePulse = 1.0;
      eyeCore = "#ffffff";
      eyeIris = "#ffffff";
    } else {
      // Phase 3: Dissipation and recovery
      const p = (attackProgress - 0.82) / 0.18;
      attackLungeX = Math.cos(facingAngle) * (4 * (1 - p));
      attackLungeY = Math.sin(facingAngle) * (4 * (1 - p));
      corePulse = (1 - p) * 0.4;
    }
  } else if (isSingularity) {
    // -------------------------------------------------------------
    // STYLE 3: EVENT HORIZON SINGULARITY (Cage Collapse & Cataclysmic Pulse)
    // -------------------------------------------------------------
    if (attackProgress < 0.55) {
      // Phase 1: Tendrils wrap tightly inward in a spherical cage
      const p = attackProgress / 0.55;
      const ease = Math.sin(p * Math.PI * 0.5);
      floatWave -= ease * (isBoss ? 16 : 10);
      radialScale = 1.0 - ease * 0.48;
      tendrilCurviness = ease * 0.38;
      corePulse = ease * 1.2;
      attackSquashX = 1 - ease * 0.18;
      attackSquashY = 1 - ease * 0.18;
      rotWobble += Math.sin(nowMs * 0.015) * (ease * 0.08);
      eyeSquashY = 1 - ease * 0.40;
    } else if (attackProgress < 0.68) {
      // Phase 2: Critical Mass Implosion
      radialScale = 0.50;
      corePulse = 1.5;
      eyeCore = "#ffffff";
      eyeIris = "#ffffff";
    } else {
      // Phase 3: Explosive Starburst Detonation
      const p = (attackProgress - 0.68) / 0.32;
      const burstPeak = Math.sin(p * Math.PI);
      radialScale = 1.0 + burstPeak * 0.65;
      attackStretch = burstPeak * 0.75;
      corePulse = (1 - p) * 0.8;
      attackSquashX = 1 + burstPeak * 0.25;
      attackSquashY = 1 + burstPeak * 0.25;
    }
  } else if (isSlam) {
    // -------------------------------------------------------------
    // STYLE 4: ABYSSAL SLAM / TENDRIL CLEAVE (Overhead Scythe Thrash)
    // -------------------------------------------------------------
    if (attackProgress < 0.35) {
      // Phase 1: Lean back, lift tendrils overhead
      const p = attackProgress / 0.35;
      const ease = Math.sin(p * Math.PI * 0.5);
      attackLungeX = -Math.cos(facingAngle) * (18 * ease);
      attackLungeY = -Math.sin(facingAngle) * (18 * ease);
      attackSquashX = 1 - ease * 0.16;
      attackSquashY = 1 + ease * 0.24;
      corePulse = ease * 0.6;
      tendrilCurviness = -ease * 0.35;
    } else if (attackProgress < 0.65) {
      // Phase 2: Violently slam downward into the ground
      const p = (attackProgress - 0.35) / 0.30;
      const surge = Math.sin(p * Math.PI * 0.5);
      attackLungeX = Math.cos(facingAngle) * (20 * surge);
      attackLungeY = Math.sin(facingAngle) * (20 * surge);
      attackSquashX = 1 + (1 - p) * 0.28;
      attackSquashY = 1 - (1 - p) * 0.22;
      attackStretch = (1 - p) * 0.85;
      corePulse = 1.0 - p * 0.5;
      tendrilCurviness = (1 - p) * 0.40;
    } else {
      // Phase 3: Elastic bounce rebound
      const p = (attackProgress - 0.65) / 0.35;
      const damp = (1 - p) * Math.sin(p * Math.PI * 2);
      attackSquashX = 1 + damp * 0.08;
      attackSquashY = 1 - damp * 0.08;
      corePulse = (1 - p) * 0.2;
    }
  } else if (isNova) {
    // -------------------------------------------------------------
    // STYLE 5: VOID NOVA (Astral Supernova Radial Mandala)
    // -------------------------------------------------------------
    if (attackProgress < 0.36) {
      // Phase 1: Symmetrical Mandala Charge
      const p = attackProgress / 0.36;
      const ease = Math.sin(p * Math.PI * 0.5);
      radialScale = 1.0 + ease * 0.25;
      corePulse = ease * 0.8;
      eyeSquashY = 1 - ease * 0.30;
    } else if (attackProgress < 0.72) {
      // Phase 2: Supernova Detonation
      const p = (attackProgress - 0.36) / 0.36;
      const peak = Math.sin(p * Math.PI);
      radialScale = 1.25 + peak * 0.45;
      attackStretch = peak * 0.70;
      corePulse = 1.0 + peak * 0.6;
      eyeCore = "#ffffff";
    } else {
      // Phase 3: Harmonic Recovery
      const p = (attackProgress - 0.72) / 0.28;
      corePulse = (1 - p) * 0.3;
      radialScale = 1.0 + (1 - p) * 0.15;
    }
  } else if (isSkewer) {
    // -------------------------------------------------------------
    // STYLE 6: VOID PIERCING SKEWER (Rapid Staccato Lance Barrage)
    // -------------------------------------------------------------
    tendrilStraighten = 0.85;
    if (attackProgress < 0.33) {
      // Thrust 1 (Left Tendril)
      activeSkewerIndex = 0;
      const p = attackProgress / 0.33;
      skewerThrustDist = Math.sin(p * Math.PI) * (isBoss ? 45 : 30);
      attackLungeX = Math.cos(facingAngle) * (skewerThrustDist * 0.25);
      attackLungeY = Math.sin(facingAngle) * (skewerThrustDist * 0.25);
    } else if (attackProgress < 0.66) {
      // Thrust 2 (Right Tendril)
      activeSkewerIndex = 1;
      const p = (attackProgress - 0.33) / 0.33;
      skewerThrustDist = Math.sin(p * Math.PI) * (isBoss ? 48 : 32);
      attackLungeX = Math.cos(facingAngle) * (skewerThrustDist * 0.25);
      attackLungeY = Math.sin(facingAngle) * (skewerThrustDist * 0.25);
    } else {
      // Thrust 3 (Tandem Dual Impale)
      activeSkewerIndex = 2;
      const p = (attackProgress - 0.66) / 0.34;
      skewerThrustDist = Math.sin(p * Math.PI) * (isBoss ? 55 : 38);
      attackLungeX = Math.cos(facingAngle) * (skewerThrustDist * 0.35);
      attackLungeY = Math.sin(facingAngle) * (skewerThrustDist * 0.35);
    }
  } else if (isAttacking) {
    // -------------------------------------------------------------
    // STYLE 7: STANDARD DIRECTIONAL LUNGE / STRIKE
    // -------------------------------------------------------------
    if (attackProgress < 0.30) {
      const p = attackProgress / 0.30;
      const ease = Math.sin(p * Math.PI * 0.5);
      attackSquashX = 1 + ease * 0.14;
      attackSquashY = 1 - ease * 0.16;
      attackLungeX = -Math.cos(facingAngle) * (5 * ease);
      attackLungeY = -Math.sin(facingAngle) * (5 * ease);
      corePulse = ease * 0.4;
    } else if (attackProgress < 0.65) {
      const p = (attackProgress - 0.30) / 0.35;
      const peak = Math.sin(p * Math.PI);
      attackSquashX = 1 - peak * 0.12;
      attackSquashY = 1 + peak * 0.20;
      attackLungeX = Math.cos(facingAngle) * (14 * peak);
      attackLungeY = Math.sin(facingAngle) * (14 * peak);
      attackStretch = peak;
      corePulse = 1.0 - p * 0.5;
    } else {
      const p = (attackProgress - 0.65) / 0.35;
      const damp = (1 - p) * Math.sin(p * Math.PI * 2);
      attackSquashX = 1 + damp * 0.06;
      attackSquashY = 1 - damp * 0.06;
      corePulse = (1 - p) * 0.2;
    }
  }

  // Hit Elasticity Distortion
  if (isFlashing) {
    const elastic = Math.sin(flashAmt * Math.PI) * 0.18;
    attackSquashY *= (1 - elastic);
    attackSquashX *= (1 + elastic);
  }

  // Draw Fair Ground Attack Area Warning Zone
  const showZone = ent.showAttackZone !== false && ent.showZone !== false;
  if (isAttacking && showZone) {
    drawEntityAttackArea(ctx, ent, x, y);
  }

  // Draw Ground Shockwaves / Detonation Bursts in World Space
  if (isSingularity && attackProgress >= 0.68) {
    const p = (attackProgress - 0.68) / 0.32;
    const ringRadius = (r * 1.5) + p * (isBoss ? 160 : 100);
    const ringAlpha = (1 - p) * 0.65;
    ctx.save();
    ctx.strokeStyle = `rgba(217, 70, 239, ${ringAlpha})`;
    ctx.lineWidth = 3.0 * (1 - p);
    ctx.beginPath();
    ctx.ellipse(x, y, ringRadius, ringRadius * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(56, 189, 248, ${ringAlpha * 0.85})`;
    ctx.lineWidth = 1.8 * (1 - p);
    ctx.beginPath();
    ctx.ellipse(x, y, ringRadius * 0.75, ringRadius * 0.46, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (isNova && attackProgress >= 0.36 && attackProgress < 0.72) {
    const p = (attackProgress - 0.36) / 0.36;
    const ringRadius = (r * 1.4) + p * (isBoss ? 170 : 110);
    const ringAlpha = (1 - p) * 0.75;
    ctx.save();
    ctx.strokeStyle = `rgba(232, 121, 249, ${ringAlpha})`;
    ctx.lineWidth = 3.5 * (1 - p);
    ctx.beginPath();
    ctx.ellipse(x, y, ringRadius, ringRadius * 0.64, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (isSlam && attackProgress >= 0.42 && attackProgress < 0.68) {
    const p = (attackProgress - 0.42) / 0.26;
    const fissureDist = (isBoss ? 60 : 42) + p * (isBoss ? 45 : 30);
    const fx = x + Math.cos(facingAngle) * fissureDist;
    const fy = y + Math.sin(facingAngle) * fissureDist;
    const fAlpha = (1 - p) * 0.75;
    ctx.save();
    ctx.strokeStyle = `rgba(217, 70, 239, ${fAlpha})`;
    ctx.lineWidth = 2.5 * (1 - p);
    ctx.beginPath();
    ctx.ellipse(fx, fy, (isBoss ? 45 : 30) * (0.5 + p * 0.5), (isBoss ? 28 : 18) * (0.5 + p * 0.5), facingAngle, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Draw Entity in Local Translated Space
  ctx.save();
  ctx.translate(x + attackLungeX, y + floatWave + attackLungeY);
  ctx.scale(baseScale * attackSquashX, baseScale * attackSquashY);
  ctx.rotate(rotWobble);

  if (isFlashing) {
    ctx.filter = `brightness(${1 + flashAmt * 1.5}) contrast(${1 + flashAmt * 0.5})`;
  }

  // -------------------------------------------------------------
  // 1. SOFT AMBIENT CORONA AURA (Pure Atmospheric Glow, No Ground Shadow)
  // -------------------------------------------------------------
  const auraR = (r * 1.6 + breathPulse + corePulse * 10) * (isSpin ? (1 + vortexIntensity * 0.25) : 1);
  const corona = safeCreateRadialGradient(ctx, 0, 0, r * 0.25, 0, 0, auraR);
  if (corona) {
    corona.addColorStop(0, auraGlow);
    corona.addColorStop(0.55, isDevourer ? "rgba(76, 5, 25, 0.18)" : isNullGazer ? "rgba(30, 27, 75, 0.18)" : "rgba(88, 28, 135, 0.18)");
    corona.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------
  // 2. WHIRLWIND MOTION SCYTHE TRAILS (Visible during high-speed spin)
  // -------------------------------------------------------------
  if (isSpin && vortexIntensity > 0.05) {
    ctx.save();
    const trailR = r * 1.85 * radialScale;
    const trailAlpha = vortexIntensity * 0.45;

    ctx.strokeStyle = glowColor;
    ctx.lineWidth = Math.max(2, baseScale * 2.2);
    ctx.globalAlpha = trailAlpha;
    ctx.beginPath();
    ctx.ellipse(0, 0, trailR, trailR * 0.78, spinAngle, 0, Math.PI * 1.5);
    ctx.stroke();

    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = Math.max(1.2, baseScale * 1.5);
    ctx.globalAlpha = trailAlpha * 0.75;
    ctx.beginPath();
    ctx.ellipse(0, 0, trailR * 0.88, trailR * 0.68, spinAngle + Math.PI, 0, Math.PI * 1.3);
    ctx.stroke();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 3. BACKGROUND TENDRILS
  // -------------------------------------------------------------
  const totalTendrils = isBoss ? 8 : isSpawn ? 3 : 4;

  if (isSpin) {
    for (let k = 0; k < totalTendrils; k++) {
      const tAngle = spinAngle + (k / totalTendrils) * Math.PI * 2;
      const tBaseX = Math.cos(tAngle) * (r * 0.52);
      const tBaseY = Math.sin(tAngle) * (r * 0.42);

      const baseTendrilLen = (r * 1.65 + Math.sin(k * 2.8 + seed) * 3) * radialScale;
      const trailCurl = vortexIntensity * 0.35;
      const tWaveAmp = 0.10 + vortexIntensity * 0.12;
      const tWavePhase = nowMs * 0.008 * speedMult + k * 1.5 + spinAngle * 1.2;

      drawSleekTendril(ctx, {
        baseX: tBaseX,
        baseY: tBaseY,
        length: baseTendrilLen,
        baseWidth: (isBoss ? 7.2 : 5.2) * (1 + vortexIntensity * 0.12),
        tipWidth: 1.5,
        angle: tAngle - trailCurl,
        wavePhase: tWavePhase,
        waveAmp: tWaveAmp,
        primaryColor: primaryColor,
        shadowColor: shadowColor,
        glowColor: glowColor,
        segments: 12,
        attackStretch: attackStretch,
        runeNodes: isBoss
      });
    }
  } else {
    // Normal / Special Attack Back Tendrils
    const backTentacleCount = isBoss ? 4 : isSpawn ? 1 : 2;
    for (let t = 0; t < backTentacleCount; t++) {
      let angleSpread = Math.PI * 1.1 + (t / Math.max(1, backTentacleCount - 1 || 1)) * (Math.PI * 0.8);
      let tLen = r * 1.50 + Math.sin(t * 2.5 + seed) * 3;
      let extraStretch = attackStretch * 0.5;

      if (isSingularity) {
        angleSpread += tendrilCurviness * (t % 2 === 0 ? 1 : -1);
      } else if (isBeam) {
        // Bias backward in bracing stance against laser recoil
        angleSpread = facingAngle + Math.PI + (t - backTentacleCount * 0.5 + 0.5) * 0.45;
      } else if (isSlam && attackProgress < 0.35) {
        // Raised overhead
        angleSpread = facingAngle + Math.PI + (t - backTentacleCount * 0.5 + 0.5) * 0.6;
      }

      const tBaseX = Math.cos(angleSpread) * (r * 0.52);
      const tBaseY = Math.sin(angleSpread) * (r * 0.38) - 2;
      const tWaveAmp = 0.08 + (isMoving ? 0.03 : 0);
      const tWavePhase = nowMs * 0.0045 * speedMult + t * 1.5 + seed;

      drawSleekTendril(ctx, {
        baseX: tBaseX,
        baseY: tBaseY,
        length: tLen * radialScale,
        baseWidth: isBoss ? 6.8 : 4.8,
        tipWidth: 1.4,
        angle: angleSpread,
        wavePhase: tWavePhase,
        waveAmp: tWaveAmp,
        primaryColor: shadowColor,
        shadowColor: "#020005",
        glowColor: rimColor,
        segments: 10,
        attackStretch: extraStretch,
        curviness: tendrilCurviness,
        runeNodes: isBoss
      });
    }
  }

  // -------------------------------------------------------------
  // 4. CENTRAL AMORPHOUS VOID CORE (Smooth Lineless Cosmic Body)
  // -------------------------------------------------------------
  ctx.save();
  const bodyR = r + breathPulse;

  ctx.save();
  if (isSpin) {
    ctx.rotate(spinAngle * 0.3);
  }

  ctx.beginPath();
  const pts = 12;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wave1 = Math.sin(a * 3 + nowMs * 0.0035 * speedMult + seed) * (r * 0.05);
    const wave2 = Math.cos(a * 2 - nowMs * 0.0025 * speedMult) * (r * 0.04);
    const rad = bodyR + wave1 + wave2;

    const yScale = 0.90 + Math.sin(a) * 0.08;
    const bx = Math.cos(a) * rad;
    const by = Math.sin(a) * (rad * yScale);

    if (i === 0) ctx.moveTo(bx, by);
    else ctx.lineTo(bx, by);
  }
  ctx.closePath();

  // Deep abyssal volumetric radial shading
  const bodyGrad = safeCreateRadialGradient(ctx, 0, -bodyR * 0.2, bodyR * 0.1, 0, 0, bodyR * 1.1);
  if (bodyGrad) {
    bodyGrad.addColorStop(0, midColor);
    bodyGrad.addColorStop(0.5, primaryColor);
    bodyGrad.addColorStop(0.9, shadowColor);
    bodyGrad.addColorStop(1, "#020005");
    ctx.fillStyle = bodyGrad;
    ctx.fill();
  }

  // Soft ethereal crown sheen along the top crest
  const crownGrad = safeCreateRadialGradient(ctx, 0, -bodyR * 0.55, bodyR * 0.1, 0, -bodyR * 0.35, bodyR * 0.85);
  if (crownGrad) {
    crownGrad.addColorStop(0, highlightColor);
    crownGrad.addColorStop(0.45, rimColor);
    crownGrad.addColorStop(0.9, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = crownGrad;
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  // -------------------------------------------------------------
  // 4B. VOID TERROR LEVIATHAN CROWN SPIRES (Cosmic Mantle Horns)
  // -------------------------------------------------------------
  if (isBoss) {
    ctx.save();
    const spireCount = 4;
    for (let s = 0; s < spireCount; s++) {
      const sSign = (s < 2) ? -1 : 1;
      const sInner = (s === 1 || s === 2);
      const sBaseX = sSign * (bodyR * (sInner ? 0.32 : 0.62));
      const sBaseY = -bodyR * (sInner ? 0.68 : 0.42);
      const sLen = bodyR * (sInner ? 0.65 : 0.50);
      const sAngle = -Math.PI * 0.5 + sSign * (sInner ? 0.22 : 0.55) + Math.sin(nowMs * 0.003 + s) * 0.04;
      const sTipX = sBaseX + Math.cos(sAngle) * sLen;
      const sTipY = sBaseY + Math.sin(sAngle) * sLen;

      // Obsidian spire contour
      ctx.beginPath();
      ctx.moveTo(sBaseX - sSign * 3.5, sBaseY);
      ctx.quadraticCurveTo(sBaseX, sBaseY - sLen * 0.5, sTipX, sTipY);
      ctx.quadraticCurveTo(sBaseX + sSign * 3.5, sBaseY - sLen * 0.4, sBaseX + sSign * 3.5, sBaseY);
      ctx.closePath();

      const sGrad = ctx.createLinearGradient(sBaseX, sBaseY, sTipX, sTipY);
      sGrad.addColorStop(0, primaryColor);
      sGrad.addColorStop(0.6, midColor);
      sGrad.addColorStop(1, highlightColor);
      ctx.fillStyle = sGrad;
      ctx.fill();

      // Glowing spire tip rune
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(sTipX, sTipY, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 5. EVENT HORIZON ORBITING SATELLITE MOTES (Leviathan Cosmic Accretion)
  // -------------------------------------------------------------
  if (isBoss) {
    ctx.save();
    const orbiterCount = 5;
    for (let o = 0; o < orbiterCount; o++) {
      const orbSpeed = 0.0018 + (o % 2) * 0.0008;
      const orbAngle = nowMs * orbSpeed + (o / orbiterCount) * Math.PI * 2 + seed;
      const orbRadiusX = bodyR * 1.45 + Math.sin(o * 3.2) * 5;
      const orbRadiusY = bodyR * 0.85;
      const ox = Math.cos(orbAngle) * orbRadiusX;
      const oy = Math.sin(orbAngle) * orbRadiusY - 4;

      const orbSize = 2.0 + Math.sin(orbAngle) * 0.8;
      const orbAlpha = 0.45 + Math.sin(orbAngle) * 0.45;

      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(1.2, orbSize), 0, Math.PI * 2);
      ctx.fillStyle = (o % 2 === 0) ? glowColor : highlightColor;
      ctx.globalAlpha = orbAlpha;
      ctx.fill();

      // Tiny trailing wisp
      const trailAngle = orbAngle - 0.22;
      const tx = Math.cos(trailAngle) * orbRadiusX;
      const ty = Math.sin(trailAngle) * orbRadiusY - 4;
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(0.8, orbSize * 0.5), 0, Math.PI * 2);
      ctx.globalAlpha = orbAlpha * 0.5;
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // 6. SUBTLE VOID VAPOR WISPS (Living Ethereal Atmosphere)
  // -------------------------------------------------------------
  ctx.save();
  for (let w = 0; w < 2; w++) {
    const wSign = w === 0 ? -1 : 1;
    const wPhase = nowMs * 0.003 * speedMult + w * 2.2 + seed;
    const wBaseX = wSign * (r * 0.35);
    const wBaseY = -r * 0.5;
    const wTipX = wBaseX + Math.sin(wPhase) * 6;
    const wTipY = wBaseY - 14 - Math.cos(wPhase * 0.8) * 4;

    const wispGrad = ctx.createLinearGradient(wBaseX, wBaseY, wTipX, wTipY);
    wispGrad.addColorStop(0, highlightColor);
    wispGrad.addColorStop(0.5, rimColor);
    wispGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.beginPath();
    ctx.moveTo(wBaseX - 3, wBaseY);
    ctx.quadraticCurveTo(wBaseX + wSign * 4, (wBaseY + wTipY) * 0.5, wTipX, wTipY);
    ctx.quadraticCurveTo(wBaseX - wSign * 2, (wBaseY + wTipY) * 0.5, wBaseX + 3, wBaseY);
    ctx.closePath();
    ctx.fillStyle = wispGrad;
    ctx.fill();
  }
  ctx.restore();

  // -------------------------------------------------------------
  // 7. HYPNOTIC CENTRAL SINGULARITY / VOID EYE
  // -------------------------------------------------------------
  ctx.save();
  const eyeRadius = (isBoss ? 14 : isNullGazer ? 15 : isSpawn ? 7 : 10) + corePulse * 3;
  const eyeY = -r * 0.12;

  const trackAmount = eyeRadius * 0.28;
  const trackX = Math.cos(facingAngle) * trackAmount;
  const trackY = Math.sin(facingAngle) * trackAmount;

  ctx.translate(0, eyeY);
  ctx.scale(1, eyeSquashY);

  // Soft luminous eye socket halo
  const socketGlow = safeCreateRadialGradient(ctx, 0, 0, eyeRadius * 0.5, 0, 0, eyeRadius * 1.6);
  if (socketGlow) {
    socketGlow.addColorStop(0, glowColor);
    socketGlow.addColorStop(0.4, rimColor);
    socketGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = socketGlow;
    ctx.beginPath();
    ctx.arc(0, 0, eyeRadius * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Deep Sclera
  ctx.fillStyle = shadowColor;
  ctx.beginPath();
  ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  // Radiant Celestial Iris
  const irisR = eyeRadius * 0.72;
  const irisGrad = safeCreateRadialGradient(ctx, trackX, trackY, irisR * 0.15, trackX, trackY, irisR);
  if (irisGrad) {
    irisGrad.addColorStop(0, eyeCore);
    irisGrad.addColorStop(0.45, eyeIris);
    irisGrad.addColorStop(0.85, primaryColor);
    irisGrad.addColorStop(1, shadowColor);
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(trackX, trackY, irisR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Menacing Slit Pupil with Attack Dilation
  const pupilW = isAttacking ? Math.max(1.5, irisR * 0.20) : (irisR * 0.32 + Math.sin(nowMs * 0.003) * 0.05);
  const pupilH = irisR * 0.88;
  ctx.fillStyle = eyePupil;
  ctx.beginPath();
  ctx.ellipse(trackX, trackY, pupilW, pupilH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Piercing Specular Glints
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(trackX - irisR * 0.32, trackY - irisR * 0.32, Math.max(1.2, irisR * 0.22), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.arc(trackX + irisR * 0.26, trackY + irisR * 0.22, Math.max(0.8, irisR * 0.13), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // -------------------------------------------------------------
  // 8. ABYSSAL RIFT BEAM VISUAL EFFECT (When beam attack is firing)
  // -------------------------------------------------------------
  if (isBeam && beamFiringProgress > 0) {
    const beamLen = (isBoss ? 260 : 180) / baseScale;
    drawVoidBeamEffect(ctx, trackX, eyeY + trackY, facingAngle, beamLen, beamFiringProgress, isBoss, glowColor, highlightColor);
  }

  // -------------------------------------------------------------
  // 9. FOREGROUND TENDRILS (When not in 360-degree spin mode)
  // -------------------------------------------------------------
  if (!isSpin) {
    const frontTentacleCount = isBoss ? 4 : isSpawn ? 2 : 3;
    for (let f = 0; f < frontTentacleCount; f++) {
      let angleSpread = (f / Math.max(1, frontTentacleCount - 1 || 1)) * (Math.PI * 0.75) + (Math.PI * 0.125);
      let tLen = r * 1.65 + Math.sin(f * 2.8 + seed) * 4;
      let extraStretch = attackStretch;
      let tStraight = tendrilStraighten;

      if (isSingularity) {
        angleSpread -= tendrilCurviness * (f % 2 === 0 ? 1 : -1);
      } else if (isBeam) {
        // Bias backward in bracing stance against laser recoil
        angleSpread = facingAngle + Math.PI + (f - frontTentacleCount * 0.5 + 0.5) * 0.35;
      } else if (isSlam) {
        if (attackProgress < 0.35) {
          // Coiled overhead
          angleSpread = facingAngle + (f - frontTentacleCount * 0.5 + 0.5) * 0.25;
          extraStretch = attackStretch;
        } else {
          // Smashed forward into ground
          angleSpread = facingAngle + (f - frontTentacleCount * 0.5 + 0.5) * 0.35;
          tLen += 14;
        }
      } else if (isSkewer) {
        // Active skewer tendrils thrust forward
        const isThrusting = (activeSkewerIndex === 0 && f === 0) ||
                            (activeSkewerIndex === 1 && f === frontTentacleCount - 1) ||
                            (activeSkewerIndex === 2 && (f === 1 || f === 2));
        if (isThrusting) {
          angleSpread = facingAngle + (f - frontTentacleCount * 0.5 + 0.5) * 0.12;
          tLen += skewerThrustDist;
          extraStretch = 0.5;
        }
      }

      const tBaseX = Math.cos(angleSpread) * (r * 0.60);
      const tBaseY = Math.sin(angleSpread) * (r * 0.45) + 3;
      const tWaveAmp = 0.10 + (isMoving ? 0.04 : 0);
      const tWavePhase = nowMs * 0.0055 * speedMult + f * 1.6 + seed;

      drawSleekTendril(ctx, {
        baseX: tBaseX,
        baseY: tBaseY,
        length: tLen * radialScale,
        baseWidth: isBoss ? 7.8 : 5.5,
        tipWidth: 1.6,
        angle: angleSpread,
        wavePhase: tWavePhase,
        waveAmp: tWaveAmp,
        primaryColor: primaryColor,
        shadowColor: shadowColor,
        glowColor: glowColor,
        segments: 12,
        attackStretch: extraStretch,
        curviness: tendrilCurviness,
        straighten: tStraight,
        runeNodes: isBoss
      });
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 5. Master Draw Dispatcher
// ---------------------------------------------------------------------------
/**
 * Master Monster Renderer
 * Routes any entity to its specialized procedural renderer with full walking and attack kinematics.
 *
 * @param {CanvasRenderingContext2D} ctx - HTML5 Canvas 2D Context
 * @param {number} x - Target screen or world X coordinate
 * @param {number} y - Target screen or world Y coordinate
 * @param {Object} ent - Entity data object (position, facingAngle, walkCycle, attack state)
 * @param {boolean} [isShadowPass=false] - Optional pass flag
 */
export function drawMonster(ctx, x, y, ent, isShadowPass = false) {
  if (!ent || isShadowPass) return;
  const type = (ent.type || "").toLowerCase();

  // Draw ground attack warning zone under monster during attack windup or casting
  const isVoidTerror = ((type.includes("void") && !type.includes("dragon") && !type.includes("drake") && !type.includes("wyrm")) || type.includes("terror") || type.includes("devourer") || type.includes("gazer"));
  const shouldDrawArea = (ent.showAttackZone !== false && ent.showAttackArea !== false && ent.showZone !== false) &&
    (ent.isAttacking || ent.currentCast || ent.showZonePreview || ent.loopZonePreview);

  if (!isVoidTerror && shouldDrawArea && typeof drawEntityAttackArea === "function") {
    drawEntityAttackArea(ctx, ent, x, y);
  }

  if (type === "salamander" || type.startsWith("salamander_") || type.includes("salamander") || type.includes("axolotl") || type.includes("proteus")) {
    return drawSalamanderEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "dragon" || type.startsWith("dragon_") || type.includes("dragon") || type.includes("drake") || type.includes("wyrm")) {
    return drawDragonEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "frost_elemental" || type === "ice_elemental" || type.startsWith("frost_elemental") || type.startsWith("ice_elemental") || type === "frost_wisp" || type === "frost_tempest" || type === "cryo_warden" || type === "glacial_colossus" || type === "boss_frost_monarch" || (type.includes("elemental") && (type.includes("frost") || type.includes("ice") || type.includes("cryo") || type.includes("glacial") || type.includes("permafrost") || type.includes("blizzard"))) || (type.includes("frost") && (type.includes("wisp") || type.includes("tempest") || type.includes("monarch") || type.includes("archon")))) {
    return drawFrostElementalEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "rat" || type.startsWith("rat_") || type.includes("rat") || type.includes("vermin")) {
    return drawRatEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "skeleton" || type.startsWith("skeleton_") || type.includes("skeleton") || type.includes("samba") || type.includes("passista") || type.includes("malandro") || type === "elite_knight" || type === "boss_samba_king") {
    return drawSkeletonEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "spider" || type.startsWith("spider_") || type.includes("spider") || type.includes("weaver") || type.includes("tarantula") || type.includes("broodmother") || type.includes("stalker")) {
    return drawSpiderEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "slime" || type.startsWith("slime_") || type.includes("slime")) {
    return drawSlimeEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "wolf" || type.startsWith("wolf_") || type.includes("wolf") || type === "dire_wolf") {
    return drawWolfEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "frost_troll" || type.includes("troll") || type.includes("jotunn") || type.includes("yeti") || (type.includes("giant") && !type.includes("spider") && !type.includes("rat")) || (type.includes("glass") && !type.includes("slime") && !type.includes("wolf") && !type.includes("spider") && !type.includes("rat"))) {
    return drawFrostTrollEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "goblin" || type.startsWith("goblin_") || type.includes("goblin")) {
    return drawGoblinEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "kobold" || type.startsWith("kobold_") || type.includes("kobold")) {
    return drawKoboldEntity(ctx, x, y, ent, isShadowPass);
  }

  if (type === "boss_void" || type === "boss_void_terror" || type === "void_terror" || type.includes("terror") || type.includes("devourer") || type.includes("gazer") || type.includes("singularity") || (type.includes("void") && !type.includes("dragon") && !type.includes("drake") && !type.includes("wyrm") && !type.includes("wolf") && !type.includes("stalker") && !type.includes("rat"))) {
    return drawVoidTerrorEntity(ctx, x, y, ent, isShadowPass);
  }

  // Default fallback to first available renderer
  return drawSalamanderEntity(ctx, x, y, ent, isShadowPass);
}


// ---------------------------------------------------------------------------
// Monster Locomotion, Kinematics & Walking Animation Engine
// ---------------------------------------------------------------------------

/**
 * Creates and initializes a monster entity with all walking cycles and properties.
 *
 * @param {string} [type="fire_salamander"] - Monster variant or family ID
 * @param {Object} [overrides={}] - Optional property overrides (x, y, speed, facingAngle, etc.)
 * @returns {Object} Ready-to-render entity state object
 */
export function createMonster(type = "fire_salamander", overrides = {}) {
  const seed = (overrides._seed !== undefined) ? overrides._seed : computeFastSeed(type + "_" + Math.floor(Math.random() * 10000));
  return {
    id: overrides.id || "monster_" + Math.floor(Math.random() * 100000),
    type: type,
    x: overrides.x || 0,
    y: overrides.y || 0,
    vx: overrides.vx || 0,
    vy: overrides.vy || 0,
    hp: overrides.hp !== undefined ? overrides.hp : 100,
    maxHp: overrides.maxHp || 100,
    facingAngle: overrides.facingAngle || 0,
    moveAngle: overrides.moveAngle || 0,
    speed: overrides.speed !== undefined ? overrides.speed : 130,
    moving: overrides.moving !== undefined ? overrides.moving : true,
    isMoving: overrides.isMoving !== undefined ? overrides.isMoving : true,
    isAttacking: overrides.isAttacking || false,
    attackDuration: overrides.attackDuration || 500,
    attackStart: overrides.attackStart || 0,
    lastHitTime: overrides.lastHitTime || 0,
    showAttackZone: overrides.showAttackZone !== false,
    _seed: seed,
    _walkCycle: 0,
    _walkProgress: 0,
    _animWalkPhase: 0,
    _lastUpdateMs: performance.now(),
    ...overrides
  };
}

/**
 * Updates a monster's walking cycle, gait, kinematics, velocity, and attack timers.
 * Call this every frame inside your game loop before drawing.
 *
 * @param {Object} ent - Monster entity returned by createMonster()
 * @param {number} [dt=0.016] - Delta time in seconds since previous frame
 * @param {Object} [options={}] - Kinematic options: { autoFace: true, walkSpeed: 130 }
 * @returns {Object} The updated monster entity
 */
export function updateMonster(ent, dt = 0.016, options = {}) {
  if (!ent) return ent;
  const now = performance.now();
  const actualDt = Math.min(0.1, dt > 0 ? dt : 0.016);
  ent._lastUpdateMs = now;

  // Initialize essential kinematic cycles
  if (ent._seed === undefined) ent._seed = computeFastSeed(ent.id || ent.type || 1);
  if (ent._walkCycle === undefined) ent._walkCycle = 0;
  if (ent._walkProgress === undefined) ent._walkProgress = 0;
  if (ent._animWalkPhase === undefined) ent._animWalkPhase = 0;

  const autoFace = options.autoFace !== false;
  const hasExplicitVel = (ent.vx !== undefined && ent.vy !== undefined && (ent.vx !== 0 || ent.vy !== 0));
  const isMoving = !!(ent.isMoving || ent.moving || hasExplicitVel);

  // Velocity integration
  let curSpeed = 0;
  if (hasExplicitVel) {
    ent.x = (ent.x || 0) + ent.vx * actualDt;
    ent.y = (ent.y || 0) + ent.vy * actualDt;
    curSpeed = Math.sqrt(ent.vx * ent.vx + ent.vy * ent.vy);
    ent.speed = curSpeed;

    if (curSpeed > 2 && autoFace) {
      const targetAngle = Math.atan2(ent.vy, ent.vx);
      let diff = targetAngle - (ent.facingAngle || 0);
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ent.facingAngle = (ent.facingAngle || 0) + diff * Math.min(1, actualDt * 14);
      ent.facingAngle = ((ent.facingAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    }
  } else if (isMoving) {
    curSpeed = (typeof ent.speed === "number") ? ent.speed : (options.walkSpeed || 130);
    const moveDir = (ent.moveAngle !== undefined) ? ent.moveAngle : (ent.facingAngle || 0);
    ent.x = (ent.x || 0) + Math.cos(moveDir) * curSpeed * actualDt;
    ent.y = (ent.y || 0) + Math.sin(moveDir) * curSpeed * actualDt;
  }

  // Advance multi-tier walk gait cycles
  if (isMoving && curSpeed > 0.5) {
    const normalizedSpeed = Math.max(0.5, curSpeed / 130);
    ent._walkCycle += actualDt * 7.5 * normalizedSpeed;
    ent._walkProgress += actualDt * 5.4 * normalizedSpeed;
    ent._animWalkPhase += actualDt * 8.2 * normalizedSpeed;
  }

  // Attack timer advancement
  if (ent.isAttacking) {
    const start = ent.attackStart || 0;
    const dur = ent.attackDuration || 500;
    if (now - start > dur) {
      ent.isAttacking = false;
      ent.currentCast = null;
    }
  }

  return ent;
}

/**
 * Triggers an attack state on the monster with appropriate kinematic windup duration.
 *
 * @param {Object} ent - Monster entity
 * @param {string} [attackType="strike"] - Attack sub-type (e.g. breath, slash, slam, thrust)
 * @param {number} [duration=500] - Duration in milliseconds
 */
export function triggerMonsterAttack(ent, attackType = "strike", duration = 500) {
  if (!ent) return;
  ent.isAttacking = true;
  ent.attackType = attackType;
  ent.attackStart = performance.now();
  ent.attackDuration = duration;
}



// ---------------------------------------------------------------------------
// Browser Global Registration (Supports vanilla <script> tags)
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  window.MonsterRenderer = {
    drawMonster,
    updateMonster,
    createMonster,
    triggerMonsterAttack,
    spawnParticle,
    updateAndDrawParticles,
    drawEntityHP,
    getMobUiOffsets
  };
}


// ---------------------------------------------------------------------------
// Standalone HTML5 Canvas Quickstart Example
// ---------------------------------------------------------------------------
/*
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Monster Canvas Preview</title>
  <style>
    body { background: #0b1120; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
    canvas { background: #131d31; border: 1px solid #334155; border-radius: 8px; }
  </style>
</head>
<body>
  <canvas id="gameCanvas" width="800" height="600"></canvas>
  <script type="module">
    import { createMonster, updateMonster, drawMonster } from './monster-bundle.js';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Create monster entity with initial state
    const monster = createMonster('fire_salamander', {
      x: 400,
      y: 300,
      speed: 120,
      moving: true,
      facingAngle: 0
    });

    let lastTime = performance.now();

    function gameLoop(now) {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Update monster kinematics & walk cycles
      updateMonster(monster, dt);

      // Render
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawMonster(ctx, monster.x, monster.y, monster);

      requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
  </script>
</body>
</html>
*/
