# Nakna HR V1.0-P7.2 QA Hotfix

Fixed in this pass:
- Initial login screen flash while restoring an existing session.
- Restored/open dialogs appearing on refresh or bfcache return.
- Cancel/X buttons blocked by native required-field validation.
- Missing leave evidence upload handler.
- Generic modal save label/state leaking from previous modal usage.
- Google connection wording simplified for normal Gmail accounts.
- Dashboard initial data loading is concurrency-limited (6 requests) instead of firing every module at once.
- Added static audit script for duplicate IDs, bindEvents DOM references, inline handlers, and cancel safety.

No database migration is required for P7.2.
