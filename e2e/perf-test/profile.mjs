import { basename } from 'node:path';

const IDLE = '(idle)';

/** Non-idle samples in a CDP CPU profile: the work the page did, in ticks. */
export function countTicks(profile) {
  const idle = new Set(
    profile.nodes.filter((n) => n.callFrame.functionName === IDLE).map((n) => n.id),
  );
  return profile.samples.filter((id) => !idle.has(id)).length;
}

/** The functions with the most self ticks, as `name (file:line)` with their share of all ticks. */
export function topFunctions(profile, limit = 8) {
  const ticks = countTicks(profile);
  const byFrame = new Map();
  for (const node of profile.nodes) {
    const { functionName, url, lineNumber } = node.callFrame;
    if (functionName === IDLE || !node.hitCount) continue;
    const where = url ? ` (${basename(url.split('?')[0])}:${lineNumber + 1})` : '';
    const key = `${functionName || '(anonymous)'}${where}`;
    byFrame.set(key, (byFrame.get(key) ?? 0) + node.hitCount);
  }
  return [...byFrame]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, self]) => ({ name, self, share: ticks ? self / ticks : 0 }));
}
