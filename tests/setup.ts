import "@testing-library/jest-dom/vitest";

// jsdom has no matchMedia; GSAP's matchMedia needs one. Report "no match" so animation code stays inert.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
