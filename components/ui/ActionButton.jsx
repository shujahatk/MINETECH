'use client';

export default function ActionButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  className = '',
  icon,
  arrow = true,
  type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`h-9 px-4 bg-primary text-primary-foreground text-[13px] font-medium rounded-lg shadow-subtle hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 ${className}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        icon && <span>{icon}</span>
      )}
      <span>{children}</span>
      {!loading && arrow && <span className="text-base leading-none" aria-hidden="true">&rarr;</span>}
    </button>
  );
}
