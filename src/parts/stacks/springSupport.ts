/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
} from "@atomist/sdm";
import * as deploy from "@atomist/sdm/blueprint/dsl/deployDsl";
import { ManagedDeploymentTargeter } from "@atomist/sdm/common/delivery/deploy/local/appManagement";
import {
    LocalDeploymentGoal,
    LocalEndpointGoal,
    LocalUndeploymentGoal,
} from "@atomist/sdm/common/delivery/goals/common/commonGoals";
import { IsMaven } from "@atomist/sdm/common/listener/support/pushtest/jvm/jvmPushTests";
import { tagRepo } from "@atomist/sdm/common/listener/support/tagRepo";
import { listLocalDeploys } from "@atomist/sdm/handlers/commands/listLocalDeploys";
import { springBootTagger } from "@atomist/spring-automation/commands/tag/springTagger";
import { FileIoImportReviewer } from "../../blueprint/code/review/java/fileIoImportReviewer";
import { ImportDotStarReviewer } from "../../blueprint/code/review/java/importDotStarReviewer";
import { ProvidedDependencyReviewer } from "../../blueprint/code/review/java/maven/providedDependencyReviewer";
import { HardCodedPropertyReviewer } from "../../blueprint/code/review/java/spring/hardcodedPropertyReviewer";
import { mavenSourceDeployer } from "../../blueprint/deploy/localSpringBootDeployers";
import { tryToUpgradeSpringBootVersion } from "../../commands/editors/spring/tryToUpgradeSpringBootVersion";
import { springBootGenerator } from "../../commands/generators/java/spring/springBootGenerator";
import { CommonJavaGeneratorConfig } from "../../machines/generatorConfig";

/**
 * Configuration common to Spring SDMs, wherever they deploy
 * @param {SoftwareDeliveryMachine} softwareDeliveryMachine
 * @param {{useCheckstyle: boolean}} options
 */
export function addSpringSupport(softwareDeliveryMachine: SoftwareDeliveryMachine, options: SoftwareDeliveryMachineOptions) {
    softwareDeliveryMachine
        .addDeployRules(
            deploy.when(IsMaven)
                .itMeans("Maven local deploy")
                .deployTo(LocalDeploymentGoal, LocalEndpointGoal, LocalUndeploymentGoal)
                .using(
                    {
                        deployer: mavenSourceDeployer(options.projectLoader),
                        targeter: ManagedDeploymentTargeter,
                    },
                ))
        .addSupportingCommands(listLocalDeploys)
        .addEditors(
            () => tryToUpgradeSpringBootVersion,
        )
        .addGenerators(() => springBootGenerator({
            ...CommonJavaGeneratorConfig,
            seedRepo: "spring-rest-seed",
            intent: "create spring",
        }))
        .addGenerators(() => springBootGenerator({
            ...CommonJavaGeneratorConfig,
            seedOwner: "johnsonr",
            seedRepo: "flux-flix-service",
            intent: "create spring kotlin",
        }))
        .addNewRepoWithCodeActions(
            tagRepo(springBootTagger),
        );
    addCloudReadinessChecks(softwareDeliveryMachine);
}

function addCloudReadinessChecks(softwareDeliveryMachine: SoftwareDeliveryMachine) {
    softwareDeliveryMachine.addReviewerRegistrations(
        HardCodedPropertyReviewer,
        ProvidedDependencyReviewer,
        FileIoImportReviewer,
        ImportDotStarReviewer,
    );
}
