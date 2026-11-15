import { seedIfNeeded } from "./seed";
import { startSyncLoop } from "./sync";

export async function initData(): Promise<void> {
  await seedIfNeeded();
  startSyncLoop();
}
