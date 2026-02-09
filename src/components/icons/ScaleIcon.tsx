'use client';

import type { SVGProps } from 'react';

/**
 * Minimal bathroom scale icon.
 * Uses currentColor so it inherits the surrounding text color.
 */
export function ScaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M7 4.5h10c1.4 0 2.5 1.1 2.5 2.5v12c0 1.4-1.1 2.5-2.5 2.5H7C5.6 21.5 4.5 20.4 4.5 19V7C4.5 5.6 5.6 4.5 7 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 9.2a4 4 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 9.2l1.7-1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 18.2h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

