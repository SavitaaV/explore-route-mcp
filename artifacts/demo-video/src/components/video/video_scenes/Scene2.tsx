import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#0B0E14] overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[90%] h-[80%] flex flex-row gap-6">
        {/* Left Map Panel */}
        <motion.div 
          className="w-1/2 h-full bg-[#111827] rounded-2xl border border-gray-800 relative overflow-hidden flex items-center justify-center"
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at center, #96BF4822 0%, transparent 70%)' }}></div>
          {/* Map lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M 10 90 C 30 70, 50 80, 80 20" fill="none" stroke="#96BF4855" strokeWidth="1" />
          </svg>
          
          {/* Map pins appearing */}
          {[
            { x: '30%', y: '60%', d: 1.0 },
            { x: '45%', y: '75%', d: 1.3 },
            { x: '75%', y: '30%', d: 1.6 }
          ].map((pin, i) => (
             <motion.div 
               key={i}
               className="absolute w-4 h-4 bg-[#96BF48] rounded-full shadow-[0_0_15px_#96BF48]"
               style={{ left: pin.x, top: pin.y }}
               initial={{ scale: 0, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{ delay: pin.d, type: 'spring' }}
             />
          ))}

          {/* Floating MCP Tools */}
          <motion.div 
            className="absolute top-6 left-6 px-4 py-2 bg-[#5C6AC4]/20 border border-[#5C6AC4] rounded text-[#5C6AC4] font-mono text-sm shadow-lg"
            initial={{ y: 20, opacity: 0 }}
            animate={phase >= 1 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {'>'} get_nearby_merchants
          </motion.div>
        </motion.div>

        {/* Right Chat Panel */}
        <motion.div 
          className="w-1/2 h-full bg-[#05070A] rounded-2xl border border-gray-800 p-8 flex flex-col"
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div className="flex items-center gap-4 mb-8">
             <div className="w-8 h-8 rounded-full bg-[#5C6AC4] flex items-center justify-center text-white text-xs font-bold">C</div>
             <div className="h-6 w-32 bg-gray-800 rounded animate-pulse"></div>
          </div>
          
          <div className="flex-1 text-gray-300 font-sans text-xl leading-relaxed">
            <motion.p
              initial={{ opacity: 0 }}
              animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
            >
              Discovering nearby merchants...
            </motion.p>

            {phase >= 2 && (
              <motion.div className="mt-8 space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <p>I found these incredible locations along your route:</p>
                <ul className="space-y-3 mt-4">
                  {[
                    "Ravine Vineyard Estate",
                    "Treadwell Farm-to-Table",
                    "Two Sisters Estates"
                  ].map((name, i) => (
                    <motion.li 
                      key={i}
                      className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800"
                      initial={{ opacity: 0, x: -20 }}
                      animate={phase >= 2 ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: i * 0.2 + (phase >= 2 ? 0 : 99) }}
                    >
                      <span className="w-2 h-2 rounded-full bg-[#96BF48]"></span>
                      <span className="text-white">{name}</span>
                      <span className="ml-auto text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded">Verified</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
