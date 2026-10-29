import { SummaryItem } from 'components';

export interface VehicleFormValues {
  year: string;
  make: string;
  model: string;
  vin: string;
  km: string;
  price: string;
  url: string;
  name: string;
  phone: string;
}

export interface VehicleFormResult {
  /** Inline message per field id (`v-year`, `v-make`, `v-model`, `v-vin`, `v-km`, `v-price`, `v-url`, `v-name`, `v-phone`). */
  errors: Record<string, string>;
  /** The summary entries, each linking to its field. */
  items: SummaryItem[];
  /** The values to send, present only when valid. */
  input?: {
    year: number;
    make: string;
    model: string;
    vin: string | null;
    odometerKm: number;
    askingPrice: number;
    listingUrl: string | null;
    sellerName: string;
    sellerPhone: string;
  };
}

const VIN_LETTERS = /^[A-HJ-NPR-Z0-9]{17}$/i;

/** The vehicle rules of ADR 0006 and ADR 0018 as the buyer meets them, with the messages of L2-023, L2-063 and L2-085. */
export function validateVehicle(v: VehicleFormValues): VehicleFormResult {
  const errors: Record<string, string> = {};
  const items: SummaryItem[] = [];
  const add = (id: string, summary: string, field = summary) => {
    errors[id] = field;
    items.push({ message: summary, fieldId: id });
  };

  const year = Number(v.year.trim());
  const nextYear = new Date().getFullYear() + 1;
  if (!v.year.trim() || !Number.isInteger(year) || year < 1900 || year > nextYear)
    add('v-year', 'Enter the year the car was made, from 1900 to next year.');
  const make = v.make.trim();
  if (!make || make.length > 50) add('v-make', 'Enter the make, like Honda.');
  const model = v.model.trim();
  if (!model || model.length > 50) add('v-model', 'Enter the model, like Civic.');

  // The VIN is optional (ADR 0018); when given it keeps the rules of L2-023.
  const vin = v.vin.trim();
  if (vin && vin.length !== 17)
    add(
      'v-vin',
      'Enter the full 17-character VIN.',
      `A VIN has 17 characters. This one has ${vin.length}.`,
    );
  else if (vin && !VIN_LETTERS.test(vin))
    add('v-vin', 'A VIN uses letters and digits, but never I, O or Q.');

  const km = Number(v.km.replace(/[\s,]/g, ''));
  if (!v.km.trim() || !Number.isInteger(km) || km < 0 || km > 1_500_000)
    add('v-km', 'Enter the odometer reading in kilometres, up to 1,500,000.');
  const price = Number(v.price.replace(/[\s,$]/g, ''));
  if (!v.price.trim() || Number.isNaN(price) || price < 0 || price > 1_000_000)
    add('v-price', 'Enter the asking price in dollars, up to 1,000,000.');
  const url = v.url.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url))
    add('v-url', 'Enter a link that starts with http:// or https://.');
  const name = v.name.trim();
  if (!name || name.length > 100) add('v-name', 'Enter the seller’s name, up to 100 characters.');
  const digits = v.phone.replace(/\D/g, '');
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))))
    add('v-phone', 'Enter the seller’s 10-digit phone number.', 'Enter a 10-digit phone number.');

  if (items.length) return { errors, items };
  return {
    errors,
    items,
    input: {
      year,
      make,
      model,
      vin: vin || null,
      odometerKm: km,
      askingPrice: price,
      listingUrl: url || null,
      sellerName: name,
      sellerPhone: v.phone.trim(),
    },
  };
}
