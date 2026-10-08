// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VegMark } from '../VegMark.js';

describe('VegMark Component', () => {
  it('renders Vegetarian mark with accessible aria-label and green theme', () => {
    render(<VegMark type="veg" />);
    const mark = screen.getByRole('img', { name: /vegetarian/i });
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveAttribute('title', 'Vegetarian');
    expect(mark.className).toContain('border-veg');
  });

  it('renders Non-Vegetarian mark with distinct shape for colorblind accessibility', () => {
    const { container } = render(<VegMark type="nonveg" />);
    const mark = screen.getByRole('img', { name: /non-vegetarian/i });
    expect(mark).toBeInTheDocument();
    expect(mark).toHaveAttribute('title', 'Non-Vegetarian');
    expect(mark.className).toContain('border-nonveg');

    // Distinct SVG triangle polygon shape instead of plain circular dot
    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
  });
});
