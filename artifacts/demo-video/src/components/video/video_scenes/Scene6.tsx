import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene6() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#05070A] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="text-center z-10 flex flex-col items-center">
        {phase < 3 ? (
          <>
            <motion.h1 
              className="text-[8vw] font-black tracking-tighter text-white font-display uppercase leading-none"
              initial={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
              animate={phase >= 1 ? { scale: 1, opacity: 1, filter: 'blur(0px)' } : {}}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              Agentic Commerce
            </motion.h1>

            {phase >= 2 && (
              <div className="flex gap-4 mt-6">
                {['MCP-native', 'Spatially aware', 'Purchase-ready'].map((text, i) => (
                  <motion.div
                    key={text}
                    className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-full text-[#96BF48] font-medium"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.2, type: "spring" }}
                  >
                    {text}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <motion.h2 
              className="text-[5vw] font-bold text-white font-display mb-4 tracking-tight"
            >
              SCENIC ROUTES MCP
            </motion.h2>
            <motion.div 
              className="h-[2px] bg-[#96BF48]"
              initial={{ width: 0 }}
              animate={{ width: "200px" }}
              transition={{ duration: 0.8 }}
            />
            <motion.div
              className="mt-8 text-gray-500 font-sans"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              A Shopify Prototype
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
