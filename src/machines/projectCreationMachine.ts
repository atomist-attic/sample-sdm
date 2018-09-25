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
    GitHubRepoRef,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    tagRepo,
} from "@atomist/sdm-core";
import {
    NodeProjectCreationParametersDefinition,
    UpdatePackageJsonIdentification, UpdateReadmeTitle,
} from "@atomist/sdm-pack-node";
import {
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    springBootTagger,
    SpringProjectCreationParameterDefinitions,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";

/**
 * Assemble a machine that performs only project creation and tagging,
 * for Spring/Java and Node.
 * See generatorConfig.ts to customize generation defaults.
 * @return {SoftwareDeliveryMachine}
 */
export function projectCreationMachine(
    configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine({ name: "Project creation machine", configuration });
    sdm
        .addGeneratorCommand({
            name: "create-spring",
            intent: "create spring",
            parameters: SpringProjectCreationParameterDefinitions,
            startingPoint: new GitHubRepoRef("spring-team", "spring-rest-seed"),
            transform: [
                ReplaceReadmeTitle,
                SetAtomistTeamInApplicationYml,
                TransformSeedToCustomProject,
            ],
        })
        .addGeneratorCommand({
            name: "typescript-express-generator",
            parameters: NodeProjectCreationParametersDefinition,
            startingPoint: new GitHubRepoRef("spring-team", "typescript-express-seed"),
            intent: "create node",
            transform: [
                UpdatePackageJsonIdentification,
                UpdateReadmeTitle
            ],
        })
        .addGeneratorCommand({
            name: "minimal-node-generator",
            parameters: NodeProjectCreationParametersDefinition,
            startingPoint: new GitHubRepoRef("spring-team", "minimal-node-seed"),
            intent: "create minimal node",
            transform: [
                UpdatePackageJsonIdentification,
                UpdateReadmeTitle],
        })
        .addFirstPushListener(tagRepo(springBootTagger));
    return sdm;
}
