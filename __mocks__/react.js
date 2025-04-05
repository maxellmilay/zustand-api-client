// __mocks__/react.js
// Minimal mock to satisfy Zustand's React import checks in Jest
module.exports = {
  useRef: () => ({ current: null }),
  useEffect: () => {},
  useLayoutEffect: () => {},
  useCallback: (fn) => fn,
  // Add other React exports if Zustand requires them for type checking,
  // but keep them minimal.
}; 