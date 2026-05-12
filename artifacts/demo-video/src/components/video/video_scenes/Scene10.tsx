import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { Caption } from './shared';

const VOICEOVER =
  "Behind the scenes, Explore Route logs every verified visit. After four this week, Shopify's acquisition team gets a warm lead — not a cold email, but proof of demand with a dollar figure attached.";

const COUNTER_ITEMS = [
  { label: 'Verified visits this week', value: '4', color: 'text-cyan-400' },
  { label: 'Est. missed online revenue', value: '$340', color: 'text-orange-400' },
  { label: 'Google Places rating', value: '4.8 ⭐', color: 'text-yellow-400' },
];

export function Scene10() {
  const { muted } = useVideoContext();
  useVoiceover(VOICEOVER, muted);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-[#05070A] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(34,197,94,0.05), transparent)' }}
      />

      <motion.div
        className="relative z-10 w-full max-w-2xl mx-8 bg-[#0d1520] border border-gray-800 rounded-2xl overflow-hidden"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ boxShadow: '0 0 60px rgba(34,197,94,0.08)' }}
      >
        <div className="bg-[#111827] border-b border-gray-800 px-6 py-4 flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <div className="text-white font-bold text-lg">Explore Route — Weekly Signal</div>
            <div className="text-gray-400 text-sm">Lakeside Pottery · NOTL</div>
          </div>
          <div className="ml-auto px-3 py-1.5 bg-amber-900/30 border border-amber-700/50 rounded-full text-amber-400 text-xs font-semibold">
            Not on Shopify
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-3 gap-4 mb-6">
            {COUNTER_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                className="bg-[#0a0f1a] border border-gray-800 rounded-xl p-4 text-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.2, duration: 0.6 }}
              >
                <div className={`text-2xl font-bold mb-1 ${item.color}`}>{item.value}</div>
                <div className="text-gray-500 text-xs leading-tight">{item.label}</div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="flex items-center justify-between bg-[#0a0f1a] border border-[#22c55e]/30 rounded-xl px-5 py-4"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.4, duration: 0.6 }}
          >
            <div>
              <div className="text-white font-semibold text-sm mb-0.5">Warm merchant lead ready</div>
              <div className="text-gray-500 text-xs">Proof of demand · 4 verified traveller visits</div>
            </div>
            <button className="ml-4 shrink-0 bg-[#22c55e] text-black text-sm font-bold rounded-xl px-4 py-2.5">
              → Send outreach
            </button>
          </motion.div>
        </div>
      </motion.div>

      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
