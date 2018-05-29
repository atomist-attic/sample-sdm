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

import { Configuration } from "@atomist/automation-client";
import {
    AnyPush,
    ArtifactGoal,
    Goals,
    JustBuildGoal,
    LocalDeploymentGoal,
    not,
    onAnyPush,
    ProductionDeploymentGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
    PushReactionGoal,
    RepositoryDeletionGoals,
    ReviewGoal,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
    StagingDeploymentGoal,
    StagingEndpointGoal,
    StagingUndeploymentGoal,
    StagingVerifiedGoal,
    ToDefaultBranch,
    UndeployEverywhereGoals,
    whenPushSatisfies,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/blueprint/dsl/buildDsl";
import * as deploy from "@atomist/sdm/blueprint/dsl/deployDsl";
import { goalContributors } from "@atomist/sdm/blueprint/dsl/goalContribution";
import { createSoftwareDeliveryMachine } from "@atomist/sdm/blueprint/machineFactory";
import {
    deploymentFreeze,
    ExplainDeploymentFreezeGoal,
    isDeploymentFrozen,
} from "@atomist/sdm/capability/freeze/deploymentFreeze";
import { InMemoryDeploymentStatusManager } from "@atomist/sdm/capability/freeze/InMemoryDeploymentStatusManager";
import { MavenBuilder } from "@atomist/sdm/common/delivery/build/local/maven/MavenBuilder";
import { ManagedDeploymentTargeter } from "@atomist/sdm/common/delivery/deploy/local/ManagedDeployments";
import { IsMaven } from "@atomist/sdm/common/listener/support/pushtest/jvm/jvmPushTests";
import { HasCloudFoundryManifest } from "@atomist/sdm/common/listener/support/pushtest/pcf/cloudFoundryManifestPushTest";
import { createEphemeralProgressLog } from "@atomist/sdm/common/log/EphemeralProgressLog";
import { lookFor200OnEndpointRootGet } from "@atomist/sdm/common/verify/lookFor200OnEndpointRootGet";
import { isDeployEnabledCommand } from "@atomist/sdm/handlers/commands/DisplayDeployEnablement";
import { disableDeploy, enableDeploy } from "@atomist/sdm/handlers/commands/SetDeployEnablement";
import {
    cloudFoundryProductionDeploySpec,
    EnableDeployOnCloudFoundryManifestAddition,
} from "../../blueprint/deploy/cloudFoundryDeploy";
import { LocalExecutableJarDeployer } from "../../blueprint/deploy/localSpringBootDeployers";
import { SuggestAddingCloudFoundryManifest } from "../../blueprint/repo/suggestAddingCloudFoundryManifest";
import { addCloudFoundryManifest } from "../../commands/editors/pcf/addCloudFoundryManifest";
import { addDemoEditors } from "../../parts/demo/demoEditors";
import { addJavaSupport } from "../../parts/stacks/javaSupport";
import { addNodeSupport } from "../../parts/stacks/nodeSupport";
import { addSpringSupport } from "../../parts/stacks/springSupport";
import { addTeamPolicies } from "../../parts/team/teamPolicies";
import { HasSpringBootApplicationClass } from "../../pushtest/jvm/springPushTests";

const freezeStore = new InMemoryDeploymentStatusManager();

const IsDeploymentFrozen = isDeploymentFrozen(freezeStore);

/**
 * Variant of cloudFoundryMachine that uses additive, "contributor" style goal setting.
 * @return {SoftwareDeliveryMachine}
 */
export function additiveCloudFoundryMachine(options: SoftwareDeliveryMachineOptions,
                                            configuration: Configuration): SoftwareDeliveryMachine {
    const sdm = createSoftwareDeliveryMachine(
        "CloudFoundry software delivery machine",
        options,
        // Each contributor contributes goals. The infrastructure assembles them into a goal set.
        goalContributors(
            onAnyPush.setGoals(new Goals("Checks", ReviewGoal, PushReactionGoal)),
            whenPushSatisfies(IsDeploymentFrozen)
                .setGoals(ExplainDeploymentFreezeGoal),
            whenPushSatisfies(IsMaven)
                .setGoals(JustBuildGoal),
            whenPushSatisfies(HasSpringBootApplicationClass, not(ToDefaultBranch))
                .setGoals(LocalDeploymentGoal),
            whenPushSatisfies(HasCloudFoundryManifest, not(IsDeploymentFrozen))
                .setGoals([ArtifactGoal,
                    StagingDeploymentGoal,
                    StagingEndpointGoal,
                    StagingVerifiedGoal,
                    ProductionDeploymentGoal,
                    ProductionEndpointGoal]),
        ));

    sdm.addCapabilities(deploymentFreeze(freezeStore));

    sdm.addBuildRules(
        build.setDefault(new MavenBuilder(options.artifactStore,
            createEphemeralProgressLog, options.projectLoader)));

    sdm.addDeployRules(
        deploy.when(IsMaven)
            .deployTo(StagingDeploymentGoal, StagingEndpointGoal, StagingUndeploymentGoal)
            .using(
                {
                    deployer: LocalExecutableJarDeployer,
                    targeter: ManagedDeploymentTargeter,
                },
            ),
        deploy.when(IsMaven)
            .deployTo(ProductionDeploymentGoal, ProductionEndpointGoal, ProductionUndeploymentGoal)
            .using(cloudFoundryProductionDeploySpec(options)),
    );
    sdm.addDisposalRules(
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, HasCloudFoundryManifest)
            .itMeans("Java project to undeploy from PCF")
            .setGoals(UndeployEverywhereGoals),
        whenPushSatisfies(AnyPush)
            .itMeans("We can always delete the repo")
            .setGoals(RepositoryDeletionGoals));
    sdm.addChannelLinkListeners(SuggestAddingCloudFoundryManifest)
        .addSupportingCommands(
            () => addCloudFoundryManifest,
            enableDeploy,
            disableDeploy,
            isDeployEnabledCommand,
        )
        .addPushReactions(EnableDeployOnCloudFoundryManifestAddition)
        .addEndpointVerificationListeners(lookFor200OnEndpointRootGet());
    addJavaSupport(sdm, configuration);
    addSpringSupport(sdm);
    addNodeSupport(sdm);
    addTeamPolicies(sdm, configuration);
    addDemoEditors(sdm);
    // addDemoPolicies(sdm, configuration);

    return sdm;
}
