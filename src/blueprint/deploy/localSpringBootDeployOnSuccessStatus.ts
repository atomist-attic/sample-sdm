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

import { logger } from "@atomist/automation-client";
import { executableJarDeployer } from "@atomist/sdm";
import { Deployer } from "@atomist/sdm";
import { FunctionalUnit } from "@atomist/sdm";
import { DeploySpec } from "@atomist/sdm";
import {
    ManagedDeploymentTargeter,
    ManagedDeploymentTargetInfo,
    targetInfoForAllBranches,
} from "@atomist/sdm";
import { ProjectLoader } from "@atomist/sdm";
import { StartupInfo } from "@atomist/sdm";
import { mavenDeployer } from "@atomist/sdm";
import {
    StagingDeploymentGoal,
    StagingEndpointGoal,
    StagingUndeploymentGoal,
} from "@atomist/sdm";
import { OnSupersededStatus } from "@atomist/sdm//handlers/events/delivery/superseded/OnSuperseded";
import { DefaultArtifactStore } from "../artifactStore";

export const LocalExecutableJarDeployer: Deployer<ManagedDeploymentTargetInfo> = executableJarDeployer({
    baseUrl: "http://localhost",
    lowerPort: 8082,
    commandLineArgumentsFor: springBootExecutableJarArgs,
});

/**
 * Deploy to the automation client node
 */

const LocalExecutableJarDeploySpec: DeploySpec<ManagedDeploymentTargetInfo> = {
    implementationName: "DeployFromLocalExecutableJar",
    deployGoal: StagingDeploymentGoal,
    endpointGoal: StagingEndpointGoal,
    artifactStore: DefaultArtifactStore,
    deployer: LocalExecutableJarDeployer,
    targeter: ManagedDeploymentTargeter,
    undeploy: {
        goal: StagingUndeploymentGoal,
        implementationName: "UndeployFromLocalJar",
    },
};

const UndeployOnSuperseded = new OnSupersededStatus(inv => {
    logger.info("Will undeploy application %j", inv.id);
    return LocalExecutableJarDeploySpec.deployer.undeploy(targetInfoForAllBranches(inv.id), undefined, undefined);
});

/* tslint:disable:no-unused-variable */

const undeployLocalOnSuperseded: FunctionalUnit = {eventHandlers: [() => UndeployOnSuperseded], commandHandlers: []};

function springBootExecutableJarArgs(si: StartupInfo): string[] {
    return [
        `--server.port=${si.port}`,
        `--server.contextPath=${si.contextRoot}`,
    ];
}

export function mavenSourceDeployer(projectLoader: ProjectLoader): Deployer<ManagedDeploymentTargetInfo> {
    return mavenDeployer(projectLoader, {
        baseUrl: "http://localhost",
        lowerPort: 9090,
        commandLineArgumentsFor: springBootMavenArgs,
    });
}

function springBootMavenArgs(si: StartupInfo): string[] {
    return [
        `-Dserver.port=${si.port}`,
        `-Dserver.contextPath=${si.contextRoot}`,
    ];
}
