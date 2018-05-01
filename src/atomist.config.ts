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

import { Configuration } from "@atomist/automation-client";
import {
    CachingProjectLoader,
    configureForSdm,
    createEphemeralProgressLog,
    DockerOptions,
    LoggingProgressLog,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
    WriteToAllProgressLog,
} from "@atomist/sdm";
import { DefaultArtifactStore } from "./blueprint/artifactStore";
import { JavaSupportOptions } from "./parts/stacks/javaSupport";
import { configureLogzio } from "./util/logzio";

const SdmOptions: SoftwareDeliveryMachineOptions & JavaSupportOptions & DockerOptions = {

    // SDM Options
    artifactStore: DefaultArtifactStore,
    projectLoader: new CachingProjectLoader(),
    logFactory: async name => new WriteToAllProgressLog(name, await createEphemeralProgressLog(name), new LoggingProgressLog(name, "info")),

    // Java options
    useCheckstyle: process.env.USE_CHECKSTYLE === "true",
    reviewOnlyChangedFiles: true,

    // Docker options
    registry: process.env.ATOMIST_DOCKER_REGISTRY,
    user: process.env.ATOMIST_DOCKER_USER,
    password: process.env.ATOMIST_DOCKER_PASSWORD,
};

/*
 * The provided software delivery machines include
 *
 * Cloud Foundry full delivery (cloudFoundryMachine):
 * - sample project creation is `create spring`
 * - runs locally for the Test environment (you can change this)
 * - deploys to PCF for production (see README.md for configuration)
 *
 * Kubernetes full delivery (k8sMachine):
 * - deploys to a sandbox kubernetes environment. You don't need your own
 * - sample project creation is `create spring`
 *
 * Autofix only (autofixMachine):
 * - adds license headers to Java and TypeScript files
 *
 * Artifact checks only (artifactVerifyingMachine):
 * - builds and performs a check on Java maven artifacts
 *
 * Project creation only (projectCreationMachine):
 * - provides commands to create Java and Node projects
 *
 * Static analysis only (staticAnalysisMachine):
 * - runs Checkstyle when Java changes; reports to GitHub status
 *
 * start with any of these and change it to make it your own!
 */

const machineName = process.env.MACHINE_NAME || "cloudFoundryMachine";
const machinePath = process.env.MACHINE_PATH || "./machines";

function createMachine(options: SoftwareDeliveryMachineOptions): SoftwareDeliveryMachine {
    const machineFunction = require(machinePath + "/" + machineName)[machineName];
    return machineFunction(options);
}

const machine = createMachine(SdmOptions);

export const configuration: Configuration = {
    policy: "ephemeral",
    http: {
        auth: {
            basic: {
                enabled: true,
                username: "admin",
                password: process.env.LOCAL_ATOMIST_ADMIN_PASSWORD,
            },
        },
    },
    cluster: {
        workers: 1,
    },
    logging: {
        level: process.env.NODE_ENV === "production" ? "debug" : "info",
        file: {
            enabled: process.env.NODE_ENV !== "production",
            name: "./log/github-sdm.log",
        },
    },
    postProcessors: [
        configureLogzio,
        configureForSdm(machine),
    ],
};
