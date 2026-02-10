"use client";

import { motion } from "framer-motion";
import { cn, shortenAddress, getAgentColor } from "@/lib/utils";
import type { Player } from "@/lib/types";

interface PlayerAvatarProps {
  player: Player;
  size?: "sm" | "md" | "lg";
  showVote?: boolean;
  showRole?: boolean;
  onClick?: () => void;
}

export default function PlayerAvatar({
  player,
  size = "md",
  showVote = false,
  showRole = false,
  onClick,
}: PlayerAvatarProps) {
  const color = getAgentColor(player.address);
  const initials = player.address.slice(2, 4).toUpperCase();

  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-14 h-14 text-sm",
    lg: "w-20 h-20 text-lg",
  };

  const ringSize = {
    sm: "w-12 h-12",
    md: "w-[68px] h-[68px]",
    lg: "w-24 h-24",
  };

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center gap-1 cursor-pointer group",
        !player.isAlive && "opacity-50"
      )}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Avatar ring */}
      <div className="relative">
        {/* Speaking indicator */}
        {player.isSpeaking && player.isAlive && (
          <motion.div
            className={cn(
              "absolute -inset-1 rounded-full border-2 border-green-400",
              ringSize[size]
            )}
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.3, 0.7] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ left: "-4px", top: "-4px" }}
          />
        )}

        {/* Avatar circle */}
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-bold border-2 transition-all",
            sizeClasses[size],
            player.isAlive
              ? "border-gray-600 group-hover:border-gray-400"
              : "border-gray-800 grayscale"
          )}
          style={{
            backgroundColor: player.isAlive ? `${color}30` : "#1f2937",
            color: player.isAlive ? color : "#6b7280",
          }}
        >
          {player.isAlive ? (
            initials
          ) : (
            <span className="line-through">{initials}</span>
          )}
        </div>

        {/* Eliminated X */}
        {!player.isAlive && (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-full h-0.5 bg-red-500 rotate-45 absolute" />
            <div className="w-full h-0.5 bg-red-500 -rotate-45 absolute" />
          </motion.div>
        )}

        {/* Vote indicator */}
        {showVote && player.votedFor && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white"
          >
            V
          </motion.div>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <div
          className={cn(
            "font-medium truncate max-w-[80px]",
            size === "sm" ? "text-[10px]" : "text-xs",
            player.isAlive ? "text-gray-300" : "text-gray-600"
          )}
        >
          {player.name || shortenAddress(player.address)}
        </div>

        {/* Role badge (shown when eliminated or showRole) */}
        {(showRole || !player.isAlive) && player.role !== "unknown" && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5",
              player.role === "impostor"
                ? "bg-purple-500/20 text-purple-400"
                : "bg-green-500/20 text-green-400"
            )}
          >
            {player.role === "impostor" ? "IMPOSTOR" : "LOBSTER"}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
