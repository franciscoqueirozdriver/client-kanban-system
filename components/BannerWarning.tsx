'use client';
import React from 'react';

export interface BannerWarningProps {
  title: string;
  message?: string; // <-- novo, opcional
  children?: React.ReactNode;
}

export default function BannerWarning({
  title,
  message,
  children,
}: BannerWarningProps) {
  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
      <div className="font-medium">{title}</div>
      {message && <div className="text-sm mt-1">{message}</div>}
      {children}
    </div>
  );
}
