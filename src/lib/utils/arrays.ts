/**
 * Array Utility Functions
 */

/**
 * Randomly pick `count` items from an array using Fisher-Yates shuffle.
 * Returns a new array — never mutates the input.
 */
export function pickRandom<T>(arr: T[], count: number): T[] {
	if (arr.length <= count) return [...arr];
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.slice(0, count);
}
