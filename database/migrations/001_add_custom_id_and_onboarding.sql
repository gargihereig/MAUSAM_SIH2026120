USE mausam_db;

-- Add the new account identifier and onboarding state without recreating existing tables.
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'login_data'
      AND column_name = 'custom_id'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE login_data ADD COLUMN custom_id VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL AFTER login_id',
    'SELECT 1'
);
PREPARE add_custom_id FROM @sql;
EXECUTE add_custom_id;
DEALLOCATE PREPARE add_custom_id;

UPDATE login_data
SET custom_id = email
WHERE custom_id IS NULL
    AND email IS NOT NULL
    AND CHAR_LENGTH(email) BETWEEN 3 AND 50
    AND email REGEXP '^[A-Za-z0-9_.-]{3,50}$';

UPDATE login_data
SET custom_id = CONCAT('legacy_', user_id)
WHERE custom_id IS NULL;

SET @email_nullable = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'login_data'
      AND column_name = 'email'
      AND is_nullable = 'YES'
);
SET @sql = IF(
    @email_nullable = 0,
    'ALTER TABLE login_data MODIFY email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL',
    'SELECT 1'
);
PREPARE allow_null_email FROM @sql;
EXECUTE allow_null_email;
DEALLOCATE PREPARE allow_null_email;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'login_data'
      AND column_name = 'custom_id'
      AND is_nullable = 'NO'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE login_data MODIFY custom_id VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL',
    'SELECT 1'
);
PREPARE require_custom_id FROM @sql;
EXECUTE require_custom_id;
DEALLOCATE PREPARE require_custom_id;

SET @index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'login_data'
      AND index_name = 'uq_login_data_custom_id'
);
SET @sql = IF(
    @index_exists = 0,
    'ALTER TABLE login_data ADD CONSTRAINT uq_login_data_custom_id UNIQUE (custom_id)',
    'SELECT 1'
);
PREPARE add_custom_id_index FROM @sql;
EXECUTE add_custom_id_index;
DEALLOCATE PREPARE add_custom_id_index;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'location_city'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE users ADD COLUMN location_city VARCHAR(120) NULL AFTER weather_use, ADD COLUMN location_latitude DECIMAL(9, 6) NULL AFTER location_city, ADD COLUMN location_longitude DECIMAL(9, 6) NULL AFTER location_latitude, ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE AFTER location_longitude',
    'SELECT 1'
);
PREPARE add_onboarding_fields FROM @sql;
EXECUTE add_onboarding_fields;
DEALLOCATE PREPARE add_onboarding_fields;

UPDATE users
SET onboarding_completed = CASE
    WHEN location_city IS NOT NULL
     AND location_latitude IS NOT NULL
     AND location_longitude IS NOT NULL
    THEN TRUE
    ELSE FALSE
END;

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'secondary_activities'
);
SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE users ADD COLUMN secondary_activities JSON NOT NULL DEFAULT (JSON_ARRAY()) AFTER weather_use',
    'SELECT 1'
);
PREPARE add_secondary_activities FROM @sql;
EXECUTE add_secondary_activities;
DEALLOCATE PREPARE add_secondary_activities;