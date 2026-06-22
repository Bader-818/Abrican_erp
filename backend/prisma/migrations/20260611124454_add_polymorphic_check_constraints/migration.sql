-- Enforce polymorphic relation invariants at the database level (defense in
-- depth; service-layer DTO validation rejects invalid combinations first).

-- JobAssignment: exactly one of employeeId/crewId/vehicleId/equipmentId must be set.
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignment_one_resource_chk" CHECK (
  (CASE WHEN "employeeId" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "crewId" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "vehicleId" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "equipmentId" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- Document: at most one of employeeId/vehicleId/equipmentId/contractId/clientId may be set
-- (none set means the document relates to the company as a whole).
ALTER TABLE "documents" ADD CONSTRAINT "document_one_entity_chk" CHECK (
  (CASE WHEN "employeeId" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "vehicleId" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "equipmentId" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "contractId" IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN "clientId" IS NOT NULL THEN 1 ELSE 0 END) <= 1
);
