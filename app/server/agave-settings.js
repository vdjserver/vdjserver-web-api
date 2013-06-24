//modify "agaveUser", "agavePass", and "basicAuth" lines below, replace "USERNAME" with a username and "PASSWORD" with a password. Duh.

module.exports = {

    agaveAuthHost       : 'iplant-vm.tacc.utexas.edu',
    agaveAuthBase       : 'https://iplant-vm.tacc.utexas.edu/',
    agaveAuth           : '/auth-v2/',

    agaveHost           : 'iplant-dev.tacc.utexas.edu',
    agaveRegInternal    : '/v2/profiles/wscarbor/users/',
    agaveUser           : 'USERNAME',
    agavePass           : 'PASSWORD',
    basicAuth           : 'Basic ' + new Buffer('USERNAME:PASSWORD').toString('base64')

};
