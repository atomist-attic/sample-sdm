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
    executeVersioner,
    NodeProjectVersioner,
    PackageLockFingerprinter,
    SoftwareDeliveryMachine,
    tagRepo,
    tslintFix,
    VersionGoal,
} from "@atomist/sdm";
import { nodeTagger } from "@atomist/spring-automation/commands/tag/nodeTagger";
import { AddAtomistTypeScriptHeader } from "../../blueprint/code/autofix/addAtomistHeader";
import { AddBuildScript } from "../../blueprint/code/autofix/addBuildScript";
import { nodeGenerator } from "../../commands/generators/node/nodeGenerator";
import { CommonGeneratorConfig } from "../../machines/generatorConfig";
import { CommonTypeScriptErrors } from "../team/commonTypeScriptErrors";
import { DontImportOwnIndex } from "../team/dontImportOwnIndex";

/**
 * Add configuration common to Node SDMs, wherever they deploy
 * @param {SoftwareDeliveryMachine} sdm
 * @param options config options
 */
export function addNodeSupport(sdm: SoftwareDeliveryMachine) {
    sdm.addGenerators(() => nodeGenerator({
            ...CommonGeneratorConfig,
            seedRepo: "typescript-express-seed",
            intent: "create node",
        }))
        .addGenerators(() => nodeGenerator({
            ...CommonGeneratorConfig,
            seedRepo: "minimal-node-seed",
            intent: "create minimal node",
        }))
        .addNewRepoWithCodeActions(
            tagRepo(nodeTagger),
        )
        .addAutofixes(
            AddAtomistTypeScriptHeader,
            tslintFix,
            AddBuildScript,
        )
        .addReviewerRegistrations(
            CommonTypeScriptErrors,
            DontImportOwnIndex,
        )
        .addFingerprinterRegistrations(new PackageLockFingerprinter())
        .addGoalImplementation("nodeVersioner", VersionGoal,
            executeVersioner(sdm.opts.projectLoader, NodeProjectVersioner));

}
