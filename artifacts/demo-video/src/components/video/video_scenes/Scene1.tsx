import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { Caption } from './shared';

const VOICEOVER = 'Every great local merchant has the same problem.';

const DOTS = [
  { cx: '15%', cy: '60%', delay: 0.3 },
  { cx: '28%', cy: '45%', delay: 0.6 },
  { cx: '42%', cy: '55%', delay: 0.9 },
  { cx: '55%', cy: '40%', delay: 1.2 },
  { cx: '68%', cy: '50%', delay: 1.5 },
  { cx: '80%', cy: '38%', delay: 1.8 },
];

export function Scene1() {
  const { muted } = useVideoContext();
  useVoiceover(VOICEOVER, muted);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070A] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(74,222,128,0.07), transparent)' }}
      />

      {/* Pulsing route dots */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        {DOTS.map((dot, i) => (
          <motion.circle
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            r="5"
            fill="#4ade80"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.5, 0.2, 0.5], scale: [0, 1, 0.8, 1] }}
            transition={{ delay: dot.delay, duration: 1.8, repeat: Infinity, repeatDelay: 0.5 }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(74,222,128,0.8))' }}
          />
        ))}
        {/* Connecting path (absolute coords in 1920x1080 viewBox) */}
        <motion.path
          d="M 290 648 Q 540 486 806 594 T 1306 540 T 1536 410"
          fill="none"
          stroke="#4ade80"
          strokeWidth="3"
          strokeDasharray="16 12"
          strokeOpacity="0.25"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.5, ease: 'easeInOut', delay: 0.5 }}
        />
      </svg>

      {/* Main text */}
      <motion.p
        className="relative z-10 text-center text-white font-bold px-8"
        style={{ fontSize: 'clamp(1.6rem, 4vw, 3.5rem)', lineHeight: 1.2, maxWidth: '72%' }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        Every great local merchant has the same problem.
      </motion.p>

      <Caption text={VOICEOVER} delay={0.8} />
    </motion.div>
  );
}
