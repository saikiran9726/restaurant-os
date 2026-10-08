// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusPill, type OrderStatus } from '../StatusPill.js';

describe('StatusPill Component', () => {
  const statuses: OrderStatus[] = ['new', 'preparing', 'ready', 'late', 'overdue'];

  it.each(statuses)('renders status "%s" with icon and text', (status) => {
    render(<StatusPill status={status} />);
    const pill = screen.getByRole('status');
    expect(pill).toBeInTheDocument();
    expect(pill.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('renders custom label when provided', () => {
    render(<StatusPill status="preparing" label="Simmering on Stove" />);
    expect(screen.getByText('Simmering on Stove')).toBeInTheDocument();
  });
});
