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
    FingerprintData,
} from "@atomist/automation-client";
import {
    CodeInspectionRegistration,
    CodeTransform,
    FingerprinterRegistration,
    PushTest,
    ReviewerRegistration,
} from "@atomist/sdm";
import { RatingScale } from "./RatingScale";
import { ProjectFingerprinter } from "./support/ProjectFingerprinter";

export enum ComparisonPolicy {
    quality = "quality",
    size = "size",
}

export interface Rater<S extends FingerprintData, V> {
    ratingScale: RatingScale<V>;
    rate: (s: S) => V;
}

/**
 * Interface for working with a particular kind of fingerprint.
 * An example of a feature is use of Spring Boot.
 * This feature can exist in a number of versions: It is present regardless of
 * which version it's at. FeatureManager can usually be ranked by version, with
 * later versions considered better.
 * This feature is relevant only to JVM projects.
 * This feature can be added to or removed from a project.
 *
 * The status of this feature can be determined by looking at a Maven POM file
 * and any relevant configuration or Java code. (A feature may be spread
 * across multiple files.)
 */
export interface FeatureRegistration<S extends FingerprintData = FingerprintData> {

    readonly name: string;

    /**
     * Provide a human-readable summary of this fingerprint
     * @param {S} s
     * @return {string}
     */
    summary(s: S): string;

    /**
     * Version of this FeatureRegistration.
     * Ratings are only guaranteed accurate across versions.
     * Not the same as the version of the feature itself:
     * e.g. FeatureRegistration 0.1.0 might be able to handle all versions
     * of the related feature less than 2.0.0.
     */
    readonly version: string;

    /**
     * PushTest: Is this feature relevant to this project.
     * For example, if it's a Spring Boot project a Spring Boot starter is relevant.
     * If the project doesn't use Spring Boot, not starter is relevant.
     */
    readonly isRelevant: PushTest;

    /**
     * PushTest: Is this feature present in this project?
     * It may be present in another version, in which case the PushTest
     * will return true.
     */
    readonly isPresent: PushTest;

    /**
     * Fingerprint this project
     */
    readonly projectFingerprinter: ProjectFingerprinter<S>;

    /**
     * Fingerprint projects.
     */
    readonly fingerprinterRegistration: FingerprinterRegistration;

    /**
     * Return a transform to get a project to the given fingerprint state.
     * Must be idempotent.
     * Throw an exception if this is impossible.
     */
    convergenceTransform?(s: S): CodeTransform;

    /**
     * Return a transform to removalTransform this feature altogether from a project
     */
    removalTransform?: CodeTransform;

    /**
     * Inspection against this fingerprint
     */
    inspection: CodeInspectionRegistration<S>;

    /**
     * Reviewer for this feature, reflecting on its quality
     */
    reviewer?: ReviewerRegistration;

    supportedComparisonPolicies: ComparisonPolicy[];

    /**
     * Order by a certain policy. This is not a fixed rating scale.
     * E.g. there is no fixed scale for project size.
     * Bigger numbers are better
     * Throw an error if this comparison policy is unsupported
     * @param {S} a
     * @param {S} b
     * @param how policy for comparison
     * @return {number}
     */
    compare(a: S, b: S, how: ComparisonPolicy): number;

    supportedRatingScales: Array<RatingScale<any>>;

    rate<V>(s: S, scale: RatingScale<V>): V;

    /**
     * Return the distinct values in this array. Useful in ranking.
     * @param {S[]} snapshots
     * @return {S[]}
     */
    distinct(snapshots: S[]): S[];

}
