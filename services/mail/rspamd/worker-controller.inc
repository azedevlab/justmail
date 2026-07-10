# Controller worker: receives Bayes learn requests from Dovecot IMAPSieve.
# Bound on all interfaces so the dovecot container can reach it over the `mail`
# network; the port is never published to the host, and learning requires the
# controller password.
#
# rspamd's jinja `env` only exposes OS vars prefixed with RSPAMD_, and strips
# that prefix — so RSPAMD_CONTROLLER_PASSWORD is referenced as env.CONTROLLER_PASSWORD.
bind_socket = "*:11334";
password = "{= env.CONTROLLER_PASSWORD =}";
enable_password = "{= env.CONTROLLER_PASSWORD =}";
