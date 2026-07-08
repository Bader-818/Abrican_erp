/**
 * Thresholds for the critical finance alerts (S13). Business-tunable; centralised
 * so a policy change is a one-line edit.
 */
export const PO_CONSUMPTION_ALERT_PCT = 90; // warn when a PO is ≥ 90% consumed
export const MARGIN_TARGET_PCT = 10; // warn when a job's gross margin falls below this
export const JOB_NOT_INVOICED_DAYS = 7; // warn when completed work is unbilled this long
