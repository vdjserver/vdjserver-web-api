
'use strict';

//
// AnalysisConfig.js
// Analysis workflow/tool configuration settings
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2025 The University of Texas Southwestern Medical Center
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

var AnalysisConfig = {
    "apps": {
        "takara_bio_umi_human_tr": {
            "vdjserver:name":"Takara Bio UMI Human TCR (pRESTO)",
            "activity": {
              "presto-ls6-0.2": {
                  "vdjserver:app:name": "presto-ls6",
                  "vdjserver:app:version": "0.2",
                  "vdjserver:app:default": true
              },
              "presto-ls6-0.1": {
                  "vdjserver:app:name": "presto-ls6",
                  "vdjserver:app:version": "0.1"
              }
            },
            "vdjserver:activity:uses": {
                "SequenceForwardPairedFiles": ['sequence_forward_paired_reads'],
                "SequenceReversePairedFiles": ['sequence_reverse_paired_reads']
            },
            "vdjserver:activity:generates": [
                "FASTQ",
                "FASTA"
            ]
        },
        "presto": {
            "vdjserver:name":"Presto",
            "activity": {
              "presto-ls6-0.2": {
                  "vdjserver:app:name": "presto-ls6",
                  "vdjserver:app:version": "0.2",
                  "vdjserver:app:default": true
              },
              "presto-ls6-0.1": {
                  "vdjserver:app:name": "presto-ls6",
                  "vdjserver:app:version": "0.1"
              }
            },
            "vdjserver:activity:uses": {
                "JobFiles": [ 'archive', 'compressed' ],
                "SequenceFiles": [ 'sequence_reads', 'sequence_single_read', 'sequence_quality' ],
                "SequenceForwardPairedFiles": ['sequence_forward_paired_reads'],
                "SequenceReversePairedFiles": ['sequence_reverse_paired_reads'] ,
                "ForwardPrimerFile": ["forward_primer_file"],
                "ReversePrimerFile": ["reverse_primer_file"],
                "BarcodeFile": ["barcode_file"]
            },
            "vdjserver:activity:generates": [
                "FASTQ",
                "FASTA",
                "sequence"
            ]
        },
        "vdjpipe": {
            "vdjserver:name":"VDJPipe",
            "activity": {
              "vdjpipe-ls6-0.2": {
                  "vdjserver:app:name": "vdjpipe-ls6",
                  "vdjserver:app:version": "0.2",
                  "vdjserver:app:default": true
              },
              "vdjpipe-ls6-0.1": {
                  "vdjserver:app:name": "vdjpipe-ls6",
                  "vdjserver:app:version": "0.1"
              }
            },
            "vdjserver:activity:uses": {
                "JobFiles": [ 'archive', 'compressed' ],
                "SequenceFASTQ": [ 'sequence_reads', 'sequence_single_read', 'sequence_quality' ],
                "SequenceFASTA": [ 'sequence_reads', 'sequence_single_read' ],
                "SequenceQualityFiles": [ 'sequence_quality'],
                "SequenceForwardPairedFiles": ['sequence_forward_paired_reads'],
                "SequenceReversePairedFiles": ['sequence_reverse_paired_reads'] ,
                "ForwardPrimerFile": ["forward_primer_file"],
                "ReversePrimerFile": ["reverse_primer_file"],
                "BarcodeFile": ["barcode_file"]
            },
            "vdjserver:activity:generates": [
                "FASTQ",
                "FASTA",
                "sequence"
            ]
        },
        "igblast": {
            "vdjserver:name":"IgBlast",
            "activity": {
              "igblast-ls6-0.7": {
                  "vdjserver:app:name": "igblast-ls6",
                  "vdjserver:app:version": "0.7",
                  "vdjserver:app:default": true
              },
              "igblast-ls6-0.6": {
                  "vdjserver:app:name": "igblast-ls6",
                  "vdjserver:app:version": "0.6",
              },
              "igblast-ls6-0.4": {
                  "vdjserver:app:name": "igblast-ls6",
                  "vdjserver:app:version": "0.4",
              },
              "igblast-ls6-0.1": {
                  "vdjserver:app:name": "igblast-ls6",
                  "vdjserver:app:version": "0.1"
              }
            },
            "vdjserver:activity:uses": {
                "JobFiles": [ 'archive', 'compressed' ],
                "query": [ 'sequence' ]
            },
            "vdjserver:activity:generates": [
                "AIRR TSV",
                "AIRR JSON",
                "vdj_sequence_annotation",
                "annotation_statistics",
                "assigned_clones"
            ]
        },
        "repcalc": {
            "vdjserver:name":"RepCalc",
            "activity": {
              "repcalc-ls6-0.2": {
                  "vdjserver:app:name": "repcalc-ls6",
                  "vdjserver:app:version": "0.2",
                  "vdjserver:app:default": true
              }
            },
            "vdjserver:activity:uses": [
                "job_files",
                "AIRR TSV",
                "assigned_clones",
                "AIRR JSON"
            ],
            "vdjserver:activity:generates": [
                "AIRR TSV",
                "AIRR JSON"
            ]
        },
        "statistics": {
            "vdjserver:name":"Statistics",
            "activity": {
              "statistics-ls6-0.2": {
                  "vdjserver:app:name": "statistics-ls6",
                  "vdjserver:app:version": "0.2"
              }
            }
        },
        "cellranger": {
            "vdjserver:name":"Cellranger",
            "activity": {
              "cellranger-ls6-0.1": {
                  "vdjserver:app:name": "cellranger-ls6",
                  "vdjserver:app:version": "0.1"
              }
            }
        },
        "tcrmatch": {
            "vdjserver:name":"TCRMatch",
            "activity": {
              "tcrmatch-ls6-0.1": {
                  "vdjserver:app:name": "tcrmatch-ls6",
                  "vdjserver:app:version": "0.1"
              }
            }
        },
        "trust4": {
            "vdjserver:name":"TRUST4",
            "activity": {
              "trust4-ls6-0.1": {
                  "vdjserver:app:name": "trust4-ls6",
                  "vdjserver:app:version": "0.1"
              }
            }
        },
        "compairr": {
            "vdjserver:name":"CompAIRR",
            "activity": {
              "compairr-ls6-0.1": {
                  "vdjserver:app:name": "compairr-ls6",
                  "vdjserver:app:version": "0.1"
              }
            }
        }
    }
};

module.exports = AnalysisConfig;
