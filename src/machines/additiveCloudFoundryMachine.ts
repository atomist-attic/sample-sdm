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
import {
    any,
    AnyPush,
    ArtifactGoal,
    AutofixGoal,
    goalContributors,
    Goals,
    JustBuildGoal,
    LocalDeploymentGoal,
    not,
    onAnyPush,
    ProductionDeploymentGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
    PushReactionGoal,
    ReviewGoal,
    SoftwareDeliveryMachine,
    StagingDeploymentGoal,
    StagingEndpointGoal,
    StagingVerifiedGoal,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    deploymentFreeze,
    DisableDeploy,
    DisplayDeployEnablement,
    EnableDeploy,
    ExplainDeploymentFreezeGoal,
    HasCloudFoundryManifest,
    InMemoryDeploymentStatusManager,
    isDeploymentFrozen,
    IsNode,
    lookFor200OnEndpointRootGet,
    ManagedDeploymentTargeter,
    RepositoryDeletionGoals,
    StagingUndeploymentGoal,
    UndeployEverywhereGoals,
} from "@atomist/sdm-core";
import { HasSpringBootApplicationClass, IsMaven, MavenBuilder, SpringSupport } from "@atomist/sdm-pack-spring";
import {
    configureLocalSpringBootDeploy,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
} from "@atomist/sdm-pack-spring/dist";
import { localExecutableJarDeployer } from "@atomist/sdm-pack-spring/dist/support/spring/deploy/localSpringBootDeployers";
import { SpringProjectCreationParameters } from "@atomist/sdm-pack-spring/dist/support/spring/generate/SpringProjectCreationParameters";
import { TransformSeedToCustomProject } from "@atomist/sdm-pack-spring/dist/support/spring/generate/transformSeedToCustomProject";
import * as build from "@atomist/sdm/api-helper/dsl/buildDsl";
import * as deploy from "@atomist/sdm/api-helper/dsl/deployDsl";
import { SoftwareDeliveryMachineConfiguration } from "@atomist/sdm/api/machine/SoftwareDeliveryMachineOptions";
import { CloudReadinessChecks } from "../pack/cloud-readiness/cloudReadiness";
import { DemoEditors } from "../pack/demo-editors/demoEditors";
import { JavaSupport } from "../pack/java/javaSupport";
import { NodeSupport } from "../pack/node/nodeSupport";
import {
    cloudFoundryProductionDeploySpec,
    enableDeployOnCloudFoundryManifestAddition,
} from "../pack/pcf/cloudFoundryDeploy";
import { CloudFoundrySupport } from "../pack/pcf/cloudFoundrySupport";
import { SentrySupport } from "../pack/sentry/sentrySupport";
import { addTeamPolicies } from "./teamPolicies";

const freezeStore = new InMemoryDeploymentStatusManager();

const IsDeploymentFrozen = isDeploymentFrozen(freezeStore);

/**
 * Variant of cloudFoundryMachine that uses additive, "contributor" style goal setting.
 * @return {SoftwareDeliveryMachine}
 */
export function additiveCloudFoundryMachine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        {
            name: "Cloud Foundry software delivery machine",
            configuration,
        });
    codeRules(sdm);
    buildRules(sdm);
    deployRules(sdm);
    return sdm;
}

export function codeRules(sdm: SoftwareDeliveryMachine) {
    // Each contributor contributes goals. The infrastructure assembles them into a goal set.
    sdm.addGoalContributions(goalContributors(
        onAnyPush().setGoals(new Goals("Checks", ReviewGoal, PushReactionGoal, AutofixGoal)),
        whenPushSatisfies(IsDeploymentFrozen)
            .setGoals(ExplainDeploymentFreezeGoal),
        whenPushSatisfies(any(IsMaven, IsNode))
            .setGoals(JustBuildGoal),
        whenPushSatisfies(HasSpringBootApplicationClass, not(ToDefaultBranch))
            .setGoals(LocalDeploymentGoal),
        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals([ArtifactGoal,
                StagingDeploymentGoal,
                StagingEndpointGoal,
                StagingVerifiedGoal]),
        whenPushSatisfies(HasCloudFoundryManifest, not(IsDeploymentFrozen), ToDefaultBranch)
            .setGoals([ArtifactGoal,
                ProductionDeploymentGoal,
                ProductionEndpointGoal]),
    ));

    sdm
        .addGeneratorCommand<SpringProjectCreationParameters>({
            name: "create-spring",
            intent: "create spring",
            paramsMaker: SpringProjectCreationParameters,
            startingPoint: new GitHubRepoRef("spring-team", "spring-rest-seed"),
            transform: [
                ReplaceReadmeTitle,
                SetAtomistTeamInApplicationYml,
                TransformSeedToCustomProject,
            ],
        })
        .addGeneratorCommand<SpringProjectCreationParameters>({
            name: "create-spring-kotlin",
            intent: "create spring kotlin",
            paramsMaker: SpringProjectCreationParameters,
            startingPoint: new GitHubRepoRef("johnsonr", "flux-flix-service"),
            transform: [
                ReplaceReadmeTitle,
                SetAtomistTeamInApplicationYml,
                TransformSeedToCustomProject,
            ],
        });

    sdm.addExtensionPacks(
        DemoEditors,
        deploymentFreeze(freezeStore),
        SpringSupport,
        SentrySupport,
        CloudReadinessChecks,
        JavaSupport,
        NodeSupport,
        CloudFoundrySupport,
    );
}

export function deployRules(sdm: SoftwareDeliveryMachine) {
    configureLocalSpringBootDeploy(sdm);
    sdm.addDeployRules(
        deploy.when(IsMaven)
            .deployTo(StagingDeploymentGoal, StagingEndpointGoal, StagingUndeploymentGoal)
            .using(
                {
                    deployer: localExecutableJarDeployer(),
                    targeter: ManagedDeploymentTargeter,
                },
            ),
        deploy.when(IsMaven)
            .deployTo(ProductionDeploymentGoal, ProductionEndpointGoal, ProductionUndeploymentGoal)
            .using(cloudFoundryProductionDeploySpec(sdm.configuration.sdm)),
    );
    sdm.addDisposalRules(
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, HasCloudFoundryManifest)
            .itMeans("Java project to undeploy from PCF")
            .setGoals(UndeployEverywhereGoals),
        whenPushSatisfies(AnyPush)
            .itMeans("We can always delete the repo")
            .setGoals(RepositoryDeletionGoals))
        .addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addPushImpactListener(enableDeployOnCloudFoundryManifestAddition(sdm))
        .addEndpointVerificationListener(lookFor200OnEndpointRootGet());
    addTeamPolicies(sdm);

    // demoRules(sdm);

    // sdm.addExtensionPacks(DemoPolicies);
}

export function buildRules(sdm: SoftwareDeliveryMachine) {
    const mb = new MavenBuilder(sdm);
    // mb.buildStatusUpdater = sdm as any as BuildStatusUpdater;
    sdm.addBuildRules(
        build.setDefault(mb));
    return sdm;
}
