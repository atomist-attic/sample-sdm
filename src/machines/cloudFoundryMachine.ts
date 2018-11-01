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

import { GitHubRepoRef } from "@atomist/automation-client";
import {
    AnyPush,
    AutoCodeInspection,
    Autofix,
    goalContributors,
    goals,
    not,
    onAnyPush,
    PushImpact,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration,
    suggestAction,
    ToDefaultBranch,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
    isInLocalMode,
    IsInLocalMode,
} from "@atomist/sdm-core";
import { Artifact, Build } from "@atomist/sdm-pack-build";
import {
    HasCloudFoundryManifest,
} from "@atomist/sdm-pack-cloudfoundry";
import {
    CloudFoundryDeploy,
    CloudFoundryDeploymentStrategy,
} from "@atomist/sdm-pack-cloudfoundry";
import { nodeSupport } from "@atomist/sdm-pack-node";
import {
    HasSpringBootPom,
    IsMaven,
    IsRiff,
    mavenBuilder,
    MavenPerBranchDeployment,
    ReplaceReadmeTitle,
    RiffProjectCreationParameterDefinitions,
    RiffProjectCreationParameters,
    RiffProjectCreationTransform,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    springSupport,
    TransformSeedToCustomProject,
} from "@atomist/sdm-pack-spring";
import { DemoEditors } from "../pack/demo-editors/demoEditors";
import {
    deploymentFreeze,
    ExplainDeploymentFreezeGoal,
    isDeploymentFrozen,
} from "../pack/freeze/deploymentFreeze";
import { InMemoryDeploymentStatusManager } from "../pack/freeze/InMemoryDeploymentStatusManager";
import { SentrySupport } from "../pack/sentry/sentrySupport";
import {
    configureForLocal,
    ConsoleReviewListener,
} from "./support/configureForLocal";
import { addTeamPolicies } from "./teamPolicies";

const freezeStore = new InMemoryDeploymentStatusManager();

const IsDeploymentFrozen = isDeploymentFrozen(freezeStore);

/**
 * Variant of cloudFoundryMachine that uses additive, "contributor" style goal setting.
 * @return {SoftwareDeliveryMachine}
 */
export function cloudFoundryMachine(configuration: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {
    const sdm: SoftwareDeliveryMachine = createSoftwareDeliveryMachine(
        {
            name: "Cloud Foundry software delivery machine",
            configuration,
        });

    sdm.addCommand<{ name: string }>({
        name: "hello",
        intent: "hello",
        parameters: {
            name: { description: "Your name" },
        },
        listener: async cli => cli.addressChannels(`Hello ${cli.parameters.name}`),
    });

    codeRules(sdm);

    if (isInLocalMode()) {
        configureForLocal(sdm);
    } else {
        // nothing
    }
    addTeamPolicies(sdm);

    return sdm;
}

export function codeRules(sdm: SoftwareDeliveryMachine) {
    const autofixGoal = new Autofix();
    const pushReactionGoal = new PushImpact();
    const artifactGoal = new Artifact();
    const codeInspectionGoal = new AutoCodeInspection();
    const build = new Build().with({ name: "Maven", builder: mavenBuilder() });
    const mavenDeploy = new MavenPerBranchDeployment();
    const pcfDeploy = new CloudFoundryDeploy({
            uniqueName: "production-deployment",
            environment: "production",
            approval: false,
            preApproval: true,
            retry: true,
        })
        .with({ environment: "production", strategy: CloudFoundryDeploymentStrategy.BLUE_GREEN });

    const checkGoals = goals("Checks")
        .plan(codeInspectionGoal, pushReactionGoal, autofixGoal);
    const buildGoals = goals("Build")
        .plan(build).after(autofixGoal);
    const localDeploymentGoals = goals("local-deploy")
        .plan(mavenDeploy).after(buildGoals);

    const StagingDeploymentGoals = goals("StagingDeployment")
        .plan(artifactGoal).after(checkGoals)
        .plan(mavenDeploy).after(buildGoals);

    const ProductionDeploymentGoals = goals("ProdDeployment")
        .plan(pcfDeploy).after(StagingDeploymentGoals);

    // sdm.addGoalSideEffect(ArtifactGoal, "other", AnyPush);

    const riffDeploy = suggestAction({
        displayName: "Riff Deploy",
        message: "I don't yet know how to deploy a Riff function, but you could teach me!",
    });

    sdm.addGoalContributions(goalContributors(
        onAnyPush().setGoals(checkGoals),
        whenPushSatisfies(IsDeploymentFrozen)
            .setGoals(ExplainDeploymentFreezeGoal),
        whenPushSatisfies(IsMaven)
            .setGoals(buildGoals),
        whenPushSatisfies(IsMaven, HasSpringBootPom, IsInLocalMode)
            .setGoals(localDeploymentGoals),
        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch, not(IsInLocalMode))
            .setGoals(StagingDeploymentGoals),
        whenPushSatisfies(HasCloudFoundryManifest, not(IsDeploymentFrozen), ToDefaultBranch, not(IsInLocalMode))
            .setGoals(ProductionDeploymentGoals),
        whenPushSatisfies(IsRiff).setGoals(riffDeploy)),
    );

    sdm.addGeneratorCommand<RiffProjectCreationParameters>({
        name: "create-riff",
        intent: "create riff",
        description: "Create a new Riff function",
        parameters: RiffProjectCreationParameterDefinitions,
        startingPoint: new GitHubRepoRef("trisberg", "upper"),
        transform: RiffProjectCreationTransform,
    });

    sdm.addGeneratorCommand<SpringProjectCreationParameters>({
        name: "create-spring",
        intent: "create spring",
        description: "Create a new Java Spring Boot REST service",
        parameters: SpringProjectCreationParameterDefinitions,
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
            description: "Create a new Kotlin Spring Boot REST service",
            parameters: SpringProjectCreationParameterDefinitions,
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
        springSupport({
            review: {
                springStyle: true,
                cloudNative: true,
            },
            autofix: {
                springStyle: true,
            },
            inspectGoal: codeInspectionGoal,
            autofixGoal,
            reviewListeners: isInLocalMode() ? [
                ConsoleReviewListener,
            ] : [
                // CloudNativeGitHubIssueRaisingReviewListener,
                // SpringStyleGitHubIssueRaisingReviewListener,
            ],
        }),
        SentrySupport,
        nodeSupport({
            review: {
                typescriptErrors: false,
            },
            autofix: {
                typescriptErrors: false,
            },
        }),
       // cloudFoundrySupport({}),
    );
}
