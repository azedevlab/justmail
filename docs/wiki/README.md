# Wiki source

These Markdown files are the source for the project
[GitHub Wiki](https://github.com/azedevlab/justmail/wiki). GitHub stores a wiki
as a separate git repository (`<repo>.wiki.git`) that only comes into existence
after the **first page is created in the web UI**.

## Publishing

1. Visit https://github.com/azedevlab/justmail/wiki and click **Create the
   first page** — save any placeholder text. This initializes `justmail.wiki.git`.
2. Publish these pages:

   ```bash
   git clone https://github.com/azedevlab/justmail.wiki.git
   cp docs/wiki/*.md justmail.wiki/
   cd justmail.wiki
   git add -A && git commit -m "Sync wiki from docs/wiki" && git push
   ```

Keep edits here in `docs/wiki/` (reviewed via PR), then re-run step 2 to sync.
