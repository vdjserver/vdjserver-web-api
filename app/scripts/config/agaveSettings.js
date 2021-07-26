
'use strict';

//
// agaveSettings.js
// Settings for the Tapis (Agave) API
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2020 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

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

    // host URL for Tapis notifications
    notifyHost: process.env.AGAVE_NOTIFY_HOST,

    // Email
    fromAddress: process.env.EMAIL_ADDRESS,
    replyToAddress: process.env.REPLYTO_EMAIL_ADDRESS,

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

        sample: ['sample_id', 'subject_uuid',
                 'sample_type', 'tissue', 'anatomic_site', 'disease_state_sample',
                 'collection_time_point_relative', 'collection_time_point_reference', 'biomaterial_provider'],

        cellProcessing: ['cell_processing_id', 'sample_uuid', 'tissue_processing', 'cell_subset', 'cell_phenotype',
                         'single_cell', 'cell_number', 'cells_per_reaction', 'cell_storage',
                         'cell_quality', 'cell_isolation', 'cell_processing_protocol'],

        nucleicAcidProcessing: ['nucleic_acid_processing_id', 'cell_processing_uuid', 'filename_uuid',
                                'template_class', 'template_quality', 'template_amount', 'library_generation_method',
                                'library_generation_protocol', 'library_generation_kit_version',
                                'pcr_target_locus', 'forward_pcr_primer_target_location',
                                'reverse_pcr_primer_target_location', 'complete_sequences',
                                'physical_linkage', 'total_reads_passing_qc_filter',
                                'sequencing_platform', 'read_length', 'sequencing_facility',
                                'sequencing_run_id', 'sequencing_run_date', 'sequencing_kit'],
    }

};
