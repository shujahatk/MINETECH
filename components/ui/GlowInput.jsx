'use client';
import { useId } from 'react';

export default function GlowInput({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  name,
  required = false,
  error,
  helperText,
  ...props
}) {
  const generatedId = useId();
  const fieldId = props.id || generatedId;
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="block text-foreground text-xs font-semibold uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? fieldId + "-help" : undefined}
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full bg-card border ${
          error ? 'border-destructive/50 focus:border-destructive focus:ring-destructive/30' : 'border-border focus:border-primary focus:ring-primary/20'
        } focus:ring-2 rounded-xl px-4 py-2.5 text-foreground placeholder-muted-foreground text-sm focus:outline-none transition-colors duration-150`}
        {...props}
      />
      {error ? (
        <p id={fieldId + "-help"} className="text-xs text-destructive mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
