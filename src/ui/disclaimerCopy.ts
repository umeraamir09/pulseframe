export type DisclaimerVariant = "banner" | "emergency";

export const DISCLAIMER_COPY: Record<DisclaimerVariant, string> = {
  banner: "Decision support only. Not medical authority. Simulated crew data.",
  emergency: "Decision support only. This is not a diagnosis. Contact the flight surgeon.",
};
