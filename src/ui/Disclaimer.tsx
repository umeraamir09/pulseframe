/** Decision-support disclaimer. Emergency copy is for /assistant and the emergency flow. */
export function Disclaimer({ variant = "banner" }: { variant?: "banner" | "emergency" }) {
  const emergency = variant === "emergency";
  return (
    <div className={emergency ? "disclaimer emergency" : "disclaimer"} role="note">
      {emergency
        ? "Decision support only. This is not a diagnosis. Contact the flight surgeon. Simulated crew data."
        : "Decision support only. Not medical authority. Simulated crew data. Flight-surgeon review is required for treatment decisions."}
    </div>
  );
}
