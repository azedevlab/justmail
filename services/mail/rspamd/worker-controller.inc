# Controller worker: receives Bayes learn requests from Dovecot IMAPSieve.
# Bound on all interfaces so the dovecot container can reach it over the `mail`
# network; the port is never published to the host, and learning requires the
# controller password.
bind_socket = "*:11334";
password = "{= env.RSPAMD_CONTROLLER_PASSWORD =}";
enable_password = "{= env.RSPAMD_CONTROLLER_PASSWORD =}";
