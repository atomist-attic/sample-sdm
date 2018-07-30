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
    AnyPush,
    anySatisfied,
    AutofixGoal,
    CommandHandlerRegistration,
    goalContributors,
    Goals,
    JustBuildGoal,
    LocalDeploymentGoal,
    onAnyPush,
    ProductionDeploymentGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
    PushReactionGoal,
    ReviewGoal,
    SoftwareDeliveryMachine,
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
    LocalEndpointGoal,
    LocalUndeploymentGoal,
    lookFor200OnEndpointRootGet,
    LookupStrategy,
    ManagedDeploymentTargeter,
    RepositoryDeletionGoals,
    StartupInfo,
    UndeployEverywhereGoals,
} from "@atomist/sdm-core";
import {
    HasSpringBootApplicationClass,
    IsMaven,
    ListLocalDeploys,
    MavenBuilder,
    mavenDeployer,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringBootSuccessPatterns,
    SpringProjectCreationParameters,
    SpringSupport,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import * as build from "@atomist/sdm/api-helper/dsl/buildDsl";
import * as deploy from "@atomist/sdm/api-helper/dsl/deployDsl";
import { SoftwareDeliveryMachineConfiguration } from "@atomist/sdm/api/machine/SoftwareDeliveryMachineOptions";
import { CloudReadinessChecks } from "../pack/cloud-readiness/cloudReadiness";
import { DemoEditors } from "../pack/demo-editors/demoEditors";
import { JavaSupport } from "../pack/java/javaSupport";
import { NodeSupport, IsNode } from "@atomist/sdm-pack-node";
import {
    cloudFoundryProductionDeploySpec,
    enableDeployOnCloudFoundryManifestAddition
} from "../pack/pcf/cloudFoundryDeploy";
import { CloudFoundrySupport } from "../pack/pcf/cloudFoundrySupport";
import { SentrySupport } from "../pack/sentry/sentrySupport";
import { buttonMessage } from "./buttonMessage";
import { addTeamPolicies } from "./teamPolicies";
import { executeMavenDeploy, MavenDeploymentGoal } from "./MavenDeploymentGoal";

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

    const helloCommand: CommandHandlerRegistration<{ name: string }> = {
        name: "hello",
        intent: "say hello",
        parameters: {
            name: { pattern: /[A-Za-z]+/ },
        },
        listener: async ci => {
            return ci.addressChannels(`Hello _${ci.parameters.name}_ :wave:`);
        },
    };

    sdm.addRepoCreationListener(async l =>
        l.addressChannels(`New repo ${l.id.url}`));
    sdm.addNewRepoWithCodeListener(async l =>
        l.addressChannels(`New repo with code ${l.id.url}`));

    sdm.addCommand(helloCommand);

    sdm.addCommand({
        name: "greet",
        intent: "greet",
        listener: async ci => {
            return ci.addressChannels(buttonMessage({ text: "greet" }, helloCommand, { name: "Rod" }));
        },
    });

    codeRules(sdm);
    buildRules(sdm);

    //deployRules(sdm);

    sdm.addGoalImplementation("Maven deployment", MavenDeploymentGoal,
        executeMavenDeploy(sdm.configuration.sdm.projectLoader, {
            lowerPort: 9090,
        }));

    return sdm;
}

export function codeRules(sdm: SoftwareDeliveryMachine) {
    // Each contributor contributes goals. The infrastructure assembles them into a goal set.
    sdm.addGoalContributions(goalContributors(
        onAnyPush().setGoals(new Goals("Checks", ReviewGoal, PushReactionGoal, AutofixGoal)),
        whenPushSatisfies(IsDeploymentFrozen)
            .setGoals(ExplainDeploymentFreezeGoal),
        whenPushSatisfies(anySatisfied(IsMaven, IsNode))
            .setGoals(JustBuildGoal),
        whenPushSatisfies(HasSpringBootApplicationClass)
            .setGoals(MavenDeploymentGoal),
        // whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
        //     .setGoals([ArtifactGoal,
        //         StagingDeploymentGoal,
        //         StagingEndpointGoal,
        //         StagingVerifiedGoal]),
        // whenPushSatisfies(HasCloudFoundryManifest, not(IsDeploymentFrozen), ToDefaultBranch)
        //     .setGoals([ArtifactGoal,
        //         ProductionDeploymentGoal,
        //         ProductionEndpointGoal]),
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

    sdm.addReviewListenerRegistration({
        name: "consoleListener",
        listener: async l => {
            await l.addressChannels(`${l.review.comments.length} review errors: ${l.review.comments}`);
            for (const c of l.review.comments) {
                await l.addressChannels(`${c.severity}: ${c.category} - ${c.detail} ${JSON.stringify(c.sourceLocation)}`);
            }
        }
    });
}

export function deployRules(sdm: SoftwareDeliveryMachine) {
    // //configureLocalSpringBootDeploy(sdm);
    // sdm.addDeployRules(
    //     deploy.when(IsMaven)
    //         .deployTo(StagingDeploymentGoal, StagingEndpointGoal, StagingUndeploymentGoal)
    //         .using(
    //             {
    //                 deployer: localExecutableJarDeployer(),
    //                 targeter: ManagedDeploymentTargeter,
    //             },
    //         ),

    sdm.addDeployRules(
        deploy.when(IsMaven)
            .itMeans("Maven local deploy")
            .deployTo(LocalDeploymentGoal, LocalEndpointGoal, LocalUndeploymentGoal)
            .using(
                {
                    deployer: mavenDeployer(sdm.configuration.sdm.projectLoader, {
                        baseUrl: "http://localhost",
                        lowerPort: 9090,
                        commandLineArgumentsFor: springBootMavenArgs,
                        successPatterns: SpringBootSuccessPatterns,
                        lookupStrategy: LookupStrategy.service,
                    }),
                    targeter: ManagedDeploymentTargeter,
                },
            ))
        .addCommand(ListLocalDeploys);

    deploy.when(IsMaven)
        .deployTo(ProductionDeploymentGoal, ProductionEndpointGoal, ProductionUndeploymentGoal)
        .using(cloudFoundryProductionDeploySpec(sdm.configuration.sdm));

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

// TODO come out of spring-pack
function springBootMavenArgs(si: StartupInfo): string[] {
    return [
        `-Dserver.port=${si.port}`,
        `-Dserver.contextPath=${si.contextRoot}`,
    ];
}
