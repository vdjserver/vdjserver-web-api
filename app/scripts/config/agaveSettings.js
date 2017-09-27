module.exports = {

    // WSO2 Auth Settings
    clientKey:    process.env.WSO2_CLIENT_KEY,
    clientSecret: process.env.WSO2_CLIENT_SECRET,
    hostname:     process.env.WSO2_HOST,

    // VDJ Service Account User
    serviceAccountKey: process.env.VDJ_SERVICE_ACCOUNT,
    serviceAccountSecret: process.env.VDJ_SERVICE_ACCOUNT_SECRET,

    // VDJ Guest Account User
    guestAccountKey: process.env.VDJ_GUEST_ACCOUNT,
    guestAccountSecret: process.env.VDJ_GUEST_ACCOUNT_SECRET,

    // VDJ Backbone Location
    vdjBackbone: process.env.VDJ_BACKBONE_HOST,

    // Agave Misc.
    storageSystem: process.env.AGAVE_STORAGE_SYSTEM,

    // Email
    fromAddress: process.env.EMAIL_ADDRESS,

    // Debug
    debugConsole: process.env.DEBUG_CONSOLE,

    // AIRR minimal standards and other defaults for metadata
    subjectColumns: ['subject_id', 'subject_name', 'organism', 'sex', 'age', 'age_event',
                     'ancestry_population', 'ethnicity', 'race', 'species_name', 'strain_name',
                     'linked_subjects', 'link_type', 'study_group_description', 'diagnosis',
                     'disease_length', 'disease_stage', 'prior_therapies', 'immunogen',
                     'intervention', 'medical_history'],

    bioProcessingColumns: ['name', 'tissue_processing', 'cell_subset', 'cell_subset_phenotype',
                           'single_or_bulk', 'cell_number', 'cells_per_reaction', 'cell_storage',
                           'cell_quality', 'cell_isolation', 'processing_protocol', 'library_source',
                           'target_substrate_quality', 'library_strategy', 'library_construction_protocol',
                           'target_locus_PCR', 'forward_PCR_primer_target_location',
                           'reverse_PCR_primer_target_location', 'whole_vs_partial_sequences',
                           'heavy_light_paired', 'ng_template', 'total_reads_passing_qc_filter',
                           'protocol', 'platform', 'read_length', 'sequencing_facility',
                           'batch_number', 'sequencing_run_date', 'sequencing_kit'],

    sampleColumns: ['sample_id', 'name', 'sample_description',
                    'sample_type', 'tissue', 'disease_state_sample',
                    'collection_date', 'collection_time_event', 'source_commercial',
                    'subject_uuid', 'project_file', 'barcode'],

};
