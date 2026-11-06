/**
 * ===========================================================================
 * Procedural Monster Renderer & Locomotion Kinematics Bundle
 * Exported: 2026-11-04T03:37:04.278Z
 * Monsters Included: Dragon
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

  if (type === "dragon" || type.startsWith("dragon_") || type.includes("dragon") || type.includes("drake") || type.includes("wyrm")) {
    return drawDragonEntity(ctx, x, y, ent, isShadowPass);
  }

  // Default fallback to first available renderer
  return drawDragonEntity(ctx, x, y, ent, isShadowPass);
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
