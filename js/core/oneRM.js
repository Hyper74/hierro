// 1RM estimado con la fórmula de Epley:  1RM = peso × (1 + reps / 30)
// Convención: con 1 repetición el 1RM es el propio peso.
export function epley(weight, reps) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
