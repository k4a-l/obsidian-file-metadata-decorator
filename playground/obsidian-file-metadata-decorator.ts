import z from "zod";
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
		!privateTitles.some((t) => title.includes(t)) ||
		frontmatter["publish"] === true ||
		frontmatter["publish"] === "true";

	if (isPublic) {
		result.classNames.push("public");
	}

	return result;
};

const evaluateTaskStatus: EvaluateFunction = ({ frontmatter }) => {
	const result: Required<EvaluateRuleResult> = {
		classNames: [],
		elements: [],
	};

	// ステータスの判定
	const status = frontmatter["status"];
	const statusParsed = z
		.enum([
			"todo",
			"doing",
			"pending",
			"waiting",
			"in-continuing",
			"in-verifying",
		])
		.safeParse(status);

	if (statusParsed.success) {
		result.elements.push({
			className: `status-badge status-${statusParsed.data}`,
			text: statusParsed.data.toUpperCase(),
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
