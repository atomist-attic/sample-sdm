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
    ArtifactGoal,
    AutofixGoal,
    BuildGoal,
    CodeInspectionGoal,
    GitHubRepoRef,
    goalContributors,
    Goals,
    not,
    onAnyPush,
    ProductionDeploymentGoal,
    ProductionEndpointGoal,
    ProductionUndeploymentGoal,
    PushReactionGoal,
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
    InMemoryDeploymentStatusManager,
    isDeploymentFrozen,
    isInLocalMode,
    ManagedDeploymentTargeter,
} from "@atomist/sdm-core";
import { HasCloudFoundryManifest } from "@atomist/sdm-pack-cloudfoundry";
import { NodeSupport } from "@atomist/sdm-pack-node";
import {
    IsMaven,
    localExecutableJarDeployer,
    MavenBuilder,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameters,
    SpringSupport,
    TransformSeedToCustomProject
} from "@atomist/sdm-pack-spring";
import { SpringProjectCreationParameterDefinitions } from "@atomist/sdm-pack-spring/lib/spring/generate/SpringProjectCreationParameters";
import { SoftwareDeliveryMachineConfiguration } from "@atomist/sdm/api/machine/SoftwareDeliveryMachineOptions";
import { CloudReadinessChecks } from "../pack/cloud-readiness/cloudReadiness";
import { DemoEditors } from "../pack/demo-editors/demoEditors";
import { JavaSupport } from "../pack/java/javaSupport";
import {
    cloudFoundryProductionDeploySpec,
    enableDeployOnCloudFoundryManifestAddition,
} from "../pack/pcf/cloudFoundryDeploy";
import { CloudFoundrySupport } from "../pack/pcf/cloudFoundrySupport";
import { SentrySupport } from "../pack/sentry/sentrySupport";
import { configureForLocal } from "./support/configureForLocal";
import { addTeamPolicies } from "./teamPolicies";

import { executeBuild } from "@atomist/sdm/api-helper/goal/executeBuild";
import { executeDeploy } from "@atomist/sdm/api-helper/goal/executeDeploy";
import { executeUndeploy } from "@atomist/sdm/api-helper/goal/executeUndeploy";
import { StagingUndeploymentGoal } from "@atomist/sdm/pack/well-known-goals/commonGoals";

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

    sdm.addCommand<{ name: string }>({
        name: "hello",
        intent: "hello",
        parameters: {
            name: { description: "Your name" },
        },
        listener: async cli => cli.addressChannels(`Hello ${cli.parameters.name}`),
    });

    codeRules(sdm);
    buildRules(sdm);

    if (isInLocalMode()) {
        configureForLocal(sdm);
    } else {
        deployRules(sdm);
    }
    addTeamPolicies(sdm);

    return sdm;
}

export function codeRules(sdm: SoftwareDeliveryMachine) {
    // Each contributor contributes goals. The infrastructure assembles them into a goal set.
    sdm.addGoalContributions(goalContributors(
        onAnyPush().setGoals(new Goals("Checks", CodeInspectionGoal, PushReactionGoal, AutofixGoal)),
        whenPushSatisfies(IsDeploymentFrozen)
            .setGoals(ExplainDeploymentFreezeGoal),
        whenPushSatisfies(IsMaven)
            .setGoals(BuildGoal),
        whenPushSatisfies(HasCloudFoundryManifest, ToDefaultBranch)
            .setGoals(new Goals("StagingDeployment", ArtifactGoal,
                StagingDeploymentGoal,
                StagingEndpointGoal,
                StagingVerifiedGoal)),
        whenPushSatisfies(HasCloudFoundryManifest, not(IsDeploymentFrozen), ToDefaultBranch)
            .setGoals(new Goals("ProdDeployment", ArtifactGoal,
                ProductionDeploymentGoal,
                ProductionEndpointGoal),
            )));

    sdm.addPushImpactListener(async pu => {
        const javaFilesChanged = await (pu.filesChanged || [])
            .filter(path => path.endsWith(".java"))
            .length;
        return pu.addressChannels(javaFilesChanged === 0 ?
            "No Java files changed :sleepy:" :
            `${javaFilesChanged} Java files changed :eye:`);
    });

    sdm.addAutoInspectRegistration<boolean, { name: string }>({
        name: "foo",
        parametersInstance: { name: "tony" },
        inspection: async (p, ci) => {
            const files = await p.totalFileCount();
            return ci.addressChannels(`There are ${files} in this project. Name was ${ci.parameters.name}`);
        },
        onInspectionResult: async (result, ci) => {
            return ci.addressChannels(`The result was ${result}`);
        },
    });

    // sdm.addAutofix({
    //     name: "countJava",
    //     transform: async p => {
    //         const fileNames = (await saveFromFiles(p,
    //                 "src/main/java/**/*.java", f => f.path)
    //         );
    //         return p.addFile("filecount.md",
    //             `${fileNames.length} Java source files:\n\n${fileNames.join("\n")}\n`);
    //     },
    // });

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
        SpringSupport,
        SentrySupport,
        CloudReadinessChecks,
        JavaSupport,
        NodeSupport,
        CloudFoundrySupport,
    );
}

export function deployRules(sdm: SoftwareDeliveryMachine) {
    const deployToStaging = {
        deployer: localExecutableJarDeployer(),
        targeter: ManagedDeploymentTargeter,
        deployGoal: StagingDeploymentGoal,
        endpointGoal: StagingEndpointGoal,
        undeployGoal: StagingUndeploymentGoal,
    };
    sdm.addGoalImplementation("Staging local deployer",
        deployToStaging.deployGoal,
        executeDeploy(
            sdm.configuration.sdm.artifactStore,
            sdm.configuration.sdm.repoRefResolver,
            deployToStaging.endpointGoal, deployToStaging),
        {
            pushTest: IsMaven,
            logInterpreter: deployToStaging.deployer.logInterpreter,
        },
    );
    // sdm.addKnownSideEffect(
    //     deployToStaging.endpointGoal,
    //     deployToStaging.deployGoal.definition.displayName,
    //     AnyPush);

    const deployToProduction = {
        ...cloudFoundryProductionDeploySpec(sdm.configuration.sdm),
        deployGoal: ProductionDeploymentGoal,
        endpointGoal: ProductionEndpointGoal,
        undeployGoal: ProductionUndeploymentGoal,
    };
    sdm.addGoalImplementation("Production CF deployer",
        deployToProduction.deployGoal,
        executeDeploy(
            sdm.configuration.sdm.artifactStore,
            sdm.configuration.sdm.repoRefResolver,
            deployToProduction.endpointGoal, deployToProduction),
        {
            pushTest: IsMaven,
            logInterpreter: deployToProduction.deployer.logInterpreter,
        },
    );
    // sdm.addKnownSideEffect(
    //     deployToProduction.endpointGoal,
    //     deployToProduction.deployGoal.definition.displayName,
    //     AnyPush);

    sdm.addCommand(EnableDeploy)
        .addCommand(DisableDeploy)
        .addCommand(DisplayDeployEnablement)
        .addPushImpactListener(enableDeployOnCloudFoundryManifestAddition(sdm));
    // sdm.addEndpointVerificationListener(lookFor200OnEndpointRootGet());
}

export function buildRules(sdm: SoftwareDeliveryMachine) {
    const mavenBuilder = new MavenBuilder(sdm);
    sdm.addGoalImplementation("Maven build",
        BuildGoal,
        executeBuild(mavenBuilder),
        {
            pushTest: IsMaven,
            logInterpreter: mavenBuilder.logInterpreter,
        });
}
