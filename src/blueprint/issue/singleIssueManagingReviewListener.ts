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

import { logger } from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import {
    ProjectOperationCredentials,
    TokenCredentials,
} from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { ReviewComment } from "@atomist/automation-client/operations/review/ReviewResult";
import { Issue } from "@atomist/automation-client/util/gitHub";
import { OnPushToAnyBranch } from "@atomist/sdm";
import { authHeaders } from "@atomist/sdm/util/github/ghub";
import * as slack from "@atomist/slack-messages";
import axios from "axios";
import * as stringify from "json-stringify-safe";
import * as _ from "lodash";
import Push = OnPushToAnyBranch.Push;

export type CommentFilter = (r: ReviewComment) => boolean;

export type BodyFormatter = (comments: ReviewComment[], rr: RemoteRepoRef) => string;

/**
 * Manage a single issue for all these review problems
 * @param commentFilter filter for relevant review comments
 * @param title title of the issue to manage
 * @param bodyFormatter function to create body from comments
 * @return {Promise<void>}
 * @constructor
 */
export function singleIssueManagingReviewListener(commentFilter: CommentFilter,
                                                  title: string,
                                                  bodyFormatter: BodyFormatter): ReviewListener {
    return async (ri: ReviewListenerInvocation) => {
        if (ri.push.branch !== ri.push.repo.defaultBranch) {
            // We only care about pushers to the default branch
            return;
        }
        const relevantComments = ri.review.comments.filter(commentFilter);
        const existingIssue = await findIssue(ri.credentials, ri.id as GitHubRepoRef, title);
        if (relevantComments.length === 0) {
            if (existingIssue) {
                logger.info("Closing issue %d because all comments have been addressed", existingIssue.number);
                const congrats: string = `The last review problem was fixed by ${who(ri.push)} when they pushed ${linkToSha(ri.id)}`;
                await updateIssue(ri.credentials, ri.id, {...existingIssue, state: "closed", body: congrats});
            }
            return;
        }

        // there are some comments
        if (!existingIssue) {
            const issue = {
                title,
                body: bodyFormatter(relevantComments, ri.id),
                // labels? assignees?
            };
            logger.info("Creating issue %j from review comments", issue);
            await createIssue(ri.credentials, ri.id, issue);
        } else {
            // Update the issue if necessary, reopening it if need be
            const body = bodyFormatter(relevantComments, ri.id);
            if (body !== existingIssue.body) {
                logger.info("Updating issue %d with the latest comments", existingIssue.number);
                await updateIssue(ri.credentials, ri.id,
                    {
                        ...existingIssue,
                        state: "open",
                        body,
                    });
            } else {
                logger.info("Not updating issue %d as body has not changed", existingIssue.number);
            }
        }
        // Should we catch exceptions and not fail the Goal if this doesn't work?
    };
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
    url: string;
}

// update the state and body of an issue.
async function updateIssue(credentials: ProjectOperationCredentials,
                           rr: RemoteRepoRef,
                           issue: KnownIssue) {
    const safeIssue = {
        state: issue.state,
        body: issue.body,
    };
    const token = (credentials as TokenCredentials).token;
    const grr = rr as GitHubRepoRef;
    const url = encodeURI(`${grr.apiBase}/repos/${rr.owner}/${rr.repo}/issues/${issue.number}`);
    logger.info(`Request to '${url}' to update issue`);
    await axios.patch(url, safeIssue, authHeaders(token)).catch(err => {
        logger.error("Failure updating issue. response: %s", stringify(err.response.data));
        throw err;
    });
}

async function createIssue(credentials: ProjectOperationCredentials,
                           rr: RemoteRepoRef,
                           issue: Issue) {
    const token = (credentials as TokenCredentials).token;
    const grr = rr as GitHubRepoRef;
    const url = `${grr.apiBase}/repos/${rr.owner}/${rr.repo}/issues`;
    logger.info(`Request to '${url}' to create issue`);
    await axios.post(url, issue, authHeaders(token));
}

// find the most recent open (or closed, if none are open) issue with precisely this title
async function findIssue(credentials: ProjectOperationCredentials,
                         rr: RemoteRepoRef,
                         title: string): Promise<KnownIssue> {
    const token = (credentials as TokenCredentials).token;
    const grr = rr as GitHubRepoRef;
    const url = encodeURI(`${grr.apiBase}/search/issues?q=is:issue+user:${rr.owner}+repo:${rr.repo}+"${title}"`);
    logger.info(`Request to '${url}' to get issues`);
    const returnedIssues: KnownIssue[] = await axios.get(url, authHeaders(token)).then(r => r.data.items);
    console.log(stringify(returnedIssues, null, 2))
    return returnedIssues.filter(i =>
        i.title === title
        && i.url.includes(`/${rr.owner}/${rr.repo}/issues/`))
        .sort(openFirst)[0];
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
