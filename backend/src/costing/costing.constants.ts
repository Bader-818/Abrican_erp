/**
 * Labour hour weightings used when turning timesheet hours into a labour cost.
 * These are business assumptions (confirm with Finance): overtime is paid at a
 * premium; standby and travel are costed at the flat rate. Centralised here so a
 * rate-policy change is a one-line edit.
 */
export const OVERTIME_MULTIPLIER = 1.5;
export const STANDBY_MULTIPLIER = 1.0;
export const TRAVEL_MULTIPLIER = 1.0;
