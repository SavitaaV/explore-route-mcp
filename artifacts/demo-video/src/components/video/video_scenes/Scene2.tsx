import { motion } from 'framer-motion';
import { useVideoContext } from '@/lib/video/VideoContext';
import { useVoiceover } from '@/lib/video/useVoiceover';
import { NotlMap, Caption } from './shared';

const VOICEOVER = 'Nobody finds them.';

export function Scene2() {
  const { muted } = useVideoContext();
  useVoiceover(VOICEOVER, muted);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070A] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      {/* Full-screen map */}
      <div className="absolute inset-0 p-8">
        <NotlMap showRoute routeAnimated showBadge />
      </div>

      {/* Big bold caption in the sky area */}
      <motion.p
        className="relative z-20 text-white text-center font-bold"
        style={{ fontSize: 'clamp(2rem, 5.5vw, 5rem)', lineHeight: 1.1, textShadow: '0 4px 30px rgba(0,0,0,0.9)' }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.8 }}
      >
        Nobody finds them.
      </motion.p>

      <Caption text={VOICEOVER} delay={1} />
    </motion.div>
  );
}
