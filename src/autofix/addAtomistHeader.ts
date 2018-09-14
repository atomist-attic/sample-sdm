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
    allSatisfied,
    AutofixRegistration,
    hasFileContaining,
    PushTest,
} from "@atomist/sdm";
import {IsTypeScript} from "@atomist/sdm-pack-node";
import {IsJava} from "@atomist/sdm-pack-spring";
import {
    AddHeaderParameters,
    addHeaderTransform,
} from "../commands/editors/license/addHeader";
import { LicenseFilename } from "./addLicenseFile";

export const AddAtomistJavaHeader: AutofixRegistration<AddHeaderParameters> = addAtomistHeader("Java header", "**/*.java", IsJava);

export const AddAtomistTypeScriptHeader: AutofixRegistration<AddHeaderParameters> = addAtomistHeader("TypeScript header", "**/*.ts", IsTypeScript);

export function addAtomistHeader(name: string, glob: string, pushTest: PushTest): AutofixRegistration<AddHeaderParameters> {
    const parametersInstance = new AddHeaderParameters();
    parametersInstance.glob = glob;
    // Stop it continually editing the barrel and graphql types
    parametersInstance.excludeGlob = "src/typings/types.ts,src/index.ts";
    return {
        name,
        pushTest: allSatisfied(pushTest, hasFileContaining(LicenseFilename, /Apache License/)),
        // Ignored any parameters passed in, which will be undefined in an autofix, and provide predefined parameters
        transform: addHeaderTransform,
        parametersInstance,
    };
}
