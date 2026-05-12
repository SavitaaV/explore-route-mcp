import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, SplitLayout, UserBubble, ClaudeBubble, Caption } from './shared';

const VOICEOVER =
  "Claude asks permission to activate Explore Route MCP — a spatial commerce layer that surfaces local merchants based on exactly where she's heading, not what she searched for.";

export function Scene4() {
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
        mapContent={<NotlMap showRoute />}
        watchContent={
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-gray-600 text-xs text-center">
              <div className="text-2xl mb-1">⌚</div>
              <div>Waiting…</div>
            </div>
          </div>
        }
        chatContent={
          <div className="flex flex-col gap-2.5">
            <UserBubble
              text="I'm walking through Niagara-on-the-Lake this afternoon. What's worth stopping for?"
              delay={0}
            />
            <ClaudeBubble delay={0.4}>
              <span>
                I can help with that. To give you the best suggestions along your exact route, can I
                enable{' '}
                <span className="text-[#96BF48] font-semibold">Explore Route MCP</span>? It connects
                to Shopify merchants and local businesses along your path.
              </span>
              <motion.div
                className="mt-2.5 flex gap-2"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
              >
                <button className="flex-1 bg-[#96BF48] text-black text-[10px] font-bold rounded-lg py-1.5 px-2">
                  Enable
                </button>
                <button className="flex-1 bg-gray-800 text-gray-400 text-[10px] rounded-lg py-1.5 px-2 border border-gray-700">
                  Not now
                </button>
              </motion.div>
            </ClaudeBubble>
          </div>
        }
      />
      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
