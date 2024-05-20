
'use strict';

//
// filePermissionsQueueManager.js
// File import queue jobs
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

var FilePermissionsQueueManager = {};
module.exports = FilePermissionsQueueManager;

// App
var app = require('../app');
var config = require('../config/config');

// Models
var FileUploadJob = require('../models/fileUploadJob');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;

// Processing
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var Queue = require('bull');
var moment = require('moment');

// Uploading files to Tapis is a two step process, first the
// file is uploaded using the files API, and second Tapis stages
// the file to the storage system.
//
// The GUI sends a file import notification after the file has
// been uploaded, but the queue needs to wait for the staging
// to be finished before the file can be used.

// The import queue waits for the staging to be completed then
// adds a permissions queue job to setup the metadata.

var importQueue = new Queue('file import staging', { redis: app.redisConfig });
var fileQueue = new Queue('file import', { redis: app.redisConfig });

// add file import queue job that keeps repeating (30secs) until resolved
FilePermissionsQueueManager.importFile = function(fileNotification) {
    importQueue.add({file: fileNotification}, { attempts: Number.MAX_SAFE_INTEGER, backoff: 30000 });
}

// this queue waits for a file to be finished staging
// fixed concurrency
// jobs should repeat until they are resolved
importQueue.process(10, async (job) => {
    const context = 'FilePermissionsQueueManager.importQueue';

    config.log.info(context, 'begin for ' + JSON.stringify(job.data));

    var msg = null;
    var fileUploadJob = new FileUploadJob(job.data.file);

    // already imported?
    var fileMetadata = await tapisIO.getProjectFileMetadataByURL(fileUploadJob.projectUuid, fileUploadJob.fileUuid)
        .catch(function(error) {
            msg = 'tapisIO.getProjectFileMetadataByURL, error ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return Promise.reject(new Error(msg));
    }

    if (fileMetadata.length != 0) {
        config.log.info(context, 'file metadata already exists, skipping import.');
        return Promise.resolve();
    }

    var isAvailable = await fileUploadJob.checkFileAvailability()
        .catch(function(error) {
            msg = 'fileUploadJob.checkFileAvailability, error ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }

    // still staging, this job should repeat after a delay
    if (!isAvailable) {
        config.log.info(context, 'file still staging: ' + JSON.stringify(job.data));
        return Promise.reject(new Error('still staging'));
    }

    config.log.info(context, 'staging complete: ' + JSON.stringify(job.data));
    fileQueue.add(job.data);
    return Promise.resolve();
});

// when file is finished staging, create all the metadata entries
// and set permissions
fileQueue.process(async (job) => {
    const context = 'FilePermissionsQueueManager.fileQueue';

    config.log.info(context, 'begin for ' + JSON.stringify(job.data));

    var msg = null;
    var fileUploadJob = new FileUploadJob(job.data.file);

/*
    // set permissions on file for project users
    var path = fileUploadJob.getRelativeFilePath();
    await tapisIO.setFilePermissionsForProjectUsers(fileUploadJob.projectUuid, path, false)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (fileQueue): tapisIO.setFilePermissionsForProjectUsers, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        app.emit('fileImportNotification', { error: msg, fileInformation: fileUploadJob });
        return Promise.reject(new Error(msg));
    }

    // emit notification
    app.emit('fileImportNotification', { fileImportStatus: 'permissions', fileInformation: fileUploadJob });
*/
    // create the file metadata
    var fileMetadata = await fileUploadJob.createAgaveFileMetadata()
        .catch(function(error) {
            msg = 'fileUploadJob.createAgaveFileMetadata error ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        app.emit('fileImportNotification', { error: msg, fileInformation: fileUploadJob });
        return Promise.reject(new Error(msg));
    }

    // emit notification
    app.emit('fileImportNotification', { fileImportStatus: 'metadata', fileInformation: fileUploadJob });

/*
    await tapisIO.addMetadataPermissionsForProjectUsers(fileUploadJob.projectUuid, fileMetadata.uuid)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (fileQueue): tapisIO.addMetadataPermissionsForProjectUsers, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        app.emit('fileImportNotification', { error: msg, fileInformation: fileUploadJob });
        return Promise.reject(new Error(msg));
    }

    // emit notification
    app.emit('fileImportNotification', { fileImportStatus: 'metadataPermissions', fileInformation: fileUploadJob });
*/
    app.emit('fileImportNotification', { fileImportStatus: 'finished', fileInformation: fileUploadJob });

    config.log.info(context, 'complete for ' + JSON.stringify(job.data));
    return Promise.resolve();
});
