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

import { SoftwareDeliveryMachine } from "@atomist/sdm";
import { AffirmationEditor } from "../../commands/editors/demo/affirmationEditor";
import { BreakJavaBuildEditor, UnbreakJavaBuildEditor } from "../../commands/editors/demo/breakJavaBuild";
import {
    BreakNodeBuildEditor,
    UnbreakNodeBuildEditor,
} from "../../commands/editors/demo/breakNodeBuild";
import { JavaAffirmationEditor } from "../../commands/editors/demo/javaAffirmationEditor";
import { WhackHeaderEditor } from "../../commands/editors/demo/removeTypeScriptHeader";
import { RemoveFileEditor } from "../../commands/editors/helper/removeFile";

/**
 * Editors for use in demos
 * @param {SoftwareDeliveryMachine} softwareDeliveryMachine
 */
export function addDemoEditors(softwareDeliveryMachine: SoftwareDeliveryMachine) {
    softwareDeliveryMachine
        .addEditors(
            BreakNodeBuildEditor,
            UnbreakNodeBuildEditor,
            WhackHeaderEditor,
            JavaAffirmationEditor,
            AffirmationEditor,
            BreakJavaBuildEditor,
            RemoveFileEditor,
            UnbreakJavaBuildEditor,
        );
}
