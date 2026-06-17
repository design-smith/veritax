"use client";

import { useState } from "react";

export interface AnchorNavigationState {
  activeAnchorId: string | null;
  activeIndex: number;
  total: number;
  goNext: () => void;
  goPrev: () => void;
  jumpTo: (anchorId: string) => void;
}

export function useAnchorNavigation(anchors: string[]): AnchorNavigationState {
  const [index, setIndex] = useState(0);

  if (anchors.length === 0) {
    return {
      activeAnchorId: null,
      activeIndex: -1,
      total: 0,
      goNext: () => {},
      goPrev: () => {},
      jumpTo: () => {},
    };
  }

  function goNext() {
    setIndex((i) => (i + 1) % anchors.length);
  }

  function goPrev() {
    setIndex((i) => (i - 1 + anchors.length) % anchors.length);
  }

  function jumpTo(anchorId: string) {
    const idx = anchors.indexOf(anchorId);
    if (idx >= 0) setIndex(idx);
  }

  return {
    activeAnchorId: anchors[index],
    activeIndex: index,
    total: anchors.length,
    goNext,
    goPrev,
    jumpTo,
  };
}
