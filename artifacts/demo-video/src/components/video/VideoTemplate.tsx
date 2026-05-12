import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';
import { Scene9 } from './video_scenes/Scene9';
import { Scene10 } from './video_scenes/Scene10';
import { Scene11 } from './video_scenes/Scene11';
import { Scene12 } from './video_scenes/Scene12';

export const SCENE_DURATIONS: Record<string, number> = {
  hook:        5000,
  route:       5000,
  splitscreen: 4000,
  permission:  5000,
  connect:     4000,
  wickdwax:    9000,
  preorder:    5000,
  lakeside:    9000,
  visit:       7000,
  dashboard:  10000,
  outcomes:    6000,
  closing:     6000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  hook:        Scene1,
  route:       Scene2,
  splitscreen: Scene3,
  permission:  Scene4,
  connect:     Scene5,
  wickdwax:    Scene6,
  preorder:    Scene7,
  lakeside:    Scene8,
  visit:       Scene9,
  dashboard:   Scene10,
  outcomes:    Scene11,
  closing:     Scene12,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const glowPositions = [
    ['5vw', '10vh'],
    ['45vw', '20vh'],
    ['55vw', '50vh'],
    ['20vw', '30vh'],
    ['60vw', '40vh'],
    ['35vw', '25vh'],
    ['50vw', '60vh'],
    ['25vw', '55vh'],
    ['70vw', '35vh'],
    ['40vw', '70vh'],
    ['15vw', '45vh'],
    ['55vw', '15vh'],
  ];

  const pos = glowPositions[sceneIndex] ?? ['35vw', '25vh'];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#05070A]">
      {/* Persistent global noise overlay */}
      <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none z-50">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100" height="100" filter="url(#noiseFilter)" />
        </svg>
      </div>

      {/* Persistent midground accent */}
      <motion.div
        className="absolute w-[40vw] h-[40vw] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.08), transparent 70%)' }}
        animate={{ x: pos[0], y: pos[1] }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      />

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
    </div>
  );
}
