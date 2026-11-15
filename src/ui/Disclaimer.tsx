import { Icon } from "./Icon";
import { DISCLAIMER_COPY, type DisclaimerVariant } from "./disclaimerCopy";

/** Decision-support notice. Banner sits on every page; the strong variant is for clinical flows. */
export function Disclaimer({ variant = "banner", className }: { variant?: DisclaimerVariant; className?: string }) {
  return (
    <div className={`disclaimer disclaimer-${variant}${className ? ` ${className}` : ""}`} role="note">
      <Icon name={variant === "emergency" ? "shield" : "info"} size={18} />
      <p>{DISCLAIMER_COPY[variant]}</p>
    </div>
  );
}
