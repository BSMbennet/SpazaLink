// One icon style for the whole app: 24px grid, 2px rounded strokes, inline so nothing is downloaded.
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 4 4',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  shop: 'M4 10v10h16V10M3 10l2-6h14l2 6H3Zm7 10v-6h4v6',
  check: 'm5 12 5 5 9-10',
} as const;

export function Icon({ name }: { name: keyof typeof PATHS }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={PATHS[name]} /></svg>;
}
