import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

/* ─── NOTL Walking Map ──────────────────────────────────────────── */

interface NotlMapProps {
  showWickd?: boolean;
  showLakeside?: boolean;
  wickdPulse?: boolean;
  lakesideColor?: 'grey' | 'green';
  walkerAt?: 'start' | 'lakeside';
  showGeofence?: boolean;
  showRoute?: boolean;
  routeAnimated?: boolean;
  showBadge?: boolean;
}

const ROUTE_PATH = 'M 60 155 C 70 120 130 80 220 65 C 248 90 252 120 248 145 C 225 178 185 198 150 205 C 110 210 68 192 55 185 C 56 175 58 165 60 155 Z';

export function NotlMap({
  showWickd = false,
  showLakeside = false,
  wickdPulse = false,
  lakesideColor = 'grey',
  walkerAt = 'start',
  showGeofence = false,
  showRoute = true,
  routeAnimated = false,
  showBadge = false,
}: NotlMapProps) {
  return (
    <div className="relative w-full h-full bg-[#1a2332] rounded-2xl overflow-hidden flex items-center justify-center">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(100,180,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(100,180,255,0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <svg
        viewBox="0 0 310 260"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Route fill */}
        {showRoute && (
          <path d={ROUTE_PATH} fill="rgba(34,197,94,0.08)" stroke="none" />
        )}
        {/* Route path */}
        {showRoute && (
          <motion.path
            d={ROUTE_PATH}
            fill="none"
            stroke="#4ade80"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1200"
            initial={{ strokeDashoffset: routeAnimated ? 1200 : 0 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 2.2, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(74,222,128,0.6))' }}
          />
        )}

        {/* Stop labels */}
        {showRoute && (
          <>
            <text x="52" y="152" fontSize="7" fill="rgba(255,255,255,0.5)" textAnchor="middle">Market Sq</text>
            <text x="225" y="60" fontSize="7" fill="rgba(255,255,255,0.5)" textAnchor="middle">Fort George</text>
            <text x="258" y="143" fontSize="7" fill="rgba(255,255,255,0.5)" textAnchor="end">Waterfront</text>
            <text x="152" y="218" fontSize="7" fill="rgba(255,255,255,0.5)" textAnchor="middle">Shaw Festival</text>
            <text x="52" y="200" fontSize="7" fill="rgba(255,255,255,0.5)" textAnchor="middle">Queen St</text>
          </>
        )}

        {/* Geofence around Lakeside */}
        {showGeofence && (
          <motion.circle
            cx="248"
            cy="145"
            r="22"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeDasharray="4 4"
            animate={{ r: [22, 30, 22], opacity: [0.8, 0.3, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Walker dot */}
        <motion.circle
          cx={walkerAt === 'lakeside' ? 248 : 60}
          cy={walkerAt === 'lakeside' ? 145 : 155}
          r="6"
          fill="#3b82f6"
          stroke="white"
          strokeWidth="2"
          animate={walkerAt === 'lakeside' ? { cx: 248, cy: 145 } : { cx: 60, cy: 155 }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.9))' }}
        />

        {/* Wick'd Wax pin (orange) */}
        {showWickd && (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            style={{ transformOrigin: '195px 92px' }}
          >
            {wickdPulse && (
              <motion.circle
                cx="195"
                cy="92"
                r="12"
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                animate={{ r: [12, 22], opacity: [0.8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <circle
              cx="195"
              cy="92"
              r="9"
              fill="#f97316"
              style={{ filter: 'drop-shadow(0 0 8px rgba(249,115,22,0.9))' }}
            />
            <text x="195" y="95" fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">W</text>
            <text x="195" y="76" fontSize="6.5" fill="#f97316" textAnchor="middle">Wick'd Wax</text>
          </motion.g>
        )}

        {/* Lakeside Pottery pin */}
        {showLakeside && (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.3 }}
            style={{ transformOrigin: '248px 145px' }}
          >
            <circle
              cx="248"
              cy="145"
              r="9"
              fill={lakesideColor === 'green' ? '#22c55e' : '#9ca3af'}
              style={{
                filter: `drop-shadow(0 0 8px ${lakesideColor === 'green' ? 'rgba(34,197,94,0.9)' : 'rgba(156,163,175,0.7)'})`,
              }}
            />
            <text x="248" y="148" fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">L</text>
            <text
              x="248"
              y="130"
              fontSize="6.5"
              fill={lakesideColor === 'green' ? '#22c55e' : '#9ca3af'}
              textAnchor="middle"
            >
              Lakeside Pottery
            </text>
          </motion.g>
        )}
      </svg>

      {showBadge && (
        <motion.div
          className="absolute bottom-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg text-xs text-white/80 font-mono"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          Niagara-on-the-Lake Old Town · 3.2 km · ~38 min
        </motion.div>
      )}
    </div>
  );
}

/* ─── Phone Frame ───────────────────────────────────────────────── */

export function PhoneFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative bg-[#0a0f1a] rounded-[28px] border-[3px] border-gray-700 shadow-2xl overflow-hidden flex flex-col ${className}`}
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 25px 60px rgba(0,0,0,0.7)' }}
    >
      {/* Notch */}
      <div className="flex justify-center pt-2 pb-1 shrink-0">
        <div className="w-16 h-1.5 bg-gray-700 rounded-full" />
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

/* ─── Watch Card ────────────────────────────────────────────────── */

interface WatchCardProps {
  emoji: string;
  title: string;
  subtitle: string;
  action?: string;
  delay?: number;
}

export function WatchCard({ emoji, title, subtitle, action, delay = 0 }: WatchCardProps) {
  return (
    <motion.div
      className="bg-black rounded-2xl border border-gray-800 p-3 flex items-start gap-2.5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-xl shrink-0">{emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-xs font-semibold leading-tight">{title}</div>
        <div className="text-gray-400 text-[10px] leading-tight mt-0.5 truncate">{subtitle}</div>
        {action && (
          <div className="mt-1.5 px-2 py-0.5 bg-[#5C6AC4]/30 border border-[#5C6AC4]/50 rounded text-[#9ba8f0] text-[9px] inline-block font-medium">
            {action}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Chat Bubble ───────────────────────────────────────────────── */

export function UserBubble({ text, delay = 0 }: { text: ReactNode; delay?: number }) {
  return (
    <motion.div
      className="flex justify-end"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.6 }}
    >
      <div className="bg-[#5C6AC4] text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%] leading-relaxed">
        {text}
      </div>
    </motion.div>
  );
}

export function ClaudeBubble({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      className="flex gap-2 items-start"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div className="w-5 h-5 rounded-full bg-[#5C6AC4] flex items-center justify-center text-white text-[8px] font-bold shrink-0 mt-0.5">
        C
      </div>
      <div className="bg-[#1a2130] text-gray-100 text-xs rounded-2xl rounded-tl-sm px-3 py-2 flex-1 leading-relaxed border border-gray-800">
        {children}
      </div>
    </motion.div>
  );
}

/* ─── Merchant Card ─────────────────────────────────────────────── */

interface MerchantCardProps {
  emoji: string;
  name: string;
  tagline: string;
  meta: string[];
  actionLabel?: string;
  actionLabel2?: string;
  delay?: number;
  borderColor?: string;
}

export function MerchantCard({
  emoji,
  name,
  tagline,
  meta,
  actionLabel,
  actionLabel2,
  delay = 0,
  borderColor = 'border-gray-700',
}: MerchantCardProps) {
  return (
    <motion.div
      className={`bg-[#111827] rounded-xl border ${borderColor} p-3 text-xs`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{emoji}</span>
        <div>
          <div className="font-bold text-white leading-tight">{name}</div>
          <div className="text-gray-400 text-[10px] mt-0.5">{tagline}</div>
        </div>
      </div>
      <div className="space-y-0.5 mb-2">
        {meta.map((line, i) => (
          <div key={i} className="text-gray-400 text-[10px]">{line}</div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-2">
        {actionLabel && (
          <button className="flex-1 bg-[#5C6AC4] text-white text-[10px] font-semibold rounded-lg py-1.5 px-2">
            {actionLabel}
          </button>
        )}
        {actionLabel2 && (
          <button className="flex-1 bg-gray-800 text-gray-300 text-[10px] font-semibold rounded-lg py-1.5 px-2 border border-gray-700">
            {actionLabel2}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Split Layout ──────────────────────────────────────────────── */

interface SplitLayoutProps {
  mapContent: ReactNode;
  watchContent: ReactNode;
  chatContent: ReactNode;
}

export function SplitLayout({ mapContent, watchContent, chatContent }: SplitLayoutProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#05070A] p-6 gap-5">
      {/* Left column: map phone + watch */}
      <div className="flex flex-col gap-3 h-full" style={{ width: '46%' }}>
        <PhoneFrame className="flex-1">
          {mapContent}
        </PhoneFrame>
        <div
          className="shrink-0 bg-black rounded-2xl border border-gray-800 overflow-hidden"
          style={{ height: '22%' }}
        >
          {watchContent}
        </div>
      </div>

      {/* Right column: chat phone */}
      <div className="h-full" style={{ width: '46%' }}>
        <PhoneFrame className="h-full">
          <div className="h-full bg-[#05070A] flex flex-col overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
              <div className="w-5 h-5 rounded-full bg-[#5C6AC4] flex items-center justify-center text-white text-[8px] font-bold">
                C
              </div>
              <span className="text-white text-xs font-semibold">Claude</span>
              <span className="ml-auto text-[9px] text-green-400 font-medium">● MCP</span>
            </div>
            <div className="flex-1 overflow-hidden p-3 flex flex-col gap-2.5">
              {chatContent}
            </div>
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}

/* ─── Caption Bar ───────────────────────────────────────────────── */

export function Caption({ text, delay = 0.3 }: { text: string; delay?: number }) {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-2.5 rounded-full text-white text-base font-medium text-center max-w-[90%] z-30"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      {text}
    </motion.div>
  );
}

/* ─── Typewriter ────────────────────────────────────────────────── */

import { useState, useEffect } from 'react';

export function Typewriter({ text, delay = 0, speed = 35 }: { text: string; delay?: number; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [started, text, speed]);

  return <>{displayed}{displayed.length < text.length && started ? <span className="animate-pulse">|</span> : null}</>;
}
