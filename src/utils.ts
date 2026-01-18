export const splitByPosNeg = (
	arr: string[],
): { pos: string[]; neg: string[] } => {
	const positive = arr.flatMap((t) => (t.startsWith("!") ? [] : [t]));
	const negative = arr.flatMap((t) =>
		t.startsWith("!") ? t.replace(/^!/, "") : [],
	);

	return { pos: positive, neg: negative };
};

const isProduction = process.env.NODE_ENV === "production";

export const logging: typeof console.log = (...args) => {
	!isProduction && console.log(...args);
};
