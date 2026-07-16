-- MG AutoTech schema-only production baseline
-- Source project ref: jujaeyvyaeesmipihrrw
-- Source access: SELECT-only pg_catalog/information_schema metadata via authenticated Supabase connector
-- Generated: 2026-07-16 (Europe/Berlin)
-- Contains application-owned public schema DDL only. No application rows, auth users, storage objects, firmware, PII, or credentials.
-- Supabase-owned supabase_admin default privileges are retained from the managed platform and are not altered here.

BEGIN;
SET LOCAL check_function_bodies = false;
SET LOCAL search_path = public, extensions;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


-- Sequences
CREATE SEQUENCE public.customer_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 10001 CACHE 1 NO CYCLE;


-- Tables
CREATE TABLE public.ai_accuracy_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope_type text NOT NULL,
    scope_key text NOT NULL,
    total_reviewed integer DEFAULT 0 NOT NULL,
    auto_label_correct integer DEFAULT 0 NOT NULL,
    auto_label_partial integer DEFAULT 0 NOT NULL,
    auto_label_wrong integer DEFAULT 0 NOT NULL,
    precision_score numeric DEFAULT 0 NOT NULL,
    review_coverage numeric DEFAULT 0 NOT NULL,
    average_quality_score numeric DEFAULT 0 NOT NULL,
    confusion_json jsonb,
    last_calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_cluster_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_id uuid NOT NULL,
    training_sample_id uuid NOT NULL,
    membership_score numeric DEFAULT 0 NOT NULL,
    membership_reasons jsonb,
    is_outlier boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_dataset_file_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    filename text NOT NULL,
    file_role_guess text DEFAULT 'unknown'::text NOT NULL,
    file_extension text,
    file_size bigint,
    fingerprint text,
    safe_storage_reference text,
    raw_storage_path text,
    ecu_family_guess text,
    ecu_type_guess text,
    sw_number_guess text,
    hw_number_guess text,
    vehicle_guess jsonb DEFAULT '{}'::jsonb NOT NULL,
    service_label_guess jsonb DEFAULT '[]'::jsonb NOT NULL,
    provider_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    validation_status text DEFAULT 'pending'::text NOT NULL,
    privacy_status text DEFAULT 'pending'::text NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_dataset_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text NOT NULL,
    source_name text,
    source_reference text,
    provider_name text,
    import_mode text DEFAULT 'dry_run'::text NOT NULL,
    dry_run boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_files integer DEFAULT 0 NOT NULL,
    candidate_pairs integer DEFAULT 0 NOT NULL,
    confirmed_pairs integer DEFAULT 0 NOT NULL,
    duplicates integer DEFAULT 0 NOT NULL,
    rejected integer DEFAULT 0 NOT NULL,
    needs_review integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_dataset_pair_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    ori_candidate_id uuid,
    mod_candidate_id uuid,
    pair_confidence integer DEFAULT 0 NOT NULL,
    pairing_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    ecu_match_score integer DEFAULT 0 NOT NULL,
    file_size_relation text,
    sw_hw_match boolean DEFAULT false NOT NULL,
    service_label_guess jsonb DEFAULT '[]'::jsonb NOT NULL,
    actual_service_labels jsonb DEFAULT '[]'::jsonb NOT NULL,
    changed_region_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    map_attribution_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    quality_score integer DEFAULT 0 NOT NULL,
    quality_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    learning_recommendation text DEFAULT 'needs_review'::text NOT NULL,
    review_status text DEFAULT 'pending_review'::text NOT NULL,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_dataset_review_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    pair_candidate_id uuid,
    file_candidate_id uuid,
    action text NOT NULL,
    old_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    new_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_ecu_knowledge_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ecu_family text,
    ecu_type text,
    sw_number text,
    hw_number text,
    total_samples integer DEFAULT 0 NOT NULL,
    human_verified_samples integer DEFAULT 0 NOT NULL,
    unverified_samples integer DEFAULT 0 NOT NULL,
    rejected_samples integer DEFAULT 0 NOT NULL,
    stage1_samples integer DEFAULT 0 NOT NULL,
    stage2_samples integer DEFAULT 0 NOT NULL,
    stage3_samples integer DEFAULT 0 NOT NULL,
    dpf_off_samples integer DEFAULT 0 NOT NULL,
    egr_off_samples integer DEFAULT 0 NOT NULL,
    adblue_off_samples integer DEFAULT 0 NOT NULL,
    dtc_off_samples integer DEFAULT 0 NOT NULL,
    vmax_off_samples integer DEFAULT 0 NOT NULL,
    pop_bangs_samples integer DEFAULT 0 NOT NULL,
    tcu_tune_samples integer DEFAULT 0 NOT NULL,
    tcu_shift_samples integer DEFAULT 0 NOT NULL,
    tcu_lockup_samples integer DEFAULT 0 NOT NULL,
    learning_level integer DEFAULT 0 NOT NULL,
    detection_confidence numeric DEFAULT 0 NOT NULL,
    pattern_confidence numeric DEFAULT 0 NOT NULL,
    map_candidate_confidence numeric DEFAULT 0 NOT NULL,
    generation_readiness text DEFAULT 'not_ready'::text NOT NULL,
    profile_json jsonb,
    last_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_samples integer DEFAULT 0 NOT NULL,
    pending_samples integer DEFAULT 0 NOT NULL,
    excluded_samples integer DEFAULT 0 NOT NULL,
    average_quality_score numeric DEFAULT 0 NOT NULL,
    similarity_readiness text DEFAULT 'no_data'::text NOT NULL,
    cluster_count integer DEFAULT 0 NOT NULL,
    strong_cluster_count integer DEFAULT 0 NOT NULL,
    usable_cluster_count integer DEFAULT 0 NOT NULL,
    weak_cluster_count integer DEFAULT 0 NOT NULL,
    outlier_count integer DEFAULT 0 NOT NULL,
    pattern_clustering_readiness text DEFAULT 'no_data'::text NOT NULL,
    accuracy_summary jsonb
);

CREATE TABLE public.ai_generation_readiness_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_expert_job_id uuid,
    training_sample_id uuid,
    readiness_status text NOT NULL,
    trust_level text NOT NULL,
    blocked_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    missing_safety_gates jsonb DEFAULT '[]'::jsonb NOT NULL,
    evidence_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    map_attribution_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    export_allowed boolean DEFAULT false NOT NULL,
    customer_visible boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_map_attribution_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    file_expert_job_id uuid,
    training_sample_id uuid,
    definition_set_id uuid,
    changed_region_id text,
    offset_start bigint,
    offset_end bigint,
    size_bytes integer,
    matched_definition_id uuid,
    map_category text DEFAULT 'unknown'::text NOT NULL,
    map_name text,
    overlap_ratio numeric,
    confidence_score integer,
    attribution_status text,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_map_definition_sets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    ecu_family text,
    ecu_type text,
    sw_number text,
    hw_number text,
    vehicle_brand text,
    vehicle_model text,
    engine text,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_reference text,
    confidence_score integer DEFAULT 50 NOT NULL,
    human_verified boolean DEFAULT false NOT NULL,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_map_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    definition_set_id uuid NOT NULL,
    map_name text NOT NULL,
    category text NOT NULL,
    offset_start bigint NOT NULL,
    offset_end bigint NOT NULL,
    rows integer,
    cols integer,
    data_type text,
    endian text,
    factor numeric,
    unit text,
    axis_x jsonb,
    axis_y jsonb,
    description text,
    confidence_score integer DEFAULT 50 NOT NULL,
    human_verified boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_model_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    provider text NOT NULL,
    model_name text,
    prompt_version text,
    input_json jsonb,
    output_text text,
    output_json jsonb,
    latency_ms integer,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_negative_learning_examples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text,
    related_training_sample_id uuid,
    related_pair_candidate_id uuid,
    negative_type text NOT NULL,
    service_labels jsonb DEFAULT '[]'::jsonb NOT NULL,
    reason text,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    human_confirmed boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_pattern_clusters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_key text NOT NULL,
    ecu_family text,
    ecu_type text,
    sw_number text,
    hw_number text,
    feature_type text NOT NULL,
    sample_count integer DEFAULT 0 NOT NULL,
    approved_sample_count integer DEFAULT 0 NOT NULL,
    human_verified_sample_count integer DEFAULT 0 NOT NULL,
    average_quality_score numeric DEFAULT 0 NOT NULL,
    cluster_confidence numeric DEFAULT 0 NOT NULL,
    cluster_status text DEFAULT 'weak'::text NOT NULL,
    repeated_regions jsonb,
    common_pattern_signature jsonb,
    feature_consistency_json jsonb,
    outlier_sample_ids jsonb,
    source_sample_ids jsonb,
    last_rebuilt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_pattern_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    training_sample_id uuid,
    ecu_family text,
    ecu_type text,
    sw_number text,
    feature_type text,
    signature_json jsonb NOT NULL,
    human_confirmed boolean DEFAULT false NOT NULL,
    confidence numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_similarity_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    compared_sample_id uuid,
    ecu_match_score numeric DEFAULT 0 NOT NULL,
    file_size_score numeric DEFAULT 0 NOT NULL,
    identifier_score numeric DEFAULT 0 NOT NULL,
    pattern_score numeric DEFAULT 0 NOT NULL,
    feature_label_score numeric DEFAULT 0 NOT NULL,
    overall_similarity_score numeric DEFAULT 0 NOT NULL,
    match_reasons jsonb,
    mismatch_reasons jsonb,
    compared_features jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_synthetic_fixture_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_type text NOT NULL,
    ecu_family text,
    ecu_type text,
    service_labels jsonb DEFAULT '[]'::jsonb NOT NULL,
    safe_fake_binary boolean DEFAULT true NOT NULL,
    generated_files jsonb DEFAULT '[]'::jsonb NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_training_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    request_id uuid,
    training_sample_id uuid,
    actor_user_id uuid,
    message text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.ai_training_samples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid,
    user_id uuid,
    ori_file_path text NOT NULL,
    mod_file_path text NOT NULL,
    ori_file_name text,
    mod_file_name text,
    ori_sha256 text,
    mod_sha256 text,
    ori_file_size bigint,
    mod_file_size bigint,
    brand text,
    model text,
    engine text,
    ecu_type text,
    ecu_family text,
    sw_number text,
    hw_number text,
    read_method text,
    service_labels jsonb,
    provider text,
    revision_label text,
    source_metadata jsonb,
    diff_json jsonb,
    pattern_signature jsonb,
    auto_label_confidence numeric,
    auto_labels_correct boolean,
    human_verified boolean DEFAULT false NOT NULL,
    human_verification_status text DEFAULT 'unverified'::text NOT NULL,
    quality_rating integer,
    safety_rating text,
    outcome text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    data_quality_score numeric,
    data_quality_reasons jsonb,
    requested_service_labels jsonb,
    performed_service_labels jsonb,
    change_type_classification text,
    learning_use_status text DEFAULT 'pending'::text NOT NULL,
    revision_number integer DEFAULT 1 NOT NULL,
    source_type text
);

CREATE TABLE public.commerce_policy_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    customer_id uuid,
    actor_user_id uuid,
    event_type text NOT NULL,
    before_json jsonb,
    after_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.commerce_settings (
    id text DEFAULT 'default'::text NOT NULL,
    currency text DEFAULT 'EUR'::text NOT NULL,
    default_custom_credit_price_eur numeric(10,4) DEFAULT 5.0000 NOT NULL,
    global_adjustment_type text DEFAULT 'percentage'::text NOT NULL,
    global_adjustment_value numeric(10,4) DEFAULT 20.0000 NOT NULL,
    promotion_label text,
    payment_sumup_enabled boolean DEFAULT true NOT NULL,
    payment_paypal_enabled boolean DEFAULT true NOT NULL,
    payment_bank_enabled boolean DEFAULT true NOT NULL,
    payment_stripe_enabled boolean DEFAULT true NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.credit_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    stripe_session_id text NOT NULL,
    stripe_payment_intent text,
    customer_email text,
    package_id text,
    credits numeric NOT NULL,
    amount_total numeric,
    currency text,
    status text DEFAULT 'paid'::text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    source_type text,
    source_id text,
    credits_delta integer NOT NULL,
    balance_after integer,
    description text,
    amount_total integer,
    currency text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.customer_commercial_policies (
    user_id uuid NOT NULL,
    credit_price_override_eur numeric(10,4),
    adjustment_type text DEFAULT 'none'::text NOT NULL,
    adjustment_value numeric(10,4) DEFAULT 0 NOT NULL,
    payment_sumup_enabled boolean,
    payment_paypal_enabled boolean,
    payment_bank_enabled boolean,
    payment_stripe_enabled boolean,
    internal_note text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.email_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    recipient_email text NOT NULL,
    recipient_user_id uuid,
    related_order_id uuid,
    related_request_id uuid,
    idempotency_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    provider text DEFAULT 'resend'::text NOT NULL,
    provider_message_id text,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.file_expert_binary_fingerprints (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    file_role text NOT NULL,
    sha256 text NOT NULL,
    file_size bigint NOT NULL,
    ecu_strings jsonb,
    ascii_strings jsonb,
    ff_ratio numeric,
    zero_ratio numeric,
    entropy numeric,
    active_regions jsonb,
    fingerprint_json jsonb,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.file_expert_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    admin_user_id uuid,
    actual_features jsonb,
    ai_correct boolean,
    quality_rating integer,
    safety_rating text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.file_expert_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    brand text,
    model text,
    engine text,
    ecu_type text,
    read_method text,
    customer_notes text,
    ori_file_path text,
    mod_file_path text,
    ori_file_name text,
    mod_file_name text,
    ori_sha256 text,
    mod_sha256 text,
    ori_file_size bigint,
    mod_file_size bigint,
    result_json jsonb,
    ai_report text,
    executive_summary text,
    detected_features jsonb,
    confidence_score numeric,
    risk_level text,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    ecu_family text,
    sw_number text,
    hw_number text
);

CREATE TABLE public.known_file_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ecu_family text,
    ecu_type text,
    sw_number text,
    hw_number text,
    feature_type text,
    pattern_signature jsonb NOT NULL,
    source_job_id uuid,
    human_confirmed boolean DEFAULT false,
    confidence numeric DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid,
    customer_email text,
    vehicle_brand text,
    vehicle_model text,
    vehicle_generation text,
    vehicle_engine text,
    service_type text,
    credits_required numeric DEFAULT 0,
    status text DEFAULT 'new_request'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    ecu text,
    gearbox text,
    vehicle_year text,
    read_method text,
    license_plate text,
    hw_sw text,
    master_slave text,
    uploaded_file_name text,
    original_file_path text,
    modified_file_path text,
    modified_files jsonb DEFAULT '[]'::jsonb NOT NULL,
    customer_upload_enabled boolean DEFAULT false NOT NULL,
    customer_uploads jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE public.payment_event_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_record_id uuid,
    provider text NOT NULL,
    external_event_id text,
    event_type text NOT NULL,
    status text NOT NULL,
    message text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.payment_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    external_id text NOT NULL,
    provider_payment_id text,
    user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_type text DEFAULT 'credit_purchase'::text NOT NULL,
    credits numeric(12,2) DEFAULT 0 NOT NULL,
    amount_total bigint,
    currency text DEFAULT 'eur'::text NOT NULL,
    customer_email text,
    package_id text,
    purchase_type text,
    failure_code text,
    failure_message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    credits_applied_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_note text,
    refunded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    role text DEFAULT 'customer'::text,
    credit_balance numeric DEFAULT 0,
    allow_negative_balance boolean DEFAULT false,
    negative_credit_limit numeric DEFAULT 0,
    custom_credit_price numeric,
    monthly_file_limit integer,
    created_at timestamp with time zone DEFAULT now(),
    customer_id text,
    account_type text DEFAULT 'private'::text,
    company_name text,
    phone text,
    street text,
    postal_code text,
    city text,
    country text DEFAULT 'Germany'::text,
    vat_id text,
    invoice_email text,
    preferred_contact text DEFAULT 'email'::text,
    allow_negative_credits boolean DEFAULT false,
    account_status text DEFAULT 'active'::text,
    internal_admin_note text,
    customer_tags text[] DEFAULT '{}'::text[] NOT NULL,
    staff_role text,
    staff_permissions text[] DEFAULT '{}'::text[] NOT NULL,
    staff_updated_at timestamp with time zone
);

CREATE TABLE public.public_vehicle_catalog_cache (
    id text NOT NULL,
    payload jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    source_hash text,
    brand_count integer DEFAULT 0 NOT NULL,
    model_count integer DEFAULT 0 NOT NULL,
    generation_count integer DEFAULT 0 NOT NULL,
    engine_count integer DEFAULT 0 NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.request_internal_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    work_order_id uuid,
    author_user_id uuid,
    note_type text DEFAULT 'internal'::text NOT NULL,
    body text NOT NULL,
    pinned boolean DEFAULT false NOT NULL,
    customer_visible boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    visibility_status text DEFAULT 'visible'::text NOT NULL,
    hidden_at timestamp with time zone,
    hidden_by uuid,
    hidden_reason text,
    restored_at timestamp with time zone,
    restored_by uuid,
    linked_request_message_id uuid
);

CREATE TABLE public.request_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_role text NOT NULL,
    message text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    visibility_status text DEFAULT 'visible'::text NOT NULL,
    hidden_at timestamp with time zone,
    hidden_by uuid,
    hidden_reason text,
    restored_at timestamp with time zone,
    restored_by uuid
);

