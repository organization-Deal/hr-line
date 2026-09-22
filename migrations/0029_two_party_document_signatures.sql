-- P8.25: Standard employee documents use two-party evidence by default.
-- Existing custom template bodies/settings remain unchanged; only the acknowledgement flag
-- for the two certificate templates is enabled so the employee can sign the received copy.
UPDATE document_templates
SET acknowledgement_required = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE code IN ('EMP_CERT','SAL_CERT')
  AND COALESCE(active,1) = 1;
