/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-check

import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from "url";

import { load } from "js-yaml";

const rootDir = fileURLToPath(new URL('.', import.meta.url));

/** @type {(...paths: string[]) => import('webpack').WebpackPluginInstance} */
function TransformYaml(...paths) {
    let needsToRerun = true;

    paths = paths.map(p => path.resolve(rootDir, p));

    return {
        apply(compiler) {
            const WATCH_RUN = 'TransformYaml.watchRun';
            compiler.hooks.watchRun.tap(WATCH_RUN, ({ modifiedFiles }) => {
                if (modifiedFiles) {
                    needsToRerun = paths.some(modifiedFiles.has.bind(modifiedFiles));
                }
            });

            const THIS_COMPILATION = 'TransformYaml.thisCompilation';
            compiler.hooks.thisCompilation.tap(THIS_COMPILATION, ({ fileDependencies }) => {
                paths.forEach(fileDependencies.add.bind(fileDependencies));
            });

            const AFTER_EMIT = 'TransformYaml.emit';
            compiler.hooks.afterEmit.tapPromise(AFTER_EMIT, async compilation => {
                const logger = compilation.getLogger(AFTER_EMIT);

                logger.log(`Needs to rerun? ${needsToRerun}`);

                if (!needsToRerun) {
                    return;
                }

                const outputDir = compilation.outputOptions.path;

                if (!outputDir) {
                    throw new Error('Output options path is not defined');
                }

                const outputPaths = paths.map(p => path.join(outputDir, path.basename(p).replace(/\.(yaml|yml)$/, '.json')));

                try {
                    const json = (await Promise.all(paths.map(p => fs.readFile(p, 'utf8')))).map(yaml => load(yaml));
                    await Promise.all(outputPaths.map((outPath, i) => fs.writeFile(outPath, JSON.stringify(json[i]), 'utf8')));
                } catch (e) {
                    console.error(e);
                }
            });
        }
    };
}

/** @type {(env: Record<PropertyKey, unknown>, argv: Record<PropertyKey, unknown>) => import('webpack').Configuration} */
export default (env, argv) => {
    const BUILD_VSCODE_NLS = env.BUILD_VSCODE_NLS === 'true';

    /** @type {import('webpack').RuleSetRule[]} */
    const rules = [
        {
            test: /\.ts$/,
            exclude: /node_modules/,
            use: [
                {
                    // configure TypeScript loader:
                    // * enable sources maps for end-to-end source maps
                    loader: 'ts-loader',
                    options: {
                        compilerOptions: {
                            sourceMap: true
                        }
                    }
                }
            ]
        },
        {
            test: /.node$/,
            loader: 'node-loader'
        }
    ];

    if (BUILD_VSCODE_NLS) {
        rules.unshift({
            loader: 'vscode-nls-dev/lib/webpack-loader',
            options: {
                base: rootDir
            }
        });
    }

    return {
        target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
        entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
        output: { // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
            path: path.resolve(rootDir, 'dist'),
            filename: 'main.js',
            libraryTarget: 'commonjs2',
            devtoolModuleFilenameTemplate: '../[resource-path]'
        },
        node: {
            __dirname: false
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        },
        resolve: { // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
            extensions: ['.ts', '.js'],
            alias: {
                '@cmt': path.resolve(rootDir, 'src')
            },
            mainFields: ['main', 'module']
        },
        module: { rules },
        optimization: {
            minimize: false
        },
        stats: {
            warnings: false
        },
        plugins: [TransformYaml('syntaxes/cmakeout.tmLanguage.yaml')]
    };
};
