import type { EvaluateFunction, EvaluateRuleResult } from "../src/types";

const evaluatePrivatePublic: EvaluateFunction = ({
	frontmatter,
	tags,
	path,
	title,
}) => {
	const result: Required<EvaluateRuleResult> = {
		classNames: [],
		elements: [],
	};

	const publicPaths = ["public", "blog", "tests"];
	const publicTags = ["public"];
	const privateTitles = ["🔐"];

	const isPublic =
		tags.some((t) => publicTags.includes(t)) ||
		publicPaths.some((p) => path.includes(p)) ||
		frontmatter["publish"] === true ||
		(frontmatter["publish"] === "true" &&
			!privateTitles.some((t) => title.includes(t)));

	if (isPublic) {
		result.elements.push({
			className: "public",
			text: "public",
			style: {
				backgroundColor: "red",
			},
		});
	} else {
		result.elements.push({
			className: "private",
			text: "🔏",
			style: {
				backgroundColor: "lightgray",
			},
		});
	}

	return result;
};

const statuses = {
	todo: "rgb(64, 128, 255)",
	doing: "rgb(9, 158, 64)",
	pending: "rgb(128, 128, 128)",
	waiting: "rgb(255, 200, 64)",
	"in-continuing": "rgb(72, 146, 80)",
	"in-verifying": "rgb(72, 146, 80)",
};

const isStatus = (status: unknown): status is keyof typeof statuses => {
	if (typeof status !== "string") {
		return false;
	}
	return Object.keys(statuses).includes(status);
};

const evaluateTaskStatus: EvaluateFunction = ({ frontmatter }) => {
	const result: Required<EvaluateRuleResult> = {
		classNames: [],
		elements: [],
	};

	// ステータスの判定
	const status = frontmatter["status"];
	const isValidStatus = isStatus(status);

	if (isValidStatus) {
		result.elements.push({
			className: `status-badge status-${status}`,
			text: status.toUpperCase(),
			style: {
				backgroundColor: statuses[status],
			},
		});
	}

	// 期限の判定
	const deadline = frontmatter["deadline"];
	if (deadline && typeof deadline === "string") {
		const deadlineDate = new Date(deadline);
		const days = Math.floor(
			(deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);

		if (days < 0) {
			result.classNames.push("is-overdue");
			result.elements.push({
				text: "期限切れ",
				style: { backgroundColor: "red" },
			});
		} else if (days <= 7) {
			result.classNames.push("has-deadline");
			result.elements.push({
				text: `あと${days}日`,
				style: { backgroundColor: "orange" },
			});
		} else {
			result.elements.push({
				text: `< ${deadlineDate.toISOString().split("T")[0]}`, // yyyy-mm-dd
			});
		}
	}

	return result;
};

const main: EvaluateFunction = (metadata) => {
	const result: Required<EvaluateRuleResult> = {
		classNames: [],
		elements: [],
	};

	const funcs = [evaluatePrivatePublic, evaluateTaskStatus];

	funcs.forEach((func) => {
		const funcResult = func(metadata);
		result.classNames.push(...funcResult.classNames);
		result.elements.push(...(funcResult.elements ?? []));
	});

	return result;
};

export default main;
