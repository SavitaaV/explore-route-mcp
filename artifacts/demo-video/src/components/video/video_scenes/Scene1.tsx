import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#05070A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8 }}
    >
      {/* Map Background */}
      <motion.div 
        className="absolute inset-0 opacity-20"
        initial={{ scale: 1.2, rotate: -2 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 4, ease: "easeOut" }}
      >
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#96BF48]/20 via-[#0B0E14] to-[#05070A]"></div>
        {/* Simple grid to simulate map */}
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#96BF4811 1px, transparent 1px), linear-gradient(90deg, #96BF4811 1px, transparent 1px)', backgroundSize: '4vw 4vw', transform: 'perspective(500px) rotateX(60deg) scale(2)', transformOrigin: 'top center' }}></div>
      </motion.div>

      {/* Path animation */}
      <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
        <motion.path
          d="M 200 800 Q 500 700 800 500 T 1400 400 T 1800 200"
          fill="none"
          stroke="#96BF48"
          strokeWidth="4"
          strokeDasharray="2000"
          strokeDashoffset="2000"
          animate={{ strokeDashoffset: [2000, 0] }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(150,191,72,0.8))' }}
        />
        {/* Pins */}
        {[
          { cx: 200, cy: 800, delay: 0.5 },
          { cx: 800, cy: 500, delay: 1.2 },
          { cx: 1400, cy: 400, delay: 1.8 }
        ].map((pin, i) => (
          <motion.circle
            key={i}
            cx={pin.cx}
            cy={pin.cy}
            r="12"
            fill="#5C6AC4"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: pin.delay, type: "spring", stiffness: 300, damping: 15 }}
            style={{ filter: 'drop-shadow(0 0 10px rgba(92,106,196,0.8))' }}
          />
        ))}
      </svg>

      <div className="relative z-20 text-center flex flex-col items-center">
        <motion.h1 
          className="text-[6vw] font-bold tracking-tighter text-white font-display uppercase"
          initial={{ y: 50, opacity: 0, clipPath: 'inset(100% 0 0 0)' }}
          animate={{ y: 0, opacity: 1, clipPath: 'inset(0% 0 0 0)' }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Scenic Routes
        </motion.h1>
        
        <motion.div
          className="h-[2px] bg-[#96BF48] mt-4 mb-6"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.6, delay: 1.2, ease: "easeOut" }}
        />

        <motion.p
          className="text-[2vw] text-gray-400 tracking-wide font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5 }}
        >
          Commerce that walks with you.
        </motion.p>
      </div>
    </motion.div>
  );
}
