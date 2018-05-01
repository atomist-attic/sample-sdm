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
import { ImportDotStarCategory } from "../code/review/java/importDotStarReviewer";
import { OnFirstPushToRepo } from "@atomist/sdm";
import Push = OnFirstPushToRepo.Push;
import * as slack from "@atomist/slack-messages";
import * as _ from "lodash";
import { ReviewComment } from "@atomist/automation-client/operations/review/ReviewResult";
import * as stringify from "json-stringify-safe";


const CloudReadinessIssueTitle = "Cloud Readiness";
const CloudReadinessReviewCommentCategories = [ImportDotStarCategory];

export const IssueRaisingReviewListener: ReviewListener = async (ri: ReviewListenerInvocation) => {
    if (ri.push.branch !== ri.push.repo.defaultBranch) {
        // We only care about pushers to the default branch
        return;
    }
    const relevantComments = ri.review.comments.filter(rc => CloudReadinessReviewCommentCategories.includes(rc.category));
    // Find the well-known issue if there is one
    const existingIssue = await findIssue((ri.credentials as TokenCredentials).token, ri.id as GitHubRepoRef, CloudReadinessIssueTitle);

    if (relevantComments.length === 0) {
        logger.debug("0 of %d comments were relevant", ri.review.comments.length);
        if (existingIssue) {
            // close it
            logger.info("Closing issue %d because all comments have been addressed", existingIssue.number);
            const congrats: string = `The last review problem was fixed by ${who(ri.push)} when they pushed ${linkToSha(ri.id)}`;
            await updateIssue(ri.credentials, ri.id, {...existingIssue, state: "closed", body: congrats});
        }
        return;
    }

    // there are some comments
    if (!existingIssue) {
        logger.info("Creating issue '%s' from review comments", CloudReadinessIssueTitle);
        await createIssue(ri.credentials, ri.id,
            {
                title: CloudReadinessIssueTitle,
                body: bodyFromComments(relevantComments),
                // labels? assignees?
            });
    } else {
        logger.info("Updating issue %d with the latest comments", existingIssue.number);
        await updateIssue(ri.credentials, ri.id,
            {
                ...existingIssue,
                state: "open",
                body: bodyFromComments(relevantComments)
            });
    }
    // Should we catch exceptions and not fail the Goal if this doesn't work?
};

function bodyFromComments(ri: ReviewComment[]): string {
    return stringify(ri);
}

function who(push: Push) {
    const screenName: string = _.get(push, "after.committer.person.chatId.screenName");
    if (screenName) {
        return slack.user(screenName);
    }
    return _.get(push, "after.committer.login", "someone");
}

function linkToSha(id) {
    return slack.url(id.url + "/tree/" + id.sha, id.sha.substr(0, 7));
}

interface KnownIssue extends Issue {
    state: "open" | "closed";
    number: number;
}

async function updateIssue(credentials: ProjectOperationCredentials,
                           rr: RemoteRepoRef,
                           issue: KnownIssue) {
    const token = (credentials as TokenCredentials).token;
    const grr = rr as GitHubRepoRef;
    const url = `${grr.apiBase}/repos/${rr.owner}/${rr.repo}/issues/${issue.number}`;
    console.log(`Request to '${url}' to update issue`);
    await axios.patch(url, issue, authHeaders(token));
}

async function createIssue(credentials: ProjectOperationCredentials,
                           rr: RemoteRepoRef,
                           issue: Issue) {
    const token = (credentials as TokenCredentials).token;
    const grr = rr as GitHubRepoRef;
    const url = `${grr.apiBase}/repos/${rr.owner}/${rr.repo}/issues`;
    console.log(`Request to '${url}' to create issue`);
    await axios.put(url, issue, authHeaders(token));
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
    return returnedIssues.filter(i => i.title === title).sort(openFirst)[0];
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