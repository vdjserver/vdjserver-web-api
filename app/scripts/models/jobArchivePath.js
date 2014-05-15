
'use strict';

var JobArchivePath = function(path) {
    this.path = path || '';
};

JobArchivePath.prototype.getProjectUuid = function() {

    var split = this.path.split('/');

    // split is: ["","projects","0001399309581559-5056a550b8-0001-012","analyses","2014-05-05-14-46-04-15"]
    return split[2];
};

module.exports = JobArchivePath;
