// เพิ่ม matcher อย่าง toBeInTheDocument(), toHaveTextContent()
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