CREATE TABLE public.request_work_order_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    work_order_id uuid,
    actor_user_id uuid,
    event_type text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    customer_visible boolean DEFAULT false NOT NULL,
    message text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.request_work_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    admin_status text DEFAULT 'new'::text NOT NULL,
    tuner_status text DEFAULT 'unassigned'::text NOT NULL,
    payment_review_status text DEFAULT 'not_checked'::text NOT NULL,
    delivery_status text DEFAULT 'not_ready'::text NOT NULL,
    assigned_admin_id uuid,
    assigned_tuner_id uuid,
    internal_notes text,
    customer_visible_notes text,
    estimated_turnaround_minutes integer,
    eta_note text,
    risk_flags text[] DEFAULT '{}'::text[] NOT NULL,
    quality_check_status text DEFAULT 'pending'::text NOT NULL,
    quality_check_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    final_file_status text DEFAULT 'not_ready'::text NOT NULL,
    delivery_method text DEFAULT 'portal'::text NOT NULL,
    last_admin_activity_at timestamp with time zone,
    last_customer_activity_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.staff_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    target_user_id uuid,
    action text NOT NULL,
    previous_access jsonb,
    new_access jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_alias_review_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    alias_table text NOT NULL,
    alias_id uuid,
    action text NOT NULL,
    old_value jsonb DEFAULT '{}'::jsonb,
    new_value jsonb DEFAULT '{}'::jsonb,
    actor_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_brand_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    alias_name text NOT NULL,
    normalized_alias text NOT NULL,
    source_type text DEFAULT 'manual'::text,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    external_id text,
    display_order integer DEFAULT 1000 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    published boolean DEFAULT true NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_reference text,
    confidence_score numeric DEFAULT 60 NOT NULL,
    verification_status text DEFAULT 'imported'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_change_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_data_sources (
    id text NOT NULL,
    name text NOT NULL,
    source_type text NOT NULL,
    base_url text,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_duplicate_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    canonical_fingerprint text NOT NULL,
    record_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    canonical_record_id uuid,
    admin_note text,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone
);

CREATE TABLE public.vehicle_ecu_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engine_id uuid NOT NULL,
    ecu_family text,
    ecu_type text,
    ecu_hardware text,
    ecu_software text,
    ecu_notes text,
    protection_notes text,
    unlock_notes text,
    gearbox_type text,
    tcu_type text,
    tcu_notes text,
    active boolean DEFAULT true NOT NULL,
    published boolean DEFAULT true NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_reference text,
    confidence_score numeric DEFAULT 60 NOT NULL,
    verification_status text DEFAULT 'imported'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_engine_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engine_id uuid NOT NULL,
    alias_name text NOT NULL,
    normalized_alias text NOT NULL,
    source_type text DEFAULT 'manual'::text,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_engines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    generation_id uuid NOT NULL,
    vehicle_key text NOT NULL,
    engine_name text NOT NULL,
    display_name text,
    external_id text,
    fuel_type text,
    displacement_cc integer,
    stock_hp integer,
    stock_nm integer,
    year_from integer,
    year_to integer,
    customer_safe_notes text,
    admin_technical_notes text,
    active boolean DEFAULT true NOT NULL,
    published boolean DEFAULT false NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_reference text,
    confidence_score numeric DEFAULT 60 NOT NULL,
    verification_status text DEFAULT 'unverified'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_external_diffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    entity_type text,
    entity_id uuid,
    candidate_id uuid,
    field_name text,
    existing_value jsonb,
    candidate_value jsonb,
    diff_type text,
    severity text DEFAULT 'info'::text NOT NULL,
    review_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_external_engine_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    generation_group_id uuid,
    engine_display_name text,
    engine_code text,
    fuel_type text,
    displacement_cc integer,
    stock_hp integer,
    stock_kw integer,
    stock_nm integer,
    stage1_hp_estimate integer,
    stage1_nm_estimate integer,
    estimate_source text,
    estimate_confidence text,
    drivetrain text,
    transmission text,
    hybrid_type text,
    body_variant_availability jsonb DEFAULT '[]'::jsonb NOT NULL,
    year_from integer,
    year_to integer,
    source_url text,
    confidence_score integer DEFAULT 50 NOT NULL,
    review_status text DEFAULT 'needs_review'::text NOT NULL,
    matched_existing_engine_id uuid,
    draft_engine_id uuid,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_external_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    raw_title text,
    raw_model text,
    raw_generation text,
    raw_body_type text,
    raw_year_range text,
    raw_power_range text,
    platform_codes jsonb DEFAULT '[]'::jsonb NOT NULL,
    parsed_year_from integer,
    parsed_year_to integer,
    source_url text,
    inclusion_status text DEFAULT 'pending'::text NOT NULL,
    exclusion_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_external_generation_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    brand text,
    model text,
    internal_generation_label text,
    customer_display_label text,
    year_from integer,
    year_to integer,
    platform_codes jsonb DEFAULT '[]'::jsonb NOT NULL,
    body_variants jsonb DEFAULT '[]'::jsonb NOT NULL,
    included_entry_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    excluded_entry_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    confidence_score integer DEFAULT 50 NOT NULL,
    review_status text DEFAULT 'needs_review'::text NOT NULL,
    matched_existing_generation_id uuid,
    draft_generation_id uuid,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_external_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid,
    source_name text,
    source_url text,
    mode text DEFAULT 'dry_run'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    modern_only boolean DEFAULT true NOT NULL,
    year_cutoff integer DEFAULT 2020 NOT NULL,
    total_entries integer DEFAULT 0 NOT NULL,
    normalized_groups integer DEFAULT 0 NOT NULL,
    engine_candidates integer DEFAULT 0 NOT NULL,
    draft_generations_created integer DEFAULT 0 NOT NULL,
    draft_engines_created integer DEFAULT 0 NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_external_review_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    entity_type text,
    entity_id uuid,
    action text,
    old_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    new_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_external_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_name text,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_url text,
    source_reference text,
    policy_status text DEFAULT 'manual_assisted'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_generation_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid NOT NULL,
    generation_id uuid NOT NULL,
    alias_name text NOT NULL,
    normalized_alias text NOT NULL,
    source_type text DEFAULT 'manual'::text,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    external_id text,
    year_from integer,
    year_to integer,
    facelift_label text,
    is_lci boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    published boolean DEFAULT true NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_reference text,
    confidence_score numeric DEFAULT 60 NOT NULL,
    verification_status text DEFAULT 'imported'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id text NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    imported_rows integer DEFAULT 0 NOT NULL,
    duplicate_rows integer DEFAULT 0 NOT NULL,
    error_rows integer DEFAULT 0 NOT NULL,
    source_reference text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);

CREATE TABLE public.vehicle_model_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    model_id uuid NOT NULL,
    alias_name text NOT NULL,
    normalized_alias text NOT NULL,
    source_type text DEFAULT 'manual'::text,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    brand_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    external_id text,
    display_order integer DEFAULT 1000 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    published boolean DEFAULT true NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    source_reference text,
    confidence_score numeric DEFAULT 60 NOT NULL,
    verification_status text DEFAULT 'imported'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_performance_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engine_id uuid NOT NULL,
    stage text NOT NULL,
    stock_hp integer,
    stock_nm integer,
    tuned_hp integer,
    tuned_nm integer,
    gain_hp integer,
    gain_nm integer,
    active boolean DEFAULT true NOT NULL,
    published boolean DEFAULT true NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    confidence_score numeric DEFAULT 60 NOT NULL,
    verification_status text DEFAULT 'imported'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_service_capabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engine_id uuid NOT NULL,
    service_key text NOT NULL,
    available boolean DEFAULT false NOT NULL,
    customer_safe_note text,
    admin_note text,
    source_type text DEFAULT 'manual'::text NOT NULL,
    confidence_score numeric DEFAULT 60 NOT NULL,
    verification_status text DEFAULT 'imported'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_source_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id text NOT NULL,
    import_batch_id uuid,
    source_external_id text,
    canonical_fingerprint text NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    generation text NOT NULL,
    engine text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.vehicle_validation_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    vehicle_key text,
    severity text NOT NULL,
    code text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid
);

CREATE TABLE public.widget_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    public_key text,
    request_domain text,
    allowed_domain text,
    path text,
    language text,
    status text NOT NULL,
    block_reason text,
    user_agent text,
    ip_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.widget_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    public_key text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);

CREATE TABLE public.widget_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_user_id uuid,
    client_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.widget_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    company_name text NOT NULL,
    email text NOT NULL,
    website_domain text NOT NULL,
    allowed_domain text NOT NULL,
    allow_www_alias boolean DEFAULT true NOT NULL,
    allow_subdomains boolean DEFAULT false NOT NULL,
    domain_verified boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_suspended boolean DEFAULT false NOT NULL,
    widget_enabled boolean DEFAULT true NOT NULL,
    plan text DEFAULT 'starter'::text NOT NULL,
    monthly_price numeric(10,2) DEFAULT 4.99 NOT NULL,
    currency text DEFAULT 'eur'::text NOT NULL,
    widget_title text DEFAULT 'Vehicle Search'::text NOT NULL,
    button_text text DEFAULT 'Show tuning options'::text NOT NULL,
    enquiry_email text,
    whatsapp_number text,
    main_color text DEFAULT '#1473e6'::text NOT NULL,
    button_text_color text DEFAULT '#ffffff'::text NOT NULL,
    difference_color text DEFAULT '#8cc500'::text NOT NULL,
    theme_mode text DEFAULT 'auto'::text NOT NULL,
    default_language text DEFAULT 'de'::text NOT NULL,
    allowed_languages jsonb DEFAULT '["de", "en", "tr", "fr", "es", "it", "nl", "pl", "ro", "pt", "ru", "ar"]'::jsonb NOT NULL,
    show_branding boolean DEFAULT true NOT NULL,
    allow_script_embed boolean DEFAULT true NOT NULL,
    allow_iframe_embed boolean DEFAULT true NOT NULL,
    can_edit_colours boolean DEFAULT true NOT NULL,
    can_edit_language boolean DEFAULT true NOT NULL,
    can_edit_contact boolean DEFAULT true NOT NULL,
    can_hide_branding boolean DEFAULT false NOT NULL,
    monthly_usage_limit integer DEFAULT 5000 NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_subscription_status text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_enquiries_enabled boolean DEFAULT true NOT NULL,
    whatsapp_enquiries_enabled boolean DEFAULT false NOT NULL
);

CREATE TABLE public.widget_domain_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    old_domain text,
    requested_domain text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);

