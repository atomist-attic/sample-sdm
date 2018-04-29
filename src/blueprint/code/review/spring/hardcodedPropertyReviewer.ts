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

import { DefaultReviewComment, ReviewComment } from "@atomist/automation-client/operations/review/ReviewResult";
import { Project } from "@atomist/automation-client/project/Project";
import { saveFromFiles } from "@atomist/automation-client/project/util/projectUtils";
import { IsMaven, ReviewerRegistration } from "@atomist/sdm";

/**
 * Reviewer that finds hard-coded properties
 */
export const HardCodedPropertyReviewer: ReviewerRegistration = {
    name: "HardcodedProperties",
    pushTest: IsMaven,
    action: async pil => {
        return {
            repoId: pil.id,
            comments: await badPropertiesStrings(pil.project),
        };
    },
};

async function badPropertiesStrings(p: Project): Promise<ReviewComment[]> {
    return saveFromFiles(p, "**/*", f =>
        new DefaultReviewComment("info", "hater",
            `Found a file at \`${f.path}\`: We hate all files`,
            {
                path: f.path,
                lineFrom1: 1,
                offset: -1,
            }));
}
