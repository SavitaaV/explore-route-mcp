import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, WatchCard, SplitLayout, UserBubble, ClaudeBubble, Caption } from './shared';

const VOICEOVER =
  "She enables it. The MCP queries Shopify's Global Catalog and Google Places simultaneously. Two merchants appear along her route.";

export function Scene5() {
  const { muted } = useVideoContext();
  useVoiceover(VOICEOVER, muted);

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      <SplitLayout
        mapContent={<NotlMap showRoute showWickd showLakeside />}
        watchContent={
          <div className="w-full h-full flex items-center justify-center px-3">
            <WatchCard
              emoji="🗺️"
              title="Route MCP Active"
              subtitle="2 merchants discovered"
              delay={1.5}
            />
          </div>
        }
        chatContent={
          <div className="flex flex-col gap-2.5">
            <UserBubble text="I'm walking through Niagara-on-the-Lake this afternoon. What's worth stopping for?" />
            <ClaudeBubble delay={0.2}>
              I can help with that. Can I enable{' '}
              <span className="text-[#96BF48] font-semibold">Explore Route MCP</span>?
              <div className="mt-2 flex gap-2">
                <button className="flex-1 bg-[#96BF48] text-black text-[10px] font-bold rounded-lg py-1.5 px-2">
                  Enable ✓
                </button>
              </div>
            </ClaudeBubble>

            {/* Tool badge */}
            <motion.div
              className="self-start px-2.5 py-1 bg-[#5C6AC4]/15 border border-[#5C6AC4]/40 rounded font-mono text-[10px] text-[#9ba8f0]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              {'>'} get_nearby_merchants
            </motion.div>

            <ClaudeBubble delay={1.4}>
              Found <strong>2 merchants</strong> along your route — one Shopify-verified, one local
              discovery.
            </ClaudeBubble>
          </div>
        }
      />
      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
