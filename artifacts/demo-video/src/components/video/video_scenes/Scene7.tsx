import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, WatchCard, SplitLayout, ClaudeBubble, MerchantCard, Caption } from './shared';

const VOICEOVER =
  "One tap. Pre-order confirmed through Shopify's Universal Cart. Wick'd Wax gets notified instantly. High-intent buyer, en route, guaranteed sale.";

export function Scene7() {
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
          <div className="relative w-full h-full">
            <NotlMap showRoute showWickd showLakeside wickdPulse />
            <motion.div
              className="absolute top-3 left-3 right-3 bg-black/85 backdrop-blur rounded-xl border border-orange-800/50 p-3"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            >
              <div className="text-orange-400 text-[9px] font-bold mb-1.5 flex items-center gap-1.5">
                <span>📦</span> New Order — Explore Route
              </div>
              <div className="text-white text-[10px] font-semibold">Priya M.</div>
              <div className="text-gray-400 text-[9px]">Arriving ~18 min · Pre-paid via Shopify</div>
            </motion.div>
          </div>
        }
        watchContent={
          <div className="w-full h-full flex items-center justify-center px-3">
            <WatchCard
              emoji="✅"
              title="Order confirmed!"
              subtitle="Wick'd Wax · Arriving ~18 min"
              delay={0.8}
            />
          </div>
        }
        chatContent={
          <div className="flex flex-col gap-2.5">
            <ClaudeBubble delay={0.1}>
              <MerchantCard
                emoji="🕯"
                name="Wick'd Wax ~ The Candle Shoppe"
                tagline="Shopify merchant · St. Davids, ON"
                meta={['Seasonal Harvest Collection — Soy candles', 'Inventory: 94% in stock']}
                actionLabel2="Pre-order via Shopify →"
                borderColor="border-orange-900/50"
                delay={0}
              />
            </ClaudeBubble>
            <ClaudeBubble delay={1.0}>
              <span className="text-green-400 font-semibold">Done.</span> Your Seasonal Harvest
              candle is reserved. Pick up when you arrive — they're expecting you in about 18 minutes.
            </ClaudeBubble>
          </div>
        }
      />
      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
