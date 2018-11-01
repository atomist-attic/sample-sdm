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
    ComparisonPolicy,
    Feature,
    ProjectFingerprinter,
    Rater,
} from "../Feature";
import { RatingScale } from "../RatingScale";
import {
    CodeInspectionRegistration,
    CodeTransform,
    FingerprinterRegistration,
    isMapping,
    predicatePushTest,
    PushTest,
    ReviewerRegistration,
} from "@atomist/sdm";
import { ProjectPredicate } from "@atomist/sdm/lib/api/mapping/PushTest";
import { FingerprintData } from "@atomist/automation-client";

export interface Comparison<S extends FingerprintData> {
    policy: ComparisonPolicy;
    compare: (a: S, b: S) => number;
}

/**
 * Convenient superclass for Feature, allowing comparison
 * and rating functions
 */
export abstract class AbstractFeature<S extends FingerprintData> implements Feature<S> {

    public readonly remove: CodeTransform;

    public readonly reviewer: ReviewerRegistration;

    private readonly comparisons: Array<Comparison<S>> = [];

    private readonly raters: Array<Rater<S, any>> = [];

    /**
     * By default all features are relevant
     * @param {string} name
     * @param {string} version
     * @param projectFingerprinter
     * @param opts
     */
    protected constructor(public readonly name: string,
                          public readonly version: string,
                          public readonly projectFingerprinter: ProjectFingerprinter<S>,
                          private readonly opts: {
                              remove?: CodeTransform,
                              reviewer?: ReviewerRegistration,
                              relevant?: PushTest | ProjectPredicate,
                          } = {}) {
        this.remove = opts.remove;
        this.reviewer = opts.reviewer;
    }

    /**
     * Override for more info
     * @param {S} s
     * @return {string}
     */
    public summary(s: S): string {
        if (s == undefined) {
            return "feature is null"
        }
        return JSON.stringify(s.data);
    }

    get fingerprinterRegistration(): FingerprinterRegistration {
        return {
            name: this.name,
            action: async pu => this.projectFingerprinter(pu.project),
            pushTest: this.isRelevant,
        };
    }

    get isRelevant(): PushTest {
        if (!this.opts.relevant) {
            // Always relevant if not specified
            return predicatePushTest(this.name, async () => true);
        }
        return isMapping(this.opts.relevant) ?
            this.opts.relevant :
            predicatePushTest(this.name, this.opts.relevant as ProjectPredicate);
    }

    get isPresent(): PushTest {
        return predicatePushTest(this.name, async p => {
            const found = await this.projectFingerprinter(p);
            return !!found;
        });
    }

    get inspection(): CodeInspectionRegistration<S> {
        return {
            name: `inspect=${this.name}`,
            inspection: async (p, i) => {
                return this.projectFingerprinter(p);
            },
        };
    }

    public addComparison(policy: ComparisonPolicy, compare: (a: S, b: S) => number): this {
        this.comparisons.push({ policy, compare });
        return this;
    }

    get supportedComparisonPolicies() {
        return this.comparisons.map(c => c.policy);
    }

    public compare(a: S, b: S, how: ComparisonPolicy): number {
        const comparison = this.comparisons.find(c => c.policy === how);
        if (!comparison) {
            throw new Error(`Unsupported comparison policy '${how}'`);
        }
        return comparison.compare(a, b);
    }

    public addRating<V>(ratingScale: RatingScale<V>, rate: (s: S) => V): this {
        this.raters.push({ ratingScale, rate });
        return this;
    }

    get supportedRatingScales() {
        return this.raters.map(c => c.ratingScale);
    }

    public rate<V>(s: S, scale: RatingScale<V>): V {
        const rater = this.raters.find(c => c.ratingScale === scale);
        if (!rater) {
            throw new Error(`Unsupported rating scale  '${scale}'`);
        }
        return rater.rate(s);
    }

    public abstract uniques(snapshots: S[]): S[];

}
