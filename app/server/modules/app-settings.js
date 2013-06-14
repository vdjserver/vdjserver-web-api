
// You will need to have valid vdjserver.key and vdjserver.cer files in the directory listed below.

var fs = require('fs');

module.exports = {

    vdjKey      : fs.readFileSync(__dirname + '/../vendor/vdjserver.org.certificate/vdjserver.org.key'),
    vdjCert     : fs.readFileSync(__dirname + '/../vendor/vdjserver.org.certificate/vdjserver.org.cer')

};
