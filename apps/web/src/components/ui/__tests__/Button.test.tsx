// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button, IconButton } from '../Button.js';

describe('Button Component', () => {
  it('renders button with label', () => {
    render(<Button>Submit Order</Button>);
    const btn = screen.getByRole('button', { name: /submit order/i });
    expect(btn).toBeInTheDocument();
  });

  it('handles click events when enabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    fireEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button and displays loading spinner when isLoading is true', () => {
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Saving
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders different sizes with min-height touch targets', () => {
    const { rerender } = render(<Button size="lg">Large Touch</Button>);
    let btn = screen.getByRole('button');
    expect(btn.className).toContain('min-h-[48px]');

    rerender(<Button size="xl">Kitchen Touch</Button>);
    btn = screen.getByRole('button');
    expect(btn.className).toContain('min-h-[56px]');
  });
});

describe('IconButton Component', () => {
  it('renders with required aria-label for accessibility', () => {
    render(
      <IconButton aria-label="Delete table">
        <span>×</span>
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: /delete table/i });
    expect(btn).toBeInTheDocument();
  });
});
