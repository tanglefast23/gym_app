'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Search } from 'lucide-react';
import type { Exercise } from '@/types/workout';

interface ExerciseAutocompleteProps {
  value: string;
  onChange: (name: string, exerciseId: string | null) => void;
  placeholder?: string;
}

/**
 * Autocomplete input for exercise names backed by the Dexie exercise library.
 *
 * As the user types, matching exercises are queried and shown in a dropdown.
 * Selecting a suggestion fills the input and passes the exercise id upstream.
 * If no match is selected, the exerciseId is passed as null (new exercise).
 */
export const ExerciseAutocomplete = ({
  value,
  onChange,
  placeholder = 'Exercise name',
}: ExerciseAutocompleteProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes into local query state
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const suggestions = useLiveQuery(
    () => {
      const trimmed = query.trim();
      if (trimmed.length === 0) return [];
      return db.exercises
        .where('name')
        .startsWithIgnoreCase(trimmed)
        .limit(8)
        .toArray();
    },
    [query],
    [],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setQuery(newValue);
      setIsOpen(true);
      onChange(newValue, null);
    },
    [onChange],
  );

  const handleSelect = useCallback(
    (exercise: Exercise) => {
      setQuery(exercise.name);
      setIsOpen(false);
      onChange(exercise.name, exercise.id);
    },
    [onChange],
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (query.trim().length > 0) {
      setIsOpen(true);
    }
  }, [query]);

  const handleBlur = useCallback(() => {
    // Delay closing to allow click events on suggestions to fire
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const showDropdown = isOpen && suggestions && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-elevated py-3 pl-10 pr-4 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          autoComplete="off"
        />
      </div>

      {showDropdown && (
        <ul className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-elevated shadow-lg">
          {suggestions.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-text-primary transition-colors hover:bg-surface active:bg-surface"
                onMouseDown={(e) => {
                  // Prevent blur from firing before click completes
                  e.preventDefault();
                }}
                onClick={() => handleSelect(exercise)}
              >
                {exercise.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