CREATE TABLE public.widget_enquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    vehicle_id text NOT NULL,
    vehicle_name text NOT NULL,
    stage text NOT NULL,
    selected_services jsonb DEFAULT '[]'::jsonb NOT NULL,
    performance_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    visitor_name text NOT NULL,
    visitor_email text NOT NULL,
    visitor_phone text,
    visitor_location text,
    vehicle_registration text,
    message text,
    request_domain text,
    ip_hash text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.widget_plans (
    id text NOT NULL,
    name text NOT NULL,
    monthly_price numeric(10,2) NOT NULL,
    currency text DEFAULT 'eur'::text NOT NULL,
    included_domains integer DEFAULT 1 NOT NULL,
    monthly_usage_limit integer DEFAULT 5000 NOT NULL,
    can_hide_branding boolean DEFAULT false NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.widget_rate_limit_buckets (
    client_id uuid NOT NULL,
    bucket_start timestamp with time zone NOT NULL,
    request_count integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.widget_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    widget_product_enabled boolean DEFAULT true NOT NULL,
    public_signup_enabled boolean DEFAULT true NOT NULL,
    checkout_enabled boolean DEFAULT true NOT NULL,
    demo_enabled boolean DEFAULT true NOT NULL,
    monthly_price numeric(10,2) DEFAULT 4.99 NOT NULL,
    currency text DEFAULT 'eur'::text NOT NULL,
    default_language text DEFAULT 'de'::text NOT NULL,
    enabled_languages jsonb DEFAULT '["de", "en", "tr", "fr", "es", "it", "nl", "pl", "ro", "pt", "ru", "ar"]'::jsonb NOT NULL,
    require_domain_whitelist boolean DEFAULT true NOT NULL,
    show_mg_branding boolean DEFAULT true NOT NULL,
    usage_logging_enabled boolean DEFAULT true NOT NULL,
    default_monthly_usage_limit integer DEFAULT 5000 NOT NULL,
    allow_script_embed boolean DEFAULT true NOT NULL,
    allow_iframe_embed boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.widget_webhook_events (
    event_id text NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


-- Table ownership
ALTER TABLE public.ai_accuracy_metrics OWNER TO postgres;

ALTER TABLE public.ai_cluster_members OWNER TO postgres;

ALTER TABLE public.ai_dataset_file_candidates OWNER TO postgres;

ALTER TABLE public.ai_dataset_import_batches OWNER TO postgres;

ALTER TABLE public.ai_dataset_pair_candidates OWNER TO postgres;

ALTER TABLE public.ai_dataset_review_events OWNER TO postgres;

ALTER TABLE public.ai_ecu_knowledge_profiles OWNER TO postgres;

ALTER TABLE public.ai_generation_readiness_reports OWNER TO postgres;

ALTER TABLE public.ai_map_attribution_results OWNER TO postgres;

ALTER TABLE public.ai_map_definition_sets OWNER TO postgres;

ALTER TABLE public.ai_map_definitions OWNER TO postgres;

ALTER TABLE public.ai_model_runs OWNER TO postgres;

ALTER TABLE public.ai_negative_learning_examples OWNER TO postgres;

ALTER TABLE public.ai_pattern_clusters OWNER TO postgres;

ALTER TABLE public.ai_pattern_signatures OWNER TO postgres;

ALTER TABLE public.ai_similarity_results OWNER TO postgres;

ALTER TABLE public.ai_synthetic_fixture_runs OWNER TO postgres;

ALTER TABLE public.ai_training_events OWNER TO postgres;

ALTER TABLE public.ai_training_samples OWNER TO postgres;

ALTER TABLE public.commerce_policy_events OWNER TO postgres;

ALTER TABLE public.commerce_settings OWNER TO postgres;

ALTER TABLE public.credit_payments OWNER TO postgres;

ALTER TABLE public.credit_transactions OWNER TO postgres;

ALTER TABLE public.customer_commercial_policies OWNER TO postgres;

ALTER TABLE public.email_events OWNER TO postgres;

ALTER TABLE public.file_expert_binary_fingerprints OWNER TO postgres;

ALTER TABLE public.file_expert_feedback OWNER TO postgres;

ALTER TABLE public.file_expert_jobs OWNER TO postgres;

ALTER TABLE public.known_file_patterns OWNER TO postgres;

ALTER TABLE public.notifications OWNER TO postgres;

ALTER TABLE public.orders OWNER TO postgres;

ALTER TABLE public.payment_event_log OWNER TO postgres;

ALTER TABLE public.payment_records OWNER TO postgres;

ALTER TABLE public.profiles OWNER TO postgres;

ALTER TABLE public.public_vehicle_catalog_cache OWNER TO postgres;

ALTER TABLE public.request_internal_notes OWNER TO postgres;

ALTER TABLE public.request_messages OWNER TO postgres;

ALTER TABLE public.request_work_order_events OWNER TO postgres;

ALTER TABLE public.request_work_orders OWNER TO postgres;

ALTER TABLE public.staff_audit_log OWNER TO postgres;

ALTER TABLE public.vehicle_alias_review_events OWNER TO postgres;

ALTER TABLE public.vehicle_brand_aliases OWNER TO postgres;

ALTER TABLE public.vehicle_brands OWNER TO postgres;

ALTER TABLE public.vehicle_change_audit_log OWNER TO postgres;

ALTER TABLE public.vehicle_data_sources OWNER TO postgres;

ALTER TABLE public.vehicle_duplicate_reviews OWNER TO postgres;

ALTER TABLE public.vehicle_ecu_variants OWNER TO postgres;

ALTER TABLE public.vehicle_engine_aliases OWNER TO postgres;

ALTER TABLE public.vehicle_engines OWNER TO postgres;

ALTER TABLE public.vehicle_external_diffs OWNER TO postgres;

ALTER TABLE public.vehicle_external_engine_candidates OWNER TO postgres;

ALTER TABLE public.vehicle_external_entries OWNER TO postgres;

ALTER TABLE public.vehicle_external_generation_groups OWNER TO postgres;

ALTER TABLE public.vehicle_external_import_batches OWNER TO postgres;

ALTER TABLE public.vehicle_external_review_events OWNER TO postgres;

ALTER TABLE public.vehicle_external_sources OWNER TO postgres;

ALTER TABLE public.vehicle_generation_aliases OWNER TO postgres;

ALTER TABLE public.vehicle_generations OWNER TO postgres;

ALTER TABLE public.vehicle_import_batches OWNER TO postgres;

ALTER TABLE public.vehicle_model_aliases OWNER TO postgres;

ALTER TABLE public.vehicle_models OWNER TO postgres;

ALTER TABLE public.vehicle_performance_profiles OWNER TO postgres;

ALTER TABLE public.vehicle_service_capabilities OWNER TO postgres;

ALTER TABLE public.vehicle_source_records OWNER TO postgres;

ALTER TABLE public.vehicle_validation_results OWNER TO postgres;

ALTER TABLE public.widget_access_logs OWNER TO postgres;

ALTER TABLE public.widget_api_keys OWNER TO postgres;

ALTER TABLE public.widget_audit_logs OWNER TO postgres;

ALTER TABLE public.widget_clients OWNER TO postgres;

ALTER TABLE public.widget_domain_change_requests OWNER TO postgres;

ALTER TABLE public.widget_enquiries OWNER TO postgres;

ALTER TABLE public.widget_plans OWNER TO postgres;

ALTER TABLE public.widget_rate_limit_buckets OWNER TO postgres;

ALTER TABLE public.widget_settings OWNER TO postgres;

ALTER TABLE public.widget_webhook_events OWNER TO postgres;


-- Sequence ownership
ALTER SEQUENCE public.customer_id_seq OWNER TO postgres;


-- Functions
CREATE OR REPLACE FUNCTION public.add_credits_from_stripe(p_user_id uuid, p_stripe_session_id text, p_stripe_payment_intent text, p_customer_email text, p_package_id text, p_credits numeric, p_amount_total numeric, p_currency text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.credit_payments (
    user_id,
    stripe_session_id,
    stripe_payment_intent,
    customer_email,
    package_id,
    credits,
    amount_total,
    currency,
    status
  )
  values (
    p_user_id,
    p_stripe_session_id,
    p_stripe_payment_intent,
    p_customer_email,
    p_package_id,
    p_credits,
    p_amount_total,
    p_currency,
    'paid'
  );

  update public.profiles
  set credit_balance = credit_balance + p_credits
  where id = p_user_id;

exception
  when unique_violation then
    null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_credits(p_customer_id uuid, p_credits integer, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_admin_role text;
  v_new_balance integer;
begin
  select role into v_admin_role
  from public.profiles
  where id = auth.uid();

  if v_admin_role <> 'admin' then
    raise exception 'Only admins can add credits.';
  end if;

  if p_credits is null or p_credits <= 0 then
    raise exception 'Credit amount must be positive.';
  end if;

  update public.profiles
  set credit_balance = coalesce(credit_balance, 0) + p_credits
  where id = p_customer_id
  returning credit_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'Customer profile not found.';
  end if;

  insert into public.credit_transactions (
    user_id,
    type,
    source_type,
    source_id,
    credits_delta,
    balance_after,
    description,
    metadata,
    created_by
  )
  values (
    p_customer_id,
    'admin_topup',
    'admin_manual',
    gen_random_uuid()::text,
    p_credits,
    v_new_balance,
    coalesce(p_note, 'Manual admin credit top-up.'),
    jsonb_build_object('admin_id', auth.uid()),
    auth.uid()
  );

  return v_new_balance;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_customer_credits(p_customer_id uuid, p_amount integer, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  new_balance integer;
begin
  update profiles
  set credit_balance = coalesce(credit_balance, 0) + p_amount
  where id = p_customer_id
  returning credit_balance into new_balance;

  insert into credit_transactions (
    user_id,
    type,
    source_type,
    credits_delta,
    balance_after,
    description,
    amount_total,
    currency,
    created_by
  )
  values (
    p_customer_id,
    'admin_topup',
    case when p_amount >= 0 then 'admin_topup' else 'admin_deduction' end,
    p_amount,
    new_balance,
    coalesce(p_note, 'Admin credit adjustment'),
    0,
    'EUR',
    auth.uid()
  );

  return new_balance;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_apply_payment_refund(p_actor_user_id uuid, p_payment_record_id uuid, p_provider_refund_id text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  payment public.payment_records%rowtype;
  current_balance numeric;
  next_balance numeric;
  new_ledger_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_user_id
      and ((role = 'admin' and staff_role = 'owner')
        or (role = 'staff' and 'credits.manage' = any(staff_permissions)))
  ) then
    raise exception 'Credit management permission is required.';
  end if;

  select * into payment
  from public.payment_records
  where id = p_payment_record_id
  for update;
  if not found then raise exception 'Payment record was not found.'; end if;
  if payment.status = 'refunded' then raise exception 'Payment is already refunded.'; end if;
  if payment.status <> 'succeeded' then raise exception 'Only successful payments can be refunded.'; end if;
  if payment.user_id is null or payment.credits <= 0 then
    raise exception 'Payment has no reversible credit allocation.';
  end if;

  select coalesce(credit_balance, 0)
  into current_balance
  from public.profiles
  where id = payment.user_id
  for update;
  if not found then raise exception 'Customer was not found.'; end if;

  next_balance := current_balance - payment.credits;
  update public.profiles set credit_balance = next_balance where id = payment.user_id;

  insert into public.credit_transactions (
    user_id, type, source_type, source_id, credits_delta, balance_after,
    description, amount_total, currency, metadata, created_by
  ) values (
    payment.user_id, 'refund', payment.provider || '_refund',
    coalesce(nullif(trim(p_provider_refund_id), ''), payment.id::text),
    -payment.credits, next_balance,
    coalesce(nullif(trim(p_note), ''), 'Payment refunded and purchased credits reversed.'),
    case when payment.amount_total is null then null else -abs(payment.amount_total) end,
    payment.currency,
    jsonb_build_object('payment_record_id', payment.id, 'provider_refund_id', p_provider_refund_id),
    p_actor_user_id
  ) returning id into new_ledger_id;

  update public.payment_records
  set status = 'refunded', refunded_at = now(), reviewed_at = now(),
      reviewed_by = p_actor_user_id, review_note = nullif(trim(p_note), '')
  where id = payment.id;

  insert into public.payment_event_log (
    payment_record_id, provider, event_type, status, message, payload
  ) values (
    payment.id, payment.provider, 'payment_refunded', 'processed',
    'Provider refund completed and credits reversed.',
    jsonb_build_object('ledger_id', new_ledger_id, 'provider_refund_id', p_provider_refund_id)
  );

  return jsonb_build_object('ledger_id', new_ledger_id, 'balance_after', next_balance);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_record_bank_payment(p_actor_user_id uuid, p_customer_user_id uuid, p_reference text, p_credits numeric, p_amount_total bigint, p_currency text DEFAULT 'eur'::text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_balance numeric;
  next_balance numeric;
  new_payment_id uuid;
  new_ledger_id uuid;
  clean_reference text := trim(p_reference);
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_user_id
      and ((role = 'admin' and staff_role = 'owner')
        or (role = 'staff' and 'credits.manage' = any(staff_permissions)))
  ) then
    raise exception 'Credit management permission is required.';
  end if;
  if clean_reference = '' or length(clean_reference) < 3 then
    raise exception 'A valid bank reference is required.';
  end if;
  if p_credits <= 0 or p_amount_total <= 0 then
    raise exception 'Credits and payment amount must be positive.';
  end if;

  select coalesce(credit_balance, 0)
  into current_balance
  from public.profiles
  where id = p_customer_user_id
  for update;
  if not found then raise exception 'Customer was not found.'; end if;

  insert into public.payment_records (
    provider, external_id, provider_payment_id, user_id, status, payment_type,
    credits, amount_total, currency, credits_applied_at, reviewed_at,
    reviewed_by, review_note, metadata
  ) values (
    'bank', clean_reference, clean_reference, p_customer_user_id, 'succeeded',
    'manual_bank', p_credits, p_amount_total, lower(p_currency), now(), now(),
    p_actor_user_id, nullif(trim(p_note), ''),
    jsonb_build_object('recorded_by', p_actor_user_id)
  )
  returning id into new_payment_id;

  next_balance := current_balance + p_credits;
  update public.profiles set credit_balance = next_balance where id = p_customer_user_id;

  insert into public.credit_transactions (
    user_id, type, source_type, source_id, credits_delta, balance_after,
    description, amount_total, currency, metadata, created_by
  ) values (
    p_customer_user_id, 'purchase', 'bank_transfer', clean_reference,
    p_credits, next_balance, coalesce(nullif(trim(p_note), ''), 'Credits purchased via bank transfer.'),
    p_amount_total, lower(p_currency), jsonb_build_object('payment_record_id', new_payment_id),
    p_actor_user_id
  ) returning id into new_ledger_id;

  insert into public.payment_event_log (
    payment_record_id, provider, event_type, status, message, payload
  ) values (
    new_payment_id, 'bank', 'bank_payment_recorded', 'processed',
    'Bank payment matched and credits applied.',
    jsonb_build_object('ledger_id', new_ledger_id, 'actor_id', p_actor_user_id)
  );

  return jsonb_build_object(
    'payment_id', new_payment_id,
    'ledger_id', new_ledger_id,
    'balance_after', next_balance
  );
exception
  when unique_violation then
    raise exception 'This bank reference has already been recorded.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_customer_message_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  recipient uuid;
begin
  if new.sender_role <> 'admin' then return new; end if;
  select customer_id into recipient from public.orders where id = new.request_id;
  if recipient is null then return new; end if;

  insert into public.notifications (user_id, order_id, type, title, body)
  values (
    recipient,
    new.request_id,
    'admin_message',
    'New message from MG AutoTech',
    left(new.message, 240)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_customer_order_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.customer_id is null then return new; end if;

  if new.status is distinct from old.status then
    insert into public.notifications (user_id, order_id, type, title, body, metadata)
    values (
      new.customer_id,
      new.id,
      case when new.status = 'completed' then 'file_ready' else 'order_status' end,
      case when new.status = 'completed' then 'Your file is ready' else 'Order status updated' end,
      case when new.status = 'completed'
        then 'Your completed file is ready to download.'
        else 'New status: ' || replace(initcap(replace(new.status, '_', ' ')), '_', ' ')
      end,
      jsonb_build_object('status', new.status)
    );
  end if;

  if new.customer_upload_enabled is true
     and new.customer_upload_enabled is distinct from old.customer_upload_enabled then
    insert into public.notifications (user_id, order_id, type, title, body)
    values (
      new.customer_id,
      new.id,
      'additional_upload_enabled',
      'Additional file upload enabled',
      'You can now upload another file inside this request.'
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_order_with_credit_deduction(p_customer_email text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_generation text, p_vehicle_engine text, p_service_type text, p_credits_required integer, p_notes text, p_ecu text DEFAULT NULL::text, p_gearbox text DEFAULT NULL::text, p_vehicle_year text DEFAULT NULL::text, p_read_method text DEFAULT NULL::text, p_license_plate text DEFAULT NULL::text, p_hw_sw text DEFAULT NULL::text, p_master_slave text DEFAULT NULL::text, p_uploaded_file_name text DEFAULT NULL::text, p_original_file_path text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_user_id uuid;
  v_balance integer;
  v_allow_negative boolean;
  v_negative_limit integer;
  v_new_balance integer;
  v_order_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select
    coalesce(credit_balance, 0),
    coalesce(allow_negative_credits, false),
    coalesce(negative_credit_limit, 0)
  into
    v_balance,
    v_allow_negative,
    v_negative_limit
  from profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_allow_negative = false and v_balance < p_credits_required then
    raise exception 'Insufficient credits';
  end if;

  if v_allow_negative = true and (v_balance - p_credits_required) < (0 - v_negative_limit) then
    raise exception 'Negative credit limit exceeded';
  end if;

  v_new_balance := v_balance - p_credits_required;

  update profiles
  set credit_balance = v_new_balance
  where id = v_user_id;

  insert into orders (
    customer_id,
    customer_email,
    vehicle_brand,
    vehicle_model,
    vehicle_generation,
    vehicle_engine,
    service_type,
    credits_required,
    status,
    notes,
    ecu,
    gearbox,
    vehicle_year,
    read_method,
    license_plate,
    hw_sw,
    master_slave,
    uploaded_file_name,
    original_file_path
  )
  values (
    v_user_id,
    p_customer_email,
    p_vehicle_brand,
    p_vehicle_model,
    p_vehicle_generation,
    p_vehicle_engine,
    p_service_type,
    p_credits_required,
    'new_request',
    p_notes,
    p_ecu,
    p_gearbox,
    p_vehicle_year,
    p_read_method,
    p_license_plate,
    p_hw_sw,
    p_master_slave,
    p_uploaded_file_name,
    p_original_file_path
  )
  returning id into v_order_id;

  insert into credit_transactions (
    user_id,
    type,
    source_type,
    source_id,
    credits_delta,
    balance_after,
    description,
    amount_total,
    currency,
    created_by
  )
  values (
    v_user_id,
    'purchase',
    'order_usage',
    v_order_id::text,
    -p_credits_required,
    v_new_balance,
    'Credits used for order #' || left(v_order_id::text, 8),
    0,
    'EUR',
    v_user_id
  );

  return v_order_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_customer_id()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
begin
  return 'MGA-' || nextval('customer_id_seq');
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name, role, credit_balance)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    0
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.has_staff_permission(required_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (
        (role = 'admin' and staff_role = 'owner')
        or (
          role = 'staff'
          and required_permission <> 'staff.manage'
          and required_permission = any(staff_permissions)
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_primary_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and staff_role = 'owner'
  );
$function$;

CREATE OR REPLACE FUNCTION public.log_order_credit_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.customer_id is not null and coalesce(new.credits_required, 0) > 0 then
    insert into public.credit_transactions (
      user_id,
      type,
      source_type,
      source_id,
      credits_delta,
      balance_after,
      description,
      metadata,
      created_at
    )
    values (
      new.customer_id,
      'usage',
      'order',
      new.id::text,
      -abs(new.credits_required)::integer,
      null,
      concat(
        'File request: ',
        coalesce(new.vehicle_brand, 'Vehicle'),
        ' ',
        coalesce(new.vehicle_model, ''),
        case when new.service_type is not null then concat(' · ', new.service_type) else '' end
      ),
      jsonb_build_object(
        'order_id', new.id,
        'vehicle_brand', new.vehicle_brand,
        'vehicle_model', new.vehicle_model,
        'service_type', new.service_type,
        'status', new.status
      ),
      coalesce(new.created_at, now())
    )
    on conflict (source_type, source_id) do nothing;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_notification_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.role() <> 'service_role' and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.order_id is distinct from old.order_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.metadata is distinct from old.metadata
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only notification read state can be changed.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_order_upload_controls()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (
    new.customer_upload_enabled is distinct from old.customer_upload_enabled
    or new.customer_uploads is distinct from old.customer_uploads
  ) and auth.role() <> 'service_role' and not public.has_staff_permission('orders.manage') then
    raise exception 'Controlled order upload fields can only be changed by authorized staff.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_primary_owner_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.staff_role = 'owner' then
    raise exception 'The Primary Owner account cannot be deleted.';
  end if;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_staff_security_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.staff_role = 'owner' and (
    new.role is distinct from old.role
    or new.staff_role is distinct from old.staff_role
    or new.staff_permissions is distinct from old.staff_permissions
  ) then
    raise exception 'The Primary Owner security role cannot be changed.';
  end if;

  if (
    new.role is distinct from old.role
    or new.staff_role is distinct from old.staff_role
    or new.staff_permissions is distinct from old.staff_permissions
  ) and auth.role() <> 'service_role' and not public.is_primary_owner() then
    raise exception 'Only the Primary Owner can change staff access.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_ai_learning_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_commerce_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_customer_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.customer_id is null then
    new.customer_id := generate_customer_id();
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_file_expert_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_payment_record_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.staff_adjust_customer_credits(p_customer_id uuid, p_amount numeric, p_note text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_balance numeric;
  next_balance numeric;
  transaction_id text := gen_random_uuid()::text;
begin
  if not public.has_staff_permission('credits.manage') then
    raise exception 'Credit management permission is required.';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'Credit amount must not be zero.';
  end if;

  select coalesce(credit_balance, 0)
  into current_balance
  from public.profiles
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer was not found.';
  end if;

  next_balance := current_balance + p_amount;

  update public.profiles
  set credit_balance = next_balance
  where id = p_customer_id;

  insert into public.credit_transactions (
    user_id, type, source_type, source_id, credits_delta, balance_after,
    description, amount_total, currency, metadata
  ) values (
    p_customer_id,
    case when p_amount > 0 then 'admin_topup' else 'admin_adjustment' end,
    'staff_adjustment',
    transaction_id,
    p_amount,
    next_balance,
    coalesce(nullif(trim(p_note), ''), 'Staff credit adjustment'),
    null,
    null,
    jsonb_build_object('actor_id', auth.uid())
  );

  return next_balance;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_ai_level2_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_email_events_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_request_work_order_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.touch_widget_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.widget_consume_rate_limit(p_client_id uuid, p_limit integer DEFAULT 120)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_bucket timestamptz := date_trunc('minute',now());
  v_count integer;
begin
  insert into public.widget_rate_limit_buckets
    (client_id,bucket_start,request_count)
  values (p_client_id,v_bucket,1)
  on conflict (client_id,bucket_start)
  do update set request_count =
    public.widget_rate_limit_buckets.request_count + 1
  returning request_count into v_count;

  return v_count <= greatest(p_limit,1);
end;
$function$;


-- Function ownership
ALTER FUNCTION public.add_credits_from_stripe(p_user_id uuid, p_stripe_session_id text, p_stripe_payment_intent text, p_customer_email text, p_package_id text, p_credits numeric, p_amount_total numeric, p_currency text) OWNER TO postgres;

ALTER FUNCTION public.admin_add_credits(p_customer_id uuid, p_credits integer, p_note text) OWNER TO postgres;

ALTER FUNCTION public.admin_adjust_customer_credits(p_customer_id uuid, p_amount integer, p_note text) OWNER TO postgres;

ALTER FUNCTION public.admin_apply_payment_refund(p_actor_user_id uuid, p_payment_record_id uuid, p_provider_refund_id text, p_note text) OWNER TO postgres;

ALTER FUNCTION public.admin_record_bank_payment(p_actor_user_id uuid, p_customer_user_id uuid, p_reference text, p_credits numeric, p_amount_total bigint, p_currency text, p_note text) OWNER TO postgres;

ALTER FUNCTION public.create_customer_message_notification() OWNER TO postgres;

ALTER FUNCTION public.create_customer_order_notification() OWNER TO postgres;

ALTER FUNCTION public.create_order_with_credit_deduction(p_customer_email text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_generation text, p_vehicle_engine text, p_service_type text, p_credits_required integer, p_notes text, p_ecu text, p_gearbox text, p_vehicle_year text, p_read_method text, p_license_plate text, p_hw_sw text, p_master_slave text, p_uploaded_file_name text, p_original_file_path text) OWNER TO postgres;

ALTER FUNCTION public.generate_customer_id() OWNER TO postgres;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

ALTER FUNCTION public.has_staff_permission(required_permission text) OWNER TO postgres;

ALTER FUNCTION public.is_admin() OWNER TO postgres;

ALTER FUNCTION public.is_primary_owner() OWNER TO postgres;

ALTER FUNCTION public.log_order_credit_usage() OWNER TO postgres;

ALTER FUNCTION public.protect_notification_content() OWNER TO postgres;

ALTER FUNCTION public.protect_order_upload_controls() OWNER TO postgres;

ALTER FUNCTION public.protect_primary_owner_delete() OWNER TO postgres;

ALTER FUNCTION public.protect_staff_security_fields() OWNER TO postgres;

ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

ALTER FUNCTION public.set_ai_learning_updated_at() OWNER TO postgres;

ALTER FUNCTION public.set_commerce_updated_at() OWNER TO postgres;

ALTER FUNCTION public.set_customer_id() OWNER TO postgres;

ALTER FUNCTION public.set_file_expert_updated_at() OWNER TO postgres;

ALTER FUNCTION public.set_payment_record_updated_at() OWNER TO postgres;

ALTER FUNCTION public.staff_adjust_customer_credits(p_customer_id uuid, p_amount numeric, p_note text) OWNER TO postgres;

ALTER FUNCTION public.touch_ai_level2_updated_at() OWNER TO postgres;

ALTER FUNCTION public.touch_email_events_updated_at() OWNER TO postgres;

ALTER FUNCTION public.touch_request_work_order_updated_at() OWNER TO postgres;

ALTER FUNCTION public.touch_widget_updated_at() OWNER TO postgres;

ALTER FUNCTION public.widget_consume_rate_limit(p_client_id uuid, p_limit integer) OWNER TO postgres;


-- Non-foreign-key constraints
ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_auto_label_correct_check CHECK (auto_label_correct >= 0);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_auto_label_partial_check CHECK (auto_label_partial >= 0);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_auto_label_wrong_check CHECK (auto_label_wrong >= 0);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_average_quality_score_check CHECK (average_quality_score >= 0::numeric AND average_quality_score <= 100::numeric);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_precision_score_check CHECK (precision_score >= 0::numeric AND precision_score <= 100::numeric);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_review_coverage_check CHECK (review_coverage >= 0::numeric AND review_coverage <= 100::numeric);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_scope_type_check CHECK (scope_type = ANY (ARRAY['global'::text, 'ecu_family'::text, 'ecu_type'::text, 'feature_type'::text, 'cluster'::text]));

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_scope_type_scope_key_key UNIQUE (scope_type, scope_key);

ALTER TABLE ONLY public.ai_accuracy_metrics ADD CONSTRAINT ai_accuracy_metrics_total_reviewed_check CHECK (total_reviewed >= 0);

ALTER TABLE ONLY public.ai_cluster_members ADD CONSTRAINT ai_cluster_members_cluster_id_training_sample_id_key UNIQUE (cluster_id, training_sample_id);

ALTER TABLE ONLY public.ai_cluster_members ADD CONSTRAINT ai_cluster_members_membership_score_check CHECK (membership_score >= 0::numeric AND membership_score <= 100::numeric);

ALTER TABLE ONLY public.ai_cluster_members ADD CONSTRAINT ai_cluster_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_dataset_file_candidates ADD CONSTRAINT ai_dataset_file_candidates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_dataset_import_batches ADD CONSTRAINT ai_dataset_import_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_dataset_pair_candidates ADD CONSTRAINT ai_dataset_pair_candidates_ecu_match_score_check CHECK (ecu_match_score >= 0 AND ecu_match_score <= 100);

ALTER TABLE ONLY public.ai_dataset_pair_candidates ADD CONSTRAINT ai_dataset_pair_candidates_pair_confidence_check CHECK (pair_confidence >= 0 AND pair_confidence <= 100);

ALTER TABLE ONLY public.ai_dataset_pair_candidates ADD CONSTRAINT ai_dataset_pair_candidates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_dataset_pair_candidates ADD CONSTRAINT ai_dataset_pair_candidates_quality_score_check CHECK (quality_score >= 0 AND quality_score <= 100);

ALTER TABLE ONLY public.ai_dataset_review_events ADD CONSTRAINT ai_dataset_review_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_ecu_knowledge_profiles ADD CONSTRAINT ai_ecu_knowledge_profiles_generation_readiness_check CHECK (generation_readiness = ANY (ARRAY['not_ready'::text, 'detection_ready'::text, 'pattern_ready'::text, 'map_candidate_ready'::text, 'suggestion_ready'::text, 'draft_ready'::text]));

ALTER TABLE ONLY public.ai_ecu_knowledge_profiles ADD CONSTRAINT ai_ecu_knowledge_profiles_learning_level_check CHECK (learning_level >= 0 AND learning_level <= 5);

ALTER TABLE ONLY public.ai_ecu_knowledge_profiles ADD CONSTRAINT ai_ecu_knowledge_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_ecu_knowledge_profiles ADD CONSTRAINT ai_ecu_profiles_pattern_clustering_readiness_check CHECK (pattern_clustering_readiness = ANY (ARRAY['no_data'::text, 'weak'::text, 'usable'::text, 'strong'::text, 'mature'::text]));

ALTER TABLE ONLY public.ai_ecu_knowledge_profiles ADD CONSTRAINT ai_ecu_profiles_similarity_readiness_check CHECK (similarity_readiness = ANY (ARRAY['no_data'::text, 'weak'::text, 'usable'::text, 'strong'::text]));

ALTER TABLE ONLY public.ai_generation_readiness_reports ADD CONSTRAINT ai_generation_readiness_reports_customer_visible_check CHECK (customer_visible = false);

ALTER TABLE ONLY public.ai_generation_readiness_reports ADD CONSTRAINT ai_generation_readiness_reports_export_allowed_check CHECK (export_allowed = false);

ALTER TABLE ONLY public.ai_generation_readiness_reports ADD CONSTRAINT ai_generation_readiness_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_map_attribution_results ADD CONSTRAINT ai_map_attribution_results_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score >= 0 AND confidence_score <= 100);

ALTER TABLE ONLY public.ai_map_attribution_results ADD CONSTRAINT ai_map_attribution_results_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_map_definition_sets ADD CONSTRAINT ai_map_definition_sets_confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 100);

ALTER TABLE ONLY public.ai_map_definition_sets ADD CONSTRAINT ai_map_definition_sets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_map_definition_sets ADD CONSTRAINT ai_map_definition_sets_verification_status_check CHECK (verification_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'needs_review'::text]));

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_category_check CHECK (category = ANY (ARRAY['driver_wish'::text, 'torque_limiter'::text, 'boost_request'::text, 'boost_limiter'::text, 'rail_pressure'::text, 'duration'::text, 'lambda'::text, 'smoke_limiter'::text, 'ignition'::text, 'vanos'::text, 'egr'::text, 'dpf'::text, 'dtc'::text, 'vmax'::text, 'pop_bangs'::text, 'tcu_shift'::text, 'tcu_pressure'::text, 'tcu_lockup'::text, 'checksum'::text, 'axis'::text, 'metadata'::text, 'unknown'::text]));

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_check CHECK (offset_end >= offset_start);

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 100);

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_offset_start_check CHECK (offset_start >= 0);

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_model_runs ADD CONSTRAINT ai_model_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_negative_learning_examples ADD CONSTRAINT ai_negative_learning_examples_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_approved_sample_count_check CHECK (approved_sample_count >= 0);

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_average_quality_score_check CHECK (average_quality_score >= 0::numeric AND average_quality_score <= 100::numeric);

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_cluster_confidence_check CHECK (cluster_confidence >= 0::numeric AND cluster_confidence <= 100::numeric);

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_cluster_key_key UNIQUE (cluster_key);

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_cluster_status_check CHECK (cluster_status = ANY (ARRAY['weak'::text, 'usable'::text, 'strong'::text, 'mature'::text]));

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_feature_type_check CHECK (feature_type = ANY (ARRAY['stage1'::text, 'stage2'::text, 'stage3'::text, 'dpf_off'::text, 'egr_off'::text, 'adblue_off'::text, 'dtc_off'::text, 'vmax_off'::text, 'pop_bangs'::text, 'tcu_tune'::text, 'tcu_shift'::text, 'tcu_lockup'::text]));

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_human_verified_sample_count_check CHECK (human_verified_sample_count >= 0);

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_pattern_clusters ADD CONSTRAINT ai_pattern_clusters_sample_count_check CHECK (sample_count >= 0);

ALTER TABLE ONLY public.ai_pattern_signatures ADD CONSTRAINT ai_pattern_signatures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_similarity_results ADD CONSTRAINT ai_similarity_results_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_similarity_results ADD CONSTRAINT ai_similarity_results_source_type_check CHECK (source_type = ANY (ARRAY['file_expert_job'::text, 'training_sample'::text]));

ALTER TABLE ONLY public.ai_similarity_results ADD CONSTRAINT ai_similarity_scores_check CHECK (ecu_match_score >= 0::numeric AND ecu_match_score <= 100::numeric AND file_size_score >= 0::numeric AND file_size_score <= 100::numeric AND identifier_score >= 0::numeric AND identifier_score <= 100::numeric AND pattern_score >= 0::numeric AND pattern_score <= 100::numeric AND feature_label_score >= 0::numeric AND feature_label_score <= 100::numeric AND overall_similarity_score >= 0::numeric AND overall_similarity_score <= 100::numeric);

ALTER TABLE ONLY public.ai_synthetic_fixture_runs ADD CONSTRAINT ai_synthetic_fixture_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_synthetic_fixture_runs ADD CONSTRAINT ai_synthetic_fixture_runs_safe_fake_binary_check CHECK (safe_fake_binary = true);

ALTER TABLE ONLY public.ai_training_events ADD CONSTRAINT ai_training_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_change_type_check CHECK (change_type_classification IS NULL OR (change_type_classification = ANY (ARRAY['identical'::text, 'focused_calibration'::text, 'distributed_calibration'::text, 'broad_rework'::text, 'structural_mismatch'::text, 'single_file'::text, 'unknown'::text])));

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_data_quality_score_check CHECK (data_quality_score IS NULL OR data_quality_score >= 0::numeric AND data_quality_score <= 100::numeric);

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_human_verification_status_check CHECK (human_verification_status = ANY (ARRAY['unverified'::text, 'confirmed'::text, 'rejected'::text, 'needs_review'::text]));

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_learning_use_status_check CHECK (learning_use_status = ANY (ARRAY['pending'::text, 'approved_for_learning'::text, 'excluded'::text]));

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_quality_rating_check CHECK (quality_rating IS NULL OR quality_rating >= 1 AND quality_rating <= 5);

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_revision_number_check CHECK (revision_number >= 1);

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_safety_rating_check CHECK (safety_rating IS NULL OR (safety_rating = ANY (ARRAY['unknown'::text, 'safe'::text, 'aggressive'::text, 'risky'::text, 'bad'::text])));

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_source_type_check CHECK (source_type IS NULL OR (source_type = ANY (ARRAY['completed_request'::text, 'demo_fixture'::text, 'manual_capture'::text, 'file_expert'::text])));

ALTER TABLE ONLY public.commerce_policy_events ADD CONSTRAINT commerce_policy_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.commerce_policy_events ADD CONSTRAINT commerce_policy_events_scope_check CHECK (scope = ANY (ARRAY['global'::text, 'customer'::text]));

ALTER TABLE ONLY public.commerce_settings ADD CONSTRAINT commerce_settings_currency_check CHECK (currency ~ '^[A-Z]{3}$'::text);

ALTER TABLE ONLY public.commerce_settings ADD CONSTRAINT commerce_settings_default_custom_credit_price_eur_check CHECK (default_custom_credit_price_eur > 0::numeric);

ALTER TABLE ONLY public.commerce_settings ADD CONSTRAINT commerce_settings_global_adjustment_type_check CHECK (global_adjustment_type = ANY (ARRAY['none'::text, 'percentage'::text, 'fixed'::text]));

ALTER TABLE ONLY public.commerce_settings ADD CONSTRAINT commerce_settings_global_adjustment_value_check CHECK (global_adjustment_value >= '-1000'::integer::numeric AND global_adjustment_value <= 1000::numeric);

ALTER TABLE ONLY public.commerce_settings ADD CONSTRAINT commerce_settings_id_check CHECK (id = 'default'::text);

ALTER TABLE ONLY public.commerce_settings ADD CONSTRAINT commerce_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_payments ADD CONSTRAINT credit_payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_payments ADD CONSTRAINT credit_payments_stripe_session_id_key UNIQUE (stripe_session_id);

ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_type_check CHECK (type = ANY (ARRAY['purchase'::text, 'usage'::text, 'admin_topup'::text, 'admin_adjustment'::text, 'refund'::text, 'correction'::text]));

ALTER TABLE ONLY public.customer_commercial_policies ADD CONSTRAINT customer_commercial_policies_adjustment_type_check CHECK (adjustment_type = ANY (ARRAY['none'::text, 'percentage'::text, 'fixed'::text]));

ALTER TABLE ONLY public.customer_commercial_policies ADD CONSTRAINT customer_commercial_policies_adjustment_value_check CHECK (adjustment_value >= '-1000'::integer::numeric AND adjustment_value <= 1000::numeric);

ALTER TABLE ONLY public.customer_commercial_policies ADD CONSTRAINT customer_commercial_policies_credit_price_override_eur_check CHECK (credit_price_override_eur IS NULL OR credit_price_override_eur > 0::numeric);

ALTER TABLE ONLY public.customer_commercial_policies ADD CONSTRAINT customer_commercial_policies_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.email_events ADD CONSTRAINT email_events_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE ONLY public.email_events ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.email_events ADD CONSTRAINT email_events_status_check CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text]));

ALTER TABLE ONLY public.file_expert_binary_fingerprints ADD CONSTRAINT file_expert_binary_fingerprints_file_role_check CHECK (file_role = ANY (ARRAY['ori'::text, 'mod'::text, 'single'::text]));

ALTER TABLE ONLY public.file_expert_binary_fingerprints ADD CONSTRAINT file_expert_binary_fingerprints_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.file_expert_feedback ADD CONSTRAINT file_expert_feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.file_expert_feedback ADD CONSTRAINT file_expert_feedback_quality_rating_check CHECK (quality_rating IS NULL OR quality_rating >= 1 AND quality_rating <= 5);

ALTER TABLE ONLY public.file_expert_feedback ADD CONSTRAINT file_expert_feedback_safety_rating_check CHECK (safety_rating IS NULL OR (safety_rating = ANY (ARRAY['unknown'::text, 'safe'::text, 'aggressive'::text, 'risky'::text, 'bad'::text])));

ALTER TABLE ONLY public.file_expert_jobs ADD CONSTRAINT file_expert_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.file_expert_jobs ADD CONSTRAINT file_expert_jobs_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]));

