import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { deepLink } from "@atomist/automation-client/util/gitHub";
import { ReviewListener } from "@atomist/sdm/common/listener/ReviewListener";
import { ImportDotStarCategory } from "../code/review/java/importDotStarReviewer";
import { BodyFormatter, singleIssueManagingReviewListener } from "./singleIssueManagingReviewListener";

import * as _ from "lodash";

const CloudReadinessIssueTitle = "Service Not Yet Cloud Native";
const CloudReadinessReviewCommentCategories = [ImportDotStarCategory];

const CloudReadinessCommentFilter = rc => CloudReadinessReviewCommentCategories.includes(rc.category);

const CloudReadinessBodyFormatter: BodyFormatter = (comments, rr) => {
    const grr = rr as GitHubRepoRef;
    let body = "# Cloud Readiness Report: Issues Found\n\n";

    const uniqueCategories = _.uniq(comments.map(c => c.category)).sort();
    uniqueCategories.forEach(category => {
        body += `## ${category}\n`;
        body += comments
            .filter(c => c.category === category)
            .map(c =>
                `- ${c.detail}: [See](${deepLink(grr, c.sourceLocation)})\n`);
    });
    return body;
};
/**
 * Manage cloud readiness issue
 * @type {ReviewListener}
 */
export const CloudReadinessIssueManager: ReviewListener = singleIssueManagingReviewListener(
    CloudReadinessCommentFilter,
    CloudReadinessIssueTitle,
    CloudReadinessBodyFormatter);
