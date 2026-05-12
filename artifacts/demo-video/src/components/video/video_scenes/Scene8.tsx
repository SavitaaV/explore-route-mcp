import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, WatchCard, SplitLayout, ClaudeBubble, MerchantCard, Caption } from './shared';

const VOICEOVER =
  'Second stop: Lakeside Pottery. Ron and Barb have been throwing stoneware by hand since 1989. No website. No online store. Completely invisible to agentic commerce — until now.';

export function Scene8() {
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
              emoji="🏺"
              title="Lakeside Pottery · On your route"
              subtitle="Handmade stoneware since 1989"
              action="[Add Stop]"
              delay={1.0}
            />
          </div>
        }
        chatContent={
          <div className="flex flex-col gap-2.5">
            <ClaudeBubble delay={0.2}>Here's the second stop along your route:</ClaudeBubble>
            <ClaudeBubble delay={0.6}>
              <MerchantCard
                emoji="🏺"
                name="Lakeside Pottery"
                tagline="Ron & Barb Zimmermann · Since 1989"
                meta={[
                  'On your route · Open weekends',
                  'Google Places · No online store',
                  '⭐ 4.8 · 89 visitor reviews',
                ]}
                actionLabel="Add as Stop"
                borderColor="border-gray-700"
                delay={0}
              />
            </ClaudeBubble>
          </div>
        }
      />
      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
