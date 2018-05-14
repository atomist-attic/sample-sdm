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

import { Configuration } from "@atomist/automation-client/configuration";
import {
    configureSdm,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineOptions,
} from "@atomist/sdm";

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

const Options = {
    requiredConfigurationValues: [
        "sdm",
        "sdm.cloudfoundry.user",
        "sdm.cloudfoundry.password",
        "sdm.cloudfoundry.org",
        "sdm.cloudfoundry.spaces.production",
        "sdm.cloudfoundry.spaces.staging",
    ],
};

function createMachine(options: SoftwareDeliveryMachineOptions,
                       config: Configuration): SoftwareDeliveryMachine {
    const machineFunction = require(machinePath + "/" + machineName)[machineName];
    return machineFunction(options, config);
}

export const configuration: Configuration = {
    // endpoints: {
    //     api: "https://automation-staging.atomist.services/registration",
    //     graphql: "https://automation-staging.atomist.services/graphql/team",
    // },
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
        level: "info",
    },
    postProcessors: [
        configureSdm(createMachine, Options),
    ],
};
