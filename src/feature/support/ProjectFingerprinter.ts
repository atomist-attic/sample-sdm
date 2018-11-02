
import { FingerprintData, Project } from "@atomist/automation-client";

/**
 * Function that can fingerprint a project to find the state of a feature.
 */
export type ProjectFingerprinter<S extends FingerprintData> = (p: Project) => Promise<S>;