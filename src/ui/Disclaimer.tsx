type DisclaimerVariant = "banner" | "emergency";

const COPY: Record<DisclaimerVariant, string> = {
  banner:
    "Decision support only. Not medical authority. Simulated crew data. Flight-surgeon review is required for treatment decisions.",
  emergency:
    "Decision support only. This is not a diagnosis. Contact the flight surgeon. Simulated crew data.",
};

/** Decision-support notice. Banner stays with the shell; emergency is for clinical flows. */
export function Disclaimer({ variant = "banner" }: { variant?: DisclaimerVariant }) {
  return (
    <div className={`disclaimer disclaimer-${variant}`} role="note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 8h.01" strokeLinecap="round" />
      </svg>
      <p>{COPY[variant]}</p>
    </div>
  );
}
