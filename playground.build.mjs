import esbuild from "esbuild";
import globPkg from "glob";
import fs from "fs/promises";
const { glob } = globPkg;

const isWatch = process.argv.includes("--watch");

async function build() {
	const files = await new Promise((resolve, reject) => {
		glob("playground/*.ts", (err, matches) => {
			if (err) reject(err);
			else resolve(matches);
		});
	});

	for (const file of files) {
		const outfile = file.replace(/\.ts$/, ".js");

		// 後処理を行うプラグイン
		const postProcessPlugin = {
			name: "post-process",
			setup(build) {
				build.onEnd(async () => {
					try {
						// ビルド後のファイルを読み込む
						let content = await fs.readFile(outfile, "utf-8");

						// 1. sourcemapコメントを一時退避（または削除）
						content = content.replace(/\/\/# sourceMappingURL=.*/g, "");

						// 2. export defaultの変数を特定
						// esbuildのESM出力は通常 `var file_default = ...; export { file_default as default };` の形
						let returnVar = "";
						const exportMatch = content.match(
							/export\s*\{\s*(\w+)\s+as\s+default\s*\};?/,
						);
						if (exportMatch) {
							returnVar = exportMatch[1];
							content = content.replace(/export\s*\{[^}]*as\s+default[^}]*\};?/g, "");
						} else {
							// `export default func;` の単純な形の場合
							const simpleExport = content.match(/export\s+default\s+(\w+);?/);
							if (simpleExport) {
								returnVar = simpleExport[1];
								content = content.replace(/export\s+default\s+\w+;?/g, "");
							}
						}

						// 特定した変数を最後にreturnする
						if (returnVar) {
							content += `\nreturn ${returnVar};`;
						}

						// 不要な var xxx_default = ... 行があれば削除（必須ではないが綺麗にするなら）
						// ただし副作用があるかもしれないので、代入自体は残しておいてよい

						// 3. 全体を即時実行関数で囲む
						if (!content.trim().startsWith("(function()")) {
							content = `(function() {\n${content}\n})()`;
						}

						await fs.writeFile(outfile, content, "utf-8");
						console.log(`Processed: ${outfile}`);
					} catch (e) {
						console.error(`Post-process failed for ${outfile}:`, e);
					}
				});
			},
		};

		const ctx = await esbuild.context({
			entryPoints: [file],
			bundle: true,
			outfile: outfile,
			format: "esm", // ESM形式で出力して解析しやすくする
			target: "es6",
			platform: "browser",
			sourcemap: "inline", // インラインに変更して管理しやすくする
			external: [],
			plugins: [postProcessPlugin],
		});

		if (isWatch) {
			await ctx.watch();
			console.log(`Watching: ${file}`);
		} else {
			await ctx.rebuild();
			await ctx.dispose();
		}
	}

	if (isWatch) {
		console.log("Watch mode enabled. Press Ctrl+C to stop.");
	}
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
