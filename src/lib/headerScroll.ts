export type HeaderScrollState = { anchor: number; previous: number; direction: number; visible: boolean };

export function advanceHeaderScroll(state: HeaderScrollState, position: number): HeaderScrollState {
  const y = Math.max(0, position);
  const direction = Math.sign(y - state.previous);
  const anchor = direction && direction !== state.direction ? state.previous : state.anchor;
  // Accumulate small events; one-pixel trackpad movements must not flicker the header.
  const visible = y <= 24 ? true : Math.abs(y - anchor) >= 8 ? direction < 0 : state.visible;
  return { anchor, previous: y, direction: direction || state.direction, visible };
}
