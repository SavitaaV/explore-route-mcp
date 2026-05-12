// Video template library - hook and animation presets

export { useVideoPlayer, useSceneTimer } from './hooks';
export { useVoiceover } from './useVoiceover';
export { VideoProvider, useVideoContext } from './VideoContext';
export type { SceneDurations, UseVideoPlayerOptions, UseVideoPlayerReturn } from './hooks';

export {
  springs,
  easings,
  sceneTransitions,
  elementAnimations,
  charVariants,
  charContainerVariants,
  staggerConfigs,
  containerVariants,
  itemVariants,
  staggerDelay,
  customSpring,
  withDelay,
} from './animations';
