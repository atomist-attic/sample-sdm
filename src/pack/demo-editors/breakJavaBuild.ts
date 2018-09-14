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

import {
    CodeTransformRegistration,
    commitToMaster,
    Project,
} from "@atomist/sdm";

export const BadJavaFileName = "src/main/java/Bad.java";

export const BreakJavaBuildTransform: CodeTransformRegistration = {
    transform: breakBuild,
    name: "breakJavaBuild",
    transformPresentation: () => commitToMaster(`You asked me to break the build!`),
};

async function breakBuild(p: Project) {
    return p.addFile(BadJavaFileName, "this is not Java");
}

export const UnbreakJavaBuildEditor: CodeTransformRegistration = {
    transform: unbreakJavaBuild,
    name: "unbreakJavaBuild",
    transformPresentation: () => commitToMaster(`Trying to unbreak the build!`),
};

async function unbreakJavaBuild(p: Project) {
    return p.deleteFile(BadJavaFileName);
}
