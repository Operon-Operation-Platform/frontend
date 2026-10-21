"use client";

import React from "react";

export default function OperonLogo({ size = 28, showWordmark = true, variant = "dark" }) {
  // The supplied brand asset is a complete lockup (symbol + wordmark).
  return (
    <div className="flex items-center select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Operon"
        width={Math.round(size * 1.29)}
        height={size}
        style={{ width: Math.round(size * 1.29), height: size }}
        className="shrink-0 object-contain"
      />
    </div>
  );
}
