import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

it('renders React components in jsdom', () => {
  render(<p>สวัสดี</p>);

  expect(screen.getByText('สวัสดี')).toBeInTheDocument();
});
