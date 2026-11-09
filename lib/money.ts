/** All amounts are integer cents. */
export type Cents = number;

/** $1,234.56 (same as the prototype's money()) */
export const money = (c: Cents) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
