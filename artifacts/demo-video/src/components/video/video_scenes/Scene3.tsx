import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, SplitLayout, UserBubble, Caption, Typewriter } from './shared';

const VOICEOVER =
  "Meet Priya. She's walking through Niagara-on-the-Lake and asks Claude what's worth stopping for.";

export function Scene3() {
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
              <div>Apple Watch</div>
            </div>
          </div>
        }
        chatContent={
          <motion.div
            className="flex flex-col gap-2.5 h-full"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <UserBubble
              text={
                <Typewriter
                  text="I'm walking through Niagara-on-the-Lake this afternoon. What's worth stopping for?"
                  delay={0.8}
                  speed={28}
                />
              }
              delay={0.6}
            />
            <motion.div
              className="flex gap-2 items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3.2, duration: 0.6 }}
            >
              <div className="w-5 h-5 rounded-full bg-[#5C6AC4] flex items-center justify-center text-white text-[8px] font-bold shrink-0">
                C
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        }
      />
      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
