import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, WatchCard, SplitLayout, ClaudeBubble, MerchantCard, Caption } from './shared';

const VOICEOVER =
  "Two merchants. Two outcomes. Wick'd Wax gets a guaranteed pre-order. Lakeside Pottery gets visibility and a path to Shopify — on their own terms.";

export function Scene11() {
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
        mapContent={
          <NotlMap showRoute showWickd showLakeside wickdPulse lakesideColor="green" walkerAt="lakeside" />
        }
        watchContent={
          <div className="w-full h-full flex items-center justify-center px-3">
            <WatchCard
              emoji="✅"
              title="Route complete"
              subtitle="2 stops · 1 pre-order · 1 visit"
              delay={0.8}
            />
          </div>
        }
        chatContent={
          <div className="flex flex-col gap-2.5">
            <ClaudeBubble delay={0.2}>
              <MerchantCard
                emoji="🕯"
                name="Wick'd Wax"
                tagline="Shopify merchant · Pre-order confirmed"
                meta={['Seasonal Harvest candle reserved', '94% in stock · verified today']}
                borderColor="border-orange-900/50"
                delay={0}
              />
            </ClaudeBubble>

            <motion.div
              className="self-stretch flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <div className="flex-1 bg-orange-900/20 border border-orange-800/40 rounded-xl px-3 py-2 text-center">
                <div className="text-orange-400 text-[10px] font-bold">Wick'd Wax</div>
                <div className="text-gray-400 text-[9px]">Guaranteed sale →</div>
              </div>
              <div className="flex-1 bg-green-900/20 border border-green-800/40 rounded-xl px-3 py-2 text-center">
                <div className="text-green-400 text-[10px] font-bold">Lakeside Pottery</div>
                <div className="text-gray-400 text-[9px]">Warm Shopify lead →</div>
              </div>
            </motion.div>

            <ClaudeBubble delay={1.5}>
              <MerchantCard
                emoji="🏺"
                name="Lakeside Pottery"
                tagline="Visit confirmed · Signal sent to Shopify"
                meta={['4 visits this week · $340 est. missed revenue', 'Outreach initiated']}
                borderColor="border-green-900/50"
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
