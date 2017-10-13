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
    metadataTypes: [ 'subject', 'diagnosis', 'sample', 'cellProcessing', 'nucleicAcidProcessing'],

    metadataColumns: {
	subject: 'subjectColumns',
	diagnosis: 'diagnosisColumns',
	sample: 'sampleColumns',
	cellProcessing: 'cellProcessingColumns',
	nucleicAcidProcessing: 'nucleicAcidProcessingColumns'
    },

    defaultColumns: {
	subject: ['subject_id', 'synthetic', 'organism', 'sex', 'age', 'age_event',
		  'ancestry_population', 'ethnicity', 'race', 'strain_name',
		  'linked_subjects', 'link_type'],

	diagnosis: ['subject_uuid', 'study_group_description', 'disease_diagnosis',
		    'disease_length', 'disease_stage', 'prior_therapies', 'immunogen',
		    'intervention', 'medical_history'],

	sample: ['sample_id', 'subject_uuid', 'filename_uuid',
		 'sample_type', 'tissue', 'anatomic_site', 'disease_state_sample',
		 'collection_date', 'collection_time_event', 'biomaterial_provider'],

	cellProcessing: ['cell_processing_id', 'sample_uuid', 'tissue_processing', 'cell_subset', 'cell_phenotype',
			 'single_cell', 'cell_number', 'cells_per_reaction', 'cell_storage',
			 'cell_quality', 'cell_isolation', 'cell_processing_protocol'],

	nucleicAcidProcessing: ['nucleic_acid_processing_id', 'cell_processing_uuid', 'filename_uuid',
				'library_source', 'library_quality', 'library_construction_method',
				'library_construction_protocol', 'target_locus_PCR', 'forward_PCR_primer_target_location',
				'reverse_PCR_primer_target_location', 'complete_sequences',
				'physical_linkage', 'template_amount', 'total_reads_passing_qc_filter',
				'protocol_id', 'platform', 'read_length', 'sequencing_facility',
				'batch_number', 'sequencing_run_date', 'sequencing_kit'],
    }

};
