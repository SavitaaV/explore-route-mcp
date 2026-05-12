import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, WatchCard, SplitLayout, ClaudeBubble, Caption } from './shared';

const VOICEOVER =
  "Priya stops, browses, buys a honey pot in cash. The MCP geofence confirms her visit — no transaction required on Shopify's side.";

export function Scene9() {
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
          <NotlMap showRoute showWickd showLakeside walkerAt="lakeside" showGeofence />
        }
        watchContent={
          <div className="w-full h-full flex items-center justify-center px-3">
            <WatchCard
              emoji="📍"
              title="Visit confirmed"
              subtitle="Lakeside Pottery · 12:34 PM"
              delay={1.4}
            />
          </div>
        }
        chatContent={
          <div className="flex flex-col gap-2.5">
            <ClaudeBubble delay={0.2}>
              Here's the second stop along your route — Lakeside Pottery is on your path.
            </ClaudeBubble>

            <motion.div
              className="self-start px-2.5 py-1 bg-cyan-900/20 border border-cyan-700/40 rounded font-mono text-[10px] text-cyan-400"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              {'>'} geofence_enter: Lakeside Pottery
            </motion.div>

            <ClaudeBubble delay={1.5}>
              Looks like you're at Lakeside Pottery. Hope you find something beautiful.{' '}
              <span className="text-cyan-400">Visit logged.</span>
            </ClaudeBubble>
          </div>
        }
      />
      <Caption text={VOICEOVER} delay={0.5} />
    </motion.div>
  );
}
