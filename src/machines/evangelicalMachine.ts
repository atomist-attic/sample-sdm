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
    executeSendMessageToSlack,
    MessageGoal,
    not,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    tagRepo,
} from "@atomist/sdm-core";
import { AddCloudFoundryManifest } from "@atomist/sdm-pack-cloudfoundry/lib/handlers/addCloudFoundryManifest";
import { enableDeployOnCloudFoundryManifestAddition } from "@atomist/sdm-pack-cloudfoundry/lib/listeners/enableDeployOnCloudFoundryManifestAddition";
import {
    SuggestAddingCloudFoundryManifest,
    suggestAddingCloudFoundryManifestOnNewRepo,
} from "@atomist/sdm-pack-cloudfoundry/lib/listeners/suggestAddingCloudFoundryManifest";
import {
    HasSpringBootApplicationClass,
    IsMaven,
    MaterialChangeToJavaRepo,
    springBootTagger,
} from "@atomist/sdm-pack-spring";
import { DemoEditors } from "../pack/demo-editors/demoEditors";

export const ImmaterialChangeToJava = new MessageGoal("immaterialChangeToJava");
export const EnableSpringBoot = new MessageGoal("enableSpringBoot");

/**
 * Assemble a machine that suggests the potential to use more SDM features
 */
export function evangelicalMachine(
                                   configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine(
        {name: "Helpful software delivery machine. You need to be saved.", configuration},
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, not(MaterialChangeToJavaRepo))
            .itMeans("No material change to Java")
            .setGoals(ImmaterialChangeToJava),
        whenPushSatisfies(ToDefaultBranch, IsMaven, HasSpringBootApplicationClass)
            .itMeans("Spring Boot service to deploy")
            .setGoals(EnableSpringBoot),
    );

    // TODO check if we've sent the message before.
    // Could do in a PushTest
    sdm.addGoalImplementation("ImmaterialChangeToJava",
        ImmaterialChangeToJava,
        executeSendMessageToSlack("Looks like you didn't change Java in a material way. " +
            "Atomist could prevent you needing to build! :atomist_build_started:"))
        .addGoalImplementation("EnableSpringBoot",
            EnableSpringBoot,
            executeSendMessageToSlack("Congratulations. You're using Spring Boot. It's cool :sunglasses: and so is Atomist. " +
                "Atomist knows lots about Spring Boot and would love to help"))
        .addChannelLinkListener(SuggestAddingCloudFoundryManifest)
        .addNewRepoWithCodeAction(suggestAddingCloudFoundryManifestOnNewRepo(sdm.configuration.sdm.projectLoader))
        .addNewRepoWithCodeAction(
            // TODO suggest creating projects with generator
            tagRepo(springBootTagger),
        )
        .addCodeTransformCommand(AddCloudFoundryManifest)
        .addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addExtensionPacks(
            DemoEditors,
        )
        .addPushReaction(enableDeployOnCloudFoundryManifestAddition(sdm));

    // addTeamPolicies(sdm);
    return sdm;
}
