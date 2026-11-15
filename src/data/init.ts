import { endDemoData } from "./demoSession";
import { seedIfNeeded } from "./seed";
import { startSyncLoop } from "./sync";

let ready: Promise<void> | undefined;

/** Loads the data once. A demo cut short by a reload is wiped here, before anything reads the stores. */
export function initData(): Promise<void> {
  return (ready ??= (async () => {
    await endDemoData();
    await seedIfNeeded();
    startSyncLoop();
  })());
}
