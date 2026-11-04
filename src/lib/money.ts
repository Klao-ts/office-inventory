const baht = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 becomes "1,234.50 THB" */
export function formatBaht(value: number) {
  return `${baht.format(value)} THB`;
}