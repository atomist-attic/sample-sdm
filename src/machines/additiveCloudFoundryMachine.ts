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

import { saveFromFiles, saveFromFilesAsync } from "@atomist/automation-client/project/util/projectUtils";
import {
    BuildGoal,
    CodeInspectionGoal,
    GitHubRepoRef,
    ProjectFile,
} from "@atomist/sdm";
import {
    AnyPush,
    anySatisfied,
    ArtifactGoal,
    AutofixGoal,
    goalContributors,
    Goals,
    JustBuildGoal,
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
    isDeploymentFrozen, isInLocalMode,
    ManagedDeploymentTargeter,
    RepositoryDeletionGoals,
    StagingUndeploymentGoal,
    UndeployEverywhereGoals,
} from "@atomist/sdm-core";
import { HasCloudFoundryManifest } from "@atomist/sdm-pack-cloudfoundry";
import { IsNode, NodeSupport } from "@atomist/sdm-pack-node";
import { configureLocalSpringBootDeploy, localExecutableJarDeployer } from "@atomist/sdm-pack-spring";
import {
    HasSpringBootApplicationClass,
    IsMaven,
    MavenBuilder,
    ReplaceReadmeTitle,
    SetAtomistTeamInApplicationYml,
    SpringProjectCreationParameters,
    SpringSupport,
    TransformSeedToCustomProject,
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

import {executeBuild} from "@atomist/sdm/api-helper/goal/executeBuild";
import {executeDeploy} from "@atomist/sdm/api-helper/goal/executeDeploy";
import {executeUndeploy} from "@atomist/sdm/api-helper/goal/executeUndeploy";
import * as _ from "lodash";

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
        whenPushSatisfies(anySatisfied(IsMaven, IsNode))
            .setGoals(JustBuildGoal),
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

    sdm.addAutoInspectRegistration<boolean, {name: string}>({
        name: "foo",
        parametersInstance: { name: "tony"},
        inspection: async (p, ci) => {
            const files = await p.totalFileCount();
            return ci.addressChannels(`There are ${files} in this project. Name was ${ci.parameters.name}`);
        },
        onInspectionResult: async (result, ci) => {
            return ci.addressChannels(`The result was ${result}`);
        },
    });

    interface FileAndLineCount {
        file: ProjectFile;
        lines: number;
    }

    async function countLines(f: ProjectFile) {
        return (await f.getContent()).split("\n").length;
    }

    function isCiFile(pl: FileAndLineCount) {
        return pl.file.path.endsWith(".travis.yml") || (pl.file.path.includes("scripts/") && pl.file.path.endsWith(".sh"));
    }

    function actuallyDoesSomething(pl: FileAndLineCount) {
        return ["java", "go", "rb", "cs", "js", "py"].includes(pl.file.extension);
    }

    function show(usefulLines: number, noiseLines: number) {
        return `Lines of code: _${usefulLines}_, Lines of noise: _${noiseLines}_, ` +
            `Noise as % of code: **${(100 * noiseLines / usefulLines).toFixed(2)}**`;
    }

    sdm.addCodeInspectionCommand({
        name: "yamlFinder",
        intent: "find yaml",
        inspection: async (p, ci) => {
            const fileAndLineCount: FileAndLineCount[] =
                await saveFromFilesAsync(p, ["**/*.yml", "**/*.yaml"], async file => (
                    {
                        file,
                        lines: (await file.getContent()).split("\n").length,
                    }));
            const yamlLines = _.sum(fileAndLineCount.map(pl => pl.lines));
            await ci.addressChannels(`${p.id.repo} has ${yamlLines} lines of YAML`);
        },
    });

    sdm.addCodeInspectionCommand<{ usefulLines: number, noiseLines: number }>({
        name: "noiseFinder",
        intent: "find noise",
        projectTest: async p => !!(await p.getFile(".travis.yml")),
        inspection: async (p, ci) => {
            const fileAndLineCount: FileAndLineCount[] =
                await saveFromFilesAsync(p, ["**/*", "**/.*"],
                    async file => ({ file, lines: await countLines(file) }));
            const noiseLines = _.sum(fileAndLineCount.filter(isCiFile).map(pl => pl.lines));
            const usefulLines = _.sum(fileAndLineCount.filter(actuallyDoesSomething).map(pl => pl.lines));
            if (usefulLines > 0) {
                await ci.addressChannels(`\`${p.id.repo}\`: ${show(usefulLines, noiseLines)}`);
                return { usefulLines, noiseLines };
            }
        },
        onInspectionResults: async (results, ci) => {
            const usefulLines = _.sum(results.filter(r => !!r.result).map(r => r.result.usefulLines));
            const noiseLines = _.sum(results.filter(r => !!r.result).map(r => r.result.noiseLines));
            return ci.addressChannels(`Results across ${results.length} projects: ${show(usefulLines, noiseLines)}`);
        },
    });

    sdm.addAutofix({
        name: "countJava",
        transform: async p => {
            const fileNames = (await saveFromFiles(p,
                    "src/main/java/**/*.java", f => f.path)
            );
            return p.addFile("filecount.md",
                `${fileNames.length} Java source files:\n\n${fileNames.join("\n")}\n`);
        },
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
    sdm.addKnownSideEffect(
        deployToStaging.endpointGoal,
        deployToStaging.deployGoal.definition.displayName,
        AnyPush);
    sdm.addGoalImplementation("Staging undeployer",
        deployToStaging.undeployGoal,
        executeUndeploy(deployToStaging),
        {
            pushTest: IsMaven,
            logInterpreter: deployToStaging.deployer.logInterpreter,
        },
    );

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
    sdm.addKnownSideEffect(
        deployToProduction.endpointGoal,
        deployToProduction.deployGoal.definition.displayName,
        AnyPush);
    sdm.addGoalImplementation("Production CF undeployer",
        deployToProduction.undeployGoal,
        executeUndeploy(deployToProduction),
        {
            pushTest: IsMaven,
            logInterpreter: deployToProduction.deployer.logInterpreter,
        },
    );

    sdm.addDisposalRules(
        whenPushSatisfies(IsMaven, HasSpringBootApplicationClass, HasCloudFoundryManifest)
            .itMeans("Java project to undeploy from PCF")
            .setGoals(UndeployEverywhereGoals),
        whenPushSatisfies(AnyPush)
            .itMeans("We can always delete the repo")
            .setGoals(RepositoryDeletionGoals));

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
        executeBuild(sdm.configuration.sdm.projectLoader, mavenBuilder),
        {
            pushTest: IsMaven,
            logInterpreter: mavenBuilder.logInterpreter,
        });
}
