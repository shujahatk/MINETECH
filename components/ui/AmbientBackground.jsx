'use client';

// Plain page surface (the decorative blurred glows were removed as part of the enterprise UI pass).
export default function AmbientBackground({ children, className = '' }) {
  return <div className={`min-h-screen bg-background text-foreground ${className}`}>{children}</div>;
}
