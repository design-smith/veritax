import "@testing-library/jest-dom";

// Radix ScrollArea uses ResizeObserver — polyfill for JSDOM
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
