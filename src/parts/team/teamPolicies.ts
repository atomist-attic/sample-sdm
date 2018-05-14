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

import { Configuration } from "@atomist/automation-client";
import {
    GraphGoalsToSlack,
    OnDryRunBuildComplete,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { slackReviewListener } from "@atomist/sdm/common/delivery/code/review/support/slackReviewListener";
import {
    SonarCubeOptions,
    SonarQubeReviewer,
} from "../../blueprint/code/review/SonarQubeReviewer";
import { PostToDeploymentsChannel } from "../../blueprint/deploy/postToDeploymentsChannel";
import { capitalizer } from "../../blueprint/issue/capitalizer";
import { CloudReadinessIssueManager } from "../../blueprint/issue/cloudReadinessIssueManager";
import { requestDescription } from "../../blueprint/issue/requestDescription";
import { thankYouYouRock } from "../../blueprint/issue/thankYouYouRock";
import { PublishNewRepo } from "../../blueprint/repo/publishNewRepo";
import { slocCommand } from "../../commands/editors/helper/sloc";
import { addApacheLicenseHeaderEditor } from "../../commands/editors/license/addHeader";

/**
 * Set up team policies
 * @param {SoftwareDeliveryMachine} sdm
 */
export function addTeamPolicies(sdm: SoftwareDeliveryMachine,
                                configuration: Configuration) {
    sdm
        .addNewIssueListeners(requestDescription, capitalizer)
        .addClosedIssueListeners(thankYouYouRock)
        .addGoalsSetListeners(GraphGoalsToSlack)
        // .addArtifactListeners(OWASPDependencyCheck)
        .addReviewListeners(
            slackReviewListener(),
            CloudReadinessIssueManager,
        )
        .addEditors(
            () => addApacheLicenseHeaderEditor,
        )
        .addNewRepoWithCodeActions(
            PublishNewRepo)
        // .addCodeReactions(NoPushToDefaultBranchWithoutPullRequest)
        .addDeploymentListeners(PostToDeploymentsChannel)
        .addSupportingCommands(() => slocCommand)
        .addSupportingEvents(OnDryRunBuildComplete)
        .addUserJoiningChannelListeners(je =>
            je.addressChannels(`Welcome, ${je.joinEvent.user.screenName}`));
    // .addFingerprintDifferenceListeners(diff1)

    if (configuration.sdm.sonar && configuration.sdm.sonar.enabled) {
        sdm.addReviewerRegistrations(SonarQubeReviewer(configuration.sdm.sonar as SonarCubeOptions));
    }

}
