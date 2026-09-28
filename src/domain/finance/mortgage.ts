/**
 * Mortgage mathematics. All amounts are integer cents; rates are annual
 * percentages (6.375 means 6.375%). Results are rounded to the cent.
 */

export function monthlyPaymentCents(principalCents: number, annualRatePercent: number, termMonths: number): number {
  if (principalCents <= 0 || termMonths <= 0) return 0;
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return Math.round(principalCents / termMonths);
  const factor = Math.pow(1 + r, termMonths);
  return Math.round((principalCents * r * factor) / (factor - 1));
}

/** Outstanding principal after `monthsPaid` scheduled payments. */
export function remainingBalanceCents(
  principalCents: number,
  annualRatePercent: number,
  termMonths: number,
  monthsPaid: number,
): number {
  const r = annualRatePercent / 100 / 12;
  const n = Math.min(Math.max(monthsPaid, 0), termMonths);
  if (r === 0) return Math.max(0, Math.round(principalCents - (principalCents / termMonths) * n));
  const payment = monthlyPaymentCents(principalCents, annualRatePercent, termMonths);
  const growth = Math.pow(1 + r, n);
  return Math.max(0, Math.round(principalCents * growth - payment * ((growth - 1) / r)));
}

export function totalInterestCents(principalCents: number, annualRatePercent: number, termMonths: number): number {
  return monthlyPaymentCents(principalCents, annualRatePercent, termMonths) * termMonths - principalCents;
}

/** Interest paid during the first `months` payments. */
export function interestPaidCents(
  principalCents: number,
  annualRatePercent: number,
  termMonths: number,
  months: number,
): number {
  const payment = monthlyPaymentCents(principalCents, annualRatePercent, termMonths);
  const n = Math.min(months, termMonths);
  const principalPaid = principalCents - remainingBalanceCents(principalCents, annualRatePercent, termMonths, n);
  return payment * n - principalPaid;
}

export interface AdjustableRateInput {
  principalCents: number;
  initialRatePercent: number;
  termMonths: number;
  initialFixedMonths: number;
  adjustedRatePercent: number;
}

/** Payment after the first reset of an ARM, re-amortized over the remaining term. */
export function adjustedPaymentCents(input: AdjustableRateInput): number {
  const balance = remainingBalanceCents(
    input.principalCents,
    input.initialRatePercent,
    input.termMonths,
    input.initialFixedMonths,
  );
  return monthlyPaymentCents(balance, input.adjustedRatePercent, input.termMonths - input.initialFixedMonths);
}

/** Conventional private mortgage insurance estimate; applies when LTV exceeds 80%. */
export function estimatedMonthlyPmiCents(loanCents: number, ltvPercent: number, annualPmiRatePercent = 0.5): number {
  if (ltvPercent <= 80) return 0;
  return Math.round((loanCents * (annualPmiRatePercent / 100)) / 12);
}

export function loanToValuePercent(loanCents: number, valueCents: number): number {
  if (valueCents <= 0) return 0;
  return Math.round((loanCents / valueCents) * 10000) / 100;
}

export interface LoanSimulationInput {
  principalCents: number;
  termMonths: number;
  horizonMonths: number;
  /** Annual rate in effect for a given month (1-based). Payment re-amortizes when the rate changes. */
  rateForMonth: (month: number) => number;
  /** Property value used for PMI termination (78% LTV of original value). */
  propertyValueCents: number;
  annualPmiRatePercent?: number;
}

export interface LoanSimulationResult {
  interestPaidCents: number;
  principalPaidCents: number;
  pmiPaidCents: number;
  balanceCents: number;
  firstPaymentCents: number;
  paymentAfterFirstResetCents: number | null;
}

/** Month-by-month amortization supporting rate resets and PMI termination. */
export function simulateLoan(input: LoanSimulationInput): LoanSimulationResult {
  let balance = input.principalCents;
  let rate = input.rateForMonth(1);
  let payment = monthlyPaymentCents(balance, rate, input.termMonths);
  const firstPayment = payment;
  let resetPayment: number | null = null;
  let interestPaid = 0;
  let principalPaid = 0;
  let pmiPaid = 0;
  const months = Math.min(input.horizonMonths, input.termMonths);
  const pmiMonthly = Math.round((input.principalCents * ((input.annualPmiRatePercent ?? 0.5) / 100)) / 12);
  const pmiApplies = input.propertyValueCents > 0 && input.principalCents / input.propertyValueCents > 0.8;

  for (let m = 1; m <= months && balance > 0; m++) {
    const monthRate = input.rateForMonth(m);
    if (monthRate !== rate) {
      rate = monthRate;
      payment = monthlyPaymentCents(balance, rate, input.termMonths - m + 1);
      if (resetPayment === null) resetPayment = payment;
    }
    const interest = Math.round(balance * (rate / 100 / 12));
    const principal = Math.min(balance, payment - interest);
    if (pmiApplies && balance / input.propertyValueCents > 0.78) pmiPaid += pmiMonthly;
    interestPaid += interest;
    principalPaid += principal;
    balance -= principal;
  }

  return {
    interestPaidCents: interestPaid,
    principalPaidCents: principalPaid,
    pmiPaidCents: pmiPaid,
    balanceCents: balance,
    firstPaymentCents: firstPayment,
    paymentAfterFirstResetCents: resetPayment,
  };
}
