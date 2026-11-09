type BackHandler = () => boolean | void;

const handlers: BackHandler[] = [];

/**
 * Register a handler for the Android hardware back button.
 * Handlers are executed in LIFO order (last registered is executed first).
 * If the handler returns true (or closes a modal), further back propagation stops.
 */
export const registerBackHandler = (handler: BackHandler) => {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  };
};

export const triggerBack = (): boolean => {
  for (let i = handlers.length - 1; i >= 0; i--) {
    const handler = handlers[i];
    if (!handler) continue;
    const handled = handler();
    if (handled !== false) {
      return true;
    }
  }
  return false;
};
