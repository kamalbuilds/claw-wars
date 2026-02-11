"use client";

import { useCallback } from "react";
import type { Graphics } from "pixi.js";
import { darkenColor } from "./pixiSetup";

interface CrabCharacterProps {
  x: number;
  y: number;
  color: number;
  isAlive: boolean;
  isSpeaking: boolean;
  scale: number;
  bobOffset: number;
  clawAngle: number;
  glowIntensity: number;
  facingAngle: number;
}

export default function CrabCharacter({
  x,
  y,
  color,
  isAlive,
  isSpeaking,
  scale,
  bobOffset,
  clawAngle,
  glowIntensity,
  facingAngle,
}: CrabCharacterProps) {
  const darker = darkenColor(color, 0.7);
  const alpha = isAlive ? 1.0 : 0.3;

  const draw = useCallback(
    (g: Graphics) => {
      g.clear();

      // Speaking glow ring
      if (isSpeaking && glowIntensity > 0) {
        g.circle(0, 0, 30);
        g.fill({ color: 0x22c55e, alpha: glowIntensity * 0.25 });
        g.circle(0, 0, 24);
        g.fill({ color: 0x22c55e, alpha: glowIntensity * 0.15 });
      }

      // --- LEGS (3 pairs, drawn behind body) ---
      // Left legs
      g.moveTo(-12, 6);
      g.lineTo(-22, 16);
      g.stroke({ color: darker, width: 2, alpha });
      g.moveTo(-10, 9);
      g.lineTo(-20, 20);
      g.stroke({ color: darker, width: 2, alpha });
      g.moveTo(-7, 11);
      g.lineTo(-16, 22);
      g.stroke({ color: darker, width: 2, alpha });
      // Right legs
      g.moveTo(12, 6);
      g.lineTo(22, 16);
      g.stroke({ color: darker, width: 2, alpha });
      g.moveTo(10, 9);
      g.lineTo(20, 20);
      g.stroke({ color: darker, width: 2, alpha });
      g.moveTo(7, 11);
      g.lineTo(16, 22);
      g.stroke({ color: darker, width: 2, alpha });

      // --- LEFT CLAW ---
      const lcRotY = Math.sin(clawAngle) * 4;
      // Upper pincer
      g.moveTo(-20, -4 - lcRotY);
      g.lineTo(-36, -12 - lcRotY);
      g.lineTo(-28, 0);
      g.closePath();
      g.fill({ color, alpha });
      // Lower pincer
      g.moveTo(-20, 4 + lcRotY);
      g.lineTo(-36, 12 + lcRotY);
      g.lineTo(-28, 0);
      g.closePath();
      g.fill({ color: darker, alpha });
      // Joint
      g.circle(-20, 0, 4);
      g.fill({ color: darker, alpha });

      // --- RIGHT CLAW ---
      const rcRotY = Math.sin(clawAngle) * 4;
      // Upper pincer
      g.moveTo(20, -4 - rcRotY);
      g.lineTo(36, -12 - rcRotY);
      g.lineTo(28, 0);
      g.closePath();
      g.fill({ color, alpha });
      // Lower pincer
      g.moveTo(20, 4 + rcRotY);
      g.lineTo(36, 12 + rcRotY);
      g.lineTo(28, 0);
      g.closePath();
      g.fill({ color: darker, alpha });
      // Joint
      g.circle(20, 0, 4);
      g.fill({ color: darker, alpha });

      // --- BODY (main oval) ---
      g.ellipse(0, 0, 18, 13);
      g.fill({ color, alpha });

      // Body highlight
      g.ellipse(-4, -4, 9, 5);
      g.fill({ color: 0xffffff, alpha: 0.12 * (isAlive ? 1 : 0.3) });

      // --- EYES ---
      // Left eye
      g.circle(-6, -7, 5);
      g.fill({ color: 0xffffff, alpha });
      g.circle(-5, -7, 2.5);
      g.fill({ color: 0x111827, alpha });
      // Right eye
      g.circle(6, -7, 5);
      g.fill({ color: 0xffffff, alpha });
      g.circle(7, -7, 2.5);
      g.fill({ color: 0x111827, alpha });

      // Elimination X for dead crabs
      if (!isAlive) {
        g.moveTo(-8, -8);
        g.lineTo(8, 8);
        g.stroke({ color: 0xef4444, width: 3, alpha: 0.7 });
        g.moveTo(8, -8);
        g.lineTo(-8, 8);
        g.stroke({ color: 0xef4444, width: 3, alpha: 0.7 });
      }
    },
    [color, darker, isAlive, isSpeaking, clawAngle, glowIntensity, alpha]
  );

  return (
    <pixiContainer x={x} y={y + bobOffset} rotation={facingAngle} scale={scale} alpha={alpha}>
      <pixiGraphics draw={draw} />
    </pixiContainer>
  );
}
