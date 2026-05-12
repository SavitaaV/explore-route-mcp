import VideoWithControls from "@/components/video/VideoWithControls";
import { VideoProvider } from "@/lib/video/VideoContext";

export default function App() {
  return (
    <VideoProvider>
      <VideoWithControls />
    </VideoProvider>
  );
}
