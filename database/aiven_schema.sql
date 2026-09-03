CREATE DATABASE IF NOT EXISTS mausam_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mausam_db;

CREATE TABLE users (
    user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    daily_routine VARCHAR(30) NOT NULL,
    outdoor_time VARCHAR(20) NOT NULL,
    weather_interests JSON NOT NULL,
    weather_use VARCHAR(30) NOT NULL,
    secondary_activities JSON NOT NULL DEFAULT (JSON_ARRAY()),
    location_city VARCHAR(120) NULL,
    location_latitude DECIMAL(9, 6) NULL,
    location_longitude DECIMAL(9, 6) NULL,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT users_name_not_blank
        CHECK (length(trim(name)) > 0),
    CONSTRAINT users_weather_interests_is_array
        CHECK (JSON_TYPE(weather_interests) = 'ARRAY'),
    CONSTRAINT users_weather_interests_limit
        CHECK (JSON_LENGTH(weather_interests) BETWEEN 1 AND 3)
);

CREATE TABLE login_data (
    login_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    custom_id VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
    user_id BIGINT UNSIGNED NOT NULL UNIQUE,
    email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT login_data_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT login_data_email_format
        CHECK (email IS NULL OR email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
    CONSTRAINT login_data_custom_id_format
        CHECK (custom_id REGEXP '^[A-Za-z0-9_.-]{3,50}$'),
    CONSTRAINT login_data_bcrypt_hash
        CHECK (password_hash REGEXP '^\\$2[aby]\\$[0-9]{2}\\$')
);

CREATE TABLE auth_sessions (
    session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT auth_sessions_user_fk
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);

