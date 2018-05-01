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

import { ReviewListener, ReviewListenerInvocation } from "@atomist/sdm/common/listener/ReviewListener";

import { Issue } from "@atomist/automation-client/util/gitHub";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { logger } from "@atomist/automation-client";
import { authHeaders } from "@atomist/sdm/util/github/ghub";
import axios from "axios";
import { ProjectOperationCredentials, TokenCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";

const CloudReadinessIssueTitle = "Cloud Readiness";

export const IssueRaisingReviewListener: ReviewListener = async (ri: ReviewListenerInvocation) => {
    if (ri.push.branch !== ri.push.repo.defaultBranch) {
        // We only care about pushers to the default branch
        return;
    }
    // Find the well-known issue if there is one
    const existingIssue = findIssue((ri.credentials as TokenCredentials).token, ri.id as GitHubRepoRef, CloudReadinessIssueTitle);
    if (!existingIssue) {
        // create it
    } else {
        // replace the body? and set state to open
    }
};

interface KnownIssue extends Issue {
    state: "open" | "closed";
    number: number;
}

// find the most recent open (or closed, if none are open) issue with precisely this title
async function findIssue(credentials: ProjectOperationCredentials,
                    rr: RemoteRepoRef,
                    title: string): Promise<KnownIssue> {
    const token = (credentials as TokenCredentials).token;
    const grr = rr as GitHubRepoRef;
    const url = `${grr.apiBase}/search/issues?q=is:issue+user:${rr.owner}+repo:${rr.repo}+"${title}"`;
    console.log(`Request to '${url}' to get issues`);
    const returnedIssues: KnownIssue[] = await axios.get(url, authHeaders(token)).then(r => r.data.items);
    return returnedIssues.sort(openFirst).filter(i => i.title === title)[0];
}

function openFirst(a: KnownIssue, b: KnownIssue): number {
    if (a.state === "open" && b.state === "closed") {
        return -1;
    }
    if (b.state === "open" && a.state === "closed") {
        return 1;
    }
    return b.number - a.number; // if same state, most recent one first.
}