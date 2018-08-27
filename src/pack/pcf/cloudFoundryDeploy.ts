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
    CommandListenerInvocation,
    DeployerInfo,
    ProjectLoader,
    PushImpactListener, PushImpactListenerRegistration,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    setDeployEnablement,
} from "@atomist/sdm-core";
import { SetDeployEnablementParameters } from "@atomist/sdm-core/handlers/commands/SetDeployEnablement";
import {
    CloudFoundryBlueGreenDeployer,
    CloudFoundryInfo,
    EnvironmentCloudFoundryTarget,
} from "@atomist/sdm-pack-cloudfoundry";
import { ArtifactStore } from "@atomist/sdm/spi/artifact/ArtifactStore";
import { AddCloudFoundryManifestMarker } from "./addCloudFoundryManifest";

/**
 * Deploy everything to the same Cloud Foundry space
 */
export function cloudFoundryStagingDeploySpec(opts: { artifactStore: ArtifactStore, projectLoader: ProjectLoader }): DeployerInfo<CloudFoundryInfo> {
    return {
        deployer: new CloudFoundryBlueGreenDeployer(opts.projectLoader),
        targeter: () => new EnvironmentCloudFoundryTarget("staging"),
    };
}

export function cloudFoundryProductionDeploySpec(opts: { artifactStore: ArtifactStore, projectLoader: ProjectLoader }):
    DeployerInfo<CloudFoundryInfo> {
    return {
        deployer: new CloudFoundryBlueGreenDeployer(opts.projectLoader),
        targeter: () => new EnvironmentCloudFoundryTarget("production"),
    };
}

export function enableDeployOnCloudFoundryManifestAdditionListener(sdm: SoftwareDeliveryMachine): PushImpactListener<any> {
    return async pil => {
        if (pil.push.commits.some(c => c.message.includes(AddCloudFoundryManifestMarker))) {
            const parameters: SetDeployEnablementParameters = {
                owner: pil.push.repo.owner,
                repo: pil.push.repo.name,
                providerId: pil.push.repo.org.provider.providerId,
                name: sdm.configuration.sdm.name,
                version: sdm.configuration.sdm.version,
            };

            await setDeployEnablement({
                commandName: "addCloudFoundryManifest",
                parameters,
                ...pil,
            } as CommandListenerInvocation<SetDeployEnablementParameters>, true);
        }
    };
}

/**
 * Enable deployment when a PCF manifest is added to the default branch.
 */
export function enableDeployOnCloudFoundryManifestAddition(sdm: SoftwareDeliveryMachine): PushImpactListenerRegistration {
    return {
        name: "EnableDeployOnCloudFoundryManifestAddition",
        action: enableDeployOnCloudFoundryManifestAdditionListener(sdm),
    };
}
