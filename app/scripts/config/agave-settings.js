
var authenticatedUser = 'wscarbor';
var apiVersion        = '/v2';

module.exports = {

    // API Settings
    host              : 'iplant-dev.tacc.utexas.edu',
    apiVersion        : apiVersion,

    // Auth Settings
    authenticatedUser : authenticatedUser,
    authenticatedUserPassword : 'oK3DVZOFRGD2WVTT9mR6wNZhEXSdgoslpuBI8lH7Eh5BjXdPmr',
    tokenAuth: '',

    // Endpoints
    authEndpoint : apiVersion + '/auth/',
    createInternalUserEndpoint: apiVersion + '/profiles/' + authenticatedUser + '/users'

};
