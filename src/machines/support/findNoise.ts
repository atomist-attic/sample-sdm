/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ProjectFile } from "@atomist/automation-client";
import { gatherFromFiles } from "@atomist/automation-client/lib/project/util/projectUtils";
import {
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import * as _ from "lodash";

interface FileAndLineCount {
    file: ProjectFile;
    lines: number;
}

async function countLines(f: ProjectFile) {
    return (await f.getContent()).split("\n").length;
}

function isCiFile(pl: FileAndLineCount) {
    return pl.file.path.endsWith(".travis.yml") || (pl.file.path.includes("scripts/") && pl.file.path.endsWith(".sh"));
}

function actuallyDoesSomething(pl: FileAndLineCount) {
    return ["java", "go", "rb", "cs", "js", "py"].includes(pl.file.extension);
}

function show(usefulLines: number, noiseLines: number) {
    return `Lines of code: _${usefulLines}_, Lines of noise: _${noiseLines}_, ` +
        `Noise as % of code: **${(100 * noiseLines / usefulLines).toFixed(2)}**`;
}

export function findNoise(sdm: SoftwareDeliveryMachine) {
    sdm.addCodeInspectionCommand({
        name: "yamlFinder",
        intent: "find yaml",
        inspection: async (p, ci) => {
            const fileAndLineCount: FileAndLineCount[] =
                await gatherFromFiles(p, ["**/*.yml", "**/*.yaml"], async file => (
                    {
                        file,
                        lines: (await file.getContent()).split("\n").length,
                    }));
            const yamlLines = _.sum(fileAndLineCount.map(pl => pl.lines));
            await ci.addressChannels(`${p.id.repo} has ${yamlLines} lines of YAML`);
        },
    });

    sdm.addCodeInspectionCommand<{ usefulLines: number, noiseLines: number }>({
        name: "noiseFinder",
        intent: "find noise",
        projectTest: async p => !!(await p.getFile(".travis.yml")),
        inspection: async (p, ci) => {
            const fileAndLineCount: FileAndLineCount[] =
                await gatherFromFiles(p, ["**/*", "**/.*"],
                    async file => ({ file, lines: await countLines(file) }));
            const noiseLines = _.sum(fileAndLineCount.filter(isCiFile).map(pl => pl.lines));
            const usefulLines = _.sum(fileAndLineCount.filter(actuallyDoesSomething).map(pl => pl.lines));
            if (usefulLines > 0) {
                await ci.addressChannels(`\`${p.id.repo}\`: ${show(usefulLines, noiseLines)}`);
                return { usefulLines, noiseLines };
            }
        },
        onInspectionResults: async (results, ci) => {
            const usefulLines = _.sum(results.filter(r => !!r.result).map(r => r.result.usefulLines));
            const noiseLines = _.sum(results.filter(r => !!r.result).map(r => r.result.noiseLines));
            return ci.addressChannels(`Results across ${results.length} projects: ${show(usefulLines, noiseLines)}`);
        },
    });
}
