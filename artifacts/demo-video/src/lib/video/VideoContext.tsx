import { createContext, useContext, useState, type ReactNode } from 'react';

interface VideoContextValue {
  muted: boolean;
  toggleMuted: () => void;
}

const VideoContext = createContext<VideoContextValue>({ muted: false, toggleMuted: () => {} });

export function VideoProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  return (
    <VideoContext.Provider value={{ muted, toggleMuted: () => setMuted((m) => !m) }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideoContext() {
  return useContext(VideoContext);
}
