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
    hasFile,
    JustBuildGoal,
    LocalDeploymentGoal,
    nodeBuilder,
    not, onAnyPush,
    ProductionDeploymentGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
    RepositoryDeletionGoals, ReviewGoal,
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

import { leinBuilder } from "@atomist/sdm/common/delivery/build/local/lein/leinBuilder";
import { MavenBuilder } from "@atomist/sdm/common/delivery/build/local/maven/MavenBuilder";
import { npmCustomBuilder } from "@atomist/sdm/common/delivery/build/local/npm/NpmDetectBuildMapping";
import { ManagedDeploymentTargeter } from "@atomist/sdm/common/delivery/deploy/local/ManagedDeployments";
import { IsLein, IsMaven } from "@atomist/sdm/common/listener/support/pushtest/jvm/jvmPushTests";
import { HasAtomistBuildFile, IsNode } from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { HasCloudFoundryManifest } from "@atomist/sdm/common/listener/support/pushtest/pcf/cloudFoundryManifestPushTest";
import { createEphemeralProgressLog } from "@atomist/sdm/common/log/EphemeralProgressLog";
import { lookFor200OnEndpointRootGet } from "@atomist/sdm/common/verify/lookFor200OnEndpointRootGet";
import { isDeployEnabledCommand } from "@atomist/sdm/handlers/commands/DisplayDeployEnablement";
import { disableDeploy, enableDeploy } from "@atomist/sdm/handlers/commands/SetDeployEnablement";
import { goalContributors, whenPush } from "../../blueprint/AdditiveGoalSetter";
import {
    cloudFoundryProductionDeploySpec,
    cloudFoundryStagingDeploySpec,
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

/**
 * Variant of cloudFoundryMachine that uses additive, "contributor" style goal setting.
 * @return {SoftwareDeliveryMachine}
 */
export function additiveCloudFoundryMachine(options: SoftwareDeliveryMachineOptions,
                                            configuration: Configuration): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        "CloudFoundry software delivery machine",
        options,
        // Each contributor contributors goals. The infrastructure will assemble them into a goal set.
        goalContributors(
            onAnyPush.setGoals(ReviewGoal),
            whenPush(IsMaven).set(JustBuildGoal),
            whenPush(HasSpringBootApplicationClass, not(ToDefaultBranch)).set(LocalDeploymentGoal),
            whenPush(HasCloudFoundryManifest).set(
                [ArtifactGoal,
                    StagingDeploymentGoal,
                    StagingEndpointGoal,
                    StagingVerifiedGoal,
                    ProductionDeploymentGoal,
                    ProductionEndpointGoal]),
        ));

    const hasPackageLock = hasFile("package-lock.json");

    sdm.addBuildRules(
        build.when(HasAtomistBuildFile)
            .itMeans("Custom build script")
            .set(npmCustomBuilder(options.artifactStore, options.projectLoader)),
        build.when(IsNode, ToDefaultBranch, hasPackageLock)
            .itMeans("npm run build")
            .set(nodeBuilder(options.projectLoader, "npm ci", "npm run build")),
        build.when(IsNode, hasPackageLock)
            .itMeans("npm run compile")
            .set(nodeBuilder(options.projectLoader, "npm ci", "npm run compile")),
        build.when(IsNode, ToDefaultBranch)
            .itMeans("npm run build - no package lock")
            .set(nodeBuilder(options.projectLoader, "npm i", "npm run build")),
        build.when(IsNode)
            .itMeans("npm run compile - no package lock")
            .set(nodeBuilder(options.projectLoader, "npm i", "npm run compile")),
        build.when(IsLein)
            .itMeans("Lein build")
            .set(leinBuilder(options.projectLoader)),
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
        deploy.when(IsNode)
            .itMeans("node run test")
            .deployTo(StagingDeploymentGoal, StagingEndpointGoal, StagingUndeploymentGoal)
            .using(cloudFoundryStagingDeploySpec(options)),
    );
    sdm.addDisposalRules(
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, HasCloudFoundryManifest)
            .itMeans("Java project to undeploy from PCF")
            .setGoals(UndeployEverywhereGoals),
        whenPushSatisfies(IsNode, HasCloudFoundryManifest)
            .itMeans("Node project to undeploy from PCF")
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