ALTER TABLE ONLY public.known_file_patterns ADD CONSTRAINT known_file_patterns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['admin_message'::text, 'order_status'::text, 'file_ready'::text, 'additional_upload_enabled'::text, 'system'::text]));

ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_event_log ADD CONSTRAINT payment_event_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_event_log ADD CONSTRAINT payment_event_log_provider_check CHECK (provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'bank'::text]));

ALTER TABLE ONLY public.payment_event_log ADD CONSTRAINT payment_event_log_status_check CHECK (status = ANY (ARRAY['received'::text, 'processed'::text, 'failed'::text, 'info'::text]));

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_credits_check CHECK (credits >= 0::numeric);

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_currency_check CHECK (currency ~ '^[a-z]{3}$'::text);

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_payment_type_check CHECK (payment_type = ANY (ARRAY['credit_purchase'::text, 'manual_bank'::text]));

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_provider_check CHECK (provider = ANY (ARRAY['stripe'::text, 'paypal'::text, 'bank'::text]));

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_provider_external_id_key UNIQUE (provider, external_id);

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_status_check CHECK (status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'requires_review'::text, 'refunded'::text]));

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_customer_id_key UNIQUE (customer_id);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_role_check_v2 CHECK (role = ANY (ARRAY['customer'::text, 'staff'::text, 'admin'::text]));

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_staff_role_check CHECK (staff_role IS NULL OR (staff_role = ANY (ARRAY['owner'::text, 'manager'::text, 'calibrator'::text, 'support'::text])));

ALTER TABLE ONLY public.public_vehicle_catalog_cache ADD CONSTRAINT public_vehicle_catalog_cache_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_note_type_check CHECK (note_type = ANY (ARRAY['internal'::text, 'tuner'::text, 'customer_visible'::text, 'pinned'::text]));

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_visibility_status_check CHECK (visibility_status = ANY (ARRAY['visible'::text, 'hidden'::text, 'archived'::text]));

ALTER TABLE ONLY public.request_messages ADD CONSTRAINT request_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.request_messages ADD CONSTRAINT request_messages_sender_role_check CHECK (sender_role = ANY (ARRAY['customer'::text, 'admin'::text]));

ALTER TABLE ONLY public.request_messages ADD CONSTRAINT request_messages_visibility_status_check CHECK (visibility_status = ANY (ARRAY['visible'::text, 'hidden'::text, 'archived'::text]));

ALTER TABLE ONLY public.request_work_order_events ADD CONSTRAINT request_work_order_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_admin_status_check CHECK (admin_status = ANY (ARRAY['new'::text, 'waiting_for_payment'::text, 'payment_review'::text, 'waiting_for_file'::text, 'file_received'::text, 'in_analysis'::text, 'waiting_for_customer'::text, 'in_progress'::text, 'quality_check'::text, 'ready_for_delivery'::text, 'delivered'::text, 'completed'::text, 'cancelled'::text, 'needs_review'::text]));

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_delivery_method_check CHECK (delivery_method = ANY (ARRAY['portal'::text, 'manual'::text, 'external'::text]));

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_delivery_status_check CHECK (delivery_status = ANY (ARRAY['not_ready'::text, 'waiting_final_file'::text, 'ready'::text, 'delivered'::text, 'revision_requested'::text, 'blocked'::text]));

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_estimated_turnaround_minutes_check CHECK (estimated_turnaround_minutes IS NULL OR estimated_turnaround_minutes >= 0);

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_final_file_status_check CHECK (final_file_status = ANY (ARRAY['not_ready'::text, 'uploaded'::text, 'qc_pending'::text, 'approved'::text, 'blocked'::text]));

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_payment_review_status_check CHECK (payment_review_status = ANY (ARRAY['not_checked'::text, 'pending'::text, 'paid'::text, 'requires_review'::text, 'refunded'::text, 'cancelled'::text]));

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_priority_check CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]));

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_quality_check_status_check CHECK (quality_check_status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text, 'needs_review'::text]));

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_request_id_key UNIQUE (request_id);

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_tuner_status_check CHECK (tuner_status = ANY (ARRAY['unassigned'::text, 'assigned'::text, 'reviewing'::text, 'working'::text, 'paused'::text, 'ready_for_qc'::text, 'done'::text]));

