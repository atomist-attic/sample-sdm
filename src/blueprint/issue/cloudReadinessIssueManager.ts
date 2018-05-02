import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { deepLink } from "@atomist/automation-client/util/gitHub";
import { ReviewListener } from "@atomist/sdm/common/listener/ReviewListener";
import { ImportDotStarCategory } from "../code/review/java/importDotStarReviewer";
import { BodyFormatter, singleIssueManagingReviewListener } from "./singleIssueManagingReviewListener";

import * as _ from "lodash";
import { ImportFileIoCategory } from "../code/review/java/fileIoImportReviewer";
import { HardcodePropertyCategory } from "../code/review/java/spring/hardcodedPropertyReviewer";

const CloudReadinessIssueTitle = "Service Not Yet Cloud Native";
const CloudReadinessReviewCommentCategories = [
    ImportDotStarCategory,
    ImportFileIoCategory,
    HardcodePropertyCategory,
];

const CloudReadinessCommentFilter = rc => CloudReadinessReviewCommentCategories.includes(rc.category);

const CloudReadinessBodyFormatter: BodyFormatter = (comments, rr) => {
    const grr = rr as GitHubRepoRef;
    let body = "";

    const uniqueCategories = _.uniq(comments.map(c => c.category)).sort();
    uniqueCategories.forEach(category => {
        body += `## ${category}\n`;
        body += comments
            .filter(c => c.category === category)
            .map(c =>
                `- \`${c.sourceLocation.path || ""}\`: [${c.detail}](${deepLink(grr, c.sourceLocation)})\n`);
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
