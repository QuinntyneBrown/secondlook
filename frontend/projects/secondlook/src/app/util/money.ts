/** "$300", or "$19.99" when the amount is not a whole number of dollars. */
export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

/** "$300 to $450", or a single amount when both ends are equal. */
export function dollarRange(minCents: number, maxCents: number): string {
  return minCents === maxCents ? dollars(minCents) : `${dollars(minCents)} to ${dollars(maxCents)}`;
}
