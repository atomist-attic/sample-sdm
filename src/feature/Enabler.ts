import { AutoCodeInspection, Fingerprint as FingerprintGoal, PushImpact, SoftwareDeliveryMachine } from "@atomist/sdm";

// TODO moves along with extension pack

/**
 * Goals in use in an SDM that should be customized by an Enabler
 */
export interface GoalsToCustomize {

    pushImpactGoal?: PushImpact,
    inspectGoal?: AutoCodeInspection,
    fingerprintGoal?: FingerprintGoal,
}

/**
 * Enable the SDM with given capabilities including customization
 * of well-known goal instances
 */
export interface Enabler {

    /**
     * Enable a feature in the SDM with the given goals
     * @param {SoftwareDeliveryMachine} sdm
     * @param {GoalsToCustomize} goals
     */
    enable(sdm: SoftwareDeliveryMachine, goals: GoalsToCustomize): void;


}