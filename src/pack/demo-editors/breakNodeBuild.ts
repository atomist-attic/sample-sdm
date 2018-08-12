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

import { CodeTransformRegistration, commitToMaster, Project } from "@atomist/sdm";

export const BadTypeScriptFileName = "src/Bad.ts";
export const BadJavaScriptFileName = "src/Bad.js";

export const BreakNodeBuildTransform: CodeTransformRegistration = {
    transform: breakBuild,
    name: "breakNodeBuild",
    transformPresentation: () => commitToMaster(`You asked me to break the build!`),
};

async function breakBuild(p: Project) {
    await p.addFile(BadJavaScriptFileName, "this is not JavaScript");
    return p.addFile(BadTypeScriptFileName, "this is not TypeScript");
}

export const UnbreakNodeBuildTransform: CodeTransformRegistration = {
    transform: unbreakNodeBuild,
    name: "unbreakNodeBuild",
    transformPresentation: () => commitToMaster(`Trying to unbreak the build!`),
};

async function unbreakNodeBuild(p: Project) {
    await p.deleteFile(BadTypeScriptFileName);
    return p;
}
