import React from 'react';

function IconBase({ children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MenuIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  );
}

export function SunIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5" />
      <path d="M12 19.5V22" />
      <path d="M4.22 4.22l1.76 1.76" />
      <path d="M18.02 17.98l1.76 1.76" />
      <path d="M2 12h2.5" />
      <path d="M19.5 12H22" />
      <path d="M4.22 19.78l1.76-1.76" />
      <path d="M18.02 6.02l1.76-1.76" />
    </IconBase>
  );
}

export function MoonIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </IconBase>
  );
}

export function GaugeCircleIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12l4.5-2.5" />
      <path d="M7 16.5h10" />
    </IconBase>
  );
}

export function BarChartIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 20h16" />
      <rect x="6" y="10" width="3" height="6" rx="1" />
      <rect x="11" y="6" width="3" height="10" rx="1" />
      <rect x="16" y="12" width="3" height="4" rx="1" />
    </IconBase>
  );
}

export function BuildingIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M5 21V5.5a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 1.5 1.5V21" />
      <path d="M3 21h18" />
      <path d="M9 21v-4h6v4" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </IconBase>
  );
}

export function DollarCircleIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 8.75a2.25 2.25 0 0 0-2.25-2.25H11a2.25 2.25 0 0 0 0 4.5h2a2.25 2.25 0 1 1 0 4.5H9.5" />
      <path d="M12 5v14" />
    </IconBase>
  );
}

export function PanelsIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5.5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="12.5" width="7" height="8" rx="1.5" />
    </IconBase>
  );
}

export function SettingsIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M4.75 13.5a7.64 7.64 0 0 1 0-3l2.02-.38a1 1 0 0 0 .76-.64l.6-1.83a7.7 7.7 0 0 1 2.6-1.5l1.02 1.77a1 1 0 0 0 .86.5h1.98a1 1 0 0 0 .86-.5l1.02-1.77a7.7 7.7 0 0 1 2.6 1.5l.6 1.83a1 1 0 0 0 .76.64l2.02.38a7.64 7.64 0 0 1 0 3l-2.02.38a1 1 0 0 0-.76.64l-.6 1.83a7.7 7.7 0 0 1-2.6 1.5l-1.02-1.77a1 1 0 0 0-.86-.5h-1.98a1 1 0 0 0-.86.5l-1.02 1.77a7.7 7.7 0 0 1-2.6-1.5l-.6-1.83a1 1 0 0 0-.76-.64Z" />
    </IconBase>
  );
}

export function UsersIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M16 7.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" />
    </IconBase>
  );
}
