import React, { useEffect, useState } from 'react';

interface DeletionCountdownProps {
  createdAt?: string;
  windowMs: number;
  variant?: 'badge' | 'inline';
  className?: string;
}

const format = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const DeletionCountdown: React.FC<DeletionCountdownProps> = ({ createdAt, windowMs, variant = 'badge', className = '' }) => {
  const [remaining, setRemaining] = useState(() => createdAt ? windowMs - (Date.now() - new Date(createdAt).getTime()) : 0);

  useEffect(() => {
    if (!createdAt) return;
    const id = setInterval(() => {
      setRemaining(windowMs - (Date.now() - new Date(createdAt).getTime()));
    }, 1000);
    return () => clearInterval(id);
  }, [createdAt, windowMs]);

  if (!createdAt) return null;
  const expired = remaining <= 0;

  if (variant === 'inline') {
    return <span className={`text-[10px] font-mono ${expired ? 'text-red-400' : 'text-acid'} ${className}`}>{expired ? 'Expirado' : format(remaining)}</span>;
  }

  return (
    <div className={`px-2 py-1 rounded-full border text-[9px] font-mono uppercase tracking-widest ${expired ? 'border-red-500 text-red-400 bg-red-500/10' : 'border-acid/40 text-acid bg-acid/5'} ${className}`}
         title={expired ? 'Tiempo expirado' : 'Tiempo restante para borrar'}>
      {expired ? 'Expirado' : format(remaining)}
    </div>
  );
};

export default DeletionCountdown;
