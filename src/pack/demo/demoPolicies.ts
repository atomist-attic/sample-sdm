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

import { Issue } from "@atomist/automation-client/util/gitHub";
import {
    ExtensionPack,
    hasFile,
    not,
} from "@atomist/sdm";
import { updateIssue } from "@atomist/sdm-core";
import { metadata } from "@atomist/sdm/api-helper/misc/extensionPack";
import axios from "axios";

/**
 * Set up demo policies
 * @param {SoftwareDeliveryMachine} sdm
 */
export const DemoPolicies: ExtensionPack = {
    ...metadata("demo-policies"),
    configure: sdm => {
        sdm
        // Close all newly created issues
            .addCommand({
                name: "helloworld",
                listener: async cli => cli.addressChannels("Hello world"),
                intent: "hello world",
            })
            .addNewIssueListener(async newIssue => {
                await updateIssue(newIssue.credentials, newIssue.id, newIssue.issue.number, {
                    ...newIssue.issue,
                    state: "closed",
                } as any as Issue);
            })
            // Make sure every project has a LICENSE file in the root
            .addAutofix({
                name: "License",
                pushTest: not(hasFile("LICENSE")),
                transform: async p => {
                    const license = await axios.get("https://www.apache.org/licenses/LICENSE-2.0.txt");
                    return p.addFile("LICENSE", license.data);
                },
            })
            // Lint commit message with rules from https://github.com/marionebl/commitlint/tree/master/@commitlint/config-conventional
            .addPushImpactListener({
                name: "lint commit message",
                action: async i => {
                    const load = require("@commitlint/load");
                    const opts = await load({extends: ["@commitlint/config-conventional"]});

                    const lint = require("@commitlint/lint");
                    const report = await lint(i.commit.message, opts.rules,
                        opts.parserPreset ? {parserOpts: opts.parserPreset.parserOpts} : {});

                    if (!report.valid) {
                        await i.addressChannels(`Commit message _${i.commit.message}_ of \`${i.commit.sha.slice(0, 6)}\` not valid :angry::
${report.errors.map(e => "• " + e.message).join("\n")}`);
                    }
                },
            });
    },
};
