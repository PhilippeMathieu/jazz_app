// Icônes (traits de 2 px, 24 × 24).
const S = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

export const PlayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor" /></svg>
);
export const StopIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" /></svg>
);
export const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" {...S} stroke-width={2.2} /></svg>
);
export const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" {...S} /></svg>
);
export const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" {...S} /></svg>
);
export const MicIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" {...S} />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...S} />
  </svg>
);
/** Pupitre : une partition posée sur un support. */
export const StandIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="3" width="16" height="11" rx="1.5" {...S} />
    <path d="M8 7h8M8 10h5M12 14v7M8 21h8" {...S} />
  </svg>
);
export const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" {...S} />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...S} />
  </svg>
);
export const SlidersIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 4v16M12 4v16M19 4v16" {...S} />
    <circle cx="5" cy="14" r="2.2" {...S} fill="var(--bg)" />
    <circle cx="12" cy="8" r="2.2" {...S} fill="var(--bg)" />
    <circle cx="19" cy="15" r="2.2" {...S} fill="var(--bg)" />
  </svg>
);
