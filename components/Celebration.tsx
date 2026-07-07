"use client";

import { motion } from "framer-motion";

export function Celebration({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-2xl bg-primary px-4 py-3 text-center font-semibold text-white shadow-sm"
    >
      🎉 {message}
    </motion.div>
  );
}
