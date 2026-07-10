require ["vnd.dovecot.pipe", "copy", "imapsieve", "environment", "variables"];

# Fired when a message is copied/appended into Junk. Skip Trash churn, then
# stream the raw message to the rspamd controller for spam training.
if environment :matches "imap.mailbox" "*" {
  set "mailbox" "${1}";
}
if string "${mailbox}" "Trash" {
  stop;
}
pipe :copy "learn-spam.sh";
