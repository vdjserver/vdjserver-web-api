# VDJServer Web API migration from Tapis V2 to V3

The ADC project load/unload/reload and the ADC download cache have been moved
to the ADC API Repository so it handles the conversion of meta records related
to those processes.

Here we handle the large majority of meta records for the main VDJServer
analysis website including projects, study metadata, files, jobs and analyses.
We have changed the name of some of the objects both to distinguish from V2
where there might be large inconsistencies in the object schema. All of these
objects have schema defined so we should use the vdj-tapis-js functions so that they are
validated in the migration.

We assume that V2 API is not available and that the data to be migrated
resides in a JSON file.

## Jupyter notebooks

The extract and transform fuctions are performed in the Jupyter notebooks
and generate JSONL files with meta records that can be bulk uploaded with
meta_load_records.js script in the tapis-conversion docker container. It
resdes in the adc-api-tapis-js of vdjserver-repository.

- public_projects.ipynb: Public Projects

## Users

- profile
- userVerification
- feedback
- passwordReset

## Projects

- project --> private_project
- publicProject --> public_project
- deletedProject --> archive_project
- projectFile --> project_file ??
- projectJob --> project_job ??
- projectJobFile --> project_job_file ??
- projectJobArchive --> ??
- processMetadata --> ??
- projectUnpublishInProcess --> ??

## Study metadata (AIRR)

Attempting to automatically convert the V2 objects to AIRR objects is challenging
because the schema for the V2 objects are all over the place. Some look
somewhat like AIRR objects due to implementation of early versions of the AIRR
standards. This is primarily for the sample objects which in V2 was split into separate
sample, cellProcessing, and nucleicAcidProcessing records. There should be a few fields
that can be converted though.

There are some records that currently conform to the AIRR v1.4/v1.5 standards and can
just be copied over as is. However, they may include some VDJServer extensions so
we want to convert that.

- repertoire
- subject
- diagnosis --> ??
- sample --> sample_processing (and repertoire)
- cellProcessing --> sample_processing (and repertoire)
- nucleicAcidProcessing --> sample_processing (and repertoire)
- data_processing --> ??
- sampleGroup --> repertoire_group
- sampleColumns (deprecated)
- subjectColumns (deprecated)
- cellProcessingColumns (deprecated)
- nucleicAcidProcessingColumns (deprecated)
- diagnosisColumns (deprecated)

## Unknown names

There are set of meta records which are not being utilized by the existing code
so they are either old or testing.

"testMetadata": 1,
"job": 3,
"vdjpipeWorkflow": 13,
"communityDataSRA": 4,
"garbage": 2,
"testmetadatamp": 1,
"testmetadata": 2,
"test": 2,
"bioProcessingColumns": 1,
"bioProcessing": 5,
"irplus_analysis": 3,

# Migration Tasks

## Public projects

This conversion maintains uuids for the records.

- public_projects.ipynb: Public Projects

This will generate files in the directories:

- Metadata_public_project: One file per project containing metadata records.
- Metadata_public_project_jobs: One file per project containing Tapis V2 job records.

As there aren't many files, manually load the files one at a time using
meta_load_records.js in the tapis-conversion docker.

## 
