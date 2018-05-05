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

import { SoftwareDeliveryMachineOptions } from "@atomist/sdm/blueprint/SoftwareDeliveryMachineOptions";
import { DockerOptions } from "@atomist/sdm/common/delivery/docker/executeDockerBuild";
import { CachingProjectLoader } from "@atomist/sdm/common/repo/CachingProjectLoader";
import { GitHubCredentialsResolver } from "@atomist/sdm/handlers/common/GitHubCredentialsResolver";
import { DefaultArtifactStore } from "./blueprint/artifactStore";
import { logFactory } from "./blueprint/log/logFactory";
import { JavaSupportOptions } from "./parts/stacks/javaSupport";

export const SdmOptions: SoftwareDeliveryMachineOptions & JavaSupportOptions & DockerOptions = {

    // SDM Options
    artifactStore: DefaultArtifactStore,
    projectLoader: new CachingProjectLoader(),
    logFactory: logFactory(process.env.ROLAR_BASE_URL),
    credentialsResolver: new GitHubCredentialsResolver(),

    // Java options
    useCheckstyle: process.env.USE_CHECKSTYLE === "true",
    reviewOnlyChangedFiles: true,

    // Docker options
    registry: process.env.ATOMIST_DOCKER_REGISTRY,
    user: process.env.ATOMIST_DOCKER_USER,
    password: process.env.ATOMIST_DOCKER_PASSWORD,
};
