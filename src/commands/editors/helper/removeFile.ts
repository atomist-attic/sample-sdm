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

import { commitToMaster } from "@atomist/automation-client/lib/operations/edit/editModes";
import { CodeTransformRegistration } from "@atomist/sdm";

export interface RemoveFileParams {

    path: string;
}

export const RemoveFileEditor: CodeTransformRegistration<RemoveFileParams> = {
    transform: async (p, i) => p.deleteFile(i.parameters.path),
    name: "remove file",
    parameters: {
        path: {},
    },
    transformPresentation: ci => commitToMaster(`You asked me to remove file ${ci.parameters.path}!`),
};
