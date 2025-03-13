/**
 * Fetches the `actualEff` value for basic drills given an operator's weighted asset equity.
 */
export const equityToActualEff = (equity: number): number => {
  const A = 22500; // Controls early exponential boost.
  const B = 0.00001; // Controls how fast the exponential growth slows down.
  const C = 42500; // Controls the logarithmic scaling.
  const D = 0.0002; // Controls logarithmic growth rate.

  return 500 + A * (1 - Math.exp(-B * equity)) + C * Math.log(1 + D * equity);
};

/**
 * Converts an operator's equity to their effMultiplier value.
 */
export const equityToEffMultiplier = (equity: number): number => {
  return 1 + Math.log(1 + 0.0000596 * equity);
};
