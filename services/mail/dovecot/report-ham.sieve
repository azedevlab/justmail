require ["vnd.dovecot.pipe", "copy", "imapsieve", "environment", "variables"];

# Fired when a message is moved out of Junk into any other folder. Skip Trash
# (deleting spam isn't a ham signal), then stream it to rspamd for ham training.
if environment :matches "imap.mailbox" "*" {
  set "mailbox" "${1}";
}
if string "${mailbox}" "Trash" {
  stop;
}
pipe :copy "learn-ham.sh";
