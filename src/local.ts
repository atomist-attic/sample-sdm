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

import { codeRules } from "./machines/additiveCloudFoundryMachine";
import { addParameters } from "@atomist/sdm";

// TODO this import is wrong because the link is wrong
// import { LocalMachineConfig } from "@atomist/slalom/build/src";

export const Config = { // : LocalMachineConfig = {

    repositoryOwnerParentDirectory: "/Users/rodjohnson/temp/local-sdm",

    name: "local-sample-sdm",

    mergeAutofixes: true,

    init: sdm => {
        codeRules(sdm);
        // buildRules(sdm);
        sdm.addCommand({
            name: "hello",
            intent: "hello",
            paramsBuilder: addParameters({name: "name" }),
            listener: async ci => ci.addressChannels(`Hello ${ci.parameters.name}`),
        });
    },

    preferLocalSeeds: true,

};