ALTER TABLE ONLY public.staff_audit_log ADD CONSTRAINT staff_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_alias_review_events ADD CONSTRAINT vehicle_alias_review_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_brand_aliases ADD CONSTRAINT vehicle_brand_aliases_brand_id_normalized_alias_key UNIQUE (brand_id, normalized_alias);

ALTER TABLE ONLY public.vehicle_brand_aliases ADD CONSTRAINT vehicle_brand_aliases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_brands ADD CONSTRAINT vehicle_brands_confidence_score_check CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

ALTER TABLE ONLY public.vehicle_brands ADD CONSTRAINT vehicle_brands_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_brands ADD CONSTRAINT vehicle_brands_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.vehicle_brands ADD CONSTRAINT vehicle_brands_verification_status_check CHECK (verification_status = ANY (ARRAY['imported'::text, 'unverified'::text, 'needs_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_change_audit_log ADD CONSTRAINT vehicle_change_audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_data_sources ADD CONSTRAINT vehicle_data_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_duplicate_reviews ADD CONSTRAINT vehicle_duplicate_reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_ecu_variants ADD CONSTRAINT vehicle_ecu_variants_confidence_score_check CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

ALTER TABLE ONLY public.vehicle_ecu_variants ADD CONSTRAINT vehicle_ecu_variants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_ecu_variants ADD CONSTRAINT vehicle_ecu_variants_verification_status_check CHECK (verification_status = ANY (ARRAY['imported'::text, 'unverified'::text, 'needs_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_engine_aliases ADD CONSTRAINT vehicle_engine_aliases_engine_id_normalized_alias_key UNIQUE (engine_id, normalized_alias);

ALTER TABLE ONLY public.vehicle_engine_aliases ADD CONSTRAINT vehicle_engine_aliases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_engines ADD CONSTRAINT vehicle_engines_confidence_score_check CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

ALTER TABLE ONLY public.vehicle_engines ADD CONSTRAINT vehicle_engines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_engines ADD CONSTRAINT vehicle_engines_vehicle_key_key UNIQUE (vehicle_key);

ALTER TABLE ONLY public.vehicle_engines ADD CONSTRAINT vehicle_engines_verification_status_check CHECK (verification_status = ANY (ARRAY['imported'::text, 'unverified'::text, 'needs_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_external_diffs ADD CONSTRAINT vehicle_external_diffs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_external_diffs ADD CONSTRAINT vehicle_external_diffs_review_status_check CHECK (review_status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'ignored'::text, 'accepted'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_external_diffs ADD CONSTRAINT vehicle_external_diffs_severity_check CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text]));

ALTER TABLE ONLY public.vehicle_external_engine_candidates ADD CONSTRAINT vehicle_external_engine_candidates_confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 100);

ALTER TABLE ONLY public.vehicle_external_engine_candidates ADD CONSTRAINT vehicle_external_engine_candidates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_external_engine_candidates ADD CONSTRAINT vehicle_external_engine_candidates_review_status_check CHECK (review_status = ANY (ARRAY['needs_review'::text, 'draft'::text, 'verified'::text, 'published'::text, 'ignored'::text, 'rejected'::text, 'archived'::text]));

ALTER TABLE ONLY public.vehicle_external_entries ADD CONSTRAINT vehicle_external_entries_inclusion_status_check CHECK (inclusion_status = ANY (ARRAY['pending'::text, 'included'::text, 'excluded'::text, 'ignored'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_external_entries ADD CONSTRAINT vehicle_external_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_external_generation_groups ADD CONSTRAINT vehicle_external_generation_groups_confidence_score_check CHECK (confidence_score >= 0 AND confidence_score <= 100);

ALTER TABLE ONLY public.vehicle_external_generation_groups ADD CONSTRAINT vehicle_external_generation_groups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_external_generation_groups ADD CONSTRAINT vehicle_external_generation_groups_review_status_check CHECK (review_status = ANY (ARRAY['needs_review'::text, 'draft'::text, 'verified'::text, 'published'::text, 'ignored'::text, 'rejected'::text, 'archived'::text]));

ALTER TABLE ONLY public.vehicle_external_import_batches ADD CONSTRAINT vehicle_external_import_batches_mode_check CHECK (mode = ANY (ARRAY['dry_run'::text, 'draft_create'::text, 'review'::text]));

ALTER TABLE ONLY public.vehicle_external_import_batches ADD CONSTRAINT vehicle_external_import_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_external_import_batches ADD CONSTRAINT vehicle_external_import_batches_status_check CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'reviewed'::text, 'archived'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_external_review_events ADD CONSTRAINT vehicle_external_review_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_external_sources ADD CONSTRAINT vehicle_external_sources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_external_sources ADD CONSTRAINT vehicle_external_sources_policy_status_check CHECK (policy_status = ANY (ARRAY['manual_assisted'::text, 'approved_reference'::text, 'blocked'::text, 'needs_review'::text]));

ALTER TABLE ONLY public.vehicle_generation_aliases ADD CONSTRAINT vehicle_generation_aliases_model_id_normalized_alias_key UNIQUE (model_id, normalized_alias);

ALTER TABLE ONLY public.vehicle_generation_aliases ADD CONSTRAINT vehicle_generation_aliases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_generations ADD CONSTRAINT vehicle_generations_confidence_score_check CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

ALTER TABLE ONLY public.vehicle_generations ADD CONSTRAINT vehicle_generations_model_id_slug_key UNIQUE (model_id, slug);

ALTER TABLE ONLY public.vehicle_generations ADD CONSTRAINT vehicle_generations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_generations ADD CONSTRAINT vehicle_generations_verification_status_check CHECK (verification_status = ANY (ARRAY['imported'::text, 'unverified'::text, 'needs_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_import_batches ADD CONSTRAINT vehicle_import_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_model_aliases ADD CONSTRAINT vehicle_model_aliases_brand_id_normalized_alias_key UNIQUE (brand_id, normalized_alias);

ALTER TABLE ONLY public.vehicle_model_aliases ADD CONSTRAINT vehicle_model_aliases_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_models ADD CONSTRAINT vehicle_models_brand_id_slug_key UNIQUE (brand_id, slug);

ALTER TABLE ONLY public.vehicle_models ADD CONSTRAINT vehicle_models_confidence_score_check CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

ALTER TABLE ONLY public.vehicle_models ADD CONSTRAINT vehicle_models_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_models ADD CONSTRAINT vehicle_models_verification_status_check CHECK (verification_status = ANY (ARRAY['imported'::text, 'unverified'::text, 'needs_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_confidence_score_check CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_engine_id_stage_key UNIQUE (engine_id, stage);

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_stage_check CHECK (stage = ANY (ARRAY['stock'::text, 'stage1'::text, 'stage2'::text, 'stage3'::text]));

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_verification_status_check CHECK (verification_status = ANY (ARRAY['imported'::text, 'unverified'::text, 'needs_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_service_capabilities ADD CONSTRAINT vehicle_service_capabilities_confidence_score_check CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric);

ALTER TABLE ONLY public.vehicle_service_capabilities ADD CONSTRAINT vehicle_service_capabilities_engine_id_service_key_key UNIQUE (engine_id, service_key);

ALTER TABLE ONLY public.vehicle_service_capabilities ADD CONSTRAINT vehicle_service_capabilities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_service_capabilities ADD CONSTRAINT vehicle_service_capabilities_verification_status_check CHECK (verification_status = ANY (ARRAY['imported'::text, 'unverified'::text, 'needs_review'::text, 'verified'::text, 'rejected'::text]));

ALTER TABLE ONLY public.vehicle_source_records ADD CONSTRAINT vehicle_source_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_validation_results ADD CONSTRAINT vehicle_validation_results_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicle_validation_results ADD CONSTRAINT vehicle_validation_results_severity_check CHECK (severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text]));

ALTER TABLE ONLY public.vehicle_validation_results ADD CONSTRAINT vehicle_validation_results_status_check CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'ignored'::text]));

ALTER TABLE ONLY public.widget_access_logs ADD CONSTRAINT widget_access_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_access_logs ADD CONSTRAINT widget_access_logs_status_check CHECK (status = ANY (ARRAY['allowed'::text, 'blocked'::text]));

ALTER TABLE ONLY public.widget_api_keys ADD CONSTRAINT widget_api_keys_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_api_keys ADD CONSTRAINT widget_api_keys_public_key_check CHECK (public_key ~~ 'pk_mga_widget_%'::text);

ALTER TABLE ONLY public.widget_api_keys ADD CONSTRAINT widget_api_keys_public_key_key UNIQUE (public_key);

ALTER TABLE ONLY public.widget_audit_logs ADD CONSTRAINT widget_audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_clients ADD CONSTRAINT widget_clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_clients ADD CONSTRAINT widget_clients_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'past_due'::text, 'suspended'::text, 'cancelled'::text]));

ALTER TABLE ONLY public.widget_clients ADD CONSTRAINT widget_clients_theme_mode_check CHECK (theme_mode = ANY (ARRAY['light'::text, 'dark'::text, 'auto'::text]));

ALTER TABLE ONLY public.widget_domain_change_requests ADD CONSTRAINT widget_domain_change_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_domain_change_requests ADD CONSTRAINT widget_domain_change_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

ALTER TABLE ONLY public.widget_enquiries ADD CONSTRAINT widget_enquiries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_enquiries ADD CONSTRAINT widget_enquiries_stage_check CHECK (stage = ANY (ARRAY['Stage 1'::text, 'Stage 2'::text]));

ALTER TABLE ONLY public.widget_enquiries ADD CONSTRAINT widget_enquiries_status_check CHECK (status = ANY (ARRAY['new'::text, 'delivered'::text, 'delivery_failed'::text]));

ALTER TABLE ONLY public.widget_plans ADD CONSTRAINT widget_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_rate_limit_buckets ADD CONSTRAINT widget_rate_limit_buckets_pkey PRIMARY KEY (client_id, bucket_start);

ALTER TABLE ONLY public.widget_settings ADD CONSTRAINT widget_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.widget_webhook_events ADD CONSTRAINT widget_webhook_events_pkey PRIMARY KEY (event_id);


-- Foreign keys
ALTER TABLE ONLY public.ai_cluster_members ADD CONSTRAINT ai_cluster_members_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES ai_pattern_clusters(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_cluster_members ADD CONSTRAINT ai_cluster_members_training_sample_id_fkey FOREIGN KEY (training_sample_id) REFERENCES ai_training_samples(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_dataset_file_candidates ADD CONSTRAINT ai_dataset_file_candidates_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES ai_dataset_import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_dataset_import_batches ADD CONSTRAINT ai_dataset_import_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_dataset_pair_candidates ADD CONSTRAINT ai_dataset_pair_candidates_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES ai_dataset_import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_dataset_pair_candidates ADD CONSTRAINT ai_dataset_pair_candidates_mod_candidate_id_fkey FOREIGN KEY (mod_candidate_id) REFERENCES ai_dataset_file_candidates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_dataset_pair_candidates ADD CONSTRAINT ai_dataset_pair_candidates_ori_candidate_id_fkey FOREIGN KEY (ori_candidate_id) REFERENCES ai_dataset_file_candidates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_dataset_review_events ADD CONSTRAINT ai_dataset_review_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_dataset_review_events ADD CONSTRAINT ai_dataset_review_events_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES ai_dataset_import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_dataset_review_events ADD CONSTRAINT ai_dataset_review_events_file_candidate_id_fkey FOREIGN KEY (file_candidate_id) REFERENCES ai_dataset_file_candidates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_dataset_review_events ADD CONSTRAINT ai_dataset_review_events_pair_candidate_id_fkey FOREIGN KEY (pair_candidate_id) REFERENCES ai_dataset_pair_candidates(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_generation_readiness_reports ADD CONSTRAINT ai_generation_readiness_reports_file_expert_job_id_fkey FOREIGN KEY (file_expert_job_id) REFERENCES file_expert_jobs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_generation_readiness_reports ADD CONSTRAINT ai_generation_readiness_reports_training_sample_id_fkey FOREIGN KEY (training_sample_id) REFERENCES ai_training_samples(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_map_attribution_results ADD CONSTRAINT ai_map_attribution_results_definition_set_id_fkey FOREIGN KEY (definition_set_id) REFERENCES ai_map_definition_sets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_map_attribution_results ADD CONSTRAINT ai_map_attribution_results_file_expert_job_id_fkey FOREIGN KEY (file_expert_job_id) REFERENCES file_expert_jobs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_map_attribution_results ADD CONSTRAINT ai_map_attribution_results_matched_definition_id_fkey FOREIGN KEY (matched_definition_id) REFERENCES ai_map_definitions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_map_attribution_results ADD CONSTRAINT ai_map_attribution_results_training_sample_id_fkey FOREIGN KEY (training_sample_id) REFERENCES ai_training_samples(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_map_definition_sets ADD CONSTRAINT ai_map_definition_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_map_definition_sets ADD CONSTRAINT ai_map_definition_sets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_definition_set_id_fkey FOREIGN KEY (definition_set_id) REFERENCES ai_map_definition_sets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_map_definitions ADD CONSTRAINT ai_map_definitions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_negative_learning_examples ADD CONSTRAINT ai_negative_learning_examples_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_negative_learning_examples ADD CONSTRAINT ai_negative_learning_examples_related_pair_candidate_id_fkey FOREIGN KEY (related_pair_candidate_id) REFERENCES ai_dataset_pair_candidates(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_negative_learning_examples ADD CONSTRAINT ai_negative_learning_examples_related_training_sample_id_fkey FOREIGN KEY (related_training_sample_id) REFERENCES ai_training_samples(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_pattern_signatures ADD CONSTRAINT ai_pattern_signatures_training_sample_id_fkey FOREIGN KEY (training_sample_id) REFERENCES ai_training_samples(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.ai_similarity_results ADD CONSTRAINT ai_similarity_results_compared_sample_id_fkey FOREIGN KEY (compared_sample_id) REFERENCES ai_training_samples(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_synthetic_fixture_runs ADD CONSTRAINT ai_synthetic_fixture_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_training_events ADD CONSTRAINT ai_training_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_training_events ADD CONSTRAINT ai_training_events_training_sample_id_fkey FOREIGN KEY (training_sample_id) REFERENCES ai_training_samples(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.ai_training_samples ADD CONSTRAINT ai_training_samples_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.commerce_policy_events ADD CONSTRAINT commerce_policy_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.commerce_policy_events ADD CONSTRAINT commerce_policy_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.commerce_settings ADD CONSTRAINT commerce_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.credit_payments ADD CONSTRAINT credit_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);

ALTER TABLE ONLY public.credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.customer_commercial_policies ADD CONSTRAINT customer_commercial_policies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.customer_commercial_policies ADD CONSTRAINT customer_commercial_policies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.email_events ADD CONSTRAINT email_events_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_events ADD CONSTRAINT email_events_related_order_id_fkey FOREIGN KEY (related_order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.email_events ADD CONSTRAINT email_events_related_request_id_fkey FOREIGN KEY (related_request_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.file_expert_binary_fingerprints ADD CONSTRAINT file_expert_binary_fingerprints_job_id_fkey FOREIGN KEY (job_id) REFERENCES file_expert_jobs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.file_expert_feedback ADD CONSTRAINT file_expert_feedback_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.file_expert_feedback ADD CONSTRAINT file_expert_feedback_job_id_fkey FOREIGN KEY (job_id) REFERENCES file_expert_jobs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.file_expert_jobs ADD CONSTRAINT file_expert_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.known_file_patterns ADD CONSTRAINT known_file_patterns_source_job_id_fkey FOREIGN KEY (source_job_id) REFERENCES file_expert_jobs(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment_event_log ADD CONSTRAINT payment_event_log_payment_record_id_fkey FOREIGN KEY (payment_record_id) REFERENCES payment_records(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.payment_records ADD CONSTRAINT payment_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.public_vehicle_catalog_cache ADD CONSTRAINT public_vehicle_catalog_cache_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_linked_request_message_id_fkey FOREIGN KEY (linked_request_message_id) REFERENCES request_messages(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_request_id_fkey FOREIGN KEY (request_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_restored_by_fkey FOREIGN KEY (restored_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_internal_notes ADD CONSTRAINT request_internal_notes_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES request_work_orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.request_messages ADD CONSTRAINT request_messages_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_messages ADD CONSTRAINT request_messages_restored_by_fkey FOREIGN KEY (restored_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_messages ADD CONSTRAINT request_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.request_work_order_events ADD CONSTRAINT request_work_order_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_work_order_events ADD CONSTRAINT request_work_order_events_request_id_fkey FOREIGN KEY (request_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.request_work_order_events ADD CONSTRAINT request_work_order_events_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES request_work_orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_assigned_tuner_id_fkey FOREIGN KEY (assigned_tuner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.request_work_orders ADD CONSTRAINT request_work_orders_request_id_fkey FOREIGN KEY (request_id) REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.staff_audit_log ADD CONSTRAINT staff_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.staff_audit_log ADD CONSTRAINT staff_audit_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_alias_review_events ADD CONSTRAINT vehicle_alias_review_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_brand_aliases ADD CONSTRAINT vehicle_brand_aliases_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES vehicle_brands(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_brand_aliases ADD CONSTRAINT vehicle_brand_aliases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_brand_aliases ADD CONSTRAINT vehicle_brand_aliases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_brands ADD CONSTRAINT vehicle_brands_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_brands ADD CONSTRAINT vehicle_brands_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_change_audit_log ADD CONSTRAINT vehicle_change_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_duplicate_reviews ADD CONSTRAINT vehicle_duplicate_reviews_canonical_record_id_fkey FOREIGN KEY (canonical_record_id) REFERENCES vehicle_source_records(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_duplicate_reviews ADD CONSTRAINT vehicle_duplicate_reviews_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_ecu_variants ADD CONSTRAINT vehicle_ecu_variants_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_ecu_variants ADD CONSTRAINT vehicle_ecu_variants_engine_id_fkey FOREIGN KEY (engine_id) REFERENCES vehicle_engines(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_ecu_variants ADD CONSTRAINT vehicle_ecu_variants_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_engine_aliases ADD CONSTRAINT vehicle_engine_aliases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_engine_aliases ADD CONSTRAINT vehicle_engine_aliases_engine_id_fkey FOREIGN KEY (engine_id) REFERENCES vehicle_engines(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_engine_aliases ADD CONSTRAINT vehicle_engine_aliases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_engines ADD CONSTRAINT vehicle_engines_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_engines ADD CONSTRAINT vehicle_engines_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES vehicle_generations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vehicle_engines ADD CONSTRAINT vehicle_engines_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_external_diffs ADD CONSTRAINT vehicle_external_diffs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES vehicle_external_import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_external_engine_candidates ADD CONSTRAINT vehicle_external_engine_candidates_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES vehicle_external_import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_external_engine_candidates ADD CONSTRAINT vehicle_external_engine_candidates_generation_group_id_fkey FOREIGN KEY (generation_group_id) REFERENCES vehicle_external_generation_groups(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_external_entries ADD CONSTRAINT vehicle_external_entries_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES vehicle_external_import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_external_generation_groups ADD CONSTRAINT vehicle_external_generation_groups_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES vehicle_external_import_batches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_external_import_batches ADD CONSTRAINT vehicle_external_import_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_external_import_batches ADD CONSTRAINT vehicle_external_import_batches_source_id_fkey FOREIGN KEY (source_id) REFERENCES vehicle_external_sources(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_external_review_events ADD CONSTRAINT vehicle_external_review_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_external_sources ADD CONSTRAINT vehicle_external_sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_generation_aliases ADD CONSTRAINT vehicle_generation_aliases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_generation_aliases ADD CONSTRAINT vehicle_generation_aliases_generation_id_fkey FOREIGN KEY (generation_id) REFERENCES vehicle_generations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_generation_aliases ADD CONSTRAINT vehicle_generation_aliases_model_id_fkey FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_generation_aliases ADD CONSTRAINT vehicle_generation_aliases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_generations ADD CONSTRAINT vehicle_generations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_generations ADD CONSTRAINT vehicle_generations_model_id_fkey FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vehicle_generations ADD CONSTRAINT vehicle_generations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_import_batches ADD CONSTRAINT vehicle_import_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_import_batches ADD CONSTRAINT vehicle_import_batches_source_id_fkey FOREIGN KEY (source_id) REFERENCES vehicle_data_sources(id);

ALTER TABLE ONLY public.vehicle_model_aliases ADD CONSTRAINT vehicle_model_aliases_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES vehicle_brands(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_model_aliases ADD CONSTRAINT vehicle_model_aliases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_model_aliases ADD CONSTRAINT vehicle_model_aliases_model_id_fkey FOREIGN KEY (model_id) REFERENCES vehicle_models(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_model_aliases ADD CONSTRAINT vehicle_model_aliases_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_models ADD CONSTRAINT vehicle_models_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES vehicle_brands(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vehicle_models ADD CONSTRAINT vehicle_models_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_models ADD CONSTRAINT vehicle_models_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_engine_id_fkey FOREIGN KEY (engine_id) REFERENCES vehicle_engines(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_performance_profiles ADD CONSTRAINT vehicle_performance_profiles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_service_capabilities ADD CONSTRAINT vehicle_service_capabilities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_service_capabilities ADD CONSTRAINT vehicle_service_capabilities_engine_id_fkey FOREIGN KEY (engine_id) REFERENCES vehicle_engines(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.vehicle_service_capabilities ADD CONSTRAINT vehicle_service_capabilities_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_source_records ADD CONSTRAINT vehicle_source_records_import_batch_id_fkey FOREIGN KEY (import_batch_id) REFERENCES vehicle_import_batches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.vehicle_source_records ADD CONSTRAINT vehicle_source_records_source_id_fkey FOREIGN KEY (source_id) REFERENCES vehicle_data_sources(id);

ALTER TABLE ONLY public.vehicle_validation_results ADD CONSTRAINT vehicle_validation_results_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.widget_access_logs ADD CONSTRAINT widget_access_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.widget_api_keys ADD CONSTRAINT widget_api_keys_client_id_fkey FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.widget_audit_logs ADD CONSTRAINT widget_audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.widget_audit_logs ADD CONSTRAINT widget_audit_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.widget_clients ADD CONSTRAINT widget_clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.widget_domain_change_requests ADD CONSTRAINT widget_domain_change_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.widget_enquiries ADD CONSTRAINT widget_enquiries_client_id_fkey FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.widget_rate_limit_buckets ADD CONSTRAINT widget_rate_limit_buckets_client_id_fkey FOREIGN KEY (client_id) REFERENCES widget_clients(id) ON DELETE CASCADE;


-- Indexes
CREATE INDEX ai_accuracy_metrics_calculated_idx ON ai_accuracy_metrics USING btree (last_calculated_at DESC);

CREATE INDEX ai_accuracy_metrics_precision_idx ON ai_accuracy_metrics USING btree (precision_score DESC);

CREATE INDEX ai_accuracy_metrics_scope_idx ON ai_accuracy_metrics USING btree (scope_type, scope_key);

CREATE INDEX ai_cluster_members_outlier_idx ON ai_cluster_members USING btree (cluster_id, is_outlier);

CREATE INDEX ai_cluster_members_sample_idx ON ai_cluster_members USING btree (training_sample_id);

CREATE INDEX ai_dataset_file_candidates_batch_idx ON ai_dataset_file_candidates USING btree (batch_id);

CREATE INDEX ai_dataset_file_candidates_ecu_idx ON ai_dataset_file_candidates USING btree (ecu_family_guess, ecu_type_guess, sw_number_guess);

CREATE INDEX ai_dataset_file_candidates_fingerprint_idx ON ai_dataset_file_candidates USING btree (fingerprint);

CREATE INDEX ai_dataset_pair_candidates_batch_idx ON ai_dataset_pair_candidates USING btree (batch_id);

CREATE INDEX ai_dataset_pair_candidates_review_idx ON ai_dataset_pair_candidates USING btree (review_status);

CREATE INDEX ai_dataset_review_events_batch_idx ON ai_dataset_review_events USING btree (batch_id);

CREATE UNIQUE INDEX ai_ecu_knowledge_profile_identity_unique ON ai_ecu_knowledge_profiles USING btree (COALESCE(ecu_family, ''::text), COALESCE(ecu_type, ''::text), COALESCE(sw_number, ''::text), COALESCE(hw_number, ''::text));

CREATE INDEX ai_generation_readiness_job_idx ON ai_generation_readiness_reports USING btree (file_expert_job_id);

CREATE INDEX ai_generation_readiness_sample_idx ON ai_generation_readiness_reports USING btree (training_sample_id);

CREATE INDEX ai_map_attribution_job_idx ON ai_map_attribution_results USING btree (file_expert_job_id);

CREATE INDEX ai_map_attribution_sample_idx ON ai_map_attribution_results USING btree (training_sample_id);

CREATE INDEX ai_map_definition_sets_ecu_idx ON ai_map_definition_sets USING btree (ecu_family, ecu_type, sw_number);

CREATE INDEX ai_map_definition_sets_hw_idx ON ai_map_definition_sets USING btree (hw_number);

CREATE INDEX ai_map_definitions_category_idx ON ai_map_definitions USING btree (category);

CREATE INDEX ai_map_definitions_offset_idx ON ai_map_definitions USING btree (offset_start, offset_end);

CREATE INDEX ai_map_definitions_set_idx ON ai_map_definitions USING btree (definition_set_id);

CREATE INDEX ai_model_runs_source_idx ON ai_model_runs USING btree (source_type, source_id, created_at DESC);

CREATE INDEX ai_negative_learning_examples_active_idx ON ai_negative_learning_examples USING btree (active);

CREATE INDEX ai_negative_learning_examples_type_idx ON ai_negative_learning_examples USING btree (negative_type);

CREATE INDEX ai_pattern_clusters_confidence_idx ON ai_pattern_clusters USING btree (cluster_confidence DESC);

CREATE INDEX ai_pattern_clusters_ecu_idx ON ai_pattern_clusters USING btree (ecu_family, ecu_type);

CREATE INDEX ai_pattern_clusters_feature_idx ON ai_pattern_clusters USING btree (feature_type);

CREATE INDEX ai_pattern_clusters_rebuilt_idx ON ai_pattern_clusters USING btree (last_rebuilt_at DESC);

CREATE INDEX ai_pattern_clusters_status_idx ON ai_pattern_clusters USING btree (cluster_status);

CREATE INDEX ai_pattern_signatures_lookup_idx ON ai_pattern_signatures USING btree (ecu_family, ecu_type, sw_number, feature_type);

CREATE INDEX ai_pattern_signatures_sample_idx ON ai_pattern_signatures USING btree (training_sample_id);

CREATE INDEX ai_similarity_results_compared_sample_idx ON ai_similarity_results USING btree (compared_sample_id);

CREATE INDEX ai_similarity_results_score_idx ON ai_similarity_results USING btree (overall_similarity_score DESC);

CREATE INDEX ai_similarity_results_source_idx ON ai_similarity_results USING btree (source_type, source_id, overall_similarity_score DESC);

CREATE UNIQUE INDEX ai_similarity_results_unique_comparison ON ai_similarity_results USING btree (source_type, source_id, compared_sample_id);

CREATE INDEX ai_training_events_request_idx ON ai_training_events USING btree (request_id, created_at DESC);

CREATE INDEX ai_training_events_sample_idx ON ai_training_events USING btree (training_sample_id, created_at DESC);

CREATE INDEX ai_training_samples_data_quality_idx ON ai_training_samples USING btree (data_quality_score DESC, created_at DESC);

CREATE INDEX ai_training_samples_ecu_idx ON ai_training_samples USING btree (ecu_family, ecu_type, sw_number, hw_number);

CREATE UNIQUE INDEX ai_training_samples_hash_unique_without_request ON ai_training_samples USING btree (ori_sha256, mod_sha256) WHERE request_id IS NULL AND ori_sha256 IS NOT NULL AND mod_sha256 IS NOT NULL;

CREATE INDEX ai_training_samples_learning_use_idx ON ai_training_samples USING btree (learning_use_status, human_verification_status, created_at DESC);

CREATE UNIQUE INDEX ai_training_samples_request_hash_unique ON ai_training_samples USING btree (request_id, ori_sha256, mod_sha256) WHERE request_id IS NOT NULL AND ori_sha256 IS NOT NULL AND mod_sha256 IS NOT NULL;

CREATE INDEX ai_training_samples_request_idx ON ai_training_samples USING btree (request_id, created_at DESC);

CREATE INDEX ai_training_samples_verification_idx ON ai_training_samples USING btree (human_verification_status, created_at DESC);

CREATE INDEX commerce_policy_events_customer_idx ON commerce_policy_events USING btree (customer_id, created_at DESC);

CREATE UNIQUE INDEX credit_transactions_source_unique ON credit_transactions USING btree (source_type, source_id);

CREATE INDEX credit_transactions_user_created_idx ON credit_transactions USING btree (user_id, created_at DESC);

CREATE INDEX email_events_event_type_idx ON email_events USING btree (event_type, created_at DESC);

CREATE INDEX email_events_recipient_user_idx ON email_events USING btree (recipient_user_id, created_at DESC);

CREATE INDEX email_events_related_order_idx ON email_events USING btree (related_order_id, created_at DESC);

CREATE INDEX email_events_status_idx ON email_events USING btree (status, created_at DESC);

CREATE INDEX file_expert_binary_fingerprints_job_id_idx ON file_expert_binary_fingerprints USING btree (job_id);

CREATE INDEX file_expert_feedback_job_id_idx ON file_expert_feedback USING btree (job_id);

CREATE INDEX file_expert_jobs_created_at_idx ON file_expert_jobs USING btree (created_at DESC);

CREATE INDEX file_expert_jobs_status_idx ON file_expert_jobs USING btree (status);

CREATE INDEX file_expert_jobs_user_id_idx ON file_expert_jobs USING btree (user_id);

CREATE INDEX known_file_patterns_feature_idx ON known_file_patterns USING btree (feature_type);

CREATE INDEX notifications_user_created_idx ON notifications USING btree (user_id, created_at DESC);

CREATE INDEX payment_event_log_created_idx ON payment_event_log USING btree (created_at DESC);

CREATE UNIQUE INDEX payment_event_log_provider_event_unique ON payment_event_log USING btree (provider, external_event_id) WHERE external_event_id IS NOT NULL;

CREATE INDEX payment_records_created_idx ON payment_records USING btree (created_at DESC);

CREATE INDEX payment_records_status_idx ON payment_records USING btree (status, created_at DESC);

CREATE INDEX payment_records_user_idx ON payment_records USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX profiles_one_primary_owner_idx ON profiles USING btree (staff_role) WHERE staff_role = 'owner'::text;

CREATE INDEX public_vehicle_catalog_cache_active_idx ON public_vehicle_catalog_cache USING btree (is_active, generated_at DESC);

CREATE INDEX request_internal_notes_linked_message_idx ON request_internal_notes USING btree (linked_request_message_id) WHERE linked_request_message_id IS NOT NULL;

CREATE INDEX request_internal_notes_request_idx ON request_internal_notes USING btree (request_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX request_internal_notes_visibility_idx ON request_internal_notes USING btree (request_id, visibility_status, created_at DESC);

CREATE INDEX request_messages_hidden_request_idx ON request_messages USING btree (request_id, hidden_at DESC) WHERE visibility_status = ANY (ARRAY['hidden'::text, 'archived'::text]);

CREATE INDEX request_messages_request_id_idx ON request_messages USING btree (request_id);

CREATE INDEX request_messages_visible_request_idx ON request_messages USING btree (request_id, created_at) WHERE visibility_status = 'visible'::text;

CREATE INDEX request_work_order_events_request_idx ON request_work_order_events USING btree (request_id, created_at DESC);

CREATE INDEX request_work_order_events_type_idx ON request_work_order_events USING btree (event_type, created_at DESC);

CREATE INDEX request_work_orders_assigned_idx ON request_work_orders USING btree (assigned_admin_id, assigned_tuner_id);

CREATE INDEX request_work_orders_request_idx ON request_work_orders USING btree (request_id);

CREATE INDEX request_work_orders_status_idx ON request_work_orders USING btree (admin_status, priority, updated_at DESC);

CREATE INDEX vehicle_alias_review_events_entity_idx ON vehicle_alias_review_events USING btree (entity_type, entity_id, created_at DESC);

CREATE INDEX vehicle_audit_entity_idx ON vehicle_change_audit_log USING btree (entity_type, entity_id, created_at DESC);

CREATE INDEX vehicle_brand_aliases_alias_idx ON vehicle_brand_aliases USING btree (normalized_alias) WHERE active;

CREATE INDEX vehicle_ecu_variants_engine_idx ON vehicle_ecu_variants USING btree (engine_id);

CREATE INDEX vehicle_engine_aliases_alias_idx ON vehicle_engine_aliases USING btree (normalized_alias) WHERE active;

CREATE INDEX vehicle_engines_generation_idx ON vehicle_engines USING btree (generation_id);

CREATE INDEX vehicle_engines_published_idx ON vehicle_engines USING btree (published, active);

CREATE INDEX vehicle_engines_vehicle_key_idx ON vehicle_engines USING btree (vehicle_key);

CREATE INDEX vehicle_external_batches_created_idx ON vehicle_external_import_batches USING btree (created_at DESC);

CREATE INDEX vehicle_external_batches_status_idx ON vehicle_external_import_batches USING btree (status, created_at DESC);

CREATE INDEX vehicle_external_diffs_batch_idx ON vehicle_external_diffs USING btree (batch_id, severity);

CREATE INDEX vehicle_external_engines_batch_idx ON vehicle_external_engine_candidates USING btree (batch_id);

CREATE INDEX vehicle_external_engines_group_idx ON vehicle_external_engine_candidates USING btree (generation_group_id);

CREATE INDEX vehicle_external_engines_review_idx ON vehicle_external_engine_candidates USING btree (review_status);

CREATE INDEX vehicle_external_entries_batch_idx ON vehicle_external_entries USING btree (batch_id);

CREATE INDEX vehicle_external_groups_batch_idx ON vehicle_external_generation_groups USING btree (batch_id);

CREATE INDEX vehicle_external_groups_brand_model_idx ON vehicle_external_generation_groups USING btree (brand, model);

CREATE INDEX vehicle_external_groups_review_idx ON vehicle_external_generation_groups USING btree (review_status);

CREATE INDEX vehicle_external_review_events_batch_idx ON vehicle_external_review_events USING btree (batch_id, created_at DESC);

CREATE INDEX vehicle_generation_aliases_model_alias_idx ON vehicle_generation_aliases USING btree (model_id, normalized_alias) WHERE active;

CREATE INDEX vehicle_generations_model_idx ON vehicle_generations USING btree (model_id);

CREATE INDEX vehicle_import_batches_created_idx ON vehicle_import_batches USING btree (created_at DESC);

CREATE INDEX vehicle_model_aliases_brand_alias_idx ON vehicle_model_aliases USING btree (brand_id, normalized_alias) WHERE active;

CREATE INDEX vehicle_models_brand_idx ON vehicle_models USING btree (brand_id);

CREATE INDEX vehicle_performance_profiles_engine_idx ON vehicle_performance_profiles USING btree (engine_id);

CREATE INDEX vehicle_service_capabilities_engine_idx ON vehicle_service_capabilities USING btree (engine_id);

CREATE INDEX vehicle_service_capabilities_key_idx ON vehicle_service_capabilities USING btree (service_key, available);

CREATE UNIQUE INDEX vehicle_source_record_identity_idx ON vehicle_source_records USING btree (source_id, canonical_fingerprint) WHERE is_current;

CREATE INDEX vehicle_validation_status_idx ON vehicle_validation_results USING btree (status, severity, created_at DESC);

CREATE INDEX widget_access_logs_blocked_idx ON widget_access_logs USING btree (client_id, created_at DESC) WHERE status = 'blocked'::text;

CREATE INDEX widget_access_logs_client_date_idx ON widget_access_logs USING btree (client_id, created_at DESC);

CREATE INDEX widget_api_keys_client_idx ON widget_api_keys USING btree (client_id, is_active);

CREATE INDEX widget_clients_email_idx ON widget_clients USING btree (lower(email));

CREATE UNIQUE INDEX widget_clients_subscription_idx ON widget_clients USING btree (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX widget_clients_user_idx ON widget_clients USING btree (user_id);

CREATE INDEX widget_enquiries_client_date_idx ON widget_enquiries USING btree (client_id, created_at DESC);

CREATE INDEX widget_enquiries_ip_date_idx ON widget_enquiries USING btree (client_id, ip_hash, created_at DESC);

CREATE UNIQUE INDEX widget_settings_singleton_idx ON widget_settings USING btree ((true));


-- Table comments
COMMENT ON TABLE public.ai_accuracy_metrics IS 'Aggregated automatic-label accuracy measurements. Empty reviewed sets must remain explicitly insufficient.';

COMMENT ON TABLE public.ai_cluster_members IS 'Admin-only sample membership evidence. Customer APIs must never expose training sample identifiers.';

COMMENT ON TABLE public.ai_pattern_clusters IS 'Evidence-only aggregates built from approved, confirmed and quality-gated training samples. Never write-ready output.';

COMMENT ON TABLE public.ai_similarity_results IS 'Evidence-only comparisons against human-confirmed, approved and quality-gated training samples.';

COMMENT ON TABLE public.email_events IS 'Server-side transactional email event log. Stores safe metadata only, not full email bodies.';

COMMENT ON TABLE public.request_internal_notes IS 'Admin and tuner notes for work orders. Internal notes must never be exposed to customers.';

COMMENT ON TABLE public.request_work_order_events IS 'Admin work-order timeline and audit events. Customer APIs must expose only customer-visible safe events.';

COMMENT ON TABLE public.request_work_orders IS 'Admin-only operational work-order state for MG AutoTech file requests.';


-- Column comments
COMMENT ON COLUMN public.ai_similarity_results.compared_features IS 'Sanitized comparison metadata only. Raw binary data and private storage paths are forbidden.';

COMMENT ON COLUMN public.ai_training_samples.data_quality_score IS 'Level 0 evidence quality score from 0 to 100. This is not a flash-safety score.';

COMMENT ON COLUMN public.ai_training_samples.data_quality_reasons IS 'Structured factors used to calculate the data quality score.';

COMMENT ON COLUMN public.ai_training_samples.requested_service_labels IS 'Services requested by the customer. Never treated as proof that the work was performed.';

COMMENT ON COLUMN public.ai_training_samples.performed_service_labels IS 'Services confirmed by a human as actually present in the delivered MOD file.';

COMMENT ON COLUMN public.ai_training_samples.learning_use_status IS 'Explicit human gate controlling whether the sample may influence ECU knowledge profiles.';

COMMENT ON COLUMN public.email_events.metadata IS 'Safe operational metadata. Do not store raw binary, private file paths, internal notes, hidden messages or full email bodies.';

COMMENT ON COLUMN public.orders.modified_files IS 'Delivered modified file versions for an order. Each item stores id, label, file_name, file_path and uploaded_at.';

COMMENT ON COLUMN public.profiles.customer_tags IS 'Internal admin customer labels such as workshop, reseller, vip, blocked and negative_credit.';

COMMENT ON COLUMN public.request_internal_notes.visibility_status IS 'Admin note visibility state for customer-visible note history. Hidden notes remain admin-visible.';

COMMENT ON COLUMN public.request_internal_notes.linked_request_message_id IS 'Optional link to the customer-facing request_messages row copied from a customer-visible admin note.';

COMMENT ON COLUMN public.request_messages.hidden_reason IS 'Admin-only reason for hiding a request message from the customer. Never expose to customer APIs.';

COMMENT ON COLUMN public.request_messages.visibility_status IS 'Customer-facing visibility state. Customer APIs must return only visible or legacy-null messages.';


-- Row level security
ALTER TABLE public.ai_accuracy_metrics ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_cluster_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_dataset_file_candidates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_dataset_import_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_dataset_pair_candidates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_dataset_review_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_ecu_knowledge_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_generation_readiness_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_map_attribution_results ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_map_definition_sets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_map_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_model_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_negative_learning_examples ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_pattern_clusters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_pattern_signatures ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_similarity_results ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_synthetic_fixture_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_training_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_training_samples ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.commerce_policy_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.commerce_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.credit_payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_commercial_policies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.file_expert_binary_fingerprints ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.file_expert_feedback ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.file_expert_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.known_file_patterns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_event_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.public_vehicle_catalog_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.request_internal_notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.request_work_order_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.request_work_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.staff_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_alias_review_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_brand_aliases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_brands ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_change_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_data_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_duplicate_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_ecu_variants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_engine_aliases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_engines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_external_diffs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_external_engine_candidates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_external_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_external_generation_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_external_import_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_external_review_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_external_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_generation_aliases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_generations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_import_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_model_aliases ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_performance_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_service_capabilities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_source_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vehicle_validation_results ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_access_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_api_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_domain_change_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_enquiries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.widget_webhook_events ENABLE ROW LEVEL SECURITY;


-- Policies
CREATE POLICY "Admins can manage AI accuracy metrics" ON public.ai_accuracy_metrics AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI cluster members" ON public.ai_cluster_members AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI dataset file candidates" ON public.ai_dataset_file_candidates AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI dataset import batches" ON public.ai_dataset_import_batches AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI dataset pair candidates" ON public.ai_dataset_pair_candidates AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI dataset review events" ON public.ai_dataset_review_events AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI knowledge profiles" ON public.ai_ecu_knowledge_profiles AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Admins can read AI model runs" ON public.ai_model_runs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Admins can manage AI negative learning examples" ON public.ai_negative_learning_examples AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI pattern clusters" ON public.ai_pattern_clusters AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can manage AI pattern signatures" ON public.ai_pattern_signatures AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Admins can manage AI similarity results" ON public.ai_similarity_results AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('ai_training.manage'::text))
  WITH CHECK (has_staff_permission('ai_training.manage'::text));

CREATE POLICY "Admins can read AI training events" ON public.ai_training_events AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Admins can manage AI training samples" ON public.ai_training_samples AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Staff can read commerce policy events" ON public.commerce_policy_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('credits.manage'::text));

CREATE POLICY "Staff can manage global commerce settings" ON public.commerce_settings AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('credits.manage'::text))
  WITH CHECK (has_staff_permission('credits.manage'::text));

CREATE POLICY "Admins can view all credit payments" ON public.credit_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Users can view own credit payments" ON public.credit_payments AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Admins can insert credit transactions" ON public.credit_transactions AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Admins can view all credit transactions" ON public.credit_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Customers can view own credit transactions" ON public.credit_transactions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Staff can manage customer commerce policies" ON public.customer_commercial_policies AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('credits.manage'::text))
  WITH CHECK (has_staff_permission('credits.manage'::text));

CREATE POLICY "Staff can manage transactional email events" ON public.email_events AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('orders.manage'::text))
  WITH CHECK (has_staff_permission('orders.manage'::text));

CREATE POLICY "Staff can read transactional email events" ON public.email_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('orders.view'::text));

CREATE POLICY "Admins can manage file expert fingerprints" ON public.file_expert_binary_fingerprints AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Customers can read fingerprints for own jobs" ON public.file_expert_binary_fingerprints AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM file_expert_jobs j
  WHERE ((j.id = file_expert_binary_fingerprints.job_id) AND (j.user_id = auth.uid())))));

CREATE POLICY "Admins can manage file expert feedback" ON public.file_expert_feedback AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Staff can manage file expert feedback by permission" ON public.file_expert_feedback AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('file_expert.manage'::text))
  WITH CHECK (has_staff_permission('file_expert.manage'::text));

CREATE POLICY "Admins can manage file expert jobs" ON public.file_expert_jobs AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Customers can create own file expert jobs" ON public.file_expert_jobs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Customers can read own file expert jobs" ON public.file_expert_jobs AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = user_id));

CREATE POLICY "Staff can manage file expert jobs by permission" ON public.file_expert_jobs AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('file_expert.manage'::text))
  WITH CHECK (has_staff_permission('file_expert.manage'::text));

CREATE POLICY "Admins can manage known file patterns" ON public.known_file_patterns AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));

CREATE POLICY "Staff can manage known patterns by permission" ON public.known_file_patterns AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('file_expert.manage'::text))
  WITH CHECK (has_staff_permission('file_expert.manage'::text));

CREATE POLICY "Customers can read own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY "Customers can update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Admins can update all orders" ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Admins can view all orders" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Staff can read orders by permission" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('orders.view'::text));

CREATE POLICY "Staff can update orders by permission" ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_staff_permission('orders.manage'::text))
  WITH CHECK (has_staff_permission('orders.manage'::text));

CREATE POLICY "Users can create own orders" ON public.orders AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.uid() = customer_id));

CREATE POLICY "Users can view own orders" ON public.orders AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = customer_id));

CREATE POLICY "Finance staff can read payment event log" ON public.payment_event_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('credits.manage'::text));

CREATE POLICY "Finance staff can read payment records" ON public.payment_records AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('credits.manage'::text));

CREATE POLICY "Admins can update all profiles" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Staff can read profiles by permission" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((has_staff_permission('customers.view'::text) OR has_staff_permission('staff.manage'::text)));

CREATE POLICY "Staff can update customers by permission" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_staff_permission('customers.manage'::text))
  WITH CHECK (has_staff_permission('customers.manage'::text));

CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.uid() = id));

CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO public
  USING ((auth.uid() = id));

CREATE POLICY "public vehicle catalog cache admin insert" ON public.public_vehicle_catalog_cache AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "public vehicle catalog cache admin select" ON public.public_vehicle_catalog_cache AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "public vehicle catalog cache admin update" ON public.public_vehicle_catalog_cache AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "Staff can manage request internal notes" ON public.request_internal_notes AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('orders.manage'::text))
  WITH CHECK (has_staff_permission('orders.manage'::text));

CREATE POLICY "Staff can read request internal notes" ON public.request_internal_notes AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('orders.view'::text));

CREATE POLICY "Allow authenticated insert request messages" ON public.request_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated select request messages" ON public.request_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff can create request messages" ON public.request_messages AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('messages.manage'::text));

CREATE POLICY "Staff can read request messages" ON public.request_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('messages.manage'::text));

CREATE POLICY "Users can view request messages" ON public.request_messages AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff can create request work order events" ON public.request_work_order_events AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('orders.manage'::text));

CREATE POLICY "Staff can read request work order events" ON public.request_work_order_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('orders.view'::text));

CREATE POLICY "Staff can manage request work orders" ON public.request_work_orders AS PERMISSIVE FOR ALL TO authenticated
  USING (has_staff_permission('orders.manage'::text))
  WITH CHECK (has_staff_permission('orders.manage'::text));

CREATE POLICY "Staff can read request work orders" ON public.request_work_orders AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('orders.view'::text));

CREATE POLICY "Primary owner can read staff audit log" ON public.staff_audit_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_primary_owner());

CREATE POLICY "vehicle alias review events admin insert" ON public.vehicle_alias_review_events AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle alias review events admin select" ON public.vehicle_alias_review_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle brand aliases admin insert" ON public.vehicle_brand_aliases AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle brand aliases admin select" ON public.vehicle_brand_aliases AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle brand aliases admin update" ON public.vehicle_brand_aliases AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin brands" ON public.vehicle_brands AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin audit log" ON public.vehicle_change_audit_log AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin data sources" ON public.vehicle_data_sources AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin ecu variants" ON public.vehicle_ecu_variants AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle engine aliases admin insert" ON public.vehicle_engine_aliases AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle engine aliases admin select" ON public.vehicle_engine_aliases AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle engine aliases admin update" ON public.vehicle_engine_aliases AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin engines" ON public.vehicle_engines AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle enrichment admin diffs" ON public.vehicle_external_diffs AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle enrichment admin engine candidates" ON public.vehicle_external_engine_candidates AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle enrichment admin entries" ON public.vehicle_external_entries AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle enrichment admin generation groups" ON public.vehicle_external_generation_groups AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle enrichment admin batches" ON public.vehicle_external_import_batches AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle enrichment admin review events" ON public.vehicle_external_review_events AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle enrichment admin sources" ON public.vehicle_external_sources AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle generation aliases admin insert" ON public.vehicle_generation_aliases AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle generation aliases admin select" ON public.vehicle_generation_aliases AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle generation aliases admin update" ON public.vehicle_generation_aliases AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin generations" ON public.vehicle_generations AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin import batches" ON public.vehicle_import_batches AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle model aliases admin insert" ON public.vehicle_model_aliases AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle model aliases admin select" ON public.vehicle_model_aliases AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle model aliases admin update" ON public.vehicle_model_aliases AS PERMISSIVE FOR UPDATE TO authenticated
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin models" ON public.vehicle_models AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin performance profiles" ON public.vehicle_performance_profiles AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin service capabilities" ON public.vehicle_service_capabilities AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY "vehicle admin validation results" ON public.vehicle_validation_results AS PERMISSIVE FOR ALL TO public
  USING (has_staff_permission('vehicles.manage'::text))
  WITH CHECK (has_staff_permission('vehicles.manage'::text));

CREATE POLICY widget_clients_own_select ON public.widget_clients AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY widget_domain_requests_own_insert ON public.widget_domain_change_requests AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM widget_clients c
  WHERE ((c.id = widget_domain_change_requests.client_id) AND (c.user_id = auth.uid())))));

CREATE POLICY widget_domain_requests_own_select ON public.widget_domain_change_requests AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM widget_clients c
  WHERE ((c.id = widget_domain_change_requests.client_id) AND (c.user_id = auth.uid())))));


-- Triggers
CREATE TRIGGER ai_accuracy_metrics_touch_updated_at BEFORE UPDATE ON ai_accuracy_metrics FOR EACH ROW EXECUTE FUNCTION touch_ai_level2_updated_at();

CREATE TRIGGER ai_pattern_clusters_touch_updated_at BEFORE UPDATE ON ai_pattern_clusters FOR EACH ROW EXECUTE FUNCTION touch_ai_level2_updated_at();

CREATE TRIGGER set_ai_training_samples_updated_at BEFORE UPDATE ON ai_training_samples FOR EACH ROW EXECUTE FUNCTION set_ai_learning_updated_at();

CREATE TRIGGER set_commerce_settings_updated_at BEFORE UPDATE ON commerce_settings FOR EACH ROW EXECUTE FUNCTION set_commerce_updated_at();

CREATE TRIGGER set_customer_commercial_policies_updated_at BEFORE UPDATE ON customer_commercial_policies FOR EACH ROW EXECUTE FUNCTION set_commerce_updated_at();

CREATE TRIGGER email_events_touch_updated_at BEFORE UPDATE ON email_events FOR EACH ROW EXECUTE FUNCTION touch_email_events_updated_at();

CREATE TRIGGER set_file_expert_jobs_updated_at BEFORE UPDATE ON file_expert_jobs FOR EACH ROW EXECUTE FUNCTION set_ai_learning_updated_at();

CREATE TRIGGER protect_notification_content_trigger BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION protect_notification_content();

CREATE TRIGGER order_customer_notification AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION create_customer_order_notification();

CREATE TRIGGER orders_credit_usage_ledger_trigger AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION log_order_credit_usage();

CREATE TRIGGER protect_order_upload_controls_trigger BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION protect_order_upload_controls();

CREATE TRIGGER set_payment_record_updated_at_trigger BEFORE UPDATE ON payment_records FOR EACH ROW EXECUTE FUNCTION set_payment_record_updated_at();

CREATE TRIGGER profiles_customer_id_trigger BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION set_customer_id();

CREATE TRIGGER protect_primary_owner_delete_trigger BEFORE DELETE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_primary_owner_delete();

CREATE TRIGGER protect_staff_security_fields_trigger BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_staff_security_fields();

CREATE TRIGGER request_internal_notes_touch_updated_at BEFORE UPDATE ON request_internal_notes FOR EACH ROW EXECUTE FUNCTION touch_request_work_order_updated_at();

CREATE TRIGGER request_message_customer_notification AFTER INSERT ON request_messages FOR EACH ROW EXECUTE FUNCTION create_customer_message_notification();

CREATE TRIGGER request_work_orders_touch_updated_at BEFORE UPDATE ON request_work_orders FOR EACH ROW EXECUTE FUNCTION touch_request_work_order_updated_at();

CREATE TRIGGER widget_clients_touch_updated_at BEFORE UPDATE ON widget_clients FOR EACH ROW EXECUTE FUNCTION touch_widget_updated_at();

CREATE TRIGGER widget_plans_touch_updated_at BEFORE UPDATE ON widget_plans FOR EACH ROW EXECUTE FUNCTION touch_widget_updated_at();

CREATE TRIGGER widget_settings_touch_updated_at BEFORE UPDATE ON widget_settings FOR EACH ROW EXECUTE FUNCTION touch_widget_updated_at();


-- Realtime publication membership
DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_rel pr JOIN pg_catalog.pg_publication existing ON existing.oid = pr.prpubid WHERE existing.pubname = 'supabase_realtime' AND pr.prrelid = 'public.notifications'::regclass) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$publication$;


-- Table privilege reset
REVOKE ALL PRIVILEGES ON TABLE public.ai_accuracy_metrics FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_cluster_members FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_dataset_file_candidates FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_dataset_import_batches FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_dataset_pair_candidates FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_dataset_review_events FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_ecu_knowledge_profiles FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_generation_readiness_reports FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_map_attribution_results FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_map_definition_sets FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_map_definitions FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_model_runs FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_negative_learning_examples FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_pattern_clusters FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_pattern_signatures FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_similarity_results FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_synthetic_fixture_runs FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_training_events FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.ai_training_samples FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.commerce_policy_events FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.commerce_settings FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.credit_payments FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.credit_transactions FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.customer_commercial_policies FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.email_events FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.file_expert_binary_fingerprints FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.file_expert_feedback FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.file_expert_jobs FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.known_file_patterns FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.orders FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.payment_event_log FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.payment_records FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.public_vehicle_catalog_cache FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.request_internal_notes FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.request_messages FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.request_work_order_events FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.request_work_orders FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.staff_audit_log FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_alias_review_events FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_brand_aliases FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_brands FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_change_audit_log FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_data_sources FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_duplicate_reviews FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_ecu_variants FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_engine_aliases FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_engines FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_external_diffs FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_external_engine_candidates FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_external_entries FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_external_generation_groups FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_external_import_batches FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_external_review_events FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_external_sources FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_generation_aliases FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_generations FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_import_batches FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_model_aliases FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_models FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_performance_profiles FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_service_capabilities FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_source_records FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.vehicle_validation_results FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_access_logs FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_api_keys FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_audit_logs FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_clients FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_domain_change_requests FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_enquiries FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_plans FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_rate_limit_buckets FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_settings FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.widget_webhook_events FROM PUBLIC, anon, authenticated, service_role;


-- Table grants
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_accuracy_metrics TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_accuracy_metrics TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_accuracy_metrics TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_cluster_members TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_cluster_members TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_cluster_members TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_file_candidates TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_file_candidates TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_file_candidates TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_import_batches TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_import_batches TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_import_batches TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_pair_candidates TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_pair_candidates TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_pair_candidates TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_review_events TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_review_events TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_dataset_review_events TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_ecu_knowledge_profiles TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_ecu_knowledge_profiles TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_ecu_knowledge_profiles TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_generation_readiness_reports TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_generation_readiness_reports TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_generation_readiness_reports TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_attribution_results TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_attribution_results TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_attribution_results TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_definition_sets TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_definition_sets TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_definition_sets TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_definitions TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_definitions TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_map_definitions TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_model_runs TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_model_runs TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_model_runs TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_negative_learning_examples TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_negative_learning_examples TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_negative_learning_examples TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_pattern_clusters TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_pattern_clusters TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_pattern_clusters TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_pattern_signatures TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_pattern_signatures TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_pattern_signatures TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_similarity_results TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_similarity_results TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_similarity_results TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_synthetic_fixture_runs TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_synthetic_fixture_runs TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_synthetic_fixture_runs TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_training_events TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_training_events TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_training_events TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_training_samples TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_training_samples TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_training_samples TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.commerce_policy_events TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.commerce_policy_events TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.commerce_policy_events TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.commerce_settings TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.commerce_settings TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.commerce_settings TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_payments TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_payments TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_payments TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_transactions TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_transactions TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.credit_transactions TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.customer_commercial_policies TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.customer_commercial_policies TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.customer_commercial_policies TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.email_events TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.email_events TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.email_events TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_binary_fingerprints TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_binary_fingerprints TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_binary_fingerprints TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_feedback TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_feedback TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_feedback TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_jobs TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_jobs TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.file_expert_jobs TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.known_file_patterns TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.known_file_patterns TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.known_file_patterns TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.notifications TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.notifications TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.notifications TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.orders TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_event_log TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_event_log TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_event_log TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_records TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_records TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.payment_records TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.profiles TO service_role;

GRANT INSERT, SELECT, UPDATE ON TABLE public.public_vehicle_catalog_cache TO authenticated;

GRANT INSERT, SELECT, UPDATE ON TABLE public.public_vehicle_catalog_cache TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_internal_notes TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_internal_notes TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_internal_notes TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_messages TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_messages TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_messages TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_work_order_events TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_work_order_events TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_work_order_events TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_work_orders TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_work_orders TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.request_work_orders TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.staff_audit_log TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.staff_audit_log TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.staff_audit_log TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_alias_review_events TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_alias_review_events TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_alias_review_events TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_brand_aliases TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_brand_aliases TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_brand_aliases TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_brands TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_brands TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_brands TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_change_audit_log TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_change_audit_log TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_change_audit_log TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_data_sources TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_duplicate_reviews TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_ecu_variants TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_ecu_variants TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_ecu_variants TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_engine_aliases TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_engine_aliases TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_engine_aliases TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_engines TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_engines TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_engines TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_diffs TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_diffs TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_diffs TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_engine_candidates TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_engine_candidates TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_engine_candidates TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_entries TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_entries TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_entries TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_generation_groups TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_generation_groups TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_generation_groups TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_import_batches TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_import_batches TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_import_batches TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_review_events TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_review_events TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_review_events TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_sources TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_sources TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_external_sources TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_generation_aliases TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_generation_aliases TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_generation_aliases TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_generations TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_generations TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_generations TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_import_batches TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_model_aliases TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_model_aliases TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_model_aliases TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_models TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_models TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_models TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_performance_profiles TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_performance_profiles TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_performance_profiles TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_service_capabilities TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_service_capabilities TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_service_capabilities TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_source_records TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_validation_results TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_validation_results TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vehicle_validation_results TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_access_logs TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_api_keys TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_audit_logs TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_clients TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_clients TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_clients TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_domain_change_requests TO anon;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_domain_change_requests TO authenticated;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_domain_change_requests TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_enquiries TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_plans TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_rate_limit_buckets TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_settings TO service_role;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.widget_webhook_events TO service_role;


-- Sequence privilege reset
REVOKE ALL PRIVILEGES ON SEQUENCE public.customer_id_seq FROM PUBLIC, anon, authenticated, service_role;


-- Sequence grants
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.customer_id_seq TO anon;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.customer_id_seq TO authenticated;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.customer_id_seq TO service_role;


-- Function privilege reset
REVOKE ALL PRIVILEGES ON FUNCTION public.add_credits_from_stripe(p_user_id uuid, p_stripe_session_id text, p_stripe_payment_intent text, p_customer_email text, p_package_id text, p_credits numeric, p_amount_total numeric, p_currency text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_add_credits(p_customer_id uuid, p_credits integer, p_note text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_adjust_customer_credits(p_customer_id uuid, p_amount integer, p_note text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_apply_payment_refund(p_actor_user_id uuid, p_payment_record_id uuid, p_provider_refund_id text, p_note text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.admin_record_bank_payment(p_actor_user_id uuid, p_customer_user_id uuid, p_reference text, p_credits numeric, p_amount_total bigint, p_currency text, p_note text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.create_customer_message_notification() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.create_customer_order_notification() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.create_order_with_credit_deduction(p_customer_email text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_generation text, p_vehicle_engine text, p_service_type text, p_credits_required integer, p_notes text, p_ecu text, p_gearbox text, p_vehicle_year text, p_read_method text, p_license_plate text, p_hw_sw text, p_master_slave text, p_uploaded_file_name text, p_original_file_path text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.generate_customer_id() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.has_staff_permission(required_permission text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.is_primary_owner() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.log_order_credit_usage() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.protect_notification_content() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.protect_order_upload_controls() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.protect_primary_owner_delete() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.protect_staff_security_fields() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_ai_learning_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_commerce_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_customer_id() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_file_expert_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.set_payment_record_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.staff_adjust_customer_credits(p_customer_id uuid, p_amount numeric, p_note text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.touch_ai_level2_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.touch_email_events_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.touch_request_work_order_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.touch_widget_updated_at() FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON FUNCTION public.widget_consume_rate_limit(p_client_id uuid, p_limit integer) FROM PUBLIC, anon, authenticated, service_role;


-- Function grants
GRANT EXECUTE ON FUNCTION public.add_credits_from_stripe(p_user_id uuid, p_stripe_session_id text, p_stripe_payment_intent text, p_customer_email text, p_package_id text, p_credits numeric, p_amount_total numeric, p_currency text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_credits_from_stripe(p_user_id uuid, p_stripe_session_id text, p_stripe_payment_intent text, p_customer_email text, p_package_id text, p_credits numeric, p_amount_total numeric, p_currency text) TO anon;

GRANT EXECUTE ON FUNCTION public.add_credits_from_stripe(p_user_id uuid, p_stripe_session_id text, p_stripe_payment_intent text, p_customer_email text, p_package_id text, p_credits numeric, p_amount_total numeric, p_currency text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_credits_from_stripe(p_user_id uuid, p_stripe_session_id text, p_stripe_payment_intent text, p_customer_email text, p_package_id text, p_credits numeric, p_amount_total numeric, p_currency text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_add_credits(p_customer_id uuid, p_credits integer, p_note text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_add_credits(p_customer_id uuid, p_credits integer, p_note text) TO anon;

GRANT EXECUTE ON FUNCTION public.admin_add_credits(p_customer_id uuid, p_credits integer, p_note text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_add_credits(p_customer_id uuid, p_credits integer, p_note text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_adjust_customer_credits(p_customer_id uuid, p_amount integer, p_note text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_adjust_customer_credits(p_customer_id uuid, p_amount integer, p_note text) TO anon;

GRANT EXECUTE ON FUNCTION public.admin_adjust_customer_credits(p_customer_id uuid, p_amount integer, p_note text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_adjust_customer_credits(p_customer_id uuid, p_amount integer, p_note text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_apply_payment_refund(p_actor_user_id uuid, p_payment_record_id uuid, p_provider_refund_id text, p_note text) TO anon;

GRANT EXECUTE ON FUNCTION public.admin_apply_payment_refund(p_actor_user_id uuid, p_payment_record_id uuid, p_provider_refund_id text, p_note text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_apply_payment_refund(p_actor_user_id uuid, p_payment_record_id uuid, p_provider_refund_id text, p_note text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_record_bank_payment(p_actor_user_id uuid, p_customer_user_id uuid, p_reference text, p_credits numeric, p_amount_total bigint, p_currency text, p_note text) TO anon;

GRANT EXECUTE ON FUNCTION public.admin_record_bank_payment(p_actor_user_id uuid, p_customer_user_id uuid, p_reference text, p_credits numeric, p_amount_total bigint, p_currency text, p_note text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_record_bank_payment(p_actor_user_id uuid, p_customer_user_id uuid, p_reference text, p_credits numeric, p_amount_total bigint, p_currency text, p_note text) TO service_role;

GRANT EXECUTE ON FUNCTION public.create_customer_message_notification() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_customer_message_notification() TO anon;

GRANT EXECUTE ON FUNCTION public.create_customer_message_notification() TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_customer_message_notification() TO service_role;

GRANT EXECUTE ON FUNCTION public.create_customer_order_notification() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_customer_order_notification() TO anon;

GRANT EXECUTE ON FUNCTION public.create_customer_order_notification() TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_customer_order_notification() TO service_role;

GRANT EXECUTE ON FUNCTION public.create_order_with_credit_deduction(p_customer_email text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_generation text, p_vehicle_engine text, p_service_type text, p_credits_required integer, p_notes text, p_ecu text, p_gearbox text, p_vehicle_year text, p_read_method text, p_license_plate text, p_hw_sw text, p_master_slave text, p_uploaded_file_name text, p_original_file_path text) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_with_credit_deduction(p_customer_email text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_generation text, p_vehicle_engine text, p_service_type text, p_credits_required integer, p_notes text, p_ecu text, p_gearbox text, p_vehicle_year text, p_read_method text, p_license_plate text, p_hw_sw text, p_master_slave text, p_uploaded_file_name text, p_original_file_path text) TO anon;

GRANT EXECUTE ON FUNCTION public.create_order_with_credit_deduction(p_customer_email text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_generation text, p_vehicle_engine text, p_service_type text, p_credits_required integer, p_notes text, p_ecu text, p_gearbox text, p_vehicle_year text, p_read_method text, p_license_plate text, p_hw_sw text, p_master_slave text, p_uploaded_file_name text, p_original_file_path text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_with_credit_deduction(p_customer_email text, p_vehicle_brand text, p_vehicle_model text, p_vehicle_generation text, p_vehicle_engine text, p_service_type text, p_credits_required integer, p_notes text, p_ecu text, p_gearbox text, p_vehicle_year text, p_read_method text, p_license_plate text, p_hw_sw text, p_master_slave text, p_uploaded_file_name text, p_original_file_path text) TO service_role;

GRANT EXECUTE ON FUNCTION public.generate_customer_id() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_customer_id() TO anon;

GRANT EXECUTE ON FUNCTION public.generate_customer_id() TO authenticated;

GRANT EXECUTE ON FUNCTION public.generate_customer_id() TO service_role;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

GRANT EXECUTE ON FUNCTION public.has_staff_permission(required_permission text) TO anon;

GRANT EXECUTE ON FUNCTION public.has_staff_permission(required_permission text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_staff_permission(required_permission text) TO service_role;

GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

GRANT EXECUTE ON FUNCTION public.is_primary_owner() TO anon;

GRANT EXECUTE ON FUNCTION public.is_primary_owner() TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_primary_owner() TO service_role;

GRANT EXECUTE ON FUNCTION public.log_order_credit_usage() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.log_order_credit_usage() TO anon;

GRANT EXECUTE ON FUNCTION public.log_order_credit_usage() TO authenticated;

GRANT EXECUTE ON FUNCTION public.log_order_credit_usage() TO service_role;

GRANT EXECUTE ON FUNCTION public.protect_notification_content() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.protect_notification_content() TO anon;

GRANT EXECUTE ON FUNCTION public.protect_notification_content() TO authenticated;

GRANT EXECUTE ON FUNCTION public.protect_notification_content() TO service_role;

GRANT EXECUTE ON FUNCTION public.protect_order_upload_controls() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.protect_order_upload_controls() TO anon;

GRANT EXECUTE ON FUNCTION public.protect_order_upload_controls() TO authenticated;

GRANT EXECUTE ON FUNCTION public.protect_order_upload_controls() TO service_role;

GRANT EXECUTE ON FUNCTION public.protect_primary_owner_delete() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.protect_primary_owner_delete() TO anon;

GRANT EXECUTE ON FUNCTION public.protect_primary_owner_delete() TO authenticated;

GRANT EXECUTE ON FUNCTION public.protect_primary_owner_delete() TO service_role;

GRANT EXECUTE ON FUNCTION public.protect_staff_security_fields() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.protect_staff_security_fields() TO anon;

GRANT EXECUTE ON FUNCTION public.protect_staff_security_fields() TO authenticated;

GRANT EXECUTE ON FUNCTION public.protect_staff_security_fields() TO service_role;

GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO anon;

GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO authenticated;

GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_ai_learning_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_ai_learning_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.set_ai_learning_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_ai_learning_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_commerce_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_commerce_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.set_commerce_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_commerce_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_customer_id() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_customer_id() TO anon;

GRANT EXECUTE ON FUNCTION public.set_customer_id() TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_customer_id() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_file_expert_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_file_expert_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.set_file_expert_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_file_expert_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_payment_record_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_payment_record_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.set_payment_record_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_payment_record_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.staff_adjust_customer_credits(p_customer_id uuid, p_amount numeric, p_note text) TO anon;

GRANT EXECUTE ON FUNCTION public.staff_adjust_customer_credits(p_customer_id uuid, p_amount numeric, p_note text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.staff_adjust_customer_credits(p_customer_id uuid, p_amount numeric, p_note text) TO service_role;

GRANT EXECUTE ON FUNCTION public.touch_ai_level2_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.touch_ai_level2_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.touch_ai_level2_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.touch_ai_level2_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.touch_email_events_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.touch_email_events_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.touch_email_events_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.touch_email_events_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.touch_request_work_order_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.touch_request_work_order_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.touch_request_work_order_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.touch_request_work_order_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.touch_widget_updated_at() TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.touch_widget_updated_at() TO anon;

GRANT EXECUTE ON FUNCTION public.touch_widget_updated_at() TO authenticated;

GRANT EXECUTE ON FUNCTION public.touch_widget_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.widget_consume_rate_limit(p_client_id uuid, p_limit integer) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.widget_consume_rate_limit(p_client_id uuid, p_limit integer) TO anon;

GRANT EXECUTE ON FUNCTION public.widget_consume_rate_limit(p_client_id uuid, p_limit integer) TO authenticated;

GRANT EXECUTE ON FUNCTION public.widget_consume_rate_limit(p_client_id uuid, p_limit integer) TO service_role;


-- Schema grants
GRANT USAGE ON SCHEMA public TO PUBLIC;

GRANT USAGE ON SCHEMA public TO postgres;

GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO service_role;


-- Default privilege reset
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;


-- Default grants
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO service_role;

COMMIT;
