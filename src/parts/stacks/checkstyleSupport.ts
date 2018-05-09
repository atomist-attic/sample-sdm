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

import {
    Configuration,
    logger,
} from "@atomist/automation-client";
import { SoftwareDeliveryMachine } from "@atomist/sdm";
import { checkstyleReviewerRegistration } from "@atomist/sdm";

export interface CheckstyleSupportOptions {
    enabled: boolean;
    path: boolean;
    reviewOnlyChangedFiles: boolean;
}

/**
 * Configuration common to Java SDMs, wherever they deploy
 * @param {SoftwareDeliveryMachine} softwareDeliveryMachine
 * @param {{useCheckstyle: boolean}} opts
 */
export function addCheckstyleSupport(softwareDeliveryMachine: SoftwareDeliveryMachine,
                                     configuration: Configuration) {
    const opts = configuration.sdm.checkstyle as CheckstyleSupportOptions;

    if (opts.enabled) {
        const checkStylePath = opts.path;
        if (!!checkStylePath) {
            softwareDeliveryMachine.addReviewerRegistrations(checkstyleReviewerRegistration(opts.reviewOnlyChangedFiles));
        } else {
            logger.warn("Skipping Checkstyle; to enable it, set 'sdm.checkstyle.path' to the location of a downloaded checkstyle jar");
        }
    }
}
