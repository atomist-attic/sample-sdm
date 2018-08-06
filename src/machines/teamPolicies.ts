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
import { SoftwareDeliveryMachine } from "@atomist/sdm";
import {
    GraphGoals,
} from "@atomist/sdm-core";
import { SlocSupport } from "@atomist/sdm-pack-sloc";
import { SonarQubeSupport } from "@atomist/sdm-pack-sonarqube";
import { slackReviewListener } from "@atomist/sdm/api-helper/code/review/slackReviewListener";
import { buildAwareCodeTransforms } from "@atomist/sdm/pack/build-aware-transform";
import { AddApacheLicenseHeaderTransform } from "../commands/editors/license/addHeader";
import { PostToDeploymentsChannel } from "../listener/deployment/postToDeploymentsChannel";
import { capitalizer } from "../listener/issue/capitalizer";
import { requestDescription } from "../listener/issue/requestDescription";
import { thankYouYouRock } from "../listener/issue/thankYouYouRock";
import { PublishNewRepo } from "../listener/repo/publishNewRepo";
import { codeMetrics } from "../pack/codemetrics/codeMetrics";

/**
 * Set up team policies independent of specific stacks
 * @param {SoftwareDeliveryMachine} sdm
 */
export function addTeamPolicies(sdm: SoftwareDeliveryMachine) {
    sdm
        .addNewIssueListener(requestDescription)
        .addNewIssueListener(capitalizer)
        .addClosedIssueListener(thankYouYouRock)
        .addGoalsSetListener(GraphGoals)
        // .addArtifactListeners(OWASPDependencyCheck)
        .addReviewListenerRegistration({
            name: "slack",
            listener: slackReviewListener(),
        })
        .addCodeTransformCommand(AddApacheLicenseHeaderTransform)
        .addNewRepoWithCodeListener(PublishNewRepo)
        // .addCodeReactions(NoPushToDefaultBranchWithoutPullRequest)
        .addDeploymentListener(PostToDeploymentsChannel)
        .addUserJoiningChannelListener(je =>
            je.addressChannels(`Welcome, ${je.joinEvent.user.screenName}`));
    // .addFingerprintDifferenceListeners(diff1)
    sdm.addExtensionPacks(
        buildAwareCodeTransforms(),
        SlocSupport,
    );

    if (sdm.configuration.sdm.sonar && sdm.configuration.sdm.sonar.enabled) {
        sdm.addExtensionPacks(SonarQubeSupport);
    } else {
        logger.info("SonarQube integration not enabled");
    }

    sdm.addExtensionPacks(codeMetrics());
    // summarizeGoalsInGitHubStatus(sdm);

    // sdm.addPushReactions(shutDownDeliveryIf(EverySecondOneGoesThrough));
}
