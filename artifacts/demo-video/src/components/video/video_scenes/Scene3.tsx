import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2200),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#05070A] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background blur/gradient */}
      <motion.div 
        className="absolute inset-0 opacity-40 blur-3xl"
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.4 }}
        transition={{ duration: 2 }}
        style={{ backgroundImage: 'radial-gradient(circle at 50% 40%, #5C6AC433, transparent 60%)' }}
      />

      <motion.div
        className="relative z-10 w-[420px] bg-[#111827] rounded-3xl border border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden"
        initial={{ y: 100, opacity: 0, rotateX: 20 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        style={{ transformPerspective: 1000 }}
      >
        {/* Product Image Area */}
        <div className="h-64 bg-gradient-to-b from-[#1F2937] to-[#111827] relative flex items-center justify-center border-b border-gray-800 overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80)' }}
          />
          <motion.img 
            src={`${import.meta.env.BASE_URL}assets/wine-bottle.png`} 
            alt="Wine" 
            className="h-56 object-contain relative z-10 drop-shadow-2xl"
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={phase >= 1 ? { y: 0, opacity: 1, scale: 1 } : { y: 20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          />
          
          <motion.div 
            className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-gray-700 flex items-center gap-2"
            initial={{ x: 20, opacity: 0 }}
            animate={phase >= 2 ? { x: 0, opacity: 1 } : { x: 20, opacity: 0 }}
            transition={{ type: "spring" }}
          >
            <span className="w-2 h-2 rounded-full bg-[#96BF48] shadow-[0_0_8px_#96BF48]"></span>
            <span className="text-xs text-white font-medium">180m away</span>
          </motion.div>
        </div>

        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-white mb-1">Ravine Vineyard Estate</h2>
            <p className="text-gray-400 mb-6">2021 Reserve Cabernet Franc</p>
          </motion.div>

          <motion.div 
            className="flex items-end justify-between mb-8"
            initial={{ opacity: 0 }}
            animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-3xl font-bold text-white">$42</div>
            <div className="text-sm text-[#96BF48] flex items-center gap-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              Verified on Shopify
            </div>
          </motion.div>

          <motion.button
            className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-transform"
            style={{ backgroundColor: '#5C6AC4' }}
            initial={{ y: 20, opacity: 0 }}
            animate={phase >= 4 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.02 }}
          >
            Pay with Shop Pay
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
