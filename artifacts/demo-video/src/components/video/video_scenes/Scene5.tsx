import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const nodes = [
    { x: '50%', y: '50%', color: '#96BF48', type: 'verified' },
    { x: '35%', y: '35%', color: '#96BF48', type: 'verified' },
    { x: '65%', y: '40%', color: '#96BF48', type: 'verified' },
    { x: '45%', y: '65%', color: '#96BF48', type: 'verified' },
    { x: '60%', y: '60%', color: '#96BF48', type: 'verified' },
    { x: '20%', y: '50%', color: '#F59E0B', type: 'ghost' },
    { x: '80%', y: '70%', color: '#F59E0B', type: 'ghost' },
    { x: '75%', y: '25%', color: '#F59E0B', type: 'ghost' }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#05070A] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}assets/network-bg.png`}
        className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-lighten"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 5 }}
      />

      {/* Network Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {phase >= 1 && (
          <motion.path 
            d="M 50 50 L 35 35 M 50 50 L 65 40 M 50 50 L 45 65 M 50 50 L 60 60 M 35 35 L 45 65"
            stroke="#96BF48"
            strokeWidth="0.5"
            strokeOpacity="0.4"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        )}
      </svg>

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{ 
            left: node.x, 
            top: node.y, 
            backgroundColor: node.color,
            width: node.type === 'verified' ? '24px' : '16px',
            height: node.type === 'verified' ? '24px' : '16px',
            boxShadow: `0 0 20px ${node.color}`,
            transform: 'translate(-50%, -50%)'
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
        />
      ))}

      {/* Labels */}
      {phase >= 2 && (
        <>
          <motion.div 
            className="absolute left-[52%] top-[48%] bg-black/80 backdrop-blur px-4 py-2 rounded border border-[#96BF48]/30"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="text-[#96BF48] font-bold text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#96BF48]"></span> Verified on Shopify
            </div>
          </motion.div>

          <motion.div 
            className="absolute left-[82%] top-[68%] bg-black/80 backdrop-blur px-4 py-2 rounded border border-[#F59E0B]/30"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="text-[#F59E0B] font-bold text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span> Ghost Business
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
