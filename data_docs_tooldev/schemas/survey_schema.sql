-- =============================================================================
-- SURVEY MANAGEMENT MODULE - PRODUCTION DATABASE DDL SCHEMA
-- Target RDBMS: PostgreSQL 14+ / Compatible SQLite 3
-- Author: Lead Tech & Architecture Team
-- =============================================================================

CREATE TABLE IF NOT EXISTS survey_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS surveys (
    id BIGSERIAL PRIMARY KEY,
    survey_code VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INT REFERENCES survey_categories(id) ON DELETE RESTRICT,
    org_unit_id VARCHAR(64) NOT NULL, -- Multi-tenant / OrgUnit filter
    status VARCHAR(32) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Published', 'Expired', 'Archived'
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    allow_multiple_submissions BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    published_by VARCHAR(64),
    
    -- Audit trail & Concurrency
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(64),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(64),
    row_version INT NOT NULL DEFAULT 1,

    CONSTRAINT chk_survey_time_range CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS survey_questions (
    id BIGSERIAL PRIMARY KEY,
    survey_id BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    question_order INT NOT NULL DEFAULT 1,
    question_type VARCHAR(32) NOT NULL, -- 'SingleChoice', 'MultipleChoice', 'TextRating', 'OpenText'
    content TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    validation_regex VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS survey_options (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    option_order INT NOT NULL DEFAULT 1,
    option_label VARCHAR(255) NOT NULL,
    score_weight NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_submissions (
    id BIGSERIAL PRIMARY KEY,
    survey_id BIGINT NOT NULL REFERENCES surveys(id) ON DELETE RESTRICT,
    participant_token VARCHAR(128) NOT NULL, -- Pseudonymized hash for anonymous surveys
    user_id VARCHAR(64),                     -- NULL if is_anonymous = TRUE
    ip_address VARCHAR(45),
    user_agent VARCHAR(512),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT uq_survey_user UNIQUE (survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS survey_answers (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES survey_submissions(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES survey_questions(id) ON DELETE RESTRICT,
    selected_option_id BIGINT REFERENCES survey_options(id) ON DELETE RESTRICT,
    text_answer TEXT,
    numeric_rating INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    survey_id BIGINT REFERENCES surveys(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL, -- 'CREATE', 'UPDATE', 'PUBLISH', 'SOFT_DELETE', 'EXPORT'
    performed_by VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_surveys_org_unit_status ON surveys(org_unit_id, status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_surveys_dates ON surveys(start_time, end_time) WHERE status = 'Published';
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_id ON survey_questions(survey_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_survey_options_question_id ON survey_options(question_id);
CREATE INDEX IF NOT EXISTS idx_survey_submissions_survey_id ON survey_submissions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_submission_id ON survey_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_survey_audit_survey_id ON survey_audit_logs(survey_id);
