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

import { logger } from "@atomist/automation-client";
import { doWithJson } from "@atomist/automation-client/project/util/jsonUtils";
import { CodeTransform } from "@atomist/sdm";
import { findAuthorName } from "../../../commands/generators/common/findAuthorName";
import { NodeProjectCreationParameters } from "../nodeSupport";

export const UpdatePackageJsonIdentification: CodeTransform<NodeProjectCreationParameters> =
    async (project, i) => {
        logger.info("Updating JSON: params=%j", i.parameters);
        const author = await findAuthorName(i.context, i.parameters.screenName)
            .then(authorName => authorName || i.parameters.screenName,
                err => {
                    logger.warn("Cannot query for author name: %s", err.message);
                    return i.parameters.screenName;
                });
        return doWithJson(project, "package.json", pkg => {
            const repoUrl = i.parameters.target.repoRef.url;
            pkg.name = i.parameters.appName;
            pkg.description = i.parameters.target.description;
            pkg.version = i.parameters.version;
            pkg.author = author;
            pkg.repository = {
                type: "git",
                url: `${repoUrl}.git`,
            };
            pkg.homepage = `${repoUrl}#readme`;
            pkg.bugs = {
                url: `${repoUrl}/issues`,
            };
            logger.info("Updated JSON. Result is %j", pkg);
        });
    };
