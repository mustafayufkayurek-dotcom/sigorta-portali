'use client';

import { useEffect, useState, useCallback } from 'react';

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  loading?: boolean;
  className?: string;
  size?: 'md' | 'lg';
}

export function SearchInput({
  placeholder = 'Ara...',
  value,
  onChange,
  onClear,
  loading = false,
  className = '',
  size = 'md',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    onClear?.();
  }, [onChange, onClear]);

  const inputSizeClass =
    size === 'lg'
      ? 'rounded-xl py-3 pl-11 pr-11 text-[15px]'
      : 'rounded-lg py-2 pl-10 pr-10 text-sm';
  const iconSizeClass = size === 'lg' ? 'left-3.5 h-5 w-5' : 'left-3 h-4 w-4';

  return (
    <div className={`relative flex items-center ${className}`}>
      <svg
        className={`absolute text-gray-400 ${iconSizeClass}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={`w-full border border-gray-300 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputSizeClass}`}
      />
      {loading && (
        <div className="absolute right-8 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
      )}
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
