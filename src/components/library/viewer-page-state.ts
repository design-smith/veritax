"use client";

import { useState } from "react";

export interface ViewerPageState {
  page: number;
  totalPages: number;
  goNext: () => void;
  goPrev: () => void;
  goTo: (n: number) => void;
}

export function useViewerPageState(totalPages: number): ViewerPageState {
  const [page, setPage] = useState(1);

  function goNext() {
    setPage((p) => Math.min(p + 1, totalPages));
  }

  function goPrev() {
    setPage((p) => Math.max(p - 1, 1));
  }

  function goTo(n: number) {
    setPage(Math.max(1, Math.min(n, totalPages)));
  }

  return { page, totalPages, goNext, goPrev, goTo };
}
