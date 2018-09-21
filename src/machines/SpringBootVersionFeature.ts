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

import * as _ from "lodash";
import { CodeTransform, TypedFingerprint } from "@atomist/sdm";
import { ComparisonPolicy, ProjectFingerprinter } from "../feature/Feature";
import {
    SpringBootVersionInspection,
    SpringBootVersions
} from "@atomist/sdm-pack-spring/lib/spring/inspect/springBootVersionInspection";
import { AbstractFeature } from "../feature/support/AbstractFeature";
import { IsMaven, setSpringBootVersionTransform } from "@atomist/sdm-pack-spring";

const DefaultSpringBootVersion = "2.0.5.RELEASE";

const SpringBootVersionSnapshotName = "SpringBootVersionSnapshot";

export class SpringBootVersionFingerprint extends TypedFingerprint<{ bootVersion: string }> {

    constructor(public readonly bootVersion: string = DefaultSpringBootVersion) {
        super(SpringBootVersionSnapshotName, "sbv", "0.1.0", { bootVersion });
    }

}

const SpringBootVersionFingerprinter: ProjectFingerprinter<SpringBootVersionFingerprint> = async p => {
    // TODO inelegant
    const versions: SpringBootVersions = await SpringBootVersionInspection(p, undefined);
    return versions.versions.length > 0 ?
        new SpringBootVersionFingerprint(versions.versions[0].version) :
        undefined;
};

export class SpringBootVersionFeature extends AbstractFeature<SpringBootVersionFingerprint> {

    constructor(desiredBootVersion: string = DefaultSpringBootVersion) {
        super(SpringBootVersionSnapshotName, "0.1.0",
            SpringBootVersionFingerprinter, {
                ideal: new SpringBootVersionFingerprint(desiredBootVersion),
                relevant: IsMaven,
            });
        // Later versions are better
        this.addComparison(
            ComparisonPolicy.quality,
            (a, b) => a.bootVersion.localeCompare(b.bootVersion));
    }

    public apply(s: SpringBootVersionFingerprint): CodeTransform {
        return setSpringBootVersionTransform(s.bootVersion);
    }

    public uniques(snapshots: SpringBootVersionFingerprint[]): SpringBootVersionFingerprint[] {
        return _.uniqBy(snapshots, s => s.bootVersion);
    }

}

