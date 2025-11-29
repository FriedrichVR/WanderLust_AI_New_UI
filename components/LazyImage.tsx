
import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, AlertTriangle, ImageOff, Loader2 } from 'lucide-react';

const DEFAULT_PLACEHOLDER = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=60&w=800&auto=format&fit=crop';

// Helper to generate responsive srcSet for external images (Unsplash supports &w= param)
const generateSrcSet = (src: string): string => {
  if (!src) return '';
  // Check if it's an external URL that supports responsive params
  if (src.includes('unsplash.com') || src.includes('images.unsplash.com')) {
    // Already has URL params, append width params
    const separator = src.includes('?') ? '&' : '?';
    return `
      ${src}${separator}w=400&auto=format&fit=crop 400w,
      ${src}${separator}w=600&auto=format&fit=crop 600w,
      ${src}${separator}w=800&auto=format&fit=crop 800w,
      ${src}${separator}w=1200&auto=format&fit=crop 1200w
    `.trim();
  }
  // For base64 images (local), don't generate srcSet as they're already optimized
  return '';
};

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  sizes?: string; // CSS sizes property for responsive images
}

const LazyImage: React.FC<Props> = ({ src, alt, className, placeholder = DEFAULT_PLACEHOLDER, sizes = '100vw', ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    setCurrentSrc(src);
  }, [src]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setCurrentSrc(placeholder);
      setIsLoaded(true); 
    }
  };

  const srcSet = generateSrcSet(currentSrc);

  return (
    <div className={`relative w-full h-full overflow-hidden bg-panel ${className}`}>
      {/* Enhanced Loading Skeleton - Less obtrusive for blur effect */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" style={{ backgroundSize: '1000px 100%' }}></div>
        </div>
      )}

      {/* Actual Image with Blur-Up Transition */}
      <img
        {...props}
        src={currentSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
        className={`w-full h-full object-cover transition-all duration-700 ease-out ${
            isLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-lg scale-105'
        }`}
      />
      
      {/* Error State Overlay */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-panel border border-border p-4 text-center z-20 opacity-90">
           <ImageOff size={24} className="text-danger mb-2" />
           <span className="text-[10px] font-mono text-danger uppercase tracking-widest">Image Unavailable</span>
        </div>
      )}
    </div>
  );
};

export default LazyImage;
