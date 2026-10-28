import { Inspection } from 'api';

/** "Maya Mechanic", "Bo Bodyshop" or "Maya Mechanic and Bo Bodyshop" for a combined call. */
export function providerNames(i: Pick<Inspection, 'mechanicName' | 'bodyShopName'>): string {
  return [i.mechanicName, i.bodyShopName].filter(Boolean).join(' and ');
}
