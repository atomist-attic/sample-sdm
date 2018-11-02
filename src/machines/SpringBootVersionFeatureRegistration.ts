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
import {
    CodeTransform,
    TypedFingerprint,
} from "@atomist/sdm";
import {
    SpringBootVersionInspection,
    SpringBootVersions,
} from "@atomist/sdm-pack-spring/lib/spring/inspect/springBootVersionInspection";
import { AbstractFeatureRegistration } from "../feature/AbstractFeatureRegistration";
import {
    IsMaven,
    setSpringBootVersionTransform,
} from "@atomist/sdm-pack-spring";
import { ProjectFingerprinter } from "../feature/support/ProjectFingerprinter";
import { ComparisonPolicy } from "../feature/FeatureRegistration";

const SpringBootVersionSnapshotName = "SpringBootVersionSnapshot";

export class SpringBootVersionFingerprint extends TypedFingerprint<{ bootVersion: string }> {

    constructor(public readonly bootVersion: string) {
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

export class SpringBootVersionFeatureRegistration extends AbstractFeatureRegistration<SpringBootVersionFingerprint> {

    constructor() {
        super(SpringBootVersionSnapshotName, "0.1.0",
            SpringBootVersionFingerprinter, {
                relevant: IsMaven,
            });
        // Later versions are better
        this.addComparison(
            ComparisonPolicy.quality,
            undefinedIsLess((a, b) => a.bootVersion.localeCompare(b.bootVersion)));
    }

    public convergenceTransform(s: SpringBootVersionFingerprint): CodeTransform {
        return setSpringBootVersionTransform(s.bootVersion);
    }

    public distinct(snapshots: SpringBootVersionFingerprint[]): SpringBootVersionFingerprint[] {
        return _.uniqBy(snapshots, s => s.bootVersion);
    }

}

function undefinedIsLess<T>(f: (a: T, b: T) => number): (a: T, b: T) => number {
    return (a, b) => {
        if (a == undefined) {
            return 1;
        }
        if (b == undefined) {
            return -1;
        }
        return f(a, b);
    }
}
