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

import { Parameter } from "@atomist/automation-client";
import { Parameters } from "@atomist/automation-client/decorators";
import { PullRequest } from "@atomist/automation-client/operations/edit/editModes";
import { CodeTransformOrTransforms, CodeTransformRegistration } from "@atomist/sdm";
import { VersionedArtifact } from "@atomist/sdm-pack-spring";
import { addDependencyTransform } from "@atomist/sdm-pack-spring";
import { appendOrCreateFileContent } from "@atomist/sdm/api-helper/project/appendOrCreate";
import { copyFileFromUrl } from "@atomist/sdm/api-helper/project/fileCopy";

const SentryDependency: VersionedArtifact = {
    group: "io.sentry",
    artifact: "sentry-spring",
    version: "1.7.5",
};

const sentryYaml = dsn => `\nraven:
    dsn: '${dsn}'`;

const AddSentryTransform: CodeTransformOrTransforms<AddSentryParams> = [
    addDependencyTransform(SentryDependency),
    // tslint:disable-next-line:max-line-length
    copyFileFromUrl("https://raw.githubusercontent.com/sdm-org/cd20/dc16c15584d77db6cf9a70fdcb4d7bebe24113d5/src/main/java/com/atomist/SentryConfiguration.java",
        "src/main/java/com/atomist/SentryConfiguration.java"),
    async (p, ci) => {
        await appendOrCreateFileContent({
            toAppend: sentryYaml(ci.parameters.dsn),
            path: "src/main/resources/application.yml",
        })(p, ci.context, ci.parameters);
        return appendOrCreateFileContent({
            toAppend: sentryYaml(ci.parameters.dsn),
            path: "src/test/resources/application.yml",
        })(p, ci.context, ci.parameters);
    },
];

@Parameters()
export class AddSentryParams {

    @Parameter()
    public dsn: string;
}

/**
 * Command to add Sentry support to the current project
 * @type {HandleCommand<EditOneOrAllParameters>}
 */
export const AddSentry: CodeTransformRegistration<AddSentryParams> = {
    transform: AddSentryTransform,
    name: "AddSentry",
    paramsMaker: AddSentryParams,
    transformPresentation: () => new PullRequest(
        `add-sentry-${new Date().getTime()}`,
        "Add Sentry support",
        "Adds Sentry (Raven) APM support"),
    intent: "add sentry",
};
