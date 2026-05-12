import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { Caption } from './shared';

const VOICEOVER =
  'Explore Route MCP. Because the best merchants deserve to be found — and the best buyers deserve to find them.';

const LINES = [
  'For buyers: the right product, at the right moment, without asking.',
  "For merchants: discovery that doesn\u2019t require an ad budget.",
];

export function Scene12() {
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(74,222,128,0.06), transparent)' }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-8 gap-6">
        {LINES.map((line, i) => (
          <motion.p
            key={i}
            className="text-gray-300 font-medium"
            style={{ fontSize: 'clamp(0.9rem, 2vw, 1.5rem)', maxWidth: '68ch' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.8, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {line}
          </motion.p>
        ))}

        <motion.div
          className="h-px bg-white/10"
          style={{ width: '40%' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 2.0, duration: 0.6 }}
        />

        <motion.h1
          className="font-black tracking-tight text-white uppercase leading-none"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 6rem)', letterSpacing: '-0.02em' }}
          initial={{ opacity: 0, scale: 0.92, filter: 'blur(12px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 2.4, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Explore Route MCP
        </motion.h1>

        <motion.p
          className="text-gray-500 font-medium tracking-widest uppercase text-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.2, duration: 0.8 }}
        >
          Spatial Commerce · Built on Shopify's MCP Infrastructure
        </motion.p>

        <motion.div
          className="flex gap-3 flex-wrap justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.8, duration: 0.6 }}
        >
          {['MCP-native', 'Spatially aware', 'Purchase-ready'].map((tag) => (
            <span
              key={tag}
              className="px-4 py-1.5 bg-gray-900 border border-gray-700 rounded-full text-sm text-[#96BF48] font-medium"
            >
              {tag}
            </span>
          ))}
        </motion.div>
      </div>

      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
