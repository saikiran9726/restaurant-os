import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const PasswordField: React.FC<PasswordFieldProps> = ({
  label = 'Password',
  error,
  id = 'password',
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-caption font-semibold text-content-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          {...props}
          id={id}
          type={showPassword ? 'text' : 'password'}
          className={`w-full h-11 pl-3.5 pr-11 rounded-lg border bg-surface-elevated text-content-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            error ? 'border-danger focus-visible:ring-danger' : 'border-surface-border'
          } ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && <p className="text-xs text-danger font-medium">{error}</p>}
    </div>
  );
};
