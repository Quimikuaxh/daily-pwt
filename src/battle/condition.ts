/** `condition` del simulador: "183/183", "40/100 par" o "0 fnt". */
export const isFaintedCondition = (condition: string): boolean => /^0(\s|\/|$)/.test(condition.trim()) || /\bfnt\b/.test(condition)
