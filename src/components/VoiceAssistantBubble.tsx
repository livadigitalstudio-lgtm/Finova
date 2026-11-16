import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface VoiceAssistantBubbleProps {
  onClick: () => void;
  isOpen: boolean;
}

export default function VoiceAssistantBubble({ onClick, isOpen }: VoiceAssistantBubbleProps) {
  if (isOpen) return null;

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        type="button"
        onClick={onClick}
        className="group relative flex items-center justify-center cursor-pointer select-none"
        aria-label="Abrir Finova AI Asistente de Voz"
      >
        {/* Pulsing Ambient Halo in Finova Brand Colors (Amber, Emerald, Sapphire) */}
        <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-blue-500 opacity-70 blur-md group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-pulse" />

        {/* Floating Orb Bubble Container */}
        <div 
          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-1.5 flex items-center justify-center shadow-xl border border-white/25"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #38bdf8 0%, #2563eb 24%, #10b981 50%, #f59e0b 76%, #d97706 100%)',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.45), inset 0 3px 6px rgba(255,255,255,0.6), inset 0 -4px 8px rgba(0,0,0,0.6)'
          }}
        >
          {/* Specular 3D Highlight */}
          <div 
            className="absolute top-1.5 right-2 w-7 h-7 rounded-full opacity-65 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 70%)'
            }}
          />

          {/* TWO VERTICAL WHITE PILLS (Status indicators) */}
          <div className="flex items-center gap-1.5 z-10">
            <span className="w-1.5 h-6 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
            <span className="w-1.5 h-6 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
          </div>

          {/* Gemini 4-Point Star Badge */}
          <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 p-1 rounded-full shadow-lg border border-amber-200">
            <Sparkles className="w-3 h-3 fill-slate-950" />
          </span>
        </div>

        {/* Hover Tooltip / Prompt for Mobile / Desktop */}
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900/95 text-white text-[11px] font-bold rounded-xl shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700/70 backdrop-blur-md hidden sm:inline-block">
          ✦ Finova AI • Manos Libres
        </span>
      </motion.button>
    </div>
  );
}
