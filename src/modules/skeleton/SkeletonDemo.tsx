import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SkeletonRegionId } from "../../contracts";
import { SkeletonView } from "./SkeletonView";
import { isSkeletonRegionId, toggleRegion } from "./regions";

/**
 * Standalone wrapper with local selection state until the emergency intake (issue 4) owns it.
 * For manual checks: `?flagged=chest,leftArm` marks regions as flagged, `?readOnly=1` locks it.
 */
export function SkeletonDemo() {
  const [selected, setSelected] = useState<SkeletonRegionId[]>([]);
  const [params] = useSearchParams();
  const flagged = (params.get("flagged") ?? "").split(",").filter(isSkeletonRegionId);
  const readOnly = params.get("readOnly") === "1";

  const handleToggle = (id: SkeletonRegionId) => {
    console.log(`onToggle("${id}")`);
    setSelected((current) => toggleRegion(current, id));
  };

  return <SkeletonView selected={selected} onToggle={handleToggle} flagged={flagged} readOnly={readOnly} />;
}
