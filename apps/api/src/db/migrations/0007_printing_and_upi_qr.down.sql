-- Migration 0007 Down

ALTER TABLE restaurant_settings
  DROP COLUMN IF EXISTS rupee_symbol_mode,
  DROP COLUMN IF EXISTS receipt_show_qr,
  DROP COLUMN IF EXISTS receipt_show_service_charge,
  DROP COLUMN IF EXISTS receipt_show_item_notes,
  DROP COLUMN IF EXISTS receipt_show_customer,
  DROP COLUMN IF EXISTS receipt_show_gstin,
  DROP COLUMN IF EXISTS receipt_footer_lines,
  DROP COLUMN IF EXISTS receipt_header_lines,
  DROP COLUMN IF EXISTS upi_payee_name,
  DROP COLUMN IF EXISTS upi_vpa;

DROP TABLE IF EXISTS payment_requests CASCADE;
DROP TABLE IF EXISTS print_events CASCADE;
DROP TABLE IF EXISTS print_jobs CASCADE;
DROP TABLE IF EXISTS printer_configurations CASCADE;
