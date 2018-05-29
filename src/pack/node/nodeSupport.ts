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

import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { ExtensionPack, PackageLockFingerprinter, SoftwareDeliveryMachine, tagRepo, tslintFix } from "@atomist/sdm";
import { nodeTagger } from "@atomist/spring-automation/commands/tag/nodeTagger";
import { AddAtomistTypeScriptHeader } from "../../blueprint/code/autofix/addAtomistHeader";
import { AddBuildScript } from "../../blueprint/code/autofix/addBuildScript";
import { CommonGeneratorConfig } from "../../machines/generatorConfig";
import { CommonTypeScriptErrors } from "../../parts/team/commonTypeScriptErrors";
import { DontImportOwnIndex } from "../../parts/team/dontImportOwnIndex";
import { nodeGenerator } from "./generators/nodeGenerator";

/**
 * Add configuration common to Node SDMs, wherever they deploy
 * @param {SoftwareDeliveryMachine} sdm
 * @param options config options
 */
export const NodeSupport: ExtensionPack = {
    name: "Node support",
    configure: (sdm: SoftwareDeliveryMachine) => {
        sdm.addGenerators(() => nodeGenerator({
            ...CommonGeneratorConfig,
            seed: new GitHubRepoRef("spring-team", "typescript-express-seed"),
            intent: "create node",
        }))
            .addGenerators(() => nodeGenerator({
                ...CommonGeneratorConfig,
                seed: new GitHubRepoRef("spring-team", "minimal-node-seed"),
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
            .addFingerprinterRegistrations(new PackageLockFingerprinter());
    },
};
