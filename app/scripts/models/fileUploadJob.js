
'use strict';

//
// fileUploadJob.js
// Handle file import into project
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

var FileUploadJob = function(kueAttributes) {
    if (typeof kueAttributes === 'object') {
        this.fileUuid  = kueAttributes.fileUuid  || '';
        this.fileEvent = kueAttributes.fileEvent || '';
        this.fileType  = kueAttributes.fileType  || '';
        this.filePath  = kueAttributes.filePath  || '';
        this.fileSystem = kueAttributes.fileSystem || '';
        this.projectUuid = kueAttributes.projectUuid || '';
        this.vdjFileType = kueAttributes.vdjFileType || '';
        this.readDirection = kueAttributes.readDirection || '';
        this.tags = kueAttributes.tags || '';
    }

    if (_.isEmpty(this.tags) === false) {
        this.tags = decodeURIComponent(this.tags);
    }
};
module.exports = FileUploadJob;

// Models
var ServiceAccount = require('./serviceAccount');
var FilePermissions = require('./filePermissions');

// Node Libraries
var _ = require('underscore');
let moment = require('moment');

// Processing
var agaveIO = require('../vendor/agaveIO');

var extractFileUUID = function(metadata) {
    var file_uuid = null;

    try {
        file_uuid = decodeURIComponent(metadata['_links']['metadata']['href']);
        var fields = file_uuid.split('?q=');
        file_uuid = fields[1];
        file_uuid = JSON.parse(file_uuid);
        file_uuid = file_uuid['associationIds'];
        return file_uuid;
    } catch (e) {
        return file_uuid;
    }
}

FileUploadJob.prototype.getRelativeFilePath = function() {
    var path = null;

    if (this.filePath.length == 0) return path;
    if (this.projectUuid.length == 0) return path;

    // urlencode filename, otherwise nonalphanumeric characters can cause Agave errors
    path = this.projectUuid + '/files/' + encodeURIComponent(this.filePath);
    return path;
}

FileUploadJob.prototype.createAgaveFileMetadata = async function() {

    var fileMetadata = await agaveIO.getProjectFileMetadataByFilename(this.projectUuid, this.fileUuid)
        .catch(function(error) {
            return Promise.reject(new Error('FileUploadJob.createAgaveFileMetadata - agaveIO.getProjectFileMetadataByFilename, error ' + error));
        });

    if (fileMetadata.length > 1) {
        return Promise.reject(new Error('FileUploadJob.createAgaveFileMetadata - multiple file metadata: ' + fileMetadata));
    }

    if (fileMetadata.length == 1) {
        console.log('VDJ-API INFO: FileUploadJob.createAgaveFileMetadata - metadata already exists, skipping creation.');
        return Promise.resolve(fileMetadata[0]);
    }

    var fileDetail = await agaveIO.getFileDetail(this.getRelativeFilePath())
        .catch(function(error) {
            return Promise.reject(new Error('FileUploadJob.createAgaveFileMetadata - agaveIO.getFileDetail, error ' + error));
        });

    var length = fileDetail[0].length;
    var name = fileDetail[0].name;

    // TODO: these file types need to be consistent with GUI
    const defaultVdjFileType = 4;

    // VDJ File Type
    if (_.isEmpty(this.vdjFileType) === false) {
        try {
            this.vdjFileType = parseInt(this.vdjFileType);
        }
        catch (e) {
            this.vdjFileType = defaultVdjFileType;
        }
    }
    else {
        this.vdjFileType = defaultVdjFileType;
    }

    // Read Direction
    if (_.isEmpty(this.readDirection) === true) {
        this.readDirection = '';
    }

    // Tags
    if (_.isEmpty(this.tags) === true) {
        this.tags = [];
    }
    else {
        var splitTags = this.tags.split(',');
        var tags = splitTags.map(function(tag) {
            return tag.trim();
        });
        this.tags = tags;
    }

    return agaveIO.createFileMetadata(this.fileUuid, this.projectUuid, this.vdjFileType, name, length, this.readDirection, this.tags);
};

FileUploadJob.prototype.checkFileAvailability = async function() {

    var path = this.getRelativeFilePath();

    var isAvailable = false;

    // if the file was manually copied to the storage system, requesting the file details
    // will cause Tapis to create the file uuid and an empty history
    var detail = await agaveIO.getFileDetail(path)
        .catch(function(error) {
            return Promise.reject(new Error('Could not get file detail for path: ' + path));
        });
    if (!detail) {
        return Promise.reject(new Error('Could not get file detail for path: ' + path));
    }
    if (detail.length != 1) {
        return Promise.reject(new Error('Invalid length (!= 1) for file detail query for path: ' + path));
    }
    detail = detail[0];
    if (detail.format == 'folder') {
        return Promise.reject(new Error('file path: ' + path + ' is a directory.'))
    }

    // check file uuid is the same
    var file_uuid = extractFileUUID(detail);
    if (!file_uuid) {
        return Promise.reject(new Error('Could not extract uuid from file detail: ' + JSON.stringify(detail)));
    }
    if (file_uuid != this.fileUuid) {
        return Promise.reject(new Error('fileUuid: ' + this.fileUuid + ' does not match uuid ' + file_uuid + ' for filePath: ' + path));
    }

    var fileHistory = await agaveIO.getFileHistory(path)
        .catch(function(error) {
            return Promise.reject(new Error('Could not get file history for path: ' + path));
        });

    // empty history suggest file was manually copied
    if (fileHistory.length == 0) {        
        return Promise.resolve(true);
    }

    // check if staging is complete
    for (let i = 0; i < fileHistory.length; i++) {
        let history = fileHistory[i];
        if (history.hasOwnProperty('status') && history.status === 'STAGING_COMPLETED') {
            return Promise.resolve(true);
        }
    }

    return Promise.resolve(false);
}

// Initial check when a file import notification is received
FileUploadJob.prototype.verifyFileNotification = async function() {

    if (this.filePath.length == 0) return Promise.reject(new Error('Missing filePath'));
    if (this.projectUuid.length == 0) return Promise.reject(new Error('Missing projectUuid'));

    var retry = false;
    var path = this.getRelativeFilePath();
    var detail = await agaveIO.getFileDetail(path)
        .catch(function(error) {
            // if we get an error, Tapis might be slow in staging, wait and retry
            retry = true;
            console.log('Could not get file detail for path: ' + path + ', will retry.');
        });

    if (retry) {
        console.log('Retry get file detail for path: ' + path);
        const timer = ms => new Promise(res => setTimeout(res, ms));
        await timer(30000);
        detail = await agaveIO.getFileDetail(path)
            .catch(function(error) {
                return Promise.reject(new Error('Could not get file detail for path: ' + path));
            });
    }

    if (!detail) {
        return Promise.reject(new Error('Could not get file detail for path: ' + path));
    }
    if (detail.length != 1) {
        return Promise.reject(new Error('Invalid length (!= 1) for file detail query for path: ' + path));
    }
    detail = detail[0];
    if (detail.format == 'folder') {
        return Promise.reject(new Error('file path: ' + path + ' is a directory.'))
    }

    // extract the file uuid from the detail
    var file_uuid = extractFileUUID(detail);
    if (!file_uuid) {
        return Promise.reject(new Error('Could not extract uuid from file detail: ' + JSON.stringify(detail)));
    }
    console.log(file_uuid);
    this.fileUuid = file_uuid;
    console.log(JSON.stringify(this));

    return Promise.resolve();
}
