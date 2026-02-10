"use client";

import { motion } from "framer-motion";
import { cn, shortenAddress, getAgentColor, getAgentName } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

interface DiscussionMessageProps {
  message: ChatMessage;
  index: number;
}

export default function DiscussionMessage({
  message,
  index,
}: DiscussionMessageProps) {
  const color = getAgentColor(message.sender);
  const isSystem = message.type === "system";
  const isAccusation = message.type === "accusation";
  const isDefense = message.type === "defense";

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="flex justify-center py-2"
      >
        <div className="rounded-full bg-gray-800/50 px-4 py-1.5 text-xs text-gray-400 border border-gray-700/50">
          {message.content}
        </div>
      </motion.div>
    );
  }

  const timeStr = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className={cn(
        "group flex gap-3 rounded-lg p-3 transition-colors hover:bg-gray-800/30",
        isAccusation && "border-l-2 border-red-500/50 bg-red-500/5",
        isDefense && "border-l-2 border-blue-500/50 bg-blue-500/5"
      )}
    >
      {/* Avatar */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        style={{
          backgroundColor: `${color}25`,
          color: color,
        }}
      >
        {message.sender.slice(2, 4).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold" style={{ color }}>
            {message.senderName || getAgentName(message.sender)}
          </span>
          <span className="text-[10px] text-gray-600">
            {shortenAddress(message.sender)}
          </span>
          {!message.senderAlive && (
            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
              ELIMINATED
            </span>
          )}
          {isAccusation && (
            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              ACCUSES
            </span>
          )}
          {isDefense && (
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
              DEFENDS
            </span>
          )}
          <span className="ml-auto text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {timeStr}
          </span>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed break-words">
          {message.content}
        </p>
      </div>
    </motion.div>
  );
}
