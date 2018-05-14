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
    FromAtomist,
    hasFile,
    HttpServiceGoals,
    LibraryGoals,
    nodeBuilder,
    NoGoals,
    not,
    NpmBuildGoals,
    NpmDeployGoals,
    NpmDockerGoals,
    NpmKubernetesDeployGoals,
    ProductionDeploymentGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
    RepositoryDeletionGoals,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
    StagingDeploymentGoal,
    StagingEndpointGoal,
    StagingUndeploymentGoal,
    ToDefaultBranch,
    ToPublicRepo,
    UndeployEverywhereGoals,
    whenPushSatisfies,
} from "@atomist/sdm";
import * as build from "@atomist/sdm/blueprint/dsl/buildDsl";
import * as deploy from "@atomist/sdm/blueprint/dsl/deployDsl";

import { leinBuilder } from "@atomist/sdm/common/delivery/build/local/lein/leinBuilder";
import { MavenBuilder } from "@atomist/sdm/common/delivery/build/local/maven/MavenBuilder";
import { npmCustomBuilder } from "@atomist/sdm/common/delivery/build/local/npm/NpmDetectBuildMapping";
import { ManagedDeploymentTargeter } from "@atomist/sdm/common/delivery/deploy/local/ManagedDeployments";
import { IsDeployEnabled } from "@atomist/sdm/common/listener/support/pushtest/deployPushTests";
import { HasDockerfile } from "@atomist/sdm/common/listener/support/pushtest/docker/dockerPushTests";
import {
    IsLein,
    IsMaven,
} from "@atomist/sdm/common/listener/support/pushtest/jvm/jvmPushTests";
import { NamedSeedRepo } from "@atomist/sdm/common/listener/support/pushtest/NamedSeedRepo";
import {
    HasAtomistBuildFile,
    IsNode,
} from "@atomist/sdm/common/listener/support/pushtest/node/nodePushTests";
import { HasCloudFoundryManifest } from "@atomist/sdm/common/listener/support/pushtest/pcf/cloudFoundryManifestPushTest";
import { createEphemeralProgressLog } from "@atomist/sdm/common/log/EphemeralProgressLog";
import { lookFor200OnEndpointRootGet } from "@atomist/sdm/common/verify/lookFor200OnEndpointRootGet";
import { isDeployEnabledCommand } from "@atomist/sdm/handlers/commands/DisplayDeployEnablement";
import {
    disableDeploy,
    enableDeploy,
} from "@atomist/sdm/handlers/commands/SetDeployEnablement";
import {
    cloudFoundryProductionDeploySpec,
    cloudFoundryStagingDeploySpec,
    EnableDeployOnCloudFoundryManifestAddition,
} from "../blueprint/deploy/cloudFoundryDeploy";
import { LocalExecutableJarDeployer } from "../blueprint/deploy/localSpringBootDeployers";
import { SuggestAddingCloudFoundryManifest } from "../blueprint/repo/suggestAddingCloudFoundryManifest";
import { addCloudFoundryManifest } from "../commands/editors/pcf/addCloudFoundryManifest";
import { addDemoEditors } from "../parts/demo/demoEditors";
import { LocalDeploymentGoals } from "../parts/localDeploymentGoals";
import { addJavaSupport } from "../parts/stacks/javaSupport";
import { addNodeSupport } from "../parts/stacks/nodeSupport";
import { addSpringSupport } from "../parts/stacks/springSupport";
import { addTeamPolicies } from "../parts/team/teamPolicies";
import { MaterialChangeToJavaRepo } from "../pushtest/jvm/materialChangeToJavaRepo";
import { HasSpringBootApplicationClass } from "../pushtest/jvm/springPushTests";
import { MaterialChangeToNodeRepo } from "../pushtest/node/materialChangeToNodeRepo";

/**
 * Assemble a machine that supports Java, Spring and Node and deploys to Cloud Foundry
 * See generatorConfig.ts to customize generation defaults.
 * @return {SoftwareDeliveryMachine}
 */
export function cloudFoundryMachine(options: SoftwareDeliveryMachineOptions,
                                    configuration: Configuration): SoftwareDeliveryMachine {
    const sdm = new SoftwareDeliveryMachine(
        "CloudFoundry software delivery machine",
        options,

        // goalContributors(
        //     whenPush(IsMaven).set(JustBuildGoal),
        //     whenPush(HasSpringBootApplicationClass, not(ToDefaultBranch)).set(LocalDeploymentGoal),
        //     whenPush(HasCloudFoundryManifest).set(
        //         [ArtifactGoal,
        //             StagingDeploymentGoal,
        //             StagingEndpointGoal,
        //             StagingVerifiedGoal,
        //             ProductionDeploymentGoal,
        //             ProductionEndpointGoal]),
        // ),

        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, not(MaterialChangeToJavaRepo))
            .itMeans("No material change to Java")
            .setGoals(NoGoals),
        whenPushSatisfies(ToDefaultBranch, IsMaven, HasSpringBootApplicationClass, HasCloudFoundryManifest,
            ToPublicRepo, not(NamedSeedRepo), not(FromAtomist), IsDeployEnabled)
            .itMeans("Spring Boot service to deploy")
            .setGoals(HttpServiceGoals),
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, not(FromAtomist))
            .itMeans("Spring Boot service local deploy")
            .setGoals(LocalDeploymentGoals),
        whenPushSatisfies(IsMaven)
            .itMeans("Build Java")
            .setGoals(LibraryGoals),
        whenPushSatisfies(IsNode, not(MaterialChangeToNodeRepo))
            .itMeans("No material change to Node")
            .setGoals(NoGoals),
        whenPushSatisfies(IsNode, HasCloudFoundryManifest, IsDeployEnabled, ToDefaultBranch)
            .itMeans("Build and deploy Node")
            .setGoals(NpmDeployGoals),
        whenPushSatisfies(IsNode, HasDockerfile, ToDefaultBranch, IsDeployEnabled)
            .itMeans("Docker deploy Node")
            .setGoals(NpmKubernetesDeployGoals),
        whenPushSatisfies(IsNode, HasDockerfile)
            .itMeans("Docker build Node")
            .setGoals(NpmDockerGoals),
        whenPushSatisfies(IsNode, not(HasDockerfile))
            .itMeans("Build Node")
            .setGoals(NpmBuildGoals),
    );

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
    return sdm;
}
