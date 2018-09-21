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

import { Fingerprint, Project } from "@atomist/automation-client";
import { CodeInspectionRegistration, CodeTransform, FingerprinterRegistration, PushTest, ReviewerRegistration } from "@atomist/sdm";
import { RatingScale } from "./RatingScale";

export enum ComparisonPolicy {
    quality = "quality",
    size = "size",
}

export interface Rater<S extends Fingerprint, V> {
    ratingScale: RatingScale<V>;
    rate: (s: S) => V;
}

export type ProjectFingerprinter<S extends Fingerprint> = (p: Project) => Promise<S>;

/**
 * Interface for working with a particular kind of fingerprint.
 * Inherited action takes a snapshot
 */
export interface Feature<S extends Fingerprint = Fingerprint> {

    readonly name: string;

    summary(s: S): string;

    /**
     * Ratings are only guaranteed accurate across versions
     */
    readonly version: string;

    /**
     * Ideal state of this fingerprint, if such a thing makes sense.
     * E.g. the latest version. We can then apply that.
     */
    readonly ideal?: S;

    /**
     * PushTest: Is this feature relevant to this project
     */
    readonly isRelevant: PushTest;

    /**
     * PushTest: Is this feature present in this project
     */
    readonly isPresent: PushTest;

    readonly projectFingerprinter: ProjectFingerprinter<S>;

    /**
     * Fingerprint projects. Includes PushTest
     */
    readonly fingerprinterRegistration: FingerprinterRegistration;

    /**
     * Return a transform to get a project to the given fingerprint state
     */
    apply?(s: S): CodeTransform;

    /**
     * Return a transform to remove this feature altogether from a project
     */
    remove?: CodeTransform;

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
     * Return the unique values in this array
     * @param {S[]} snapshots
     * @return {S[]}
     */
    uniques(snapshots: S[]): S[];

}
