#!/bin/bash
# Based on: https://github.com/jacksoncage/nginx-docker

# Using environment variables to set postfix configuration

[ -z "${POSTFIX_RELAYHOST}" ] && echo "\$POSTFIX_RELAYHOST is not set" || sed -i "s:POSTFIX_RELAYHOST:${POSTFIX_RELAYHOST}:" /etc/postfix/main.cf
[ -z "${POSTFIX_HOSTNAME}" ] && echo "\$POSTFIX_HOSTNAME is not set" || sed -i "s:POSTFIX_HOSTNAME:${POSTFIX_HOSTNAME}:" /etc/postfix/main.cf
[ -z "${POSTFIX_HOSTNAME}" ] && echo "\$POSTFIX_HOSTNAME is not set" || echo ${POSTFIX_HOSTNAME} >> /etc/mailname

service postfix start
/usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
