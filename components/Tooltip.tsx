
import React, { useState } from 'react';

interface Props {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<Props> = ({ content, children, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-slate-800',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-slate-800',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-slate-800',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-slate-800',
  };

  return (
    <div 
      className="relative flex items-center" 
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${positionClasses[position]} px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg shadow-xl whitespace-nowrap z-50 animate-fade-in backdrop-blur-sm bg-opacity-90`}>
          {content}
          {/* Arrow */}
          <div className={`absolute border-4 border-transparent ${arrowClasses[position]}`}></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
