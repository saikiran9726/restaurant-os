// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimerBadge, formatSecondsToMMSS } from '../TimerBadge.js';

describe('TimerBadge Component', () => {
  describe('formatSecondsToMMSS helper', () => {
    it('formats seconds into mm:ss accurately', () => {
      expect(formatSecondsToMMSS(0)).toBe('00:00');
      expect(formatSecondsToMMSS(45)).toBe('00:45');
      expect(formatSecondsToMMSS(185)).toBe('03:05');
      expect(formatSecondsToMMSS(3600)).toBe('60:00');
    });

    it('formats negative seconds', () => {
      expect(formatSecondsToMMSS(-65)).toBe('-01:05');
    });
  });

  it('renders timer badge with accessible role and formatted time', () => {
    render(<TimerBadge seconds={245} state="warning" />);
    const timer = screen.getByRole('timer');
    expect(timer).toBeInTheDocument();
    expect(timer.textContent).toContain('04:05');
    expect(timer.className).toContain('text-amber-500');
  });

  it('renders overdue state with high-contrast alert styling', () => {
    render(<TimerBadge seconds={1200} state="overdue" />);
    const timer = screen.getByRole('timer');
    expect(timer.className).toContain('text-red-500');
    expect(timer.className).toContain('animate-pulse');
  });
});
