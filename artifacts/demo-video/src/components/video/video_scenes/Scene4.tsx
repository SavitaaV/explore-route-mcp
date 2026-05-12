import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#05070A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background ripples */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-[#96BF48]"
            initial={{ width: 200, height: 200, opacity: 0 }}
            animate={{ 
              width: [200, 800], 
              height: [200, 800], 
              opacity: [0, 0.3, 0] 
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              delay: i * 0.8,
              ease: "easeOut"
            }}
          />
        ))}
      </div>

      <motion.div 
        className="relative w-[320px] h-[380px] bg-black rounded-[60px] border-[12px] border-gray-900 shadow-2xl flex flex-col items-center justify-center p-6 text-center overflow-hidden"
        initial={{ y: 50, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      >
        {/* Watch Face Highlight */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#96BF4822] to-transparent opacity-50"></div>

        <motion.div
          className="w-16 h-16 rounded-full bg-[#96BF48]/20 flex items-center justify-center mb-6 relative"
          initial={{ scale: 0 }}
          animate={phase >= 1 ? { scale: 1 } : { scale: 0 }}
          transition={{ type: "spring" }}
        >
          <div className="w-8 h-8 rounded-full bg-[#96BF48] shadow-[0_0_15px_#96BF48]"></div>
          {phase >= 2 && (
            <motion.div 
              className="absolute inset-0 rounded-full border-2 border-[#96BF48]"
              animate={{ scale: [1, 1.5], opacity: [1, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>

        <motion.h3 
          className="text-white font-bold text-2xl leading-tight mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: 0.2 }}
        >
          Ravine Vineyard
        </motion.h3>
        
        <motion.p 
          className="text-[#96BF48] font-medium text-lg mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: 0.3 }}
        >
          180m away
        </motion.p>

        <motion.div
          className="px-6 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-sm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ type: "spring" }}
        >
          Tap to explore
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
