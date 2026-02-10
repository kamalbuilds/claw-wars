"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  delay?: number;
}

export default function StatsCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = "text-red-400",
  delay = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800",
            color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-xl font-bold text-white">{value}</p>
          {subValue && (
            <p className="text-xs text-gray-400">{subValue}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
